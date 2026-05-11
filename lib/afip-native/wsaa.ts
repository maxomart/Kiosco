/**
 * WSAA — Web Service de Autenticación y Autorización de AFIP.
 *
 * Flujo:
 *   1. Generar un Login Ticket Request (TRA) — XML con uniqueId + windows
 *      de validez (~10 min).
 *   2. Firmar el TRA en CMS SignedData con cert + key del contribuyente.
 *   3. POST al endpoint LoginCms (homo o prod) con SOAP envelope.
 *   4. Parsear el Token + Sign del response (TA — válido 12 hs).
 *   5. Cachear el TA por tenant + service + mode para no re-firmar cada
 *      request a WSFE.
 *
 * Endpoints oficiales:
 *   Homo: https://wsaahomo.afip.gov.ar/ws/services/LoginCms
 *   Prod: https://wsaa.afip.gov.ar/ws/services/LoginCms
 *
 * Spec: http://www.afip.gob.ar/ws/WSAA/Especificacion_Tecnica_WSAA_1.2.2.pdf
 */

import { XMLParser } from "fast-xml-parser"
import { signCMS } from "./cms"

export type AfipMode = "HOMOLOGACION" | "PRODUCCION"

export interface TicketAccess {
  token: string
  sign: string
  /** ms epoch — generación del TA */
  generationTime: number
  /** ms epoch — expiración del TA (~12 hs después) */
  expirationTime: number
}

export interface WSAAOptions {
  service: string
  certPem: string
  keyPem: string
  mode: AfipMode
  /** Identificador único para distinguir tenants en el cache. */
  cacheKey: string
}

const WSAA_URLS: Record<AfipMode, string> = {
  HOMOLOGACION: "https://wsaahomo.afip.gov.ar/ws/services/LoginCms",
  PRODUCCION: "https://wsaa.afip.gov.ar/ws/services/LoginCms",
}

// =============================================================================
// In-memory TA cache
// =============================================================================
// 12 horas de validez por TA — pegarle al WSAA cada vez es lento e innecesario.
// Cache es por proceso. Para deploy multi-instancia, ver `TODO_MULTI_INSTANCE`
// abajo: migrar a tabla AfipTicket en DB.

const taCache = new Map<string, TicketAccess>()

function cacheKey(opts: { mode: AfipMode; service: string; cacheKey: string }) {
  return `${opts.mode}::${opts.service}::${opts.cacheKey}`
}

/** Devuelve el TA cacheado si está vigente (con un margen de 5 min). */
function getCachedTA(key: string): TicketAccess | null {
  const ta = taCache.get(key)
  if (!ta) return null
  const skewMs = 5 * 60 * 1000
  if (Date.now() + skewMs >= ta.expirationTime) {
    taCache.delete(key)
    return null
  }
  return ta
}

/** Borra el TA del cache (útil si AFIP nos devuelve "token expirado"). */
export function invalidateTA(opts: { mode: AfipMode; service: string; cacheKey: string }) {
  taCache.delete(cacheKey(opts))
}

// =============================================================================
// TRA — Login Ticket Request
// =============================================================================

let _uniqueIdCounter = Math.floor(Math.random() * 1_000_000)

function nextUniqueId(): number {
  _uniqueIdCounter = (_uniqueIdCounter + 1) % 2_147_483_647 // int32 max
  return _uniqueIdCounter
}

/**
 * Construye el XML del TRA. AFIP requiere fechas en ISO 8601 con offset
 * de timezone (ej "2024-05-01T12:00:00-03:00").
 *
 * El window de validez es chico (~10 min): es solo para que la firma del
 * TRA no sea reutilizable indefinidamente — el TA resultante dura 12 hs.
 */
export function buildTRA(service: string, ttlSeconds = 600): string {
  const now = new Date()
  const generationTime = isoOffset(new Date(now.getTime() - 60_000)) // -1 min de margen
  const expirationTime = isoOffset(new Date(now.getTime() + ttlSeconds * 1000))
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<loginTicketRequest version=\"1.0\">",
    "  <header>",
    `    <uniqueId>${nextUniqueId()}</uniqueId>`,
    `    <generationTime>${generationTime}</generationTime>`,
    `    <expirationTime>${expirationTime}</expirationTime>`,
    "  </header>",
    `  <service>${escapeXml(service)}</service>`,
    "</loginTicketRequest>",
  ].join("\n")
}

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

