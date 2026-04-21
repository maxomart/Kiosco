import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { getPreapproval, searchPaymentsByPreapproval, searchPreapprovalsByTenant } from "@/lib/mp-billing"
import { PLAN_PRICES_ARS, type Plan } from "@/lib/utils"

const ANNUAL_DISCOUNT = 0.2

function planFromAmount(amount: number): Plan | null {
  for (const [k, v] of Object.entries(PLAN_PRICES_ARS)) {
    if (v <= 0) continue
    if (v === amount) return k as Plan
    if (Math.round(v * 12 * (1 - ANNUAL_DISCOUNT)) === amount) return k as Plan
  }
  return null
}

async function backfillInvoices(subscriptionId: string, preapprovalId: string, fallbackAmount: number) {
  const payments = await searchPaymentsByPreapproval(preapprovalId)
  let created = 0
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
    })
    created++
  }
  if (created === 0 && fallbackAmount > 0) {
    const externalId = `mp_preapproval_${preapprovalId}`
    const existing = await db.invoice.findFirst({ where: { stripeInvoiceId: externalId } })
    if (!existing) {
      await db.invoice.create({
        data: {
          subscriptionId,
          number: `MP-${preapprovalId.slice(0, 8).toUpperCase()}`,
          stripeInvoiceId: externalId,
          amount: fallbackAmount,
          currency: "ARS",
          status: "PAID",
          paidAt: new Date(),
        },
      })
      created++
    }
  }
  return created
}

/** Admin: force-sync a subscription's MP status and backfill invoices. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  const { id: subscriptionId } = await params
  const sub = await db.subscription.findUnique({
    where: { id: subscriptionId },
    select: { id: true, tenantId: true, plan: true, status: true, mpPreapprovalId: true },
  })
  if (!sub) return NextResponse.json({ error: "Suscripción no encontrada" }, { status: 404 })

  // Try stored preapproval first
  let preapprovalId = sub.mpPreapprovalId
  let amount = 0
  let mpStatus = "unknown"

  if (preapprovalId) {
    try {
      const pre = await getPreapproval(preapprovalId)
      mpStatus = pre.status
      amount = pre.auto_recurring?.transaction_amount ?? 0
      if (pre.status === "authorized" && sub.status !== "ACTIVE") {
        const matchedPlan = planFromAmount(amount)
        await db.subscription.update({
          where: { id: sub.id },
          data: {
            status: "ACTIVE",
            plan: matchedPlan ?? sub.plan,
            mpStatus: "authorized",
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            cancelledAt: null,
          },
        })
      }
    } catch { /* continue */ }
  }

  // Also search by tenantId if needed
  if ((!preapprovalId || mpStatus !== "authorized") && sub.tenantId) {
    const all = await searchPreapprovalsByTenant(sub.tenantId)
    const authorized = all.find(p => p.status === "authorized")
    if (authorized) {
      preapprovalId = authorized.id
      amount = authorized.auto_recurring?.transaction_amount ?? 0
      mpStatus = "authorized"
      const matchedPlan = planFromAmount(amount)
      await db.subscription.update({
        where: { id: sub.id },
        data: {
          status: "ACTIVE",
          plan: matchedPlan ?? sub.plan,
          mpStatus: "authorized",
          mpPreapprovalId: authorized.id,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          cancelledAt: null,
        },
      })
    }
  }

  const invoicesCreated = preapprovalId
    ? await backfillInvoices(sub.id, preapprovalId, amount)
    : 0

  return NextResponse.json({ ok: true, mpStatus, invoicesCreated })
}
