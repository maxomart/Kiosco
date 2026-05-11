/**
 * Wrapper específico de @afipsdk/afip.js — para conexión y testing.
 *
 * Es complementario a lib/afip.ts (que tiene la abstracción de providers).
 * Las funciones acá usan directamente el SDK con las credenciales del tenant
 * encriptadas en TenantConfig.
 *
 * Cómo funciona:
 *   - AfipSDK provee un servicio cloud (afipsdk.com) que actúa como proxy
 *     hacia ARCA. Su access_token global se setea en AFIP_SDK_ACCESS_TOKEN.
 *   - Cada tenant aporta su CUIT + certificado X.509 + private key
 *     (guardamos encriptados en TenantConfig).
 *   - Modo HOMOLOGACION = ambiente testing de ARCA (production:false).
 *     Modo PRODUCCION = facturación real (production:true).
 */

import { db } from "./db"
import { decryptAfipCert } from "./afip-crypto"

/**
 * Extrae el motivo real de errores de AfipSDK. El SDK usa axios — cuando
 * AFIP devuelve 4xx, axios tira un AxiosError con message="Request failed
 * with status code 400" (inútil) y el verdadero motivo en `response.data`.
 * Esta función junta status + body para que el usuario vea la causa.
 */
function extractSdkError(err: unknown): string {
  const e = err as {
    message?: string
    response?: { data?: unknown; status?: number; statusText?: string }
  }
  if (e?.response?.data !== undefined) {
    const status = e.response.status ?? "?"
    const data = e.response.data
    let bodyStr: string
    if (typeof data === "string") {
      bodyStr = data
    } else if (data && typeof data === "object") {
      const d = data as { error?: string; message?: string; msg?: string }
      bodyStr = d.error ?? d.message ?? d.msg ?? JSON.stringify(data)
    } else {
      bodyStr = String(data)
    }
    return `[HTTP ${status}] ${bodyStr}`
  }
  if (err instanceof Error) return err.message
  return String(err)
}

type AfipInstance = any
let _AfipCtor: any = null
async function loadAfip(): Promise<any> {
  if (!_AfipCtor) {
    const mod: any = await import("@afipsdk/afip.js")
    _AfipCtor = mod?.default ?? mod
  }
  return _AfipCtor
}

export interface AfipTenantConfig {
  enabled: boolean
  ready: boolean
  mode: "HOMOLOGACION" | "PRODUCCION"
  condicionIVA: "RI" | "MONOTRIBUTO" | "EXENTO" | null
  pointOfSale: number | null
  cuit: string | null
  businessName: string | null
  hasCert: boolean
  hasPrivateKey: boolean
  lastSyncAt: Date | null
  lastError: string | null
}

export async function getAfipConfig(tenantId: string): Promise<AfipTenantConfig | null> {
  const cfg = await db.tenantConfig.findUnique({
    where: { tenantId },
    select: {
      afipEnabled: true,
      afipReady: true,
      afipMode: true,
      afipCondicionIVA: true,
      afipPointOfSale: true,
      afipCertCuit: true,
      afipBusinessName: true,
      afipCertX509: true,
      afipCertPrivateKey: true,
      afipLastSyncAt: true,
      afipLastError: true,
    } as any,
  })
  if (!cfg) return null
  const c = cfg as any
  return {
    enabled: c.afipEnabled,
    ready: c.afipReady,
    mode: (c.afipMode as AfipTenantConfig["mode"]) ?? "HOMOLOGACION",
    condicionIVA: (c.afipCondicionIVA as AfipTenantConfig["condicionIVA"]) ?? null,
    pointOfSale: c.afipPointOfSale,
    cuit: c.afipCertCuit,
    businessName: c.afipBusinessName,
    hasCert: !!c.afipCertX509,
    hasPrivateKey: !!c.afipCertPrivateKey,
    lastSyncAt: c.afipLastSyncAt,
    lastError: c.afipLastError,
  }
}

async function buildAfipClient(tenantId: string): Promise<AfipInstance> {
  const accessToken = process.env.AFIP_SDK_ACCESS_TOKEN
  if (!accessToken) {
    throw new Error("AFIP_SDK_ACCESS_TOKEN no configurado en el servidor")
  }
  const cfg = await db.tenantConfig.findUnique({
    where: { tenantId },
    select: {
      afipMode: true,
      afipCertCuit: true,
      afipCertX509: true,
      afipCertPrivateKey: true,
    } as any,
  })
  const c = cfg as any
  if (!c?.afipCertCuit) throw new Error("Falta CUIT del kiosquero")
  if (!c.afipCertX509 || !c.afipCertPrivateKey) {
    throw new Error("Falta certificado o private key — subilos en /configuracion/afip")
  }

  const cert = decryptAfipCert(c.afipCertX509)
  const key = decryptAfipCert(c.afipCertPrivateKey)
  const Afip = await loadAfip()
  return new Afip({
    CUIT: c.afipCertCuit,
    cert,
    key,
    production: c.afipMode === "PRODUCCION",
    access_token: accessToken,
  })
}

