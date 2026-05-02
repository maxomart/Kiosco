import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { createCertViaSDK, testAfipConnection } from "@/lib/afip-sdk"
import { encryptAfipCert, isAfipCryptoConfigured } from "@/lib/afip-crypto"

export const dynamic = "force-dynamic"
// El proceso puede tardar hasta 2 minutos (AfipSDK levanta el CSR contra ARCA).
export const maxDuration = 180

/**
 * AFIP "uno-click" — genera el certificado X.509 del kiosquero a partir de
 * su CUIT + Clave Fiscal usando AfipSDK como proxy contra ARCA. Encripta y
 * guarda el cert/key en TenantConfig, después prueba la conexión.
 *
 * La clave fiscal **nunca** se loguea ni se persiste.
 */

const bodySchema = z.object({
  cuit: z.string().regex(/^\d{11}$/, "CUIT debe tener 11 dígitos"),
  claveFiscal: z.string().min(1, "Falta la clave fiscal"),
  mode: z.enum(["HOMOLOGACION", "PRODUCCION"]).default("HOMOLOGACION"),
  alias: z.string().min(2).max(50).optional(),
  // Datos de identificación para guardar en config
  businessName: z.string().min(2).max(200).optional(),
  condicionIVA: z.enum(["RI", "MONOTRIBUTO", "EXENTO"]).optional(),
  pointOfSale: z.number().int().min(1).max(99999).optional(),
})

export async function POST(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Solo el dueño puede generar certificados" }, { status: 403 })
  }

  if (!isAfipCryptoConfigured()) {
    return NextResponse.json({
      error: "AFIP_ENCRYPTION_KEY no configurada. Generala con `openssl rand -hex 32` y agregala a Railway.",
    }, { status: 500 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", issues: parsed.error.issues }, { status: 422 })
  }
  const { cuit, claveFiscal, mode, alias, businessName, condicionIVA, pointOfSale } = parsed.data

  // 1. Generar cert vía AfipSDK
  const aliasFinal = alias ?? `orvex-${cuit}-${Date.now().toString(36)}`
  const cert = await createCertViaSDK({
    cuit,
    username: cuit,         // En AFIP el usuario es el CUIT
    password: claveFiscal,  // No persistir
    alias: aliasFinal,
    production: mode === "PRODUCCION",
  })

  if (!cert.ok || !cert.cert || !cert.key) {
    return NextResponse.json({ error: cert.message }, { status: 502 })
  }

  // 2. Persistir encriptado + datos opcionales del kiosquero
  const updateData: Record<string, unknown> = {
    afipCertCuit: cuit,
    afipCertX509: encryptAfipCert(cert.cert),
    afipCertPrivateKey: encryptAfipCert(cert.key),
    afipMode: mode,
    afipReady: false,
  }
  if (businessName) updateData.afipBusinessName = businessName
  if (condicionIVA) updateData.afipCondicionIVA = condicionIVA
  if (pointOfSale)  updateData.afipPointOfSale = pointOfSale

  await db.tenantConfig.upsert({
    where: { tenantId: tenantId! },
    create: { tenantId: tenantId!, ...updateData },
    update: updateData,
  })

  // 3. Probar conexión inmediatamente — confirma que el cert quedó válido en ARCA
  const test = await testAfipConnection(tenantId!)

  return NextResponse.json({
    ok: true,
    certCreated: true,
    connectionOk: test.ok,
    connectionMessage: test.message,
  })
}
