import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { getAfipConfig } from "@/lib/afip-sdk"
import { encryptAfipCert, isAfipCryptoConfigured } from "@/lib/afip-crypto"

export const dynamic = "force-dynamic"

const saveSchema = z.object({
  enabled: z.boolean().optional(),
  mode: z.enum(["HOMOLOGACION", "PRODUCCION"]).optional(),
  condicionIVA: z.enum(["RI", "MONOTRIBUTO", "EXENTO"]).optional(),
  pointOfSale: z.number().int().min(1).max(99999).optional(),
  cuit: z.string().regex(/^\d{11}$/).optional(),
  businessName: z.string().min(2).max(200).optional(),
  cert: z.string().optional(),       // PEM contents (X.509)
  privateKey: z.string().optional(), // PEM contents
})

export async function GET() {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Solo el dueño puede ver la config AFIP" }, { status: 403 })
  }

  const cfg = await getAfipConfig(tenantId!)
  return NextResponse.json({
    config: cfg,
    cryptoConfigured: isAfipCryptoConfigured(),
    sdkConfigured: !!process.env.AFIP_SDK_ACCESS_TOKEN,
  })
}

export async function PATCH(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Solo el dueño puede editar la config AFIP" }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }
  const parsed = saveSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", issues: parsed.error.issues }, { status: 422 })
  }
  const data = parsed.data

  // Si se están subiendo cert o key, requerimos que la encriptación esté
  // configurada — sino los guardamos en plano y eso es un riesgo grave.
  if ((data.cert || data.privateKey) && !isAfipCryptoConfigured()) {
    return NextResponse.json({
      error: "AFIP_ENCRYPTION_KEY no configurada en el servidor. Generala con `openssl rand -hex 32` y agregala a Railway antes de subir certificados.",
    }, { status: 500 })
  }

  const updateData: Record<string, unknown> = {}
  if (data.enabled !== undefined)        updateData.afipEnabled = data.enabled
  if (data.mode !== undefined)           updateData.afipMode = data.mode
  if (data.condicionIVA !== undefined)   updateData.afipCondicionIVA = data.condicionIVA
  if (data.pointOfSale !== undefined)    updateData.afipPointOfSale = data.pointOfSale
  if (data.cuit !== undefined)           updateData.afipCertCuit = data.cuit
  if (data.businessName !== undefined)   updateData.afipBusinessName = data.businessName
  if (data.cert !== undefined && data.cert.trim()) {
    updateData.afipCertX509 = encryptAfipCert(data.cert.trim())
    // Cambió el cert → resetear ready hasta que se vuelva a probar
    updateData.afipReady = false
  }
  if (data.privateKey !== undefined && data.privateKey.trim()) {
    updateData.afipCertPrivateKey = encryptAfipCert(data.privateKey.trim())
    updateData.afipReady = false
  }

  await db.tenantConfig.upsert({
    where: { tenantId: tenantId! },
    create: { tenantId: tenantId!, ...updateData },
    update: updateData,
  })

  const cfg = await getAfipConfig(tenantId!)
  return NextResponse.json({ ok: true, config: cfg })
}