export interface AfipServerStatus {
  ok: boolean
  message: string
  detail?: any
}

/**
 * Pega contra ARCA para verificar que las credenciales son válidas.
 * Si el tenant usa `afipCertProvider="native"`, delegamos al cliente WSAA/WSFE
 * propio (lib/afip-native). Sino, usamos el SDK como antes.
 */
export async function testAfipConnection(tenantId: string): Promise<AfipServerStatus> {
  const providerCfg = (await db.tenantConfig.findUnique({
    where: { tenantId },
    select: { afipCertProvider: true } as any,
  })) as { afipCertProvider?: string | null } | null
  const provider = (providerCfg?.afipCertProvider ?? "").toLowerCase()

  if (provider === "native") {
    // Lazy import para no traer node-forge si nadie usa native.
    const { nativeAuthCheck } = await import("./afip-native")
    const r = await nativeAuthCheck(tenantId)
    await db.tenantConfig
      .update({
        where: { tenantId },
        data: r.ok
          ? ({ afipReady: true, afipLastSyncAt: new Date(), afipLastError: null } as any)
          : ({ afipReady: false, afipLastError: r.message.slice(0, 500) } as any),
      })
      .catch(() => {})
    return { ok: r.ok, message: r.message, detail: r.detail }
  }

  try {
    const afip = await buildAfipClient(tenantId)
    const status = await afip.ElectronicBilling.GetServerStatus()
    const allUp =
      status?.AppServer === "OK" && status?.DbServer === "OK" && status?.AuthServer === "OK"
    if (!allUp) {
      return { ok: false, message: "ARCA respondió pero algún servicio está caído", detail: status }
    }
    await db.tenantConfig.update({
      where: { tenantId },
      data: { afipReady: true, afipLastSyncAt: new Date(), afipLastError: null } as any,
    })
    return { ok: true, message: "Conexión con ARCA OK", detail: status }
  } catch (err) {
    const msg = extractSdkError(err)
    await db.tenantConfig
      .update({
        where: { tenantId },
        data: { afipReady: false, afipLastError: msg.slice(0, 500) } as any,
      })
      .catch(() => {})
    return { ok: false, message: msg }
  }
}

export interface CertCreationResult {
  ok: boolean
  message: string
  cert?: string
  key?: string
}

/**
 * "Uno-click" — usa AfipSDK CreateCert para que ARCA genere el certificado
 * digital del kiosquero a partir de su CUIT + Clave Fiscal nivel 3+.
 *
 * Flujo del SDK:
 *   1. AfipSDK arma el CSR (RSA 2048) en su backend
 *   2. Hace login en AFIP con clave fiscal
 *   3. Sube el CSR a AFIP, obtiene el cert firmado
 *   4. Lo asocia al WSFE de ese ambiente (prod o homo)
 *   5. Devuelve cert + private key en PEM
 *
 * IMPORTANTE: La clave fiscal nunca se loguea ni se guarda en DB. Sólo se
 * pasa al SDK para esta operación puntual.
 */
export async function createCertViaSDK(opts: {
  cuit: string
  username: string
  password: string
  alias: string
  production: boolean
}): Promise<CertCreationResult> {
  const accessToken = process.env.AFIP_SDK_ACCESS_TOKEN
  if (!accessToken) {
    return { ok: false, message: "AFIP_SDK_ACCESS_TOKEN no configurado en el servidor" }
  }
  try {
    const Afip = await loadAfip()
    const afip = new Afip({
      CUIT: opts.cuit,
      production: opts.production,
      access_token: accessToken,
    })
    const result = await afip.CreateCert(opts.username, opts.password, opts.alias)
    // El SDK devuelve { cert, key } (PEM strings). Si la forma cambia, ajustar acá.
    const cert: string | undefined = result?.cert ?? result?.certificate ?? result?.x509
    const key: string | undefined = result?.key ?? result?.private_key ?? result?.privateKey
    if (!cert || !key) {
      return { ok: false, message: "AfipSDK no devolvió el cert/key esperado" }
    }
    return { ok: true, message: "Certificado generado", cert, key }
  } catch (err) {
    return { ok: false, message: extractSdkError(err).slice(0, 500) }
  }
}

/** Devuelve el último número emitido. cbteTipo: 1=A, 6=B, 11=C. */
export async function getLastVoucherNumber(
  tenantId: string,
  cbteTipo: number,
  ptoVta?: number,
): Promise<number> {
  const afip = await buildAfipClient(tenantId)
  const cfg = await db.tenantConfig.findUnique({
    where: { tenantId },
    select: { afipPointOfSale: true } as any,
  })
  const pos = ptoVta ?? (cfg as any)?.afipPointOfSale ?? 1
  const result = await afip.ElectronicBilling.GetLastVoucher(pos, cbteTipo)
  return Number(result ?? 0)
}
