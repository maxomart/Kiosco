/**
 * WSFEv1 — Web Service de Factura Electrónica de AFIP.
 *
 * Cliente SOAP minimalista que cubre lo que necesitamos para emitir facturas:
 *   - FEDummy                  → health check (no requiere auth)
 *   - FECompUltimoAutorizado   → último número emitido para (ptoVta, tipo)
 *   - FECAESolicitar           → pedir CAE para un comprobante
 *   - FEParamGetPtosVenta      → listar PV habilitados (útil para setup UI)
 *
 * Endpoints:
 *   Homo: https://wswhomo.afip.gov.ar/wsfev1/service.asmx
 *   Prod: https://servicios1.afip.gov.ar/wsfev1/service.asmx
 *
 * Spec: https://www.afip.gob.ar/fe/documentos/manual_desarrollador_COMPG_v3_0_1.pdf
 *
 * Convenciones:
 *   - Importes con 2 decimales, en pesos. Si MonId !== "PES" usar MonCotiz.
 *   - Fechas en formato YYYYMMDD (number).
 *   - PtoVta y CbteTipo son ints. CbteDesde === CbteHasta para emisión 1x1.
 */

import { XMLParser } from "fast-xml-parser"
import { getTA, invalidateTA, type AfipMode } from "./wsaa"

const WSFE_URLS: Record<AfipMode, string> = {
  HOMOLOGACION: "https://wswhomo.afip.gov.ar/wsfev1/service.asmx",
  PRODUCCION: "https://servicios1.afip.gov.ar/wsfev1/service.asmx",
}

const SOAP_ACTION_BASE = "http://ar.gov.afip.dif.FEV1/"

// =============================================================================
// Types — request side
// =============================================================================

export interface WSFEClientOptions {
  /** CUIT del emisor, sin guiones. */
  cuit: string
  certPem: string
  keyPem: string
  mode: AfipMode
  /** Identificador único del tenant para el cache de TA. */
  cacheKey: string
}

export interface AlicIVA {
  /** Id AFIP. 3=0%, 4=10.5%, 5=21%, 6=27%, 8=5%, 9=2.5%. */
  id: number
  baseImp: number
  importe: number
}

export interface Tributo {
  /** Id AFIP del tributo. */
  id: number
  desc: string
  baseImp: number
  alic: number
  importe: number
}

export interface CbteAsoc {
  tipo: number
  ptoVta: number
  nro: number
  cuit?: string
  fecha?: number // YYYYMMDD
}

export interface RequestCAEInput {
  /** Tipo de comprobante. 1=Fact A, 6=Fact B, 11=Fact C, 51=Fact M, etc. */
  cbteTipo: number
  ptoVta: number
  /**
   * Número del comprobante a emitir. Si se omite, el cliente consulta
   * FECompUltimoAutorizado y usa N+1.
   */
  cbteNro?: number
  /** 1=Productos, 2=Servicios, 3=Productos+Servicios. */
  concepto: 1 | 2 | 3
  /** Tipo de doc del receptor. 80=CUIT, 86=CUIL, 96=DNI, 99=CF, 94=Pasaporte. */
  docTipo: number
  /** Número de doc del receptor (entero, sin guiones). */
  docNro: number
  /** Fecha del comprobante en YYYYMMDD (entero). Default = hoy UTC. */
  cbteFch?: number
  impTotal: number
  /** Total conceptos no gravados. */
  impTotConc: number
  impNeto: number
  /** Operaciones exentas. */
  impOpEx: number
  impIVA: number
  impTrib: number
  /** "PES" o ISO de la moneda. */
  monId: string
  monCotiz: number
  iva?: AlicIVA[]
  tributos?: Tributo[]
  cbtesAsoc?: CbteAsoc[]
  /** Servicios — fechas de servicio (YYYYMMDD). */
  fchServDesde?: number
  fchServHasta?: number
  fchVtoPago?: number
  /** Condición frente al IVA del receptor (RG 5616). 1=RI, 5=CF, 6=MT, etc. */
  condicionIVAReceptorId?: number
}

// =============================================================================
// Types — response side
// =============================================================================

export interface DummyResult {
  appServer: string
  dbServer: string
  authServer: string
}

