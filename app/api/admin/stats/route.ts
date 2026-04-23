import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { PLAN_PRICES_USD, type Plan } from "@/lib/utils"

export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  // Best-effort promo lookup. If the model isn't present for some reason,
  // fall back to an empty set so the rest of the stats still render.
  let promoTenantIds = new Set<string>()
  try {
    const reds = await db.promoRedemption.findMany({ select: { tenantId: true } })
    promoTenantIds = new Set(reds.map((r: any) => r.tenantId))
  } catch (e) {
    console.error("[admin/stats] promoRedemption lookup failed:", e)
  }

  const [tenants, users, subs, recent, paidInvoices] = await Promise.all([
    db.tenant.findMany({ select: { id: true, active: true, config: { select: { businessType: true } } } }),
    db.user.count(),
    db.subscription.findMany({
      select: {
        id: true,
        plan: true,
        status: true,
        tenantId: true,
        paymentProvider: true,
        mpStatus: true,
        stripeSubscriptionId: true,
      },
    }),
    db.tenant.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, name: true, createdAt: true, subscription: { select: { plan: true } } },
    }),
    db.invoice.findMany({ where: { status: "PAID" }, select: { subscriptionId: true } }),
  ])

  const paidSubscriptionSet = new Set<string>(
    (paidInvoices as any[]).map((i) => i.subscriptionId)
  )

  // "Paying right now" requires status ACTIVE AND a real payment signal —
  // either a paid invoice in the DB or a webhook-confirmed mpStatus /
  // stripeSubscriptionId. paymentProvider alone doesn't count because the MP
  // checkout sets it just by creating the preapproval.
  const isReallyPaying = (s: any) =>
    s.status === "ACTIVE" &&
    (paidSubscriptionSet.has(s.id) ||
      (s.paymentProvider && (s.mpStatus === "authorized" || !!s.stripeSubscriptionId)))

  const totalTenants = tenants.length
  const activeTenants = tenants.filter(t => t.active).length
  const trialingTenants = subs.filter((s: any) => s.status === "TRIALING").length
  const promoActiveTenants = subs.filter(
    (s: any) =>
      s.status !== "CANCELLED" &&
      s.status !== "PAUSED" &&
      promoTenantIds.has(s.tenantId) &&
      !isReallyPaying(s) // a promo user that truly converted counts as paid, not promo
  ).length
  const paidTenants = subs.filter(isReallyPaying).length

  const planCounts: Record<string, number> = {}
  for (const s of subs) planCounts[s.plan] = (planCounts[s.plan] ?? 0) + 1

  const byPlan = Object.entries(planCounts).map(([plan, count]) => ({ plan, count }))

  const mrr = (subs as any[])
    .filter(isReallyPaying)
    .reduce((acc, s) => acc + (PLAN_PRICES_USD[s.plan as Plan] ?? 0), 0)

  const businessCounts: Record<string, number> = {}
  for (const t of tenants) {
    const bt = t.config?.businessType ?? "OTRO"
    businessCounts[bt] = (businessCounts[bt] ?? 0) + 1
  }
  const byBusinessType = Object.entries(businessCounts).map(([type, count]) => ({ type, count }))

  return NextResponse.json({
    totalTenants,
    activeTenants,
    trialingTenants,
    paidTenants,
    promoActiveTenants,
    totalUsers: users,
    totalRevenue: 0,
    monthlyRecurringRevenue: mrr,
    byPlan,
    byBusinessType,
    recentSignups: recent.map(r => ({
      id: r.id, name: r.name,
      plan: r.subscription?.plan ?? "STARTER",
      createdAt: r.createdAt.toISOString(),
    })),
  })
}
