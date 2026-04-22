/**
 * Daily cron: downgrade tenants whose promo-granted window has elapsed.
 *
 * Flow:
 *   1. Find every PromoRedemption → its Subscription.
 *   2. If the subscription is still on the granted paid plan, has a period end
 *      in the past, and has NOT signed up for a paying provider (MP/Stripe),
 *      flip it to FREE/ACTIVE. The user keeps their data; paid features lock
 *      via plan-guard automatically.
 *   3. If the user already moved to a paying plan (paymentProvider set), we
 *      leave them alone — they converted.
 *
 * Wiring (Railway/Vercel): POST/GET /api/cron/expire-promos daily at 04:00
 *   with header: Authorization: Bearer ${CRON_SECRET}
 *
 * Manual run: POST with the same header, or use scripts/manage-promo.js
 * for ad-hoc inspection.
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyCronSecret } from "@/lib/cron"

async function run(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 401 })
  }

  const now = new Date()
  const redemptions = await db.promoRedemption.findMany({
    select: { tenantId: true, promoCodeId: true },
  })

  // Dedup tenantIds — a tenant should only have one redemption due to the
  // @@unique constraint, but the defensive set keeps us correct if that ever
  // changes.
  const tenantIds = Array.from(new Set(redemptions.map((r) => r.tenantId)))
  if (tenantIds.length === 0) {
    return NextResponse.json({ ok: true, checked: 0, downgraded: 0 })
  }

  const expired = await db.subscription.findMany({
    where: {
      tenantId: { in: tenantIds },
      plan: { not: "FREE" },
      paymentProvider: null, // they never added a payment method
      currentPeriodEnd: { lt: now, not: null },
    },
    select: {
      id: true,
      tenantId: true,
      plan: true,
      currentPeriodEnd: true,
    },
  })

  const results: Array<{ tenantId: string; fromPlan: string }> = []
  for (const sub of expired) {
    await db.subscription.update({
      where: { id: sub.id },
      data: {
        plan: "FREE",
        status: "ACTIVE",
        currentPeriodEnd: null,
      },
    })
    results.push({ tenantId: sub.tenantId, fromPlan: sub.plan })
  }

  return NextResponse.json({
    ok: true,
    checked: tenantIds.length,
    downgraded: results.length,
    details: results,
    ranAt: now.toISOString(),
  })
}

export async function POST(req: NextRequest) {
  return run(req)
}
export async function GET(req: NextRequest) {
  return run(req)
}
