import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { getTenantPlan } from "@/lib/plan-guard"
import { hasFeature } from "@/lib/permissions"
import { createPreference, qrImageUrl } from "@/lib/mercadopago"

// Plan-gated: PROFESSIONAL+ (proxied via feature:loyalty until a dedicated
// feature:mercadopago is added).

const ItemSchema = z.object({
  title: z.string().min(1),
  quantity: z.number().int().positive(),
  unit_price: z.number().nonnegative(),
})

const BodySchema = z.object({
  items: z.array(ItemSchema).min(1),
  externalReference: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const { error, tenantId, isSuperAdmin } = await getSessionTenant()
  if (error) return error

  if (!isSuperAdmin) {
    const plan = await getTenantPlan(tenantId!)
    // TODO: replace feature:loyalty proxy with a dedicated feature:mercadopago
    if (!hasFeature(plan, "feature:loyalty")) {
      return NextResponse.json({ error: "Mercado Pago disponible en plan Professional o superior" }, { status: 403 })
    }
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const cfg = await db.tenantConfig.findUnique({ where: { tenantId: tenantId! } })
  if (!cfg?.mpAccessToken) {
    return NextResponse.json({ error: "Falta configurar Mercado Pago. Andá a Configuración → Mercado Pago." }, { status: 400 })
  }

  try {
    const pref = await createPreference(
      cfg.mpAccessToken,
      parsed.data.items,
      parsed.data.externalReference,
    )
    return NextResponse.json({
      preferenceId: pref.id,
      initPoint: pref.init_point,
      qrUrl: qrImageUrl(pref.init_point),
    })
  } catch (e: any) {
    console.error("[POST /api/mercadopago/preference]", e)
    return NextResponse.json({ error: e?.message ?? "Error al crear preferencia" }, { status: 502 })
  }
}
