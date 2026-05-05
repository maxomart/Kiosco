/**
 * Quota de facturas electrónicas por tenant.
 *
 * - Cada plan tiene un cupo mensual incluido.
 * - El contador es el COUNT de Sale con CAE no nulo en el mes actual.
 * - Cuando el tenant llega al 100%, no puede emitir más hasta el mes siguiente
 *   (o upgrade de plan).
 * - A 80% se le muestra alerta amarilla en el UI.
 *
 * El reset es automático: como contamos por createdAt del mes actual, al
 * cambiar el mes el contador "se resetea" solo (no hay job batch).
 */

import { db } from "./db"
import type { Plan } from "./utils"

/** Cupo mensual de facturas según plan. INFINITY = sin límite. */
export const INVOICE_LIMIT_BY_PLAN: Record<Plan, number> = {
  FREE: 30,
  STARTER: 100,
  PROFESSIONAL: 500,
  BUSINESS: 2000,
  ENTERPRISE: Number.POSITIVE_INFINITY,
}

// Legacy export — antes el plan FREE no incluía facturas. Ahora sí (50/mes).
// Lo dejamos exportado para no romper imports existentes pero apunta al cupo
// real del plan FREE.
export const FREE_PLAN_LIMIT = INVOICE_LIMIT_BY_PLAN.FREE

export interface InvoiceQuota {
  /** Plan actual del tenant */
  plan: string
  /** Cupo mensual del plan */
  limit: number
  /** Cuántas se emitieron este mes */
  used: number
  /** Cuántas le quedan (max 0) */
  remaining: number
  /** % usado (0-100) */
  percentUsed: number
  /** True si llegó al límite */
  reachedLimit: boolean
  /** True si llegó al 80% (zona de alerta) */
  nearingLimit: boolean
  /** True si el plan no incluye facturas */
  notIncluded: boolean
  /** Inicio del mes actual (para mostrar "del 1 al 30") */
  periodStart: Date
  /** Fin del mes actual */
  periodEnd: Date
}

function planLimit(plan: string): number {
  if (plan === "FREE") return FREE_PLAN_LIMIT
  return INVOICE_LIMIT_BY_PLAN[plan as Plan] ?? FREE_PLAN_LIMIT
}

function monthBounds(now: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  return { start, end }
}

/** Cuenta facturas emitidas (Sale con CAE no nulo) este mes. */
export async function countInvoicesThisMonth(tenantId: string): Promise<number> {
  const { start, end } = monthBounds()
  return db.sale.count({
    where: {
      tenantId,
      cae: { not: null },
      afipStatus: "APPROVED",
      createdAt: { gte: start, lte: end },
    },
  })
}

/** Devuelve el quota del tenant: plan, cupo, usado, restante, alertas. */
export async function getInvoiceQuota(tenantId: string): Promise<InvoiceQuota> {
  const sub = await db.subscription.findUnique({
    where: { tenantId },
    select: { plan: true },
  })
  const plan = sub?.plan ?? "FREE"
  const limit = planLimit(plan)
  const used = await countInvoicesThisMonth(tenantId)
  const { start, end } = monthBounds()

  const remaining = limit === Number.POSITIVE_INFINITY ? Number.POSITIVE_INFINITY : Math.max(0, limit - used)
  const percentUsed = limit === Number.POSITIVE_INFINITY ? 0 : limit === 0 ? 100 : Math.min(100, Math.round((used / limit) * 100))
  const reachedLimit = limit !== Number.POSITIVE_INFINITY && used >= limit
  const nearingLimit = limit !== Number.POSITIVE_INFINITY && limit > 0 && used / limit >= 0.8 && !reachedLimit

  return {
    plan,
    limit,
    used,
    remaining,
    percentUsed,
    reachedLimit,
    nearingLimit,
    notIncluded: limit === 0 && plan === "FREE",
    periodStart: start,
    periodEnd: end,
  }
}

