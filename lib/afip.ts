/**
 * AFIP electronic invoicing — provider-pluggable layer.
 *
 * Why a provider abstraction?
 * --------------------------------------------------------------------------
 * AFIP's WSFEv1 is a SOAP web-service that requires X.509 client certificates,
 * WSAA token caching, CUIT-based authorization, and a maddening dance of
 * homologación vs producción endpoints. Building (and maintaining) a direct
 * SOAP client is a multi-month project on its own.
 *
 * Instead we expose a tiny `AfipProvider` interface and let users pick:
 *   - "mock"        — local fake CAE, no external calls (default for dev/test)
 *   - "tusfacturas" — REST proxy via https://www.tusfacturas.app/  (production)
 *   - (future)      — direct AfipSDK / Talo / Bill.com etc., one new file each.
 *
 * Argentine fiscal rules
 * --------------------------------------------------------------------------
 * Comprobante codes per AFIP RG 100/1415:
 *   Factura A  → 1   (RI to RI)
 *   Factura B  → 6   (RI to consumer / monotributo / exento)
 *   Factura C  → 11  (Monotributo or Exento as emitter)
 *   Factura M  → 51  (RI emitter, recipient inhabilitado / sin antecedentes)
 *
 * AFIP QR per RG 4892/2020 — payload is base64-encoded JSON appended to
 * `https://www.afip.gob.ar/fe/qr/?p=<base64>`. See `buildAfipQRPayload`.
 */

import type { TenantConfig } from "@prisma/client"

// =============================================================================
// Types
// =============================================================================

export type CondicionIVA = "RI" | "MONOTRIBUTO" | "EXENTO" | "CF"
export type DocType = "CUIT" | "CUIL" | "DNI" | "EXTRANJERO" | "SIN_IDENTIFICAR"
export type InvoiceLetter = "A" | "B" | "C" | "M"
export type InvoiceCode = 1 | 6 | 11 | 51
export type AfipMode = "HOMOLOGACION" | "PRODUCCION"

export interface AfipInvoiceItem {
  description: string
  quantity: number
  unitPrice: number       // includes IVA when emitter is Monotributo (no breakdown)
  taxRate: number         // 0, 0.105, 0.21
  subtotal: number        // post-discount, includes IVA
}

export interface AfipInvoiceInput {
  /** Emitter side (from TenantConfig) */
  emitterCuit: string                 // sin guiones
  emitterCondicion: CondicionIVA
  pointOfSale: number                 // e.g. 1, 2…
  mode: AfipMode

  /** Customer side (resolved from sale.client) */
  customerName: string
  customerDocType: DocType
  customerDocNumber: string           // sin guiones; "0" for CF
  customerCondicion: CondicionIVA
  customerAddress?: string

  /** Sale data */
  saleId: string                      // for idempotency / external_reference
  saleDate: Date                      // ISO date for AFIP
  currency: "PES" | "DOL"             // PES = ARS
  exchangeRate: number                // 1 for ARS

  items: AfipInvoiceItem[]
  subtotalNeto: number                // sum of subtotals net of IVA
  ivaAmount: number                   // total IVA
  total: number                       // grand total
  ivaBreakdown: { rate: number; baseAmount: number; ivaAmount: number }[]
}

export interface AfipInvoiceResult {
  ok: boolean
  /** AFIP-issued CAE — 14 digit numeric string */
  cae?: string
  /** CAE expiration date (yyyy-mm-dd) */
  caeExpiresAt?: Date
  /** Invoice number assigned (sequential per (cuit, ptoVta, tipo)) */
  invoiceNumber?: number
  /** Invoice letter — A/B/C/M */
  invoiceLetter?: InvoiceLetter
  /** AFIP comprobante code 1/6/11/51 */
  invoiceCode?: InvoiceCode
  /** Pre-built QR URL (https://www.afip.gob.ar/fe/qr/?p=BASE64) */
  qrUrl?: string
  /** Status — APPROVED | REJECTED | PENDING */
  status: "APPROVED" | "REJECTED" | "PENDING"
  /** Provider error message if rejected */
  error?: string
  /** Raw provider response for audit/debug */
  raw?: unknown
}

