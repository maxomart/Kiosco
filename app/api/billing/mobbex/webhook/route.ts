import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { PLAN_PRICES_ARS, type Plan } from "@/lib/utils"
import { syncPaymentToSheet } from "@/lib/sheets-sync"

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

export async function POST(req: NextRequest) {
  let body: Record<string, any> = {}
  const contentType = req.headers.get("content-type") ?? ""

  try {
    if (contentType.includes("application/json")) {
      body = await req.json()
    } else {
      const text = await req.text()
      body = Object.fromEntries(new URLSearchParams(text))
    }
  } catch { /* ignore */ }

  // Mobbex sends: type, status, data (subscriber info), total, subscriber (uid)
  const eventType: string = body.type ?? body.event ?? ""
  const subscriberUid: string = body.subscriber ?? body.data?.subscriber ?? ""
  const status: string = body.status ?? ""
  const total: number = parseFloat(body.total ?? body.data?.total ?? "0")

  console.log("[mobbex/webhook]", { eventType, subscriberUid, status, total })

  // Run async — respond ASAP
  handleEvent({ eventType, subscriberUid, status, total }).catch(err =>
    console.error("[mobbex/webhook] handler error:", err)
  )

  return NextResponse.json({ received: true })
}

async function handleEvent({
  eventType,
  subscriberUid,
  status,
  total,
}: {
  eventType: string
  subscriberUid: string
  status: string
  total: number
}) {
  if (!subscriberUid) return

  // Find sub by matching subscriber UID in composite mpPreapprovalId
  const sub = await db.subscription.findFirst({
    where: { mpPreapprovalId: { contains: subscriberUid }, paymentProvider: "mobbex" },
  })
  if (!sub) {
    console.warn("[mobbex/webhook] sub not found for subscriber:", subscriberUid)
    return
  }

  // subscription_execution = recurring charge processed
  if (eventType === "subscription_execution" && status === "200") {
    const matchedPlan = planFromAmount(total)
    await db.subscription.update({
      where: { id: sub.id },
      data: {
        status: "ACTIVE",
        plan: matchedPlan ?? sub.plan,
        mpStatus: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelledAt: null,
      },
    })
    // Create invoice
    const externalId = `mobbex_${subscriberUid}_${Date.now()}`
    try {
      const inv = await db.invoice.create({
        data: {
          subscriptionId: sub.id,
          number: `MBX-${subscriberUid.slice(0, 8).toUpperCase()}`,
          stripeInvoiceId: externalId,
          amount: total,
          currency: "ARS",
          status: "PAID",
          paidAt: new Date(),
        },
      })
      syncPaymentToSheet(inv.id)
    } catch (e) { console.error("[mobbex/webhook] invoice failed:", e) }
    return
  }

  // subscription_registration = customer registered card (not charged yet)
  if (eventType === "subscription_registration") {
    await db.subscription.update({
      where: { id: sub.id },
      data: { mpStatus: "registered" },
    })
    return
  }

  // Cancellation/suspension
  if (["subscription_cancel", "subscription_suspend"].includes(eventType)) {
    await db.subscription.update({
      where: { id: sub.id },
      data: { status: "CANCELLED", mpStatus: "cancelled", cancelledAt: new Date() },
    })
  }
}
