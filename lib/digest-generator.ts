import { db } from "@/lib/db"
import { sendEmail } from "@/lib/email"
import { renderDigestEmail, renderLowStockEmail } from "@/lib/email-templates"
import { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from "date-fns"
import { es } from "date-fns/locale"
import { hasFeature } from "@/lib/permissions"
import type { Plan } from "@/lib/utils"

export type DigestPeriod = "daily" | "weekly" | "monthly"

interface DigestRange {
  from: Date
  to: Date
  prevFrom: Date
  prevTo: Date
  label: string
}

function buildRange(period: DigestPeriod): DigestRange {
  const now = new Date()
  if (period === "daily") {
    const from = startOfDay(now)
    const to = endOfDay(now)
    const prevFrom = startOfDay(subDays(now, 1))
    const prevTo = endOfDay(subDays(now, 1))
    return { from, to, prevFrom, prevTo, label: format(now, "EEEE d 'de' MMMM 'de' yyyy", { locale: es }) }
  }
  if (period === "weekly") {
    const from = startOfWeek(now, { weekStartsOn: 1 })
    const to = endOfWeek(now, { weekStartsOn: 1 })
    const prevFrom = startOfWeek(subDays(from, 1), { weekStartsOn: 1 })
    const prevTo = endOfWeek(subDays(from, 1), { weekStartsOn: 1 })
    return { from, to, prevFrom, prevTo, label: `Semana del ${format(from, "d 'de' MMM", { locale: es })} al ${format(to, "d 'de' MMM 'de' yyyy", { locale: es })}` }
  }
  // monthly
  const from = startOfMonth(now)
  const to = endOfMonth(now)
  const prevFrom = startOfMonth(subDays(from, 1))
  const prevTo = endOfMonth(subDays(from, 1))
  return { from, to, prevFrom, prevTo, label: format(now, "MMMM yyyy", { locale: es }) }
}

interface PeriodMetrics {
  revenue: number
  cost: number
  profit: number
  salesCount: number
  itemsSold: number
  avgTicket: number
  topProducts: Array<{ name: string; qty: number; revenue: number }>
  byMethod: Array<{ method: string; count: number; total: number }>
}

async function computeMetrics(tenantId: string, from: Date, to: Date): Promise<PeriodMetrics> {
  const sales = await db.sale.findMany({
    where: { tenantId, status: "COMPLETED", createdAt: { gte: from, lte: to } },
    select: {
      total: true,
      paymentMethod: true,
      items: { select: { productName: true, quantity: true, costPrice: true, subtotal: true } },
    },
  })

  const revenue = sales.reduce((a, s) => a + Number(s.total), 0)
  const cost = sales.reduce(
    (a, s) => a + s.items.reduce((b, i) => b + Number(i.costPrice) * i.quantity, 0),
    0
  )
  const itemsSold = sales.reduce((a, s) => a + s.items.reduce((b, i) => b + i.quantity, 0), 0)

  const productMap = new Map<string, { qty: number; revenue: number }>()
  for (const s of sales) {
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

  const methodMap = new Map<string, { count: number; total: number }>()
  for (const s of sales) {
    const curr = methodMap.get(s.paymentMethod) ?? { count: 0, total: 0 }
    curr.count += 1
    curr.total += Number(s.total)
    methodMap.set(s.paymentMethod, curr)
  }
  const byMethod = [...methodMap.entries()]
    .map(([method, v]) => ({ method, ...v }))
    .sort((a, b) => b.total - a.total)

  return {
    revenue,
    cost,
    profit: revenue - cost,
    salesCount: sales.length,
    itemsSold,
    avgTicket: sales.length > 0 ? revenue / sales.length : 0,
    topProducts,
    byMethod,
  }
}

async function maybeAIInsights(
  tenantId: string,
  current: PeriodMetrics,
  previous: PeriodMetrics,
  period: DigestPeriod,
  plan: Plan
): Promise<{ summary: string; highlights: string[]; recommendations: string[] } | null> {
  if (!hasFeature(plan, "feature:ai_assistant")) return null
  if (!process.env.OPENAI_API_KEY) return null

  try {
    const { getOpenAI } = await import("@/lib/openai")
    const openai = getOpenAI()

    const periodLabel = period === "daily" ? "día" : period === "weekly" ? "semana" : "mes"
    const digest = {
      period: periodLabel,
      current: {
        revenue: current.revenue,
        profit: current.profit,
        salesCount: current.salesCount,
        avgTicket: current.avgTicket,
      },
      previous: {
        revenue: previous.revenue,
        profit: previous.profit,
        salesCount: previous.salesCount,
      },
      topProducts: current.topProducts.slice(0, 5),
    }

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Sos un analista de negocios para un kiosco argentino. Te paso datos del ${periodLabel} y respondes JSON con:
{
  "summary": "1-2 oraciones describiendo cómo fue el ${periodLabel}, comparando con el anterior",
  "highlights": ["max 3 puntos breves, 12 palabras max c/u"],
  "recommendations": ["max 2 acciones concretas, basadas en los datos"]
}
Reglas: pesos argentinos con punto miles ($ 12.345). Mencionar productos/montos reales. Tono natural rioplatense.`,
        },
        {
          role: "user",
          content: JSON.stringify(digest),
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 600,
    })
    const raw = resp.choices[0]?.message?.content ?? "{}"
    return JSON.parse(raw)
  } catch (err) {
    console.error("[digest] AI failed:", err)
    return null
  }
}

/**
 * Send a digest email to the tenant (if configured for that period).
 * Returns true if sent, false if skipped (no email, not enabled, etc.)
 */
export async function sendDigestForTenant(
  tenantId: string,
  period: DigestPeriod,
  options: { force?: boolean } = {}
): Promise<{ sent: boolean; reason?: string }> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    include: {
      config: true,
      subscription: { select: { plan: true } },
      users: { where: { role: "OWNER" }, select: { email: true }, take: 1 },
    },
  })
  if (!tenant || !tenant.active) return { sent: false, reason: "tenant_inactive" }

  const cfg = tenant.config as any
  const enabled =
    period === "daily" ? cfg?.emailDailySummary :
    period === "weekly" ? cfg?.emailWeeklySummary :
    cfg?.emailMonthlySummary
  if (!options.force && !enabled) return { sent: false, reason: "not_enabled" }

  const to = cfg?.notificationEmail || tenant.users[0]?.email
  if (!to) return { sent: false, reason: "no_email" }

  const range = buildRange(period)
  const [current, previous] = await Promise.all([
    computeMetrics(tenantId, range.from, range.to),
    computeMetrics(tenantId, range.prevFrom, range.prevTo),
  ])

  // Skip empty days (no sales) for daily — but always send weekly/monthly
  if (period === "daily" && current.salesCount === 0 && !options.force) {
    return { sent: false, reason: "no_sales_today" }
  }

  // Expenses in period
  const expensesAgg = await db.expense.aggregate({
    where: { tenantId, createdAt: { gte: range.from, lte: range.to } },
    _sum: { amount: true },
  })
  const expenses = Number(expensesAgg._sum.amount ?? 0)
  const netProfit = current.profit - expenses

  const pctChange = (curr: number, prev: number) => {
    if (prev === 0 && curr === 0) return 0
    if (prev === 0) return 100
    return ((curr - prev) / prev) * 100
  }

  const plan = (tenant.subscription?.plan as Plan) ?? "FREE"
  const includeAI = cfg?.emailIncludeAIInsights !== false
  const aiInsights = includeAI
    ? await maybeAIInsights(tenantId, current, previous, period, plan)
    : null

  const html = renderDigestEmail({
    businessName: tenant.name,
    periodLabel: range.label,
    revenue: current.revenue,
    profit: current.profit,
    salesCount: current.salesCount,
    itemsSold: current.itemsSold,
    avgTicket: current.avgTicket,
    expenses,
    netProfit,
    comparison: {
      revenue: pctChange(current.revenue, previous.revenue),
      profit: pctChange(current.profit, previous.profit),
      salesCount: pctChange(current.salesCount, previous.salesCount),
    },
    topProducts: current.topProducts,
    byMethod: current.byMethod,
    aiSummary: aiInsights?.summary,
    aiHighlights: aiInsights?.highlights,
    aiRecommendations: aiInsights?.recommendations,
    brandColor: cfg?.themeColor ?? undefined,
    appUrl: process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXTAUTH_URL,
  })

  const periodTitle = period === "daily" ? "Reporte diario" : period === "weekly" ? "Reporte semanal" : "Reporte mensual"
  const result = await sendEmail({
    to,
    subject: `${periodTitle} — ${tenant.name} (${range.label})`,
    html,
  })

  return { sent: result.ok, reason: result.error }
}

/**
 * Send a low stock alert email (called when stock crosses minStock threshold).
 */
export async function sendLowStockAlert(tenantId: string): Promise<{ sent: boolean; reason?: string }> {
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    include: {
      config: true,
      users: { where: { role: "OWNER" }, select: { email: true }, take: 1 },
    },
  })
  if (!tenant || !tenant.active) return { sent: false, reason: "tenant_inactive" }

  const cfg = tenant.config as any
  if (!cfg?.emailLowStockAlerts) return { sent: false, reason: "not_enabled" }

  const to = cfg?.notificationEmail || tenant.users[0]?.email
  if (!to) return { sent: false, reason: "no_email" }

  // Find products at or below minimum
  const products = await db.product.findMany({
    where: { tenantId, active: true },
    select: {
      id: true,
      name: true,
      stock: true,
      minStock: true,
      category: { select: { name: true } },
    },
  })
  const lowStock = products
    .filter((p) => p.stock <= p.minStock)
    .map((p) => ({
      name: p.name,
      stock: p.stock,
      minStock: p.minStock,
      categoryName: p.category?.name ?? null,
    }))
    .sort((a, b) => a.stock - b.stock)

  if (lowStock.length === 0) return { sent: false, reason: "none_low" }

  const html = renderLowStockEmail({
    businessName: tenant.name,
    brandColor: cfg?.themeColor ?? undefined,
    appUrl: process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXTAUTH_URL,
    products: lowStock,
  })

  const result = await sendEmail({
    to,
    subject: `⚠ Stock bajo — ${lowStock.length} producto${lowStock.length !== 1 ? "s" : ""} necesitan reposición`,
    html,
  })

  return { sent: result.ok, reason: result.error }
}
