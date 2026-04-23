import { NextRequest, NextResponse } from "next/server"
import type Stripe from "stripe"
import { db } from "@/lib/db"
import { getStripe } from "@/lib/stripe"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) return NextResponse.json({ error: "Webhook no configurado" }, { status: 500 })

  const PLAN_FROM_PRICE: Record<string, string> = {
    [process.env.STRIPE_PRICE_STARTER ?? ""]: "STARTER",
    [process.env.STRIPE_PRICE_PROFESSIONAL ?? ""]: "PROFESSIONAL",
    [process.env.STRIPE_PRICE_BUSINESS ?? ""]: "BUSINESS",
  }

  const stripe = getStripe()
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
        const sub = (invoice as any).subscription
          ? await stripe.subscriptions.retrieve((invoice as any).subscription as string)
          : null
        if (!sub) break
        const tenantId = sub.metadata?.tenantId
        if (!tenantId) break
        const plan = PLAN_FROM_PRICE[sub.items.data[0]?.price.id] || "STARTER"
        const dbSub = await db.subscription.upsert({
          where: { tenantId },
          create: {
            tenantId, plan,
            stripeCustomerId: customerId,
            stripeSubscriptionId: sub.id,
            status: "ACTIVE",
            currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
          },
          update: {
            plan, status: "ACTIVE",
            stripeCustomerId: customerId,
            stripeSubscriptionId: sub.id,
            currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
          },
        })
        const invoiceNumber = invoice.number ?? invoice.id ?? `inv_${Date.now()}`
        const paidAtTs = invoice.status_transitions?.paid_at
        await db.invoice.create({
          data: {
            subscriptionId: dbSub.id,
            number: invoiceNumber,
            stripeInvoiceId: invoice.id ?? null,
            amount: invoice.amount_paid / 100,
            currency: invoice.currency.toUpperCase(),
            status: "PAID",
            paidAt: paidAtTs ? new Date(paidAtTs * 1000) : new Date(),
            pdfUrl: invoice.invoice_pdf ?? invoice.hosted_invoice_url ?? null,
          },
        }).catch((e) => { console.error("invoice insert failed:", e) })
        break
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice
        if (!(invoice as any).subscription) break
        const sub = await stripe.subscriptions.retrieve((invoice as any).subscription as string)
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
          data: { plan: "STARTER", status: "CANCELLED", stripeSubscriptionId: null, cancelledAt: new Date() },
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
          data: { plan, status, currentPeriodEnd: new Date((sub as any).current_period_end * 1000) },
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
