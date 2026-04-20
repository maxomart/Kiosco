import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { db } from "@/lib/db"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" })
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!


const PLAN_FROM_PRICE: Record<string, string> = {
  [process.env.STRIPE_PRICE_STARTER ?? ""]: "STARTER",
  [process.env.STRIPE_PRICE_PROFESSIONAL ?? ""]: "PROFESSIONAL",
  [process.env.STRIPE_PRICE_BUSINESS ?? ""]: "BUSINESS",
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get("stripe-signature")
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message)
    return NextResponse.json({ error: err.message }, { status: 400 })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        const tenantId = session.metadata?.tenantId
        const plan = session.metadata?.plan
        if (!tenantId || !plan) break
        await db.subscription.upsert({
          where: { tenantId },
          create: {
            tenantId,
            plan,
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
            status: "TRIALING",
            currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          },
          update: {
            plan,
            stripeSubscriptionId: session.subscription as string,
            status: "TRIALING",
            currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          },
        })
        break
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string
        const sub = invoice.subscription
          ? await stripe.subscriptions.retrieve(invoice.subscription as string)
          : null
        if (!sub) break
        const tenantId = sub.metadata?.tenantId
        if (!tenantId) break
        const plan = PLAN_FROM_PRICE[sub.items.data[0]?.price.id] || "STARTER"
        await db.subscription.upsert({
          where: { tenantId },
          create: {
            tenantId, plan,
            stripeCustomerId: customerId,
            stripeSubscriptionId: sub.id,
            status: "ACTIVE",
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
          },
          update: {
            plan, status: "ACTIVE",
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
          },
        })
        // Create invoice record
        await db.invoice.create({
          data: {
            tenantId,
            stripeInvoiceId: invoice.id,
            amount: invoice.amount_paid / 100,
            currency: invoice.currency.toUpperCase(),
            status: "PAID",
            paidAt: new Date(invoice.status_transitions.paid_at! * 1000),
            invoiceUrl: invoice.hosted_invoice_url,
          },
        }).catch(() => {}) // ignore duplicates
        break
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice
        if (!invoice.subscription) break
        const sub = await stripe.subscriptions.retrieve(invoice.subscription as string)
        const tenantId = sub.metadata?.tenantId
        if (!tenantId) break
        await db.subscription.updateMany({ where: { tenantId }, data: { status: "PAST_DUE" } })
        break
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription
        const tenantId = sub.metadata?.tenantId
        if (!tenantId) break
        await db.subscription.updateMany({
          where: { tenantId },
          data: { plan: "FREE", status: "CANCELLED", stripeSubscriptionId: null },
        })
        break
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription
        const tenantId = sub.metadata?.tenantId
        if (!tenantId) break
        const plan = PLAN_FROM_PRICE[sub.items.data[0]?.price.id] || "STARTER"
        const status = sub.status === "active" ? "ACTIVE"
          : sub.status === "trialing" ? "TRIALING"
          : sub.status === "past_due" ? "PAST_DUE"
          : "CANCELLED"
        await db.subscription.updateMany({
          where: { tenantId },
          data: { plan, status, currentPeriodEnd: new Date(sub.current_period_end * 1000) },
        })
        break
      }
    }
  } catch (err) {
    console.error("Webhook handler error:", err)
    return NextResponse.json({ error: "Handler failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
