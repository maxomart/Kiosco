import { NextResponse } from "next/server"
import { getSessionTenant } from "@/lib/tenant"
import { getStripe } from "@/lib/stripe"

export const dynamic = "force-dynamic"

export async function POST() {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const { db } = await import("@/lib/db")
  const sub = await db.subscription.findUnique({ where: { tenantId: tenantId! } })
  if (!sub?.stripeCustomerId) return NextResponse.json({ error: "Sin suscripción activa" }, { status: 400 })

  const stripe = getStripe()
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${process.env.NEXTAUTH_URL}/configuracion/suscripcion`,
  })

  return NextResponse.json({ url: portalSession.url })
}
