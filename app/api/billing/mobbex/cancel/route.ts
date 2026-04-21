import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { cancelMobbexSubscriber, parseMobbexId } from "@/lib/mobbex-billing"

export const dynamic = "force-dynamic"

export async function POST() {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (session.user.role !== "OWNER")
    return NextResponse.json({ error: "Solo el dueño puede gestionar la suscripción" }, { status: 403 })

  const sub = await db.subscription.findUnique({ where: { tenantId: tenantId! } })
  if (!sub?.mpPreapprovalId) return NextResponse.json({ error: "Sin suscripción activa" }, { status: 400 })

  const ids = parseMobbexId(sub.mpPreapprovalId)
  if (!ids) return NextResponse.json({ error: "ID de suscripción inválido" }, { status: 400 })

  try {
    await cancelMobbexSubscriber(ids.subscriptionUid, ids.subscriberUid)
  } catch (err: any) {
    console.error("[mobbex/cancel]", err?.message)
  }

  await db.subscription.update({
    where: { tenantId: tenantId! },
    data: { status: "CANCELLED", mpStatus: "cancelled", cancelledAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