export interface AfipProvider {
  readonly name: string
  requestInvoice(input: AfipInvoiceInput): Promise<AfipInvoiceResult>
  /** Quick health check — used by the "Probar conexión" button. */
  ping(): Promise<{ ok: boolean; message: string }>
}

// =============================================================================
// CUIT validation — AFIP modulo-11 checksum
// =============================================================================

const CUIT_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]

/** Returns true if the CUIT/CUIL string (with or without dashes) is valid. */
export function validateCUIT(cuit: string | null | undefined): boolean {
  if (!cuit) return false
  const digits = cuit.replace(/\D/g, "")
  if (digits.length !== 11) return false
  let sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i], 10) * CUIT_WEIGHTS[i]
  let check = 11 - (sum % 11)
  if (check === 11) check = 0
  if (check === 10) check = 9 // edge case
  return check === parseInt(digits[10], 10)
}

/** Strip dashes/spaces. */
export function normalizeCuit(cuit: string): string {
  return cuit.replace(/\D/g, "")
}

// =============================================================================
// Invoice type chooser
// =============================================================================

/**
 * Decide which factura to issue based on emitter + customer fiscal status.
 * See AFIP RG 1415/2003 + RG 4290/2018.
 */
export function chooseInvoiceType(
  emitter: CondicionIVA,
  customer: CondicionIVA,
): { letter: InvoiceLetter; code: InvoiceCode } {
  if (emitter === "RI") {
    if (customer === "RI") return { letter: "A", code: 1 }
    // CF / Monotributo / Exento → B
    return { letter: "B", code: 6 }
  }
  if (emitter === "MONOTRIBUTO") {
    return { letter: "C", code: 11 }
  }
  if (emitter === "EXENTO") {
    if (customer === "RI") return { letter: "M", code: 51 }
    return { letter: "C", code: 11 }
  }
  // Fallback — should not happen for a tenant with afipEnabled
  return { letter: "B", code: 6 }
}

// =============================================================================
// Formatting helpers
// =============================================================================

/** "0001-00000123" — 4 digit POS + dash + 8 digit number. */
export function formatComprobanteNumber(pos: number, num: number): string {
  return `${String(pos).padStart(4, "0")}-${String(num).padStart(8, "0")}`
}

/**
 * Build the AFIP QR URL per RG 4892/2020.
 *
 * Spec:
 *   https://www.afip.gob.ar/fe/qr/especificaciones.asp
 *
 * The URL embeds a base64-encoded JSON object with these fields:
 *   ver        : 1
 *   fecha      : "yyyy-mm-dd"
 *   cuit       : emitter CUIT (number)
 *   ptoVta     : punto de venta (number)
 *   tipoCmp    : comprobante code (1, 6, 11, 51, …)
 *   nroCmp     : invoice number (number)
 *   importe    : total amount (number, 2 decimals)
 *   moneda     : "PES" | "DOL"
 *   ctz        : exchange rate (number)
 *   tipoDocRec : doc type code (80=CUIT, 86=CUIL, 96=DNI, 99=CF)
 *   nroDocRec  : doc number (number, 0 for CF)
 *   tipoCodAut : "E" (CAE) | "A" (CAEA)
 *   codAut     : the CAE itself (number)
 */
const DOC_TYPE_TO_AFIP: Record<DocType, number> = {
  CUIT: 80,
  CUIL: 86,
  DNI: 96,
  EXTRANJERO: 94,
  SIN_IDENTIFICAR: 99,
}

