/**
 * Punto de entrada para el cliente AFIP nativo (sin AfipSDK).
 *
 * Combina WSAA (autenticación) + WSFEv1 (factura electrónica) en un cliente
 * listo para usar desde lib/afip-issue.ts.
 *
 * Uso desde el resto del código:
 *
 *   const client = await buildWSFEClientForTenant(tenantId)
 *   const last = await client.getLastVoucherNumber(1, 11)
 *   const cae = await client.requestCAE({ ... })
 */

import { db } from "@/lib/db"
import { decryptAfipCert } from "@/lib/afip-crypto"
import { WSFEClient, type AlicIVA } from "./wsfe"
import type { AfipMode } from "./wsaa"
import type { CondicionIVA, DocType } from "@/lib/afip"

export { WSFEClient } from "./wsfe"
export type {
  AlicIVA,
  CAEResult,
  DummyResult,
  RequestCAEInput,
  WSFEClientOptions,
  CbteAsoc,
  Tributo,
} from "./wsfe"
export type { AfipMode, TicketAccess } from "./wsaa"

// =============================================================================
// AFIP IVA alicuota IDs
// =============================================================================
//
// Tabla oficial AFIP — id del campo Iva.AlicIva.Id en FECAESolicitar.
// Sólo agregamos las que están vigentes a fecha de hoy.

export const AFIP_IVA_ALIC = {
  /** 0% */
  ZERO: 3,
  /** 10.5% */
  REDUCED: 4,
  /** 21% */
  STANDARD: 5,
  /** 27% */
  UPPER: 6,
  /** 5% */
  FIVE: 8,
  /** 2.5% */
  TWO_FIVE: 9,
} as const

/** Mapea una tasa decimal (0.21) al Id AFIP correspondiente. */
export function ivaRateToAfipId(rate: number): number {
  if (rate === 0) return AFIP_IVA_ALIC.ZERO
  if (closeTo(rate, 0.025)) return AFIP_IVA_ALIC.TWO_FIVE
  if (closeTo(rate, 0.05)) return AFIP_IVA_ALIC.FIVE
  if (closeTo(rate, 0.105)) return AFIP_IVA_ALIC.REDUCED
  if (closeTo(rate, 0.21)) return AFIP_IVA_ALIC.STANDARD
  if (closeTo(rate, 0.27)) return AFIP_IVA_ALIC.UPPER
  return AFIP_IVA_ALIC.STANDARD
}

function closeTo(a: number, b: number, eps = 0.001): boolean {
  return Math.abs(a - b) < eps
}

// =============================================================================
// Condición IVA del receptor — RG 5616/2024
// =============================================================================
//
// AFIP exige (desde mayo 2024 para algunos comprobantes) declarar la
// condición frente al IVA del receptor con un código específico.
// Si no se manda y AFIP lo requiere, FECAESolicitar devuelve error.

export const AFIP_COND_IVA_RECEPTOR = {
  RI: 1,
  EXENTO: 4,
  CF: 5,
  MONOTRIBUTO: 6,
  NO_CATEGORIZADO: 7,
  EXTERIOR: 8,
  CLIENTE_EXTERIOR: 9,
  MONOTRIBUTO_SOCIAL: 13,
  NO_ALCANZADO: 15,
} as const

export function condicionToReceptorId(c: CondicionIVA): number {
  switch (c) {
    case "RI":
      return AFIP_COND_IVA_RECEPTOR.RI
    case "MONOTRIBUTO":
      return AFIP_COND_IVA_RECEPTOR.MONOTRIBUTO
    case "EXENTO":
      return AFIP_COND_IVA_RECEPTOR.EXENTO
    case "CF":
    default:
      return AFIP_COND_IVA_RECEPTOR.CF
  }
}

// =============================================================================
// Documento del receptor — códigos AFIP
// =============================================================================