/** Tira si el tenant llegó al límite — usado en lib/afip-issue.ts antes de emitir. */
export async function assertCanIssueInvoice(tenantId: string): Promise<void> {
  const q = await getInvoiceQuota(tenantId)
  if (q.notIncluded) {
    throw new Error(`Tu plan ${q.plan} no incluye facturación electrónica. Pasá a Básico o superior.`)
  }
  if (q.reachedLimit) {
    throw new Error(
      `Ya emitiste las ${q.limit} facturas incluidas este mes. Esperá al 1° del próximo mes o pasá a un plan superior.`
    )
  }
}

/** Stats globales del SaaS — usado por el panel admin. */
export interface GlobalUsage {
  totalThisMonth: number
  totalLastMonth: number
  topTenants: Array<{ tenantId: string; tenantName: string; used: number; limit: number; percent: number }>
  byPlan: Array<{ plan: string; tenants: number; used: number }>
}

export async function getGlobalInvoiceUsage(): Promise<GlobalUsage> {
  const { start, end } = monthBounds()
  const lastMonthStart = new Date(start.getFullYear(), start.getMonth() - 1, 1)
  const lastMonthEnd = new Date(start.getFullYear(), start.getMonth(), 0, 23, 59, 59, 999)

  const [totalThisMonth, totalLastMonth] = await Promise.all([
    db.sale.count({
      where: { cae: { not: null }, afipStatus: "APPROVED", createdAt: { gte: start, lte: end } },
    }),
    db.sale.count({
      where: { cae: { not: null }, afipStatus: "APPROVED", createdAt: { gte: lastMonthStart, lte: lastMonthEnd } },
    }),
  ])

  // Top 20 tenants por uso este mes
  const grouped = await db.sale.groupBy({
    by: ["tenantId"],
    where: { cae: { not: null }, afipStatus: "APPROVED", createdAt: { gte: start, lte: end } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 20,
  })

  const tenantIds = grouped.map((g) => g.tenantId)
  const tenants = tenantIds.length
    ? await db.tenant.findMany({
        where: { id: { in: tenantIds } },
        select: { id: true, name: true, subscription: { select: { plan: true } } },
      })
    : []
  const tenantMap = new Map(tenants.map((t) => [t.id, t]))

  const topTenants = grouped.map((g) => {
    const t = tenantMap.get(g.tenantId)
    const plan = t?.subscription?.plan ?? "FREE"
    const limit = planLimit(plan)
    const used = g._count.id
    return {
      tenantId: g.tenantId,
      tenantName: t?.name ?? "—",
      used,
      limit: limit === Number.POSITIVE_INFINITY ? -1 : limit,
      percent: limit === Number.POSITIVE_INFINITY || limit === 0
        ? 0
        : Math.min(100, Math.round((used / limit) * 100)),
    }
  })

  // Stats por plan — count tenants y suma usadas
  const allTenants = await db.tenant.findMany({
    where: { active: true },
    select: { id: true, subscription: { select: { plan: true } } },
  })
  const byPlanMap = new Map<string, { tenants: number; used: number }>()
  for (const t of allTenants) {
    const plan = t.subscription?.plan ?? "FREE"
    if (!byPlanMap.has(plan)) byPlanMap.set(plan, { tenants: 0, used: 0 })
    byPlanMap.get(plan)!.tenants++
  }
  for (const g of grouped) {
    const t = tenantMap.get(g.tenantId)
    const plan = t?.subscription?.plan ?? "FREE"
    if (!byPlanMap.has(plan)) byPlanMap.set(plan, { tenants: 0, used: 0 })
    byPlanMap.get(plan)!.used += g._count.id
  }
  const byPlan = Array.from(byPlanMap.entries()).map(([plan, v]) => ({ plan, ...v }))

  return { totalThisMonth, totalLastMonth, topTenants, byPlan }
}
