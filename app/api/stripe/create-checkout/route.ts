import { NextRequest, NextResponse } from "next/server"
import { getSessionTenant } from "@/lib/tenant"
import { getStripe } from "@/lib/stripe"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const PRICE_IDS: Record<string, string> = {
    STARTER: process.env.STRIPE_PRICE_STARTER ?? "",
    PROFESSIONAL: process.env.STRIPE_PRICE_PROFESSIONAL ?? "",
    BUSINESS: process.env.STRIPE_PRICE_BUSINESS ?? "",
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }
  const { plan } = body
  if (!PRICE_IDS[plan]) return NextResponse.json({ error: "Plan inválido" }, { status: 400 })

  const stripe = getStripe()
  const { db } = await import("@/lib/db")
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId! },
    include: { subscription: true },
  })
  if (!tenant) return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 })

  // Reuse or create Stripe customer
  let customerId = tenant.subscription?.stripeCustomerId

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.user.email!,
      name: tenant.name,
      metadata: { tenantId: tenantId! },
    })
    customerId = customer.id
    await db.subscription.upsert({
      where: { tenantId: tenantId! },
      create: { tenantId: tenantId!, plan: "STARTER", stripeCustomerId: customerId },
      update: { stripeCustomerId: customerId },
    })
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
    success_url: `${process.env.NEXTAUTH_URL}/configuracion/suscripcion?success=1`,
    cancel_url: `${process.env.NEXTAUTH_URL}/configuracion/suscripcion?cancelled=1`,
    metadata: { tenantId: tenantId!, plan },
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { tenantId: tenantId!, plan },
      trial_period_days: 14,
    },
  })

  return NextResponse.json({ url: checkoutSession.url })
}
