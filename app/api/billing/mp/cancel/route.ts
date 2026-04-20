import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { cancelPreapproval } from "@/lib/mp-billing"

export const dynamic = "force-dynamic"

export async function POST() {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) {
    return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  if (session.user.role !== "OWNER") {
    return NextResponse.json(
      { error: "Solo el dueño del comercio puede cancelar la suscripción" },
      { status: 403 }
    )
  }

  const sub = await db.subscription.findUnique({ where: { tenantId: tenantId! } })
  if (!sub?.mpPreapprovalId) {
    return NextResponse.json(
      { error: "No hay suscripción activa con Mercado Pago" },
      { status: 404 }
    )
  }

  try {
    await cancelPreapproval(sub.mpPreapprovalId)
  } catch (err: any) {
    console.error("[mp/cancel] cancelPreapproval error:", err)
    return NextResponse.json(
      { error: "No se pudo cancelar en Mercado Pago", detail: err?.message },
      { status: 502 }
    )
  }

  await db.subscription.update({
    where: { tenantId: tenantId! },
    data: {
      status: "CANCELLED",
      mpStatus: "cancelled",
      cancelledAt: new Date(),
    },
  })

  return NextResponse.json({ ok: true })
}
