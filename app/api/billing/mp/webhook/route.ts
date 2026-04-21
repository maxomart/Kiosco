import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import {
  verifyWebhookSignature,
  getPreapproval,
  getPayment,
} from "@/lib/mp-billing"
import { PLAN_PRICES_ARS, type Plan } from "@/lib/utils"

export const dynamic = "force-dynamic"

/**
 * MercadoPago notifies us about two relevant resource types:
 *
 *   - `preapproval`  → subscription state changes (authorized/cancelled/paused)
 *   - `payment`     → recurring charges processed (renewals)
 *
 * We always respond 200 quickly. Any handler error is logged but we still
 * acknowledge to avoid retry storms (we'll fix data via a backfill if needed).
 */
export async function POST(req: NextRequest) {
  const url = new URL(req.url)
  const topic = url.searchParams.get("topic") ?? url.searchParams.get("type") ?? ""
  const queryDataId = url.searchParams.get("id") ?? url.searchParams.get("data.id")

  // MP also sends a JSON body for newer integrations
  let body: any = null
  try {
    body = await req.json()
  } catch {
    /* may be empty for v1-style notifications */
  }

  const dataId: string | null =
    body?.data?.id?.toString() ?? queryDataId ?? null
  const eventType: string =
    body?.type ?? body?.action ?? topic ?? ""

  // Verify signature (constant-time HMAC). On dev without secret we accept.
  if (!verifyWebhookSignature(req, dataId)) {
    console.warn("[mp/webhook] firma inválida", { eventType, dataId })
    // Still 200 — we don't want MP to retry on bad signatures forever
    return NextResponse.json({ received: true })
  }

  // Run the handler in the background — respond ASAP (MP requires <2s).
  handleEvent({ eventType, dataId }).catch((err) => {
    console.error("[mp/webhook] handler error:", err)
  })

  return NextResponse.json({ received: true })
}

async function handleEvent({
  eventType,
  dataId,
}: {
  eventType: string
  dataId: string | null
}) {
  if (!dataId) return

  const isPreapproval = eventType.includes("preapproval")
  const isPayment = eventType.includes("payment") || eventType === "subscription_authorized_payment"

  if (isPreapproval) {
    await handlePreapproval(dataId)
    return
  }
  if (isPayment) {
    await handlePayment(dataId)
    return
  }
  // Unknown event — ignore quietly
}

const ANNUAL_DISCOUNT = 0.2

function planFromAmount(amount: number): Plan | null {
  for (const [k, v] of Object.entries(PLAN_PRICES_ARS)) {
    if (v <= 0) continue
    if (v === amount) return k as Plan
    if (Math.round(v * 12 * (1 - ANNUAL_DISCOUNT)) === amount) return k as Plan
  }
  return null
}

async function handlePreapproval(preapprovalId: string) {
  const pre = await getPreapproval(preapprovalId)
  const tenantId = pre.external_reference
  if (!tenantId) return

  const sub = await db.subscription.findUnique({ where: { tenantId } })
  if (!sub) return

  const status = pre.status // pending | authorized | paused | cancelled
  const amount = pre.auto_recurring?.transaction_amount ?? 0
  const matchedPlan = planFromAmount(amount)

  if (status === "authorized") {
    await db.subscription.update({
      where: { tenantId },
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
  } else if (status === "cancelled") {
    await db.subscription.update({
      where: { tenantId },
      data: {
        status: "CANCELLED",
        mpStatus: "cancelled",
        cancelledAt: new Date(),
      },
    })
  } else if (status === "paused") {
    await db.subscription.update({
      where: { tenantId },
      data: { status: "PAST_DUE", mpStatus: "paused" },
    })
  } else {
    await db.subscription.update({
      where: { tenantId },
      data: { mpStatus: status },
    })
  }
}

async function handlePayment(paymentId: string) {
  const payment = await getPayment(paymentId)
  const preapprovalId: string | undefined =
    payment?.preapproval_id ?? payment?.metadata?.preapproval_id
  if (!preapprovalId) return

  const sub = await db.subscription.findFirst({
    where: { mpPreapprovalId: preapprovalId },
  })
  if (!sub) return

  // Idempotency — reuse stripeInvoiceId column to store the MP payment id
  const externalId = `mp_${payment.id}`
  const existing = await db.invoice.findFirst({
    where: { stripeInvoiceId: externalId },
  })
  if (existing) return

  const status: string = payment.status // approved | pending | rejected | refunded
  if (status !== "approved") return

  // Bump period and write an invoice row
  const now = new Date()
  const newEnd = new Date(
    Math.max(sub.currentPeriodEnd?.getTime() ?? now.getTime(), now.getTime()) +
      30 * 24 * 60 * 60 * 1000
  )

  await db.subscription.update({
    where: { id: sub.id },
    data: {
      status: "ACTIVE",
      mpStatus: "authorized",
      paymentProvider: "mercadopago",
      currentPeriodEnd: newEnd,
    },
  })

  await db.invoice.create({
    data: {
      subscriptionId: sub.id,
      number: `MP-${payment.id}`,
      stripeInvoiceId: externalId,
      amount: Number(payment.transaction_amount ?? 0),
      currency: (payment.currency_id ?? "ARS").toUpperCase(),
      status: "PAID",
      paidAt: payment.date_approved ? new Date(payment.date_approved) : new Date(),
    },
  }).catch((e) => {
    console.error("[mp/webhook] invoice insert failed:", e)
  })
}
