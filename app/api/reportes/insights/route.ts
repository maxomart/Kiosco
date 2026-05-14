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
  day: number
  hour: number
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

/**
 * Métricas del período anterior — usa aggregates Prisma en vez de cargar
 * sales+items. Mucho más rápido que computar todo desde objects JS.
 */
async function computePreviousMetrics(
  tenantId: string,
  from: Date,
  to: Date
): Promise<PeriodMetrics> {
  const where = {
    tenantId,
    status: "COMPLETED" as const,
    createdAt: { gte: from, lte: to },
  }
  const [saleAgg, itemAgg] = await Promise.all([
    db.sale.aggregate({
      where,
      _sum: { total: true },
      _count: true,
      _avg: { total: true },
    }),
    // Aggregate sobre saleItem para obtener cost total + items vendidos sin
    // cargar todas las filas en memoria.
    db.saleItem.findMany({
      where: { sale: where },
      select: { costPrice: true, quantity: true },
    }),
  ])
  const revenue = Number(saleAgg._sum.total ?? 0)
  const cost = itemAgg.reduce((a, i) => a + Number(i.costPrice) * i.quantity, 0)
  const itemsSold = itemAgg.reduce((a, i) => a + i.quantity, 0)
  return {
    revenue,
    cost,
    profit: revenue - cost,
    salesCount: saleAgg._count,
    avgTicket: Number(saleAgg._avg.total ?? 0),
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

  const prevTo = new Date(from.getTime() - 1)
  const prevFrom = subDays(prevTo, periodDays)

  try {
    // UNA sola findMany de sales+items para el período actual.
    // Cubre: metrics current + heatmap + dayBreakdown + topCategories + topByMargin.
    // En paralelo: aggregates baratos de período anterior + expenses.
    const [salesRaw, previous, expensesAgg] = await Promise.all([
      db.sale.findMany({
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
      }),
      computePreviousMetrics(tenantId!, prevFrom, prevTo),
      db.expense.aggregate({
        where: { tenantId: tenantId!, createdAt: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
    ])

    // === Compute current metrics from the single salesRaw load ===
    let revenue = 0
    let cost = 0
    let itemsSold = 0
    for (const s of salesRaw) {
      revenue += Number(s.total)
      for (const it of s.items) {
        cost += Number(it.costPrice) * it.quantity
        itemsSold += it.quantity
      }
    }
    const current: PeriodMetrics = {
      revenue,
      cost,
      profit: revenue - cost,
      salesCount: salesRaw.length,
      avgTicket: salesRaw.length > 0 ? revenue / salesRaw.length : 0,
      itemsSold,
    }

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

    // === Heatmap + dayBreakdown + categorías + márgenes en UN solo loop ===
    const heatmapMap = new Map<string, DayHourCell>()
    const dayBreakdownMap = new Map<
      string,
      { day: number; date: string; count: number; total: number }
    >()
    const catMap = new Map<string, { revenue: number; cost: number; qty: number }>()
    const productMarginMap = new Map<
      string,
      { revenue: number; cost: number; qty: number }
    >()

    for (const s of salesRaw) {
      const ts = s.createdAt
      const d = ts.getDay()
      const h = ts.getHours()
      const saleTotal = Number(s.total)

      // Heatmap
      const hmKey = `${d}-${h}`
      const hm = heatmapMap.get(hmKey) ?? { day: d, hour: h, count: 0, total: 0 }
      hm.count += 1
      hm.total += saleTotal
      heatmapMap.set(hmKey, hm)

      // Day breakdown (cada lunes/martes/etc específico)
      const y = ts.getFullYear()
      const mStr = String(ts.getMonth() + 1).padStart(2, "0")
      const dStr = String(ts.getDate()).padStart(2, "0")
      const dateKey = `${y}-${mStr}-${dStr}`
      const dbKey = `${d}-${dateKey}`
      const dbEntry =
        dayBreakdownMap.get(dbKey) ?? { day: d, date: dateKey, count: 0, total: 0 }
      dbEntry.count += 1
      dbEntry.total += saleTotal
      dayBreakdownMap.set(dbKey, dbEntry)

      // Categories + product margins
      for (const it of s.items) {
        const cat = it.product?.category?.name ?? "Sin categoría"
        const catCurr = catMap.get(cat) ?? { revenue: 0, cost: 0, qty: 0 }
        catCurr.revenue += Number(it.subtotal)
        catCurr.cost += Number(it.costPrice) * it.quantity
        catCurr.qty += it.quantity
        catMap.set(cat, catCurr)

        const pmCurr =
          productMarginMap.get(it.productName) ?? { revenue: 0, cost: 0, qty: 0 }
        pmCurr.revenue += Number(it.subtotal)
        pmCurr.cost += Number(it.costPrice) * it.quantity
        pmCurr.qty += it.quantity
        productMarginMap.set(it.productName, pmCurr)
      }
    }

    const heatmap = [...heatmapMap.values()]
    const dayBreakdown = [...dayBreakdownMap.values()].sort((a, b) =>
      a.date.localeCompare(b.date)
    )

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

    const topByMargin = [...productMarginMap.entries()]
      .filter(([, v]) => v.qty >= 2)
      .map(([name, v]) => ({
        name,
        revenue: v.revenue,
        profit: v.revenue - v.cost,
        qty: v.qty,
        marginPct: v.revenue > 0 ? ((v.revenue - v.cost) / v.revenue) * 100 : 0,
      }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5)

    const totalExpenses = Number(expensesAgg._sum.amount ?? 0)
    const netProfit = current.profit - totalExpenses

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
          peakHour: [...heatmap].sort((a, b) => b.total - a.total)[0] ?? null,
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
      }
    }

    return NextResponse.json({
      period: { from: from.toISOString(), to: to.toISOString(), days: periodDays },
      current,
      previous,
      changes,
      heatmap,
      dayBreakdown,
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