export interface QRPayloadInput {
  fecha: Date
  cuitEmisor: string
  ptoVta: number
  tipoCmp: InvoiceCode
  nroCmp: number
  importe: number
  moneda: "PES" | "DOL"
  ctz: number
  tipoDocRec: DocType
  nroDocRec: string
  cae: string
}

export function buildAfipQRPayload(input: QRPayloadInput): string {
  const json = {
    ver: 1,
    fecha: input.fecha.toISOString().slice(0, 10),
    cuit: Number(normalizeCuit(input.cuitEmisor)),
    ptoVta: input.ptoVta,
    tipoCmp: input.tipoCmp,
    nroCmp: input.nroCmp,
    importe: Number(input.importe.toFixed(2)),
    moneda: input.moneda,
    ctz: input.ctz,
    tipoDocRec: DOC_TYPE_TO_AFIP[input.tipoDocRec],
    nroDocRec: Number(input.nroDocRec.replace(/\D/g, "") || "0"),
    tipoCodAut: "E",
    codAut: Number(input.cae),
  }
  // Use Buffer in Node, btoa in browser. Server-side here.
  const b64 = Buffer.from(JSON.stringify(json), "utf8").toString("base64")
  return `https://www.afip.gob.ar/fe/qr/?p=${b64}`
}

// =============================================================================
// Mock provider — for local testing without any AFIP setup
// =============================================================================

class MockProvider implements AfipProvider {
  readonly name = "mock"

  async ping() {
    return { ok: true, message: "Mock provider activo (no realiza llamadas reales a AFIP)." }
  }

  async requestInvoice(input: AfipInvoiceInput): Promise<AfipInvoiceResult> {
    const { letter, code } = chooseInvoiceType(input.emitterCondicion, input.customerCondicion)
    // Fake but deterministic-ish CAE: 14 digits derived from saleId hash + timestamp.
    const cae = String(Date.now()).padStart(14, "0").slice(-14)
    const expires = new Date()
    expires.setDate(expires.getDate() + 10)
    const invoiceNumber = Math.floor(Math.random() * 99999) + 1

    const qrUrl = buildAfipQRPayload({
      fecha: input.saleDate,
      cuitEmisor: input.emitterCuit,
      ptoVta: input.pointOfSale,
      tipoCmp: code,
      nroCmp: invoiceNumber,
      importe: input.total,
      moneda: input.currency,
      ctz: input.exchangeRate,
      tipoDocRec: input.customerDocType,
      nroDocRec: input.customerDocNumber,
      cae,
    })

    return {
      ok: true,
      cae,
      caeExpiresAt: expires,
      invoiceNumber,
      invoiceLetter: letter,
      invoiceCode: code,
      qrUrl,
      status: "APPROVED",
      raw: { provider: "mock", note: "Generated locally — NOT a real AFIP CAE." },
    }
  }
}

// =============================================================================
// TusFacturas provider — REST proxy
// =============================================================================

/**
 * TusFacturas.app integration.
 *
 * Sign-up flow (one-time, by the tenant owner):
 *   1. Create an account at https://www.tusfacturas.app/registro
 *   2. Upload your AFIP digital certificate following their wizard, OR delegate
 *      via "AFIP > Administradores de Relaciones" → grant TusFacturas the
 *      "Webservices Facturación Electrónica" role.
 *   3. From the dashboard copy:
 *        - apitoken      (per-account secret)
 *        - apikey        (per-account public id)
 *        - usertoken     (per-user secret — required on every call)
 *   4. Save these in the tenant config:
 *        afipCertProvider = "tusfacturas"
 *        afipCertCuit     = your CUIT
 *        afipCertSecret   = JSON string: {"apitoken":"…","apikey":"…","usertoken":"…"}
 *
 * API docs: https://developers.tusfacturas.app/
 * Endpoint used: POST https://www.tusfacturas.app/app/api/v2/facturacion/nuevo
 *
 * NOTE: AFIP rules require the tenant to use HOMOLOGACION mode for testing
 * (env=test in TF) and switch to PRODUCCION (env=prod) once their cert is
 * "homologado" by AFIP. We forward `mode` to TusFacturas verbatim.
 */

