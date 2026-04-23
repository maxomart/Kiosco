/**
 * Server-side helpers for plan-based hard limits.
 * Pair these with the role-based `can()` from lib/permissions.ts:
 *   - role check first (can the USER do this action at all?)
 *   - plan check second (does the TENANT's plan allow it?)
 */

import { db } from "@/lib/db"
import { PLAN_LIMITS, type Plan, PLAN_LABELS } from "@/lib/utils"

/** Fetch plan for a tenant (defaults to STARTER if no subscription row). */
export async function getTenantPlan(tenantId: string): Promise<Plan> {
  const sub = await db.subscription.findUnique({
    where: { tenantId },
    select: { plan: true },
  })
  return (sub?.plan as Plan) ?? "STARTER"
}

interface QuotaResult {
  ok: boolean
  used: number
  limit: number
  plan: Plan
  message: string
}

/**
 * Check if a tenant can create one more entity of a given type.
 * Returns `{ ok: true }` if under limit, otherwise `{ ok: false, message }`
 * with a friendly upgrade-CTA-style error message.
 */
export async function checkQuota(
  tenantId: string,
  entity: "products" | "users" | "clients" | "suppliers" | "categories",
  plan?: Plan,
): Promise<QuotaResult> {
  const p: Plan = plan ?? (await getTenantPlan(tenantId))
  const limit = PLAN_LIMITS[p][entity]

  // 0 = feature locked entirely (use can()/hasFeature elsewhere too)
  if (limit === 0) {
    return {
      ok: false,
      used: 0,
      limit: 0,
      plan: p,
      message: `Esta función no está incluida en el plan ${PLAN_LABELS[p]}. Suscribite a un plan superior para desbloquearla.`,
    }
  }

  const used = await countEntity(tenantId, entity)
  if (limit !== Number.POSITIVE_INFINITY && used >= limit) {
    return {
      ok: false,
      used,
      limit,
      plan: p,
      message: `Llegaste al límite del plan ${PLAN_LABELS[p]} (${limit} ${entity}). Suscribite a un plan superior para agregar más.`,
    }
  }
  return { ok: true, used, limit, plan: p, message: "" }
}

async function countEntity(
  tenantId: string,
  entity: "products" | "users" | "clients" | "suppliers" | "categories",
): Promise<number> {
  switch (entity) {
    case "products":   return db.product.count({ where: { tenantId, active: true } })
    case "users":      return db.user.count({ where: { tenantId, active: true } })
    case "clients":    return db.client.count({ where: { tenantId, active: true } })
    case "suppliers":  return db.supplier.count({ where: { tenantId, active: true } })
    case "categories": return db.category.count({ where: { tenantId, active: true } })
  }
}

/**
 * Returns a Date that is N days ago at 00:00, where N comes from the plan's
 * historyDays. For unlimited plans, returns null (caller should treat as "no
 * lower bound"). Use this to clamp date filters in /api/ventas, /api/reportes.
 */
export function getHistoryWindow(plan: Plan): Date | null {
  const days = PLAN_LIMITS[plan].historyDays
  if (days === Number.POSITIVE_INFINITY) return null
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Clamps a user-supplied "from" date to the plan's history window. If the
 * user requests further back than allowed, snap to the window's start.
 * Returns the clamped Date so the caller can use it directly.
 */
export function clampFromDate(plan: Plan, from: Date | null | undefined): Date {
  const min = getHistoryWindow(plan)
  const requested = from ?? new Date(0)
  if (!min) return requested
  return requested < min ? min : requested
}
