import { NextRequest, NextResponse } from "next/server"
import forge from "node-forge"
import { getSessionTenant } from "@/lib/tenant"

export const dynamic = "force-dynamic"

/**
 * POST /api/configuracion/afip/inspect-cert
 *
 * Recibe un certificado PEM (string) y devuelve info parseada:
 *   - alias (commonName)
 *   - CUIT (serialNumber)
 *   - razón social (organizationName)
 *   - fecha de vencimiento + días restantes
 *   - validez (ok / error específico)
 *
 * Usado por el wizard de cert para dar feedback en vivo al pegar el cert
 * firmado por AFIP — antes de que el user le dé "Guardar".
 */
export async function POST(req: NextRequest) {
  const { error } = await getSessionTenant()
  if (error) return error

  let body: { cert?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 })
  }

  const pem = body.cert?.trim() ?? ""
  if (!pem) {
    return NextResponse.json({ ok: false, error: "Falta el cert" }, { status: 422 })
  }
  if (!pem.startsWith("-----BEGIN CERTIFICATE-----")) {
    return NextResponse.json({
      ok: false,
      error: "Esto no parece un certificado — tiene que empezar con -----BEGIN CERTIFICATE-----",
    })
  }
  if (!pem.includes("-----END CERTIFICATE-----")) {
    return NextResponse.json({
      ok: false,
      error: "El certificado está incompleto — falta la línea -----END CERTIFICATE-----",
    })
  }

  let cert: forge.pki.Certificate
  try {
    cert = forge.pki.certificateFromPem(pem)
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: `Certificado mal formateado: ${e instanceof Error ? e.message : "error desconocido"}`,
    })
  }

  // Extraer subject attributes
  const subject = cert.subject
  const cn = subject.getField("CN")?.value ?? null
  const o = subject.getField("O")?.value ?? null
  const serial = subject.getField({ name: "serialName" })?.value
    ?? subject.getField({ type: "2.5.4.5" })?.value
    ?? null

  // Extraer CUIT del serialNumber (formato típico: "CUIT 20123456789")
  let cuit: string | null = null
  if (typeof serial === "string") {
    const m = serial.match(/CUIT\s*(\d{11})/i)
    if (m) cuit = m[1]
  }

  const notAfter = cert.validity.notAfter
  const notBefore = cert.validity.notBefore
  const now = Date.now()
  const daysToExpire = Math.floor((notAfter.getTime() - now) / (24 * 60 * 60 * 1000))
  const isExpired = notAfter.getTime() < now
  const expiresSoon = daysToExpire <= 30 && !isExpired

  // Detectar si es de testing (issuer = "Computadores Test" es la CA de homo)
  const issuerCn = cert.issuer.getField("CN")?.value ?? null
  const isTestCert = typeof issuerCn === "string" && /test/i.test(issuerCn)

  return NextResponse.json({
    ok: !isExpired,
    alias: typeof cn === "string" ? cn : null,
    businessName: typeof o === "string" ? o : null,
    cuit,
    notBefore: notBefore.toISOString(),
    notAfter: notAfter.toISOString(),
    daysToExpire,
    isExpired,
    expiresSoon,
    environment: isTestCert ? "HOMOLOGACION" : "PRODUCCION",
    warning: isExpired
      ? `El cert venció el ${notAfter.toLocaleDateString("es-AR")}`
      : expiresSoon
        ? `El cert vence en ${daysToExpire} días — renová antes`
        : null,
  })
}
