import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { PLAN_PRICES_USD, type Plan } from "@/lib/utils"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status") || ""
  const plan = searchParams.get("plan") || ""
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "25")

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (plan) where.plan = plan

  const [subs, total] = await Promise.all([
    db.subscription.findMany({
      where: where as never,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { updatedAt: "desc" },
      include: {
        tenant: { select: { id: true, name: true, slug: true, active: true } },
      },
    }),
    db.subscription.count({ where: where as never }),
  ])

  const items = (subs as Array<Record<string, unknown> & { plan: string; status: string; tenant: unknown }>).map((s) => ({
    id: s.id,
    tenantId: s.tenantId,
    tenant: s.tenant,
    plan: s.plan,
    status: s.status,
    billingCycle: s.billingCycle,
    currentPeriodStart: s.currentPeriodStart,
    currentPeriodEnd: s.currentPeriodEnd,
    cancelledAt: s.cancelledAt,
    createdAt: s.createdAt,
    mrr: s.status === "ACTIVE" ? PLAN_PRICES_USD[s.plan as Plan] ?? 0 : 0,
  }))

  return NextResponse.json({ subscriptions: items, total, page, limit })
}