/** ISO 8601 con offset local: "2024-05-01T12:00:00-03:00". */
function isoOffset(d: Date): string {
  // AFIP acepta UTC también (sufijo Z) — usamos UTC para evitar drama
  // con zonas horarias del server.
  const yyyy = d.getUTCFullYear()
  const mm = pad2(d.getUTCMonth() + 1)
  const dd = pad2(d.getUTCDate())
  const HH = pad2(d.getUTCHours())
  const MM = pad2(d.getUTCMinutes())
  const SS = pad2(d.getUTCSeconds())
  return `${yyyy}-${mm}-${dd}T${HH}:${MM}:${SS}-00:00`
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

// =============================================================================
// SOAP envelope para loginCms
// =============================================================================

function buildSoapEnvelope(cmsBase64: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">
  <soapenv:Header/>
  <soapenv:Body>
    <wsaa:loginCms>
      <wsaa:in0>${cmsBase64}</wsaa:in0>
    </wsaa:loginCms>
  </soapenv:Body>
</soapenv:Envelope>`
}

// =============================================================================
// Public API
// =============================================================================

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  parseAttributeValue: false,
  parseTagValue: false,
  removeNSPrefix: true,
  trimValues: true,
})

/**
 * Devuelve un TA válido para `service` (ej "wsfe"). Cachea por 12 hs.
 * Si no hay cache válido, pega contra WSAA, firma el TRA y guarda el TA.
 */
export async function getTA(opts: WSAAOptions): Promise<TicketAccess> {
  const key = cacheKey(opts)
  const cached = getCachedTA(key)
  if (cached) return cached

  const tra = buildTRA(opts.service)
  const cms = signCMS({ xml: tra, certPem: opts.certPem, keyPem: opts.keyPem })
  const envelope = buildSoapEnvelope(cms)

  const url = WSAA_URLS[opts.mode]
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: "",
    },
    body: envelope,
  })

  const text = await res.text()
  if (!res.ok) {
    throw new Error(`WSAA HTTP ${res.status}: ${extractFaultString(text) ?? text.slice(0, 300)}`)
  }

  const fault = extractFaultString(text)
  if (fault) {
    throw new Error(`WSAA fault: ${fault}`)
  }

  const ta = parseLoginCmsResponse(text)
  taCache.set(key, ta)
  return ta
}

function extractFaultString(soapXml: string): string | null {
  // Match flojo, suficiente para detectar Faults sin parsear todo
  const m = soapXml.match(/<faultstring[^>]*>([\s\S]*?)<\/faultstring>/i)
  return m ? m[1].trim() : null
}

interface ParsedTAResponse {
  Envelope?: {
    Body?: {
      loginCmsResponse?: {
        loginCmsReturn?: string
      }
    }
  }
}

/**
 * Extrae el TA del response SOAP. El response viene como:
 *   <soapenv:Envelope>
 *     <soapenv:Body>
 *       <ns:loginCmsResponse>
 *         <loginCmsReturn>&lt;loginTicketResponse&gt;...&lt;/loginTicketResponse&gt;</loginCmsReturn>
 *
 * O sea, el TA viene XML-escapado dentro de `<loginCmsReturn>`.
 */
export function parseLoginCmsResponse(soapXml: string): TicketAccess {
  const parsed = xmlParser.parse(soapXml) as ParsedTAResponse
  const inner = parsed?.Envelope?.Body?.loginCmsResponse?.loginCmsReturn
  if (!inner) {
    throw new Error("WSAA: respuesta sin loginCmsReturn")
  }

  // El parser con removeNSPrefix + parseTagValue:false ya nos des-escapa las
  // entities del texto contenido (&lt; → <). Re-parseamos el XML interno.
  const ta = xmlParser.parse(inner) as {
    loginTicketResponse?: {
      header?: {
        generationTime?: string
        expirationTime?: string
      }
      credentials?: { token?: string; sign?: string }
    }
  }
  const inner2 = ta?.loginTicketResponse
  const token = inner2?.credentials?.token
  const sign = inner2?.credentials?.sign
  if (!token || !sign) {
    throw new Error("WSAA: respuesta sin token/sign")
  }
  const generationTime = inner2?.header?.generationTime
    ? Date.parse(inner2.header.generationTime)
    : Date.now()
  const expirationTime = inner2?.header?.expirationTime
    ? Date.parse(inner2.header.expirationTime)
    : Date.now() + 12 * 60 * 60 * 1000
  return { token, sign, generationTime, expirationTime }
}

// TODO_MULTI_INSTANCE:
// El cache es in-memory por proceso. Cuando Orvex tenga >1 instancia en
// Railway, agregar tabla AfipTicket:
//   model AfipTicket {
//     tenantId       String
//     service        String
//     mode           String
//     token          String  @db.Text
//     sign           String  @db.Text
//     generationTime DateTime
//     expirationTime DateTime
//     @@id([tenantId, service, mode])
//   }
// y reemplazar el Map<> por queries. Mientras Orvex sea 1 instancia el
// in-memory está bien — 12 hs de TTL hacen que el costo sea marginal.