export interface CAEResult {
  resultado: "A" | "R" | "P"
  cae: string | null
  caeFchVto: string | null // YYYYMMDD
  cbteDesde: number
  cbteHasta: number
  /** Observaciones (no fatales). */
  observaciones: Array<{ code: number; msg: string }>
  /** Errores (fatales). */
  errores: Array<{ code: number; msg: string }>
  /** Raw response para debug. */
  raw: unknown
}

// =============================================================================
// XML helpers
// =============================================================================

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function tag(name: string, value: string | number | boolean): string {
  return `<${name}>${value}</${name}>`
}

function tagOpt(name: string, value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === "") return ""
  return `<${name}>${typeof value === "string" ? escapeXml(value) : value}</${name}>`
}

function money(n: number): string {
  return n.toFixed(2)
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  parseAttributeValue: false,
  parseTagValue: false,
  removeNSPrefix: true,
  trimValues: true,
  isArray: (name) =>
    [
      "Obs",
      "Err",
      "AlicIva",
      "Tributo",
      "CbteAsoc",
      "FECAEDetResponse",
      "FECAEDetRequest",
    ].includes(name),
})

// =============================================================================
// SOAP envelope builders
// =============================================================================

function envelopeFor(bodyInner: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soap:Header/>
  <soap:Body>${bodyInner}</soap:Body>
</soap:Envelope>`
}

function authXml(token: string, sign: string, cuit: string): string {
  return `<ar:Auth>${tag("ar:Token", token)}${tag("ar:Sign", sign)}${tag(
    "ar:Cuit",
    cuit,
  )}</ar:Auth>`
}

// =============================================================================
// SOAP POST helper
// =============================================================================

interface SoapResponse {
  ok: boolean
  parsed: unknown
  raw: string
  fault: string | null
}

async function soapPost(url: string, action: string, envelope: string): Promise<SoapResponse> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: `"${action}"`,
    },
    body: envelope,
  })
  const text = await res.text()
  const fault = extractFault(text)
  if (!res.ok && !fault) {
    return { ok: false, parsed: null, raw: text, fault: `HTTP ${res.status}` }
  }
  if (fault) {
    return { ok: false, parsed: null, raw: text, fault }
  }
  const parsed = xmlParser.parse(text)
  return { ok: true, parsed, raw: text, fault: null }
}

function extractFault(soapXml: string): string | null {
  const m = soapXml.match(/<faultstring[^>]*>([\s\S]*?)<\/faultstring>/i)
  return m ? m[1].trim() : null
}

/**
 * Helper para navegar de forma segura un árbol parseado de XML. Devuelve
 * `undefined` si cualquier paso intermedio falta. Cast al tipo esperado.
 */
function pick<T>(obj: unknown, path: string[]): T | undefined {
  let cur: unknown = obj
  for (const key of path) {
    if (cur && typeof cur === "object" && key in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[key]
    } else {
      return undefined
    }
  }
  return cur as T
}

// =============================================================================
// Today helper
// =============================================================================

function todayYYYYMMDD(): number {
  const d = new Date()
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(d.getUTCDate()).padStart(2, "0")
  return parseInt(`${yyyy}${mm}${dd}`, 10)
}

// =============================================================================
// WSFEClient
// =============================================================================

export class WSFEClient {
  private readonly url: string
  private readonly cuit: string

  constructor(private readonly opts: WSFEClientOptions) {
    this.url = WSFE_URLS[opts.mode]
    this.cuit = opts.cuit.replace(/\D/g, "")
  }

  private async getAuth(): Promise<{ token: string; sign: string }> {
    const ta = await getTA({
      service: "wsfe",
      certPem: this.opts.certPem,
      keyPem: this.opts.keyPem,
      mode: this.opts.mode,
      cacheKey: this.opts.cacheKey,
    })
    return { token: ta.token, sign: ta.sign }
  }

  /** Ping al server. No requiere TA. */
  async dummy(): Promise<DummyResult> {
    const envelope = envelopeFor(`<ar:FEDummy/>`)
    const r = await soapPost(this.url, `${SOAP_ACTION_BASE}FEDummy`, envelope)
    if (!r.ok) throw new Error(`WSFE FEDummy: ${r.fault ?? "error desconocido"}`)
    const result = pick<{ AppServer?: string; DbServer?: string; AuthServer?: string }>(
      r.parsed,
      ["Envelope", "Body", "FEDummyResponse", "FEDummyResult"],
    )
    return {
      appServer: String(result?.AppServer ?? ""),
      dbServer: String(result?.DbServer ?? ""),
      authServer: String(result?.AuthServer ?? ""),
    }
  }

  /** Devuelve el último número de comprobante emitido para (ptoVta, cbteTipo). */
  async getLastVoucherNumber(ptoVta: number, cbteTipo: number): Promise<number> {
    const auth = await this.getAuth()
    const body = `<ar:FECompUltimoAutorizado>${authXml(
      auth.token,
      auth.sign,
      this.cuit,
    )}${tag("ar:PtoVta", ptoVta)}${tag("ar:CbteTipo", cbteTipo)}</ar:FECompUltimoAutorizado>`
    const r = await this.soapWithRetry(`${SOAP_ACTION_BASE}FECompUltimoAutorizado`, envelopeFor(body))
    const result = pick<{ CbteNro?: string | number; Errors?: { Err?: unknown } }>(r.parsed, [
      "Envelope",
      "Body",
      "FECompUltimoAutorizadoResponse",
      "FECompUltimoAutorizadoResult",
    ])
    const errs = collectErrors(result?.Errors?.Err)
    if (errs.length > 0) {
      throw new Error(
        `WSFE FECompUltimoAutorizado: ${errs.map((e) => `[${e.code}] ${e.msg}`).join("; ")}`,
      )
    }
    return parseInt(String(result?.CbteNro ?? "0"), 10)
  }

  /** Solicita CAE para un comprobante. */
  async requestCAE(input: RequestCAEInput): Promise<CAEResult> {
    const auth = await this.getAuth()
    const cbteNro =
      input.cbteNro ?? (await this.getLastVoucherNumber(input.ptoVta, input.cbteTipo)) + 1
    const cbteFch = input.cbteFch ?? todayYYYYMMDD()

    const ivaXml =
      input.iva && input.iva.length > 0
        ? `<ar:Iva>${input.iva
            .map(
              (a) =>
                `<ar:AlicIva>${tag("ar:Id", a.id)}${tag("ar:BaseImp", money(a.baseImp))}${tag(
                  "ar:Importe",
                  money(a.importe),
                )}</ar:AlicIva>`,
            )
            .join("")}</ar:Iva>`
        : ""

    const tributosXml =
      input.tributos && input.tributos.length > 0
        ? `<ar:Tributos>${input.tributos
            .map(
              (t) =>
                `<ar:Tributo>${tag("ar:Id", t.id)}${tag("ar:Desc", escapeXml(t.desc))}${tag(
                  "ar:BaseImp",
                  money(t.baseImp),
                )}${tag("ar:Alic", money(t.alic))}${tag("ar:Importe", money(t.importe))}</ar:Tributo>`,
            )
            .join("")}</ar:Tributos>`
        : ""

    const cbtesAsocXml =
      input.cbtesAsoc && input.cbtesAsoc.length > 0
        ? `<ar:CbtesAsoc>${input.cbtesAsoc
            .map(
              (c) =>
                `<ar:CbteAsoc>${tag("ar:Tipo", c.tipo)}${tag("ar:PtoVta", c.ptoVta)}${tag(
                  "ar:Nro",
                  c.nro,
                )}${tagOpt("ar:Cuit", c.cuit)}${tagOpt("ar:CbteFch", c.fecha)}</ar:CbteAsoc>`,
            )
            .join("")}</ar:CbtesAsoc>`
        : ""

    const detail = [
      tag("ar:Concepto", input.concepto),
      tag("ar:DocTipo", input.docTipo),
      tag("ar:DocNro", input.docNro),
      tag("ar:CbteDesde", cbteNro),
      tag("ar:CbteHasta", cbteNro),
      tag("ar:CbteFch", cbteFch),
      tag("ar:ImpTotal", money(input.impTotal)),
      tag("ar:ImpTotConc", money(input.impTotConc)),
      tag("ar:ImpNeto", money(input.impNeto)),
      tag("ar:ImpOpEx", money(input.impOpEx)),
      tag("ar:ImpIVA", money(input.impIVA)),
      tag("ar:ImpTrib", money(input.impTrib)),
      tagOpt("ar:FchServDesde", input.fchServDesde),
      tagOpt("ar:FchServHasta", input.fchServHasta),
      tagOpt("ar:FchVtoPago", input.fchVtoPago),
      tag("ar:MonId", input.monId),
      tag("ar:MonCotiz", money(input.monCotiz)),
      tagOpt("ar:CondicionIVAReceptorId", input.condicionIVAReceptorId),
      cbtesAsocXml,
      tributosXml,
      ivaXml,
    ].join("")

    const body = `<ar:FECAESolicitar>${authXml(auth.token, auth.sign, this.cuit)}<ar:FeCAEReq><ar:FeCabReq>${tag(
      "ar:CantReg",
      1,
    )}${tag("ar:PtoVta", input.ptoVta)}${tag(
      "ar:CbteTipo",
      input.cbteTipo,
    )}</ar:FeCabReq><ar:FeDetReq><ar:FECAEDetRequest>${detail}</ar:FECAEDetRequest></ar:FeDetReq></ar:FeCAEReq></ar:FECAESolicitar>`

    const r = await this.soapWithRetry(`${SOAP_ACTION_BASE}FECAESolicitar`, envelopeFor(body))
    type DetResp = {
      Resultado?: string
      CAE?: string
      CAEFchVto?: string
      CbteDesde?: string | number
      CbteHasta?: string | number
      Observaciones?: { Obs?: unknown }
      Errors?: { Err?: unknown }
    }
    type Result = {
      FeCabResp?: { Resultado?: string }
      FeDetResp?: { FECAEDetResponse?: DetResp | DetResp[] }
      Errors?: { Err?: unknown }
    }
    const result = pick<Result>(r.parsed, [
      "Envelope",
      "Body",
      "FECAESolicitarResponse",
      "FECAESolicitarResult",
    ])
    if (!result) {
      throw new Error("WSFE FECAESolicitar: respuesta sin FECAESolicitarResult")
    }

    const headerErrors = collectErrors(result?.Errors?.Err)
    const detResponses = result?.FeDetResp?.FECAEDetResponse
    const det: DetResp | undefined = Array.isArray(detResponses) ? detResponses[0] : detResponses

    const resultado = String(result?.FeCabResp?.Resultado ?? det?.Resultado ?? "R") as "A" | "R" | "P"
    return {
      resultado,
      cae: det?.CAE ? String(det.CAE) : null,
      caeFchVto: det?.CAEFchVto ? String(det.CAEFchVto) : null,
      cbteDesde: parseInt(String(det?.CbteDesde ?? cbteNro), 10),
      cbteHasta: parseInt(String(det?.CbteHasta ?? cbteNro), 10),
      observaciones: collectErrors(det?.Observaciones?.Obs),
      errores: [...headerErrors, ...collectErrors(det?.Errors?.Err)],
      raw: result,
    }
  }

  /**
   * Como las llamadas SOAP pueden fallar con "Token expirado" si el TA
   * fue invalidado en AFIP (raro pero pasa), reintentamos una vez con TA
   * fresco.
   */
  private async soapWithRetry(action: string, envelope: string): Promise<SoapResponse> {
    let r = await soapPost(this.url, action, envelope)
    if (r.ok) return r
    if (r.fault && /token/i.test(r.fault) && /(expir|inv[aá]lid)/i.test(r.fault)) {
      invalidateTA({ service: "wsfe", mode: this.opts.mode, cacheKey: this.opts.cacheKey })
      r = await soapPost(this.url, action, envelope)
    }
    if (!r.ok) throw new Error(`WSFE ${action.split("/").pop()}: ${r.fault ?? "error"}`)
    return r
  }
}

function collectErrors(node: unknown): Array<{ code: number; msg: string }> {
  if (!node) return []
  const arr = Array.isArray(node) ? node : [node]
  return arr.map((e: unknown) => {
    const item = (e ?? {}) as { Code?: unknown; Msg?: unknown }
    return {
      code: parseInt(String(item.Code ?? 0), 10),
      msg: String(item.Msg ?? ""),
    }
  })
}

// =============================================================================
// Date helpers — para parsear CAEFchVto "YYYYMMDD" a Date
// =============================================================================

export function parseAfipDate(yyyymmdd: string): Date {
  const s = yyyymmdd.padStart(8, "0")
  return new Date(
    parseInt(s.slice(0, 4), 10),
    parseInt(s.slice(4, 6), 10) - 1,
    parseInt(s.slice(6, 8), 10),
  )
}
