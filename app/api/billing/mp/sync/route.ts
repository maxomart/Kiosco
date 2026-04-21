import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { getPreapproval, searchPaymentsByPreapproval } from "@/lib/mp-billing"
import { PLAN_PRICES_ARS, type Plan } from "@/lib/utils"

export const dynamic = "force-dynamic"

const ANNUAL_DISCOUNT = 0.2

function planFromAmount(amount: number): Plan | null {
  for (const [k, v] of Object.entries(PLAN_PRICES_ARS)) {
    if (v <= 0) continue
    if (v === amount) return k as Plan
    if (Math.round(v * 12 * (1 - ANNUAL_DISCOUNT)) === amount) return k as Plan
  }
  return null
}

async function createInvoicesFromPayments(subscriptionId: string, preapprovalId: string) {
  const payments = await searchPaymentsByPreapproval(preapprovalId)
  for (const payment of payments) {
    if (payment.status !== "approved") continue
    const externalId = `mp_${payment.id}`
    const existing = await db.invoice.findFirst({ where: { stripeInvoiceId: externalId } })
    if (existing) continue
    await db.invoice.create({
      data: {
        subscriptionId,
        number: `MP-${payment.id}`,
        stripeInvoiceId: externalId,
        amount: Number(payment.transaction_amount ?? 0),
        currency: (payment.currency_id ?? "ARS").toUpperCase(),
        status: "PAID",
        paidAt: payment.date_approved ? new Date(payment.date_approved) : new Date(),
      },
    }).catch(e => console.error("[mp/sync] invoice create failed:", e))
  }
}

/** Called when user returns from MP checkout — forces a status check from MP API. */
export async function POST() {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const sub = await db.subscription.findUnique({ where: { tenantId: tenantId! } })
  if (!sub?.mpPreapprovalId) {
    return NextResponse.json({ synced: false, reason: "no_preapproval" })
  }

  let pre
  try {
    pre = await getPreapproval(sub.mpPreapprovalId)
  } catch (err: any) {
    console.error("[mp/sync] getPreapproval error:", err?.message)
    return NextResponse.json({ synced: false, reason: "mp_error", detail: err?.message })
  }

  const status = pre.status
  const amount = pre.auto_recurring?.transaction_amount ?? 0
  const matchedPlan = planFromAmount(amount)

  console.log(`[mp/sync] preapproval ${sub.mpPreapprovalId} → status=${status} amount=${amount} plan=${matchedPlan}`)

  if (status === "authorized") {
    await db.subscription.update({
      where: { tenantId: tenantId! },
      data: {
        status: "ACTIVE",
        plan: matchedPlan ?? sub.plan,
        mpStatus: "authorized",
        paymentProvider: "mercadopago",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelledAt: null,
      },
    })
    // Backfill any payments MP already processed
    await createInvoicesFromPayments(sub.id, sub.mpPreapprovalId)
    return NextResponse.json({ synced: true, plan: matchedPlan ?? sub.plan, status: "ACTIVE" })
  }

  if (status === "cancelled") {
    await db.subscription.update({
      where: { tenantId: tenantId! },
      data: { status: "CANCELLED", mpStatus: "cancelled", cancelledAt: new Date() },
    })
  }

  return NextResponse.json({ synced: false, mpStatus: status })
}
