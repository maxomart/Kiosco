import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { PLAN_PRICES_USD, type Plan } from "@/lib/utils"

export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  const [tenants, users, subs, recent] = await Promise.all([
    db.tenant.findMany({ select: { id: true, businessType: true, active: true } }),
    db.user.count(),
    db.subscription.findMany({ select: { plan: true, status: true } }),
    db.tenant.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, name: true, createdAt: true, subscription: { select: { plan: true } } },
    }),
  ])

  const totalTenants = tenants.length
  const activeTenants = tenants.filter(t => t.active).length
  const trialingTenants = subs.filter(s => s.status === "TRIALING").length

  const planCounts: Record<string, number> = {}
  for (const s of subs) planCounts[s.plan] = (planCounts[s.plan] ?? 0) + 1

  const byPlan = Object.entries(planCounts).map(([plan, count]) => ({ plan, count }))

  const mrr = subs
    .filter(s => s.status === "ACTIVE")
    .reduce((acc, s) => acc + (PLAN_PRICES_USD[s.plan as Plan] ?? 0), 0)

  const businessCounts: Record<string, number> = {}
  for (const t of tenants) businessCounts[t.businessType] = (businessCounts[t.businessType] ?? 0) + 1
  const byBusinessType = Object.entries(businessCounts).map(([type, count]) => ({ type, count }))

  return NextResponse.json({
    totalTenants, activeTenants, trialingTenants,
    totalUsers: users,
    totalRevenue: 0,
    monthlyRecurringRevenue: mrr,
    byPlan, byBusinessType,
    recentSignups: recent.map(r => ({
      id: r.id, name: r.name,
      plan: r.subscription?.plan ?? "FREE",
      createdAt: r.createdAt.toISOString(),
    })),
  })
}
