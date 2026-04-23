import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"

export async function GET() {
  const { error, tenantId, session } = await getSessionTenant()
  if (error) return error
  try {
    const subscription = await db.subscription.findUnique({
      where: { tenantId: tenantId! },
      select: {
        plan: true,
        status: true,
        currentPeriodEnd: true,
        stripeCustomerId: true,
        mpPreapprovalId: true,
        mpStatus: true,
        paymentProvider: true,
      },
    })
    return NextResponse.json({
      // Signup email — used as a suggestion when the UI asks for the user's
      // MP Argentina account email. The user can edit it before submitting.
      userEmail: session?.user?.email ?? null,
      subscription:
        subscription ?? {
          plan: "STARTER",
          status: "STARTER",
          currentPeriodEnd: null,
          stripeCustomerId: null,
          mpPreapprovalId: null,
          mpStatus: null,
          paymentProvider: null,
        },
    })
  } catch (err) {
    console.error("[GET /api/configuracion/suscripcion]", err)
    return NextResponse.json({ error: "Error al obtener suscripción" }, { status: 500 })
  }
}