interface TFCredentials {
  apitoken: string
  apikey: string
  usertoken: string
}

const TF_BASE = "https://www.tusfacturas.app/app/api/v2"

class TusFacturasProvider implements AfipProvider {
  readonly name = "tusfacturas"

  constructor(private readonly creds: TFCredentials, private readonly mode: AfipMode) {}

  async ping() {
    if (!this.creds.apitoken || !this.creds.apikey || !this.creds.usertoken) {
      return { ok: false, message: "Faltan credenciales de TusFacturas (apitoken/apikey/usertoken)." }
    }
    // TF doesn't expose a true ping endpoint; we attempt a low-cost call:
    // listing comprobantes with a date range that yields nothing.
    try {
      const res = await fetch(`${TF_BASE}/facturacion/consulta_comprobantes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apitoken: this.creds.apitoken,
          apikey: this.creds.apikey,
          usertoken: this.creds.usertoken,
          fecha_desde: "01/01/2099",
          fecha_hasta: "01/01/2099",
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (data?.error === "S") return { ok: false, message: data?.errores?.join("; ") ?? "Credenciales inválidas." }
      return { ok: true, message: "Conexión con TusFacturas OK." }
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Error de red contactando TusFacturas." }
    }
  }

  async requestInvoice(input: AfipInvoiceInput): Promise<AfipInvoiceResult> {
    const { letter, code } = chooseInvoiceType(input.emitterCondicion, input.customerCondicion)

    // Map our condicionIVA → TusFacturas labels.
    const tfCondicion: Record<CondicionIVA, string> = {
      RI: "RESPONSABLE INSCRIPTO",
      MONOTRIBUTO: "MONOTRIBUTO",
      EXENTO: "EXENTO",
      CF: "CONSUMIDOR FINAL",
    }
    const tfDocTipo: Record<DocType, string> = {
      CUIT: "CUIT",
      CUIL: "CUIL",
      DNI: "DNI",
      EXTRANJERO: "OTRO",
      SIN_IDENTIFICAR: "OTRO",
    }

    const fecha = formatDateAR(input.saleDate)

    const detalle = input.items.map((it) => ({
      cantidad: it.quantity,
      producto: {
        descripcion: it.description,
        unidad_bulto: 1,
        lista_precios: "Standard",
        codigo: "GENERICO",
        precio_unitario_sin_iva: round2(it.unitPrice / (1 + it.taxRate)),
        alicuota: ivaRateToTfCode(it.taxRate),
      },
      leyenda: "",
    }))

    const body = {
      apitoken: this.creds.apitoken,
      apikey: this.creds.apikey,
      usertoken: this.creds.usertoken,
      cliente: {
        documento_tipo: tfDocTipo[input.customerDocType],
        documento_nro: input.customerDocNumber || "0",
        razon_social: input.customerName,
        email: "",
        domicilio: input.customerAddress ?? "",
        provincia: "1",
        envia_por_mail: "N",
        condicion_pago: "201",
        condicion_iva: tfCondicion[input.customerCondicion],
      },
      comprobante: {
        rubro: "Productos varios",
        rubro_grupo_contable: "Productos",
        tipo: `FACTURA ${letter}`,
        numero: 0, // 0 = let TF assign next number
        operacion: "V",
        punto_venta: input.pointOfSale,
        fecha,
        vencimiento: fecha,
        moneda: input.currency,
        cotizacion: input.exchangeRate,
        idioma: 1,
        external_reference: input.saleId,
        condicion_pago: "201",
        detalle,
        bonificacion: 0,
        leyenda_gral: "",
        comentario: `Venta ${input.saleId}`,
      },
      env: this.mode === "PRODUCCION" ? "prod" : "test",
    }

    try {
      const res = await fetch(`${TF_BASE}/facturacion/nuevo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok || data?.error === "S") {
        return {
          ok: false,
          status: "REJECTED",
          error: Array.isArray(data?.errores) ? data.errores.join("; ") : data?.errores ?? `HTTP ${res.status}`,
          raw: data,
        }
      }

      const cae = String(data?.cae ?? "")
      const invoiceNumber = Number(data?.comprobante_nro ?? data?.numero ?? 0)
      const expiresAt = data?.vencimiento_cae ? parseDateAR(data.vencimiento_cae) : addDays(new Date(), 10)
      const qrUrl = data?.qr_url ?? buildAfipQRPayload({
        fecha: input.saleDate,
        cuitEmisor: input.emitterCuit,
        ptoVta: input.pointOfSale,
        tipoCmp: code,
        nroCmp: invoiceNumber,
        importe: input.total,
        moneda: input.currency,
        ctz: input.exchangeRate,
        tipoDocRec: input.customerDocType,
        nroDocRec: input.customerDocNumber,
        cae,
      })

      return {
        ok: true,
        cae,
        caeExpiresAt: expiresAt,
        invoiceNumber,
        invoiceLetter: letter,
        invoiceCode: code,
        qrUrl,
        status: "APPROVED",
        raw: data,
      }
    } catch (e) {
      return {
        ok: false,
        status: "PENDING",
        error: e instanceof Error ? e.message : "Error de red",
      }
    }
  }
}