export function docTypeToAfipCode(docType: DocType | string | null | undefined): number {
  switch (docType) {
    case "CUIT":
      return 80
    case "CUIL":
      return 86
    case "DNI":
      return 96
    case "EXTRANJERO":
      return 94
    default:
      return 99 // CF / SIN_IDENTIFICAR
  }
}

// =============================================================================
// IVA breakdown → AFIP AlicIVA array
// =============================================================================

/**
 * Agrupa el breakdown por tasa y devuelve el array AlicIVA que espera
 * FECAESolicitar. Filtra alicuotas con base = 0 (AFIP las rechaza).
 */
export function buildAlicIVAArray(
  breakdown: Array<{ rate: number; baseAmount: number; ivaAmount: number }>,
): AlicIVA[] {
  return breakdown
    .filter((b) => b.baseAmount > 0)
    .map((b) => ({
      id: ivaRateToAfipId(b.rate),
      baseImp: round2(b.baseAmount),
      importe: round2(b.ivaAmount),
    }))
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// =============================================================================
// Builder por tenant
// =============================================================================

/**
 * Construye un WSFEClient para un tenant. Lee cert/key encriptados de DB y
 * decifra usando AFIP_ENCRYPTION_KEY.
 *
 * Throw si:
 *   - El tenant no tiene config AFIP
 *   - Faltan cert / key
 *   - Falta CUIT
 */
interface TenantAfipConfigRow {
  afipMode: string | null
  afipCertCuit: string | null
  afipCertX509: string | null
  afipCertPrivateKey: string | null
}

export async function buildWSFEClientForTenant(tenantId: string): Promise<WSFEClient> {
  const cfg = (await db.tenantConfig.findUnique({
    where: { tenantId },
    select: {
      afipMode: true,
      afipCertCuit: true,
      afipCertX509: true,
      afipCertPrivateKey: true,
    },
  })) as TenantAfipConfigRow | null

  if (!cfg?.afipCertCuit) throw new Error("Falta CUIT del emisor")
  if (!cfg.afipCertX509 || !cfg.afipCertPrivateKey) {
    throw new Error("Falta certificado o private key (subilos en /configuracion/afip)")
  }

  const certPem = decryptAfipCert(cfg.afipCertX509)
  const keyPem = decryptAfipCert(cfg.afipCertPrivateKey)
  const mode: AfipMode = cfg.afipMode === "PRODUCCION" ? "PRODUCCION" : "HOMOLOGACION"

  return new WSFEClient({
    cuit: String(cfg.afipCertCuit),
    certPem,
    keyPem,
    mode,
    cacheKey: tenantId,
  })
}

// =============================================================================
// Health check por tenant
// =============================================================================

export interface NativeHealthResult {
  ok: boolean
  message: string
  detail?: { appServer: string; dbServer: string; authServer: string }
}

/**
 * Verifica conectividad con WSFE (FEDummy). NO requiere TA — sirve aunque
 * el cert no esté autorizado todavía. Útil para diagnóstico inicial.
 */
export async function nativeHealthCheck(tenantId: string): Promise<NativeHealthResult> {
  try {
    const client = await buildWSFEClientForTenant(tenantId)
    const r = await client.dummy()
    const allOk = r.appServer === "OK" && r.dbServer === "OK" && r.authServer === "OK"
    return {
      ok: allOk,
      message: allOk ? "WSFE OK" : `WSFE parcial: app=${r.appServer} db=${r.dbServer} auth=${r.authServer}`,
      detail: r,
    }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Verifica además que el TA del WSAA se obtiene OK (firma + auth). Es la
 * prueba real de que cert + key son válidos y están asociados al servicio.
 */
export async function nativeAuthCheck(tenantId: string): Promise<NativeHealthResult> {
  try {
    const client = await buildWSFEClientForTenant(tenantId)
    // Pidiendo getLastVoucherNumber forzamos a obtener TA del WSAA.
    // Si el cert no está habilitado para wsfe, acá pincha.
    await client.getLastVoucherNumber(1, 11)
    return { ok: true, message: "WSAA + WSFE OK (cert habilitado para wsfe)" }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) }
  }
}
