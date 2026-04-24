import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { can, hasFeature } from "@/lib/permissions"
import type { Plan } from "@/lib/utils"
import { getOpenAI } from "@/lib/openai"
import { subDays, startOfDay, endOfDay, format, differenceInDays } from "date-fns"

async function getPlan(tenantId: string): Promise<Plan> {
  const sub = await db.subscription.findUnique({
    where: { tenantId },
    select: { plan: true },
  })
  return (sub?.plan as Plan) ?? "FREE"
}

interface DayHourCell {
  day: number // 0=Sunday, 6=Saturday
  hour: number // 0-23
  count: number
  total: number
}

interface PeriodMetrics {
  revenue: number
  profit: number
  cost: number
  salesCount: number
  avgTicket: number
  itemsSold: number
}

async function computePeriodMetrics(
  tenantId: string,
  from: Date,
  to: Date
): Promise<PeriodMetrics> {
  const sales = await db.sale.findMany({
    where: {
      tenantId,
      status: "COMPLETED",
      createdAt: { gte: from, lte: to },
    },
    select: {
      total: true,
      items: { select: { costPrice: true, quantity: true, subtotal: true } },
    },
  })

  const revenue = sales.reduce((a, s) => a + Number(s.total), 0)
  const cost = sales.reduce(
    (a, s) =>
      a + s.items.reduce((b, i) => b + Number(i.costPrice) * i.quantity, 0),
    0
  )
  const itemsSold = sales.reduce(
    (a, s) => a + s.items.reduce((b, i) => b + i.quantity, 0),
    0
  )
  return {
    revenue,
    cost,
    profit: revenue - cost,
    salesCount: sales.length,
    avgTicket: sales.length > 0 ? revenue / sales.length : 0,
    itemsSold,
  }
}

