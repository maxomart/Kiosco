import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { PLAN_PRICES_USD, type Plan } from "@/lib/utils"

// `source` distinguishes real paying customers from promo/trial/cancelled
// accounts. Critical for MRR accuracy and for not lying to ourselves about
// who is actually paying.
//
// Order of precedence (first match wins):
//   FREE   → plan = FREE (nothing to bill regardless of status)
//   OTHER  → status CANCELLED / PAST_DUE / PAUSED (not paying right now)
//   PROMO  → tenant has a PromoRedemption record. Takes precedence over
//            paymentProvider because the MP checkout sets paymentProvider
//            to "mercadopago" just by creating the preapproval — even when
//            the user never completes the payment. So a promo user who
//            merely clicked "Suscribirme" gets a false paymentProvider.
//            We treat them as PROMO until mpStatus reports an "authorized"
//            charge, which only the webhook writes after a real payment.
//   PAID   → paymentProvider set AND status ACTIVE  ← only this counts as MRR
//   TRIAL  → paid plan, no provider, no promo → default signup trial
//   OTHER  → fall-through
type Source = "PAID" | "PROMO" | "TRIAL" | "FREE" | "OTHER"

function deriveSource(args: {
  plan: string
  status: string
  paymentProvider: string | null
  mpStatus: string | null
  stripeSubscriptionId: string | null
  isPromo: boolean
}): Source {
  const { plan, status, paymentProvider, mpStatus, stripeSubscriptionId, isPromo } = args

  if (plan === "FREE") return "FREE"
  if (status === "CANCELLED" || status === "PAST_DUE" || status === "PAUSED") {
    return "OTHER"
  }

  // Promo user "converted" only if there's evidence of a real charge:
  //   - MP/Mobbex: mpStatus === "authorized" (webhook confirmed the charge)
  //   - Stripe:    stripeSubscriptionId set (webhook created the Sub)
  // Without that evidence, a promo user who merely clicked Suscribirme
  // shouldn't show as PAGANTE.
  const realCharge =
    (paymentProvider && status === "ACTIVE") &&
    (mpStatus === "authorized" || !!stripeSubscriptionId)

  if (isPromo && !realCharge) return "PROMO"
  if (realCharge) return "PAID"
  if (isPromo) return "PROMO" // paranoia: promo with half-baked provider

  // Non-promo with unconfirmed provider → still a trial-ish state, not paying.
  if (status === "TRIALING" || status === "ACTIVE") return "TRIAL"
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
    const source = deriveSource({
      plan: s.plan,
      status: s.status,
      paymentProvider: s.paymentProvider ?? null,
      mpStatus: s.mpStatus ?? null,
      stripeSubscriptionId: s.stripeSubscriptionId ?? null,
      isPromo,
    })
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
