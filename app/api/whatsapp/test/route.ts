import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { hasFeature } from "@/lib/permissions"
import { sendWhatsApp, isWhatsAppConfigured } from "@/lib/whatsapp"
import type { Plan } from "@/lib/utils"

export async function POST() {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (session.user.role !== "OWNER" && session.user.role !== "ADMIN")
    return NextResponse.json({ error: "Solo el dueño o un admin puede testear" }, { status: 403 })

  const sub = await db.subscription.findUnique({
    where: { tenantId: tenantId! },
    select: { plan: true },
  })
  const plan = (sub?.plan as Plan) ?? "FREE"
  if (!hasFeature(plan, "feature:whatsapp")) {
    return NextResponse.json({ error: "WhatsApp no está incluido en tu plan." }, { status: 402 })
  }

  if (!isWhatsAppConfigured()) {
    return NextResponse.json({
      error: "UltraMsg no está configurado en Railway. Pedile al admin que agregue ULTRAMSG_INSTANCE_ID y ULTRAMSG_TOKEN.",
    }, { status: 503 })
  }

  const cfg = (await db.tenantConfig.findUnique({
    where: { tenantId: tenantId! },
  })) as any
  const phone = cfg?.whatsappPhone
  if (!phone) {
    return NextResponse.json({ error: "Configurá tu número de WhatsApp primero." }, { status: 400 })
  }

  const tenant = await db.tenant.findUnique({
    where: { id: tenantId! },
    select: { name: true },
  })

  const result = await sendWhatsApp(
    phone,
    `✅ ${tenant?.name ?? "RetailAR"}: Esta es una prueba. Las notificaciones de WhatsApp ya están funcionando. Te avisaremos cuando haya stock bajo o eventos importantes.`
  )

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "No se pudo enviar" }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