export async function GET(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error) return error

  if (!can(session?.user?.role, "reports:read")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  const plan = await getPlan(tenantId!)
  if (!hasFeature(plan, "feature:reports_full")) {
    return NextResponse.json(
      { error: "Reportes avanzados disponibles desde plan Profesional", code: "FEATURE_LOCKED" },
      { status: 402 }
    )
  }

  const { searchParams } = new URL(req.url)
  const fromStr = searchParams.get("from")
  const toStr = searchParams.get("to")
  const withAI = searchParams.get("ai") === "true"

  const to = toStr ? new Date(toStr) : endOfDay(new Date())
  const from = fromStr ? new Date(fromStr) : startOfDay(subDays(to, 30))
  const periodDays = Math.max(1, differenceInDays(to, from))

  // Previous period for comparison
  const prevTo = new Date(from.getTime() - 1)
  const prevFrom = subDays(prevTo, periodDays)

  try {
    const [current, previous] = await Promise.all([
      computePeriodMetrics(tenantId!, from, to),
      computePeriodMetrics(tenantId!, prevFrom, prevTo),
    ])

    // Percent change helper
    const pctChange = (curr: number, prev: number) => {
      if (prev === 0 && curr === 0) return 0
      if (prev === 0) return 100
      return ((curr - prev) / prev) * 100
    }

    const changes = {
      revenue: pctChange(current.revenue, previous.revenue),
      profit: pctChange(current.profit, previous.profit),
      salesCount: pctChange(current.salesCount, previous.salesCount),
      avgTicket: pctChange(current.avgTicket, previous.avgTicket),
    }

    // Heatmap: day × hour
    const salesRaw = await db.sale.findMany({
      where: {
        tenantId: tenantId!,
        status: "COMPLETED",
        createdAt: { gte: from, lte: to },
      },
      select: {
        createdAt: true,
        total: true,
        items: {
          select: {
            productName: true,
            quantity: true,
            costPrice: true,
            subtotal: true,
            product: {
              select: {
                categoryId: true,
                category: { select: { name: true } },
              },
            },
          },
        },
      },
    })

    const heatmapMap = new Map<string, DayHourCell>()
    for (const s of salesRaw) {
      const d = s.createdAt.getDay()
      const h = s.createdAt.getHours()
      const key = `${d}-${h}`
      const curr = heatmapMap.get(key) ?? { day: d, hour: h, count: 0, total: 0 }
      curr.count += 1
      curr.total += Number(s.total)
      heatmapMap.set(key, curr)
    }
    const heatmap = [...heatmapMap.values()]

    // Top categories
    const catMap = new Map<string, { revenue: number; cost: number; qty: number }>()
    for (const s of salesRaw) {
      for (const it of s.items) {
        const cat = it.product?.category?.name ?? "Sin categoría"
        const curr = catMap.get(cat) ?? { revenue: 0, cost: 0, qty: 0 }
        curr.revenue += Number(it.subtotal)
        curr.cost += Number(it.costPrice) * it.quantity
        curr.qty += it.quantity
        catMap.set(cat, curr)
      }
    }
    const topCategories = [...catMap.entries()]
      .map(([name, v]) => ({
        name,
        revenue: v.revenue,
        profit: v.revenue - v.cost,
        qty: v.qty,
        marginPct: v.revenue > 0 ? ((v.revenue - v.cost) / v.revenue) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)

    // Top products by margin (most profitable per unit)
    const productMarginMap = new Map<string, { revenue: number; cost: number; qty: number }>()
    for (const s of salesRaw) {
      for (const it of s.items) {
        const curr = productMarginMap.get(it.productName) ?? { revenue: 0, cost: 0, qty: 0 }
        curr.revenue += Number(it.subtotal)
        curr.cost += Number(it.costPrice) * it.quantity
        curr.qty += it.quantity
        productMarginMap.set(it.productName, curr)
      }
    }
    const topByMargin = [...productMarginMap.entries()]
      .filter(([, v]) => v.qty >= 2) // at least 2 units sold
      .map(([name, v]) => ({
        name,
        revenue: v.revenue,
        profit: v.revenue - v.cost,
        qty: v.qty,
        marginPct: v.revenue > 0 ? ((v.revenue - v.cost) / v.revenue) * 100 : 0,
      }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5)

    // Expenses in period (for net profit comparison)
    const expensesAgg = await db.expense.aggregate({
      where: {
        tenantId: tenantId!,
        createdAt: { gte: from, lte: to },
      },
      _sum: { amount: true },
    })
    const totalExpenses = Number(expensesAgg._sum.amount ?? 0)
    const netProfit = current.profit - totalExpenses

    // AI Insights (optional, only if requested + plan allows)
    let aiInsights: {
      summary: string
      highlights: string[]
      recommendations: string[]
    } | null = null

    if (withAI && hasFeature(plan, "feature:ai_assistant")) {
      try {
        const digest = {
          period: {
            from: format(from, "yyyy-MM-dd"),
            to: format(to, "yyyy-MM-dd"),
            days: periodDays,
          },
          current,
          previous,
          changes,
          topCategories: topCategories.slice(0, 5),
          topByMargin: topByMargin.slice(0, 5),
          peakHour: heatmap.sort((a, b) => b.total - a.total)[0] ?? null,
          expenses: totalExpenses,
          netProfit,
        }

        const openai = getOpenAI()
        const resp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `Sos un analista de negocios para un comerciante argentino (kiosco/almacén).
Tu tarea: leer un resumen numérico y devolver insights útiles, breves y accionables.

Responde en JSON exacto:
{
  "summary": "Un párrafo de 1-2 oraciones con el estado general del negocio en este período",
  "highlights": ["punto destacado 1", "punto destacado 2", "punto destacado 3"] (máximo 4, máximo 15 palabras cada uno),
  "recommendations": ["recomendación concreta 1", "recomendación 2"] (máximo 3, accionables, en imperativo)
}

Reglas:
- Pesos argentinos con separador miles punto: "$ 12.345"
- Comparaciones con el período anterior cuando aplique
- Menciona productos/categorías por nombre exacto
- Recomendaciones deben ser ESPECÍFICAS (no "vendé más"), basadas en datos.
- Tono amigable, español rioplatense.`,
            },
            {
              role: "user",
              content: `Analizá este resumen y devolvé JSON con summary/highlights/recommendations:\n${JSON.stringify(digest, null, 2)}`,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
          max_tokens: 800,
        })

        const raw = resp.choices[0]?.message?.content ?? "{}"
        aiInsights = JSON.parse(raw)
      } catch (err) {
        console.error("[reportes/insights] AI failed:", err)
        // Non-fatal: still return the numeric data
      }
    }

    return NextResponse.json({
      period: { from: from.toISOString(), to: to.toISOString(), days: periodDays },
      current,
      previous,
      changes,
      heatmap,
      topCategories,
      topByMargin,
      expenses: totalExpenses,
      netProfit,
      aiInsights,
    })
  } catch (err) {
    console.error("[reportes/insights]", err)
    return NextResponse.json({ error: "Error generando insights" }, { status: 500 })
  }
}