function ivaRateToTfCode(rate: number): number {
  // TusFacturas alicuota codes: 3=0%, 4=10.5%, 5=21%, 6=27%
  if (rate === 0) return 3
  if (Math.abs(rate - 0.105) < 0.001) return 4
  if (Math.abs(rate - 0.21) < 0.001) return 5
  if (Math.abs(rate - 0.27) < 0.001) return 6
  return 5
}

function formatDateAR(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function parseDateAR(s: string): Date {
  const [dd, mm, yyyy] = s.split("/")
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd))
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// =============================================================================
// Provider factory
// =============================================================================

/**
 * Resolves an AfipProvider based on the tenant's stored config.
 * Returns null if AFIP is disabled or misconfigured.
 */
export function getAfipProvider(cfg: Pick<TenantConfig, "afipEnabled" | "afipMode" | "afipCertProvider" | "afipCertSecret">): AfipProvider | null {
  if (!cfg.afipEnabled) return null
  const provider = cfg.afipCertProvider ?? "mock"
  const mode = (cfg.afipMode as AfipMode) ?? "HOMOLOGACION"

  if (provider === "mock") return new MockProvider()
  if (provider === "tusfacturas") {
    if (!cfg.afipCertSecret) return null
    let creds: TFCredentials
    try {
      creds = JSON.parse(cfg.afipCertSecret) as TFCredentials
    } catch {
      return null
    }
    return new TusFacturasProvider(creds, mode)
  }
  return null
}

/**
 * Compute IVA breakdown by rate from sale items. Each item's `subtotal` is
 * total-with-IVA; we back out neto and IVA per rate bucket.
 */
export function computeIvaBreakdown(
  items: Array<{ subtotal: number; taxRate: number }>,
): { rate: number; baseAmount: number; ivaAmount: number }[] {
  const buckets = new Map<number, { baseAmount: number; ivaAmount: number }>()
  for (const it of items) {
    const rate = it.taxRate
    const base = it.subtotal / (1 + rate)
    const iva = it.subtotal - base
    const cur = buckets.get(rate) ?? { baseAmount: 0, ivaAmount: 0 }
    cur.baseAmount += base
    cur.ivaAmount += iva
    buckets.set(rate, cur)
  }
  return Array.from(buckets.entries()).map(([rate, v]) => ({
    rate,
    baseAmount: round2(v.baseAmount),
    ivaAmount: round2(v.ivaAmount),
  }))
}
