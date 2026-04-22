import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { PLAN_PRICES_USD, type Plan } from "@/lib/utils"

// `source` distinguishes real paying customers from promo/trial accounts that
// happen to show status=ACTIVE. Critical for MRR: a PROMO Profesional is
// worth $0, not $25.
//   - PAID:  paymentProvider is set (MP/Stripe/Mobbex committed)
//   - PROMO: tenant has a PromoRedemption record
//   - TRIAL: status TRIALING and not paid
//   - FREE:  plan FREE
//   - OTHER: status CANCELLED / PAST_DUE / PAUSED
type Source = "PAID" | "PROMO" | "TRIAL" | "FREE" | "OTHER"

function deriveSource(
  plan: string,
  status: string,
  paymentProvider: string | null,
  isPromo: boolean
): Source {
  if (plan === "FREE") return "FREE"
  if (paymentProvider) return "PAID"
  if (isPromo) return "PROMO"
  if (status === "TRIALING") return "TRIAL"
  if (status === "ACTIVE") return "TRIAL" // signup trial that lingered as ACTIVE
  return "OTHER"
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status") || ""
  const plan = searchParams.get("plan") || ""
  const sourceFilter = searchParams.get("source") || "" // "PAID" | "PROMO" | "TRIAL" | "FREE" | ""
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

  // Bulk promo lookup — one query for all tenants shown.
  const tenantIds = subs.map((s: any) => s.tenantId)
  let promoTenantSet = new Set<string>()
  if (tenantIds.length > 0) {
    try {
      const redemptions = await db.promoRedemption.findMany({
        where: { tenantId: { in: tenantIds } },
        select: { tenantId: true },
      })
      promoTenantSet = new Set(redemptions.map((r: any) => r.tenantId))
    } catch (e) {
      console.error("[admin/subscriptions] promoRedemption lookup failed:", e)
    }
  }

  const allItems = (subs as any[]).map((s) => {
    const isPromo = promoTenantSet.has(s.tenantId)
    const source = deriveSource(s.plan, s.status, s.paymentProvider ?? null, isPromo)
    return {
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
      paymentProvider: s.paymentProvider ?? null,
      source,
      // Only count MRR for PAID sources. Promo/trial accounts that happen to
      // show status=ACTIVE were inflating MRR before.
      mrr: source === "PAID" ? PLAN_PRICES_USD[s.plan as Plan] ?? 0 : 0,
    }
  })

  const items = sourceFilter
    ? allItems.filter((it) => it.source === sourceFilter)
    : allItems

  return NextResponse.json({ subscriptions: items, total, page, limit })
}
