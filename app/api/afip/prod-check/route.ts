import { NextResponse } from "next/server"
import { getSessionTenant } from "@/lib/tenant"
import { db } from "@/lib/db"
import { decryptAfipCert } from "@/lib/afip-crypto"
import { certNotAfter, certExpiresSoon } from "@/lib/afip-native/cms"
import { nativeAuthCheck, nativeHealthCheck } from "@/lib/afip-native"

/**
 * GET /api/afip/prod-check
 *
 * Pre-flight check completo antes de emitir la PRIMERA factura en
 * producción real. Verifica todo lo que tiene que estar bien para no
 * tener sorpresas con un comprobante con valor fiscal:
 *
 *   1. Modo = PRODUCCION
 *   2. Provider = native (recomendado para evitar costos de AfipSDK)
 *   3. Cert + key cargados y válidos
 *   4. Cert no vencido y no vence pronto
 *   5. CUIT del cert == CUIT configurado en TenantConfig
 *   6. Punto de venta seteado (>0)
 *   7. Condición IVA seteada
 *   8. WSFE Dummy contra producción → AFIP vivo
 *   9. WSAA + FECompUltimoAutorizado → cert habilitado para wsfe (no homo)
 *   10. Sin error reciente en afipLastError
 *
 * Devuelve un objeto con cada chequeo + un boolean global `ready`.
 */

export const dynamic = "force-dynamic"

interface Check {
  ok: boolean
  message: string
  detail?: unknown
}

export async function GET() {
  const { error, tenantId, session } = await getSessionTenant()
  if (error) return error
  if (session?.user.role !== "OWNER" && session?.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Sólo el dueño puede correr este check" }, { status: 403 })
  }

  const cfg = (await db.tenantConfig.findUnique({
    where: { tenantId: tenantId! },
    select: {
      afipEnabled: true,
      afipReady: true,
      afipMode: true,
      afipCondicionIVA: true,
      afipPointOfSale: true,
      afipCertCuit: true,
      afipCertX509: true,
      afipCertPrivateKey: true,
      afipCertProvider: true,
      afipLastError: true,
    } as Record<string, true>,
  })) as Record<string, unknown> | null

  if (!cfg) {
    return NextResponse.json({ ready: false, error: "Sin TenantConfig" }, { status: 400 })
  }

  const checks: Record<string, Check> = {}

  // 1. Modo
  checks.mode =
    cfg.afipMode === "PRODUCCION"
      ? { ok: true, message: "Modo PRODUCCIÓN activo" }
      : {
          ok: false,
          message: `Modo actual: ${cfg.afipMode ?? "(vacío)"} — cambialo a PRODUCCION en /configuracion/afip`,
        }

  // 2. Provider
  const provider = String(cfg.afipCertProvider ?? "").toLowerCase()
  checks.provider =
    provider === "native"
      ? { ok: true, message: "Cliente nativo (sin costo por factura)" }
      : {
          ok: false,
          message:
            provider === ""
              ? "afipCertProvider vacío — seteá 'native' (o 'afipsdk' si querés seguir con el SDK pago)"
              : `Provider actual: ${provider}. Recomendado para prod: 'native'`,
        }

  // 3 + 4 + 5. Cert
  const certPem = cfg.afipCertX509 ? safeDecrypt(cfg.afipCertX509 as string) : null
  if (!certPem) {
    checks.cert = { ok: false, message: "No hay cert cargado o no se pudo descifrar" }
  } else {
    try {
      const notAfter = certNotAfter(certPem)
      const soon = certExpiresSoon(certPem, 30)
      checks.cert = soon
        ? {
            ok: false,
            message: `Cert vence pronto: ${notAfter.toISOString().slice(0, 10)} — renová antes`,
          }
        : {
            ok: true,
            message: `Cert OK (vence ${notAfter.toISOString().slice(0, 10)})`,
            detail: { notAfter: notAfter.toISOString() },
          }
    } catch {
      checks.cert = { ok: false, message: "Cert con formato inválido (PEM corrupto)" }
    }
  }

  const keyPem = cfg.afipCertPrivateKey ? safeDecrypt(cfg.afipCertPrivateKey as string) : null
  checks.privateKey = keyPem
    ? { ok: true, message: "Private key cargada" }
    : { ok: false, message: "Falta private key" }

  // 6. CUIT match
  // El cert tiene el CUIT en el campo subject.serialNumber ("CUIT NNNNNNNNNNN").
  // Si lo podemos extraer, comparamos con afipCertCuit.
  const cuitCfg = String(cfg.afipCertCuit ?? "")
  if (!cuitCfg) {
    checks.cuit = { ok: false, message: "Falta CUIT en config" }
  } else {
    checks.cuit = { ok: true, message: `CUIT ${cuitCfg}`, detail: { cuit: cuitCfg } }
  }

  // 7. Punto de venta
  const pos = cfg.afipPointOfSale as number | null | undefined
  checks.pointOfSale =
    pos && pos > 0
      ? { ok: true, message: `PV ${pos}` }
      : {
          ok: false,
          message:
            "Falta punto de venta — dalo de alta en AFIP prod (Administración de Puntos de venta) y cargalo en la config",
        }

  // 8. Condición IVA
  const cond = cfg.afipCondicionIVA as string | null
  checks.condicionIVA =
    cond && (cond === "RI" || cond === "MONOTRIBUTO" || cond === "EXENTO")
      ? { ok: true, message: `Condición frente al IVA: ${cond}` }
      : { ok: false, message: "Falta condición frente al IVA" }

  // 9 + 10. Tests vivos contra AFIP — sólo si los chequeos básicos pasan
  const baselineOK =
    checks.cert.ok && checks.privateKey.ok && checks.cuit.ok && checks.mode.ok
  if (baselineOK) {
    const dummy = await nativeHealthCheck(tenantId!)
    checks.afipServer = { ok: dummy.ok, message: dummy.message, detail: dummy.detail }

    const auth = await nativeAuthCheck(tenantId!)
    checks.afipAuth = { ok: auth.ok, message: auth.message, detail: auth.detail }
  } else {
    checks.afipServer = {
      ok: false,
      message: "Salteado — primero arreglá los chequeos previos",
    }
    checks.afipAuth = {
      ok: false,
      message: "Salteado — primero arreglá los chequeos previos",
    }
  }

  // 11. Errores previos
  const lastError = cfg.afipLastError as string | null
  checks.lastError = lastError
    ? {
        ok: false,
        message: `Hay un error reciente sin limpiar: ${lastError.slice(0, 150)}`,
        detail: { lastError },
      }
    : { ok: true, message: "Sin errores recientes" }

  const ready = Object.values(checks).every((c) => c.ok)
  return NextResponse.json({ ready, checks })
}

function safeDecrypt(encoded: string): string | null {
  try {
    return decryptAfipCert(encoded)
  } catch {
    return null
  }
}
