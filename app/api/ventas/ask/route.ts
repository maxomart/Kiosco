import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { can, hasFeature } from "@/lib/permissions"
import type { Plan } from "@/lib/utils"
import { getOpenAI } from "@/lib/openai"
import { z } from "zod"
import { subDays, format } from "date-fns"

async function getPlan(tenantId: string): Promise<Plan> {
  const sub = await db.subscription.findUnique({
    where: { tenantId },
    select: { plan: true },
  })
  return (sub?.plan as Plan) ?? "FREE"
}

const schema = z.object({
  question: z.string().trim().min(2).max(300),
  /** Optional range narrowing; default = last 30 days */
  days: z.number().int().min(1).max(365).default(30),
})

interface SaleDigest {
  totalSales: number
  completedSales: number
  cancelledSales: number
  totalRevenue: number
  totalCost: number
  totalProfit: number
  avgTicket: number
  topProducts: Array<{ name: string; qty: number; revenue: number }>
  topHours: Array<{ hour: number; count: number; total: number }>
  topWeekdays: Array<{ day: string; count: number; total: number }>
  byMethod: Array<{ method: string; count: number; total: number }>
  byDay: Array<{ date: string; total: number; count: number }>
  periodFrom: string
  periodTo: string
}

async function buildDigest(tenantId: string, days: number): Promise<SaleDigest> {
  const to = new Date()
  const from = subDays(to, days)

  const sales = await db.sale.findMany({
    where: {
      tenantId,
      createdAt: { gte: from, lte: to },
    },
    select: {
      id: true,
      total: true,
      status: true,
      paymentMethod: true,
      createdAt: true,
      items: {
        select: {
          productName: true,
          quantity: true,
          unitPrice: true,
          costPrice: true,
          subtotal: true,
        },
      },
    },
    take: 5000, // safety cap
  })

  const completed = sales.filter((s) => s.status === "COMPLETED")
  const cancelled = sales.filter((s) => s.status === "CANCELLED")
  const totalRevenue = completed.reduce((a, s) => a + Number(s.total), 0)
  const totalCost = completed.reduce(
    (a, s) =>
      a + s.items.reduce((b, i) => b + Number(i.costPrice) * i.quantity, 0),
    0
  )
  const totalProfit = totalRevenue - totalCost
  const avgTicket = completed.length > 0 ? totalRevenue / completed.length : 0

  // Top products by revenue
  const productMap = new Map<string, { qty: number; revenue: number }>()
  for (const s of completed) {
    for (const it of s.items) {
      const curr = productMap.get(it.productName) ?? { qty: 0, revenue: 0 }
      curr.qty += it.quantity
      curr.revenue += Number(it.subtotal)
      productMap.set(it.productName, curr)
    }
  }
  const topProducts = [...productMap.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  // By hour
  const hourMap = new Map<number, { count: number; total: number }>()
  for (const s of completed) {
    const h = s.createdAt.getHours()
    const curr = hourMap.get(h) ?? { count: 0, total: 0 }
    curr.count += 1
    curr.total += Number(s.total)
    hourMap.set(h, curr)
  }
  const topHours = [...hourMap.entries()]
    .map(([hour, v]) => ({ hour, ...v }))
    .sort((a, b) => b.total - a.total)

  // By weekday
  const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
  const wdMap = new Map<number, { count: number; total: number }>()
  for (const s of completed) {
    const d = s.createdAt.getDay()
    const curr = wdMap.get(d) ?? { count: 0, total: 0 }
    curr.count += 1
    curr.total += Number(s.total)
    wdMap.set(d, curr)
  }
  const topWeekdays = [...wdMap.entries()]
    .map(([d, v]) => ({ day: WEEKDAYS[d], ...v }))
    .sort((a, b) => b.total - a.total)

  // By method
  const methodMap = new Map<string, { count: number; total: number }>()
  for (const s of completed) {
    const curr = methodMap.get(s.paymentMethod) ?? { count: 0, total: 0 }
    curr.count += 1
    curr.total += Number(s.total)
    methodMap.set(s.paymentMethod, curr)
  }
  const byMethod = [...methodMap.entries()]
    .map(([method, v]) => ({ method, ...v }))
    .sort((a, b) => b.total - a.total)

  // Daily series
  const dayMap = new Map<string, { count: number; total: number }>()
  for (const s of completed) {
    const k = format(s.createdAt, "yyyy-MM-dd")
    const curr = dayMap.get(k) ?? { count: 0, total: 0 }
    curr.count += 1
    curr.total += Number(s.total)
    dayMap.set(k, curr)
  }
  const byDay = [...dayMap.entries()]
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    totalSales: sales.length,
    completedSales: completed.length,
    cancelledSales: cancelled.length,
    totalRevenue,
    totalCost,
    totalProfit,
    avgTicket,
    topProducts,
    topHours,
    topWeekdays,
    byMethod,
    byDay,
    periodFrom: format(from, "yyyy-MM-dd"),
    periodTo: format(to, "yyyy-MM-dd"),
  }
}

const SYSTEM_PROMPT = `Sos un asistente de ventas para un comerciante argentino (kiosco, almacén, minimarket).
Te damos un RESUMEN numérico de las ventas en JSON, y el usuario te hace preguntas.

Reglas:
- Respondé SOLO con datos del resumen dado. Si no se puede responder con los datos, decilo amablemente.
- Usá pesos argentinos con separador miles punto ($ 1.250).
- Sé breve: 1-3 oraciones o una lista corta.
- Nunca inventes productos o montos que no estén en los datos.
- Si te preguntan por tendencias, compará periodos o días disponibles.
- Si te preguntan acciones ("qué conviene hacer"), sugerí 1-2 cosas concretas basadas en los datos.
- Responde en español rioplatense natural, sin tecnicismos.`

export async function POST(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })

  if (!can(session.user.role, "sales:read")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  const plan = await getPlan(tenantId!)
  if (!hasFeature(plan, "feature:ai_assistant")) {
    return NextResponse.json(
      { error: "Asistente IA no incluido en tu plan", code: "FEATURE_LOCKED", requiredPlan: "PROFESSIONAL" },
      { status: 402 }
    )
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { question, days } = parsed.data

  try {
    const digest = await buildDigest(tenantId!, days)

    const openai = getOpenAI()
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `RESUMEN DE VENTAS (${days} días, ${digest.periodFrom} al ${digest.periodTo}):
${JSON.stringify(digest, null, 2)}

Pregunta del usuario: "${question}"`,
        },
      ],
      temperature: 0.4,
      max_tokens: 600,
    })

    const answer = resp.choices[0]?.message?.content?.trim() ?? "No pude procesar la respuesta."

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          action: "AI_SALES_QUERY",
          entity: "Sale",
          entityId: null,
          userId: session.user.id!,
          newValue: JSON.stringify({ question, days }).slice(0, 1000),
        },
      })
    } catch { /* non-fatal */ }

    return NextResponse.json({
      answer,
      digest: {
        period: { from: digest.periodFrom, to: digest.periodTo, days },
        totals: {
          revenue: digest.totalRevenue,
          profit: digest.totalProfit,
          completed: digest.completedSales,
          avgTicket: digest.avgTicket,
        },
      },
    })
  } catch (err) {
    console.error("[ventas/ask]", err)
    return NextResponse.json({ error: "No se pudo generar la respuesta" }, { status: 502 })
  }
}
