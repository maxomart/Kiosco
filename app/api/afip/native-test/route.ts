import { NextResponse } from "next/server"
import { getSessionTenant } from "@/lib/tenant"
import {
  buildWSFEClientForTenant,
  nativeAuthCheck,
  nativeHealthCheck,
} from "@/lib/afip-native"
import { certExpiresSoon, certNotAfter } from "@/lib/afip-native/cms"
import { db } from "@/lib/db"
import { decryptAfipCert } from "@/lib/afip-crypto"

/**
 * Diagnóstico end-to-end del cliente AFIP nativo (sin tocar nada en DB ni
 * emitir comprobantes reales). Útil para validar que cert + key del tenant
 * están bien configurados antes de switchear `afipCertProvider` a "native".
 *
 * GET → corre 3 chequeos:
 *   1. Cert válido y no vencido
 *   2. FEDummy (sin auth) — ¿el server WSFE está vivo?
 *   3. WSAA + FECompUltimoAutorizado — ¿el TA se obtiene y el cert está
 *      asociado al servicio wsfe?
 *
 * POST con body `{ ptoVta, cbteTipo }` → corre además FECompUltimoAutorizado
 * para el PV/tipo que indique. Devuelve el último número emitido.
 */

interface CheckResult {
  ok: boolean
  message: string
  detail?: unknown
}

interface CertRow {
  afipCertX509: string | null
  afipCertCuit: string | null
  afipMode: string | null
}

async function certCheck(tenantId: string): Promise<CheckResult> {
  try {
    const cfg = (await db.tenantConfig.findUnique({
      where: { tenantId },
      select: { afipCertX509: true, afipCertCuit: true, afipMode: true },
    })) as CertRow | null

    if (!cfg?.afipCertX509) return { ok: false, message: "No hay certificado guardado" }
    const certPem = decryptAfipCert(cfg.afipCertX509)
    const notAfter = certNotAfter(certPem)
    const expiringSoon = certExpiresSoon(certPem, 30)
    return {
      ok: !expiringSoon,
      message: expiringSoon
        ? `Cert vence pronto: ${notAfter.toISOString().slice(0, 10)}`
        : `Cert OK (vence ${notAfter.toISOString().slice(0, 10)})`,
      detail: {
        cuit: cfg.afipCertCuit,
        mode: cfg.afipMode,
        notAfter: notAfter.toISOString(),
      },
    }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Error leyendo certificado",
    }
  }
}

export async function GET() {
  const { error, tenantId, session } = await getSessionTenant()
  if (error) return error
  const role = session!.user.role
  if (role !== "OWNER" && role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  const checks = {
    cert: await certCheck(tenantId!),
    dummy: await nativeHealthCheck(tenantId!),
    auth: await nativeAuthCheck(tenantId!),
  }
  const ok = checks.cert.ok && checks.dummy.ok && checks.auth.ok
  return NextResponse.json({ ok, checks })
}

export async function POST(req: Request) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error) return error
  const role = session!.user.role
  if (role !== "OWNER" && role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const ptoVta = Number(body?.ptoVta ?? 1)
  const cbteTipo = Number(body?.cbteTipo ?? 11)
  if (!Number.isInteger(ptoVta) || ptoVta <= 0) {
    return NextResponse.json({ ok: false, error: "ptoVta inválido" }, { status: 422 })
  }
  if (!Number.isInteger(cbteTipo) || cbteTipo <= 0) {
    return NextResponse.json({ ok: false, error: "cbteTipo inválido" }, { status: 422 })
  }

  try {
    const client = await buildWSFEClientForTenant(tenantId!)
    const last = await client.getLastVoucherNumber(ptoVta, cbteTipo)
    return NextResponse.json({
      ok: true,
      ptoVta,
      cbteTipo,
      lastVoucherNumber: last,
      nextWouldBe: last + 1,
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 502 },
    )
  }
}
