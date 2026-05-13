import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import forge from "node-forge"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { encryptAfipCert, isAfipCryptoConfigured } from "@/lib/afip-crypto"

export const dynamic = "force-dynamic"

/**
 * POST /api/configuracion/afip/generate-csr
 *
 * Genera localmente (server-side, no AfipSDK) un par private key RSA 2048
 * + CSR PKCS#10 con los datos del tenant. La private key se guarda
 * encriptada inmediatamente en TenantConfig — NO se devuelve al cliente.
 * Sólo el CSR se devuelve para que el user lo copie / descargue.
 *
 * Reemplaza el flujo manual con openssl + Terminal que era una de las
 * fricciones principales del onboarding AFIP.
 *
 * Body:
 *   { cuit: "20461243615", businessName?: "Joaquín Pérez", alias?: "orvex" }
 *
 * Response:
 *   { ok: true, csr: "-----BEGIN CERTIFICATE REQUEST-----..." }
 */

const bodySchema = z.object({
  cuit: z.string().regex(/^\d{11}$/, "CUIT debe tener 11 dígitos"),
  businessName: z.string().min(2).max(200).optional(),
  alias: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[A-Za-z0-9-]+$/, "alias sólo puede tener letras, números y guiones")
    .optional(),
})

export async function POST(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) {
    return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  if (session.user.role !== "OWNER") {
    return NextResponse.json(
      { error: "Solo el dueño puede generar el pedido de certificado" },
      { status: 403 },
    )
  }
  if (!isAfipCryptoConfigured()) {
    return NextResponse.json(
      {
        error:
          "AFIP_ENCRYPTION_KEY no configurada en el servidor — generala con `openssl rand -hex 32` y agregala a Railway.",
      },
      { status: 500 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", issues: parsed.error.issues },
      { status: 422 },
    )
  }
  const { cuit, businessName, alias } = parsed.data
  const effectiveAlias = alias ?? `orvex-${Date.now().toString(36)}`
  const effectiveBusinessName = businessName?.trim() || `CUIT ${cuit}`

  // 1. Generar private key RSA 2048
  const keys = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 })
  const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey)

  // 2. Construir el CSR con los attributes que AFIP espera:
  //    CN = alias del DN, O = razón social, C = AR, serialNumber = "CUIT NNNNNNNNNNN"
  const csr = forge.pki.createCertificationRequest()
  csr.publicKey = keys.publicKey
  csr.setSubject([
    { name: "countryName", value: "AR" },
    { name: "organizationName", value: effectiveBusinessName },
    { name: "commonName", value: effectiveAlias },
    { name: "serialName", value: `CUIT ${cuit}`, type: "2.5.4.5" },
  ])
  csr.sign(keys.privateKey, forge.md.sha256.create())
  const csrPem = forge.pki.certificationRequestToPem(csr)

  // 3. Persistir la private key encriptada — el user no la ve nunca.
  //    No tocamos el cert (afipCertX509) — el user lo va a subir cuando
  //    AFIP se lo firme.
  await db.tenantConfig.upsert({
    where: { tenantId: tenantId! },
    create: {
      tenantId: tenantId!,
      afipCertCuit: cuit,
      afipCertPrivateKey: encryptAfipCert(privateKeyPem),
      afipBusinessName: effectiveBusinessName,
      // Cualquier cert anterior queda inválido para esta nueva key — limpiamos.
      afipCertX509: null,
      afipReady: false,
      afipLastError: null,
    },
    update: {
      afipCertCuit: cuit,
      afipCertPrivateKey: encryptAfipCert(privateKeyPem),
      afipBusinessName: effectiveBusinessName,
      afipCertX509: null,
      afipReady: false,
      afipLastError: null,
    },
  })

  // Invalidar TAs por las dudas (nueva key → TA viejo no aplica).
  await db.afipTicket.deleteMany({ where: { tenantId: tenantId! } }).catch(() => {})

  return NextResponse.json({
    ok: true,
    csr: csrPem,
    alias: effectiveAlias,
    cuit,
    businessName: effectiveBusinessName,
  })
}
