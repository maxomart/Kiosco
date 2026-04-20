import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"

export async function GET() {
  const { error, tenantId } = await getSessionTenant()
  if (error) return error
  const subscription = await db.subscription.findUnique({
    where: { tenantId: tenantId! },
    select: { plan: true, status: true, currentPeriodEnd: true, stripeCustomerId: true },
  })
  return NextResponse.json({ subscription: subscription ?? { plan: "FREE", status: "FREE", currentPeriodEnd: null, stripeCustomerId: null } })
}
