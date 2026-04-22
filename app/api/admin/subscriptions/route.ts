import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { PLAN_PRICES_USD, type Plan } from "@/lib/utils"

// `source` distinguishes real paying customers from promo/trial/cancelled
// accounts. Critical for MRR accuracy.
//
// "Real payment" signals — ANY of these counts as evidence of money in the
// account. Each is sufficient on its own:
//   - At least one Invoice with status="PAID" linked to the subscription
//     (the most reliable signal — comes from a confirmed charge, regardless
//     of provider)
//   - mpStatus === "authorized" (MP/Mobbex webhook marks this on confirmed
//     recurring auth)
//   - stripeSubscriptionId set (Stripe webhook creates this on completed
//     checkout)
// We DON'T trust paymentProvider alone — the MP checkout sets it just by
// creating the preapproval, before any real charge.
//
// Precedence:
//   FREE   → plan = FREE
//   OTHER  → status CANCELLED / PAST_DUE / PAUSED
//   PAID   → status ACTIVE + any real-payment signal (even if isPromo, since
//            a promo user who actually pays converted to a real customer)
//   PROMO  → has PromoRedemption (and didn't convert above)
//   TRIAL  → paid plan, ACTIVE/TRIALING, no payment evidence, no promo
//   OTHER  → fall-through
type Source = "PAID" | "PROMO" | "TRIAL" | "FREE" | "OTHER"

function deriveSource(args: {
  plan: string
  status: string
  paymentProvider: string | null
  mpStatus: string | null
  stripeSubscriptionId: string | null
  hasPaidInvoice: boolean
  isPromo: boolean
}): Source {
  const { plan, status, paymentProvider, mpStatus, stripeSubscriptionId, hasPaidInvoice, isPromo } = args

  if (plan === "FREE") return "FREE"
  if (status === "CANCELLED" || status === "PAST_DUE" || status === "PAUSED") {
    return "OTHER"
  }

  // Hard evidence of money: a paid invoice OR a webhook-confirmed status.
  const realCharge =
    status === "ACTIVE" &&
    (hasPaidInvoice ||
      (paymentProvider && (mpStatus === "authorized" || !!stripeSubscriptionId)))

  if (realCharge) return "PAID"
  if (isPromo) return "PROMO"
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

  // Bulk promo + paid-invoice lookup — one query each, joined in memory.
  const tenantIds = subs.map((s: any) => s.tenantId)
  const subscriptionIds = subs.map((s: any) => s.id)

  let promoTenantSet = new Set<string>()
  let paidSubscriptionSet = new Set<string>()

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

  if (subscriptionIds.length > 0) {
    try {
      const paid = await db.invoice.findMany({
        where: { subscriptionId: { in: subscriptionIds }, status: "PAID" },
        select: { subscriptionId: true },
      })
      paidSubscriptionSet = new Set(paid.map((i: any) => i.subscriptionId))
    } catch (e) {
      console.error("[admin/subscriptions] paid-invoice lookup failed:", e)
    }
  }

  const allItems = (subs as any[]).map((s) => {
    const isPromo = promoTenantSet.has(s.tenantId)
    const hasPaidInvoice = paidSubscriptionSet.has(s.id)
    const source = deriveSource({
      plan: s.plan,
      status: s.status,
      paymentProvider: s.paymentProvider ?? null,
      mpStatus: s.mpStatus ?? null,
      stripeSubscriptionId: s.stripeSubscriptionId ?? null,
      hasPaidInvoice,
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
