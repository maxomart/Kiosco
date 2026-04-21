import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { getPreapproval, searchPaymentsByPreapproval, searchPreapprovalsByTenant } from "@/lib/mp-billing"
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

async function activateFromPreapproval(
  tenantId: string,
  sub: { id: string; plan: string },
  pre: { id: string; status: string; auto_recurring?: { transaction_amount?: number } }
) {
  const amount = pre.auto_recurring?.transaction_amount ?? 0
  const matchedPlan = planFromAmount(amount)
  console.log(`[mp/sync] activating from preapproval ${pre.id} amount=${amount} plan=${matchedPlan}`)

  await db.subscription.update({
    where: { tenantId },
    data: {
      status: "ACTIVE",
      plan: matchedPlan ?? sub.plan,
      mpStatus: "authorized",
      mpPreapprovalId: pre.id,
      paymentProvider: "mercadopago",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelledAt: null,
    },
  })
  await createInvoicesFromPayments(sub.id, pre.id)
  return matchedPlan ?? sub.plan
}

/** Called when user returns from MP checkout — forces a status check from MP API. */
export async function POST() {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const sub = await db.subscription.findUnique({ where: { tenantId: tenantId! } })

  // Step 1: check the stored preapproval ID
  if (sub?.mpPreapprovalId) {
    let pre
    try {
      pre = await getPreapproval(sub.mpPreapprovalId)
    } catch (err: any) {
      console.error("[mp/sync] getPreapproval error:", err?.message)
    }

    if (pre) {
      console.log(`[mp/sync] stored preapproval ${sub.mpPreapprovalId} → status=${pre.status}`)
      if (pre.status === "authorized") {
        const plan = await activateFromPreapproval(tenantId!, sub, pre)
        return NextResponse.json({ synced: true, plan, status: "ACTIVE" })
      }
    }
  }

  // Step 2: search all preapprovals for this tenant — the stored ID might be stale
  console.log(`[mp/sync] searching all preapprovals for tenant ${tenantId}`)
  const all = await searchPreapprovalsByTenant(tenantId!)
  const authorized = all.find(p => p.status === "authorized")
  if (authorized) {
    const plan = await activateFromPreapproval(tenantId!, sub ?? { id: "", plan: "FREE" }, authorized)
    return NextResponse.json({ synced: true, plan, status: "ACTIVE" })
  }

  const latestStatus = all[0]?.status ?? sub?.mpStatus ?? "unknown"
  console.log(`[mp/sync] no authorized preapproval found. latest status: ${latestStatus}`)
  return NextResponse.json({ synced: false, mpStatus: latestStatus, reason: "not_authorized" })
}
