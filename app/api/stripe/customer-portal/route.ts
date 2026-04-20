import { NextResponse } from "next/server"
import { getSessionTenant } from "@/lib/tenant"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" })

export async function POST() {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { db } = await import("@/lib/db")
  const sub = await db.subscription.findUnique({ where: { tenantId: tenantId! } })
  if (!sub?.stripeCustomerId) return NextResponse.json({ error: "Sin suscripción activa" }, { status: 400 })

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${process.env.NEXTAUTH_URL}/configuracion/suscripcion`,
  })

  return NextResponse.json({ url: portalSession.url })
}
