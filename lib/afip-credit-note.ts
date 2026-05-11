/**
 * Emisión de notas de crédito y débito.
 *
 * Una NC anula/devuelve total o parcialmente una factura emitida. Una ND
 * suma un cargo posterior a una factura ya emitida (ej: intereses por mora).
 * Ambas se asocian al comprobante original via `CbtesAsoc`.
 *
 * Mapeo de tipos AFIP:
 *   Factura A (1)  → NC A (3),  ND A (2)
 *   Factura B (6)  → NC B (8),  ND B (7)
 *   Factura C (11) → NC C (13), ND C (12)
 *   Factura M (51) → NC M (53), ND M (52)
 *
 * Path AFIP igual que afip-issue.ts:
 *   - native (lib/afip-native): WSAA + WSFEv1 directo
 *   - afipsdk: vía @afipsdk/afip.js (fallback)
 */

import { db } from "./db"
import { decryptAfipCert } from "./afip-crypto"
import { buildAfipQRPayload, normalizeCuit, type DocType, type InvoiceCode } from "./afip"
import {
  buildWSFEClientForTenant,
  docTypeToAfipCode,
  condicionToReceptorId,
} from "./afip-native"

interface AfipSDKVoucherResponse {
  CAE?: string
  CAEFchVto?: string
  [key: string]: unknown
}
interface AfipSDKInstance {
  ElectronicBilling: {
    GetLastVoucher(ptoVta: number, cbteTipo: number): Promise<number | string>
    createNextVoucher(data: Record<string, unknown>): Promise<AfipSDKVoucherResponse>
  }
}
interface AfipSDKCtor {
  new (opts: {
    CUIT: string
    cert: string
    key: string
    production: boolean
    access_token: string
  }): AfipSDKInstance
}

let _AfipCtor: AfipSDKCtor | null = null
async function loadAfip(): Promise<AfipSDKCtor> {
  if (!_AfipCtor) {
    const mod = (await import("@afipsdk/afip.js")) as unknown as {
      default?: AfipSDKCtor
    } & AfipSDKCtor
    _AfipCtor = mod.default ?? mod
  }
  return _AfipCtor
}

export type NoteKind = "credit" | "debit"

const FACTURA_TO_NOTA_CREDITO: Record<number, number> = {
  1: 3, // A → NC A
  6: 8, // B → NC B
  11: 13, // C → NC C
  51: 53, // M → NC M
}

const FACTURA_TO_NOTA_DEBITO: Record<number, number> = {
  1: 2, // A → ND A
  6: 7, // B → ND B
  11: 12, // C → ND C
  51: 52, // M → ND M
}

const INVOICE_LETTER_TO_CODE: Record<string, number> = {
  A: 1,
  B: 6,
  C: 11,
  M: 51,
}

function getNoteCode(facturaCode: number, kind: NoteKind): number | null {
  const map = kind === "credit" ? FACTURA_TO_NOTA_CREDITO : FACTURA_TO_NOTA_DEBITO
  return map[facturaCode] ?? null
}

export interface NoteResult {
  ok: boolean
  cae?: string
  caeExpiresAt?: Date
  invoiceNumber?: number
  invoiceCode?: number
  qrUrl?: string
  error?: string
  kind?: NoteKind
}

interface TenantConfigForNote {
  afipEnabled: boolean
  afipReady: boolean
  afipMode: string | null
  afipCertCuit: string | null
  afipCertX509: string | null
  afipCertPrivateKey: string | null
  afipCertProvider: string | null
  afipPointOfSale: number | null
}

function isNativeProvider(provider: string | null | undefined): boolean {
  return (provider ?? "").toLowerCase() === "native"
}

/**
 * Emite una NC o ND sobre la factura asociada a `saleId`.
 *
 * - NC: marca la venta como CANCELLED (la NC neutraliza la factura)
 * - ND: NO cambia el status de la venta — es un cargo adicional, la
 *   factura original sigue válida
 */
export async function issueCreditOrDebitNote(
  saleId: string,
  kind: NoteKind = "credit",
): Promise<NoteResult> {
  const sale = await db.sale.findUnique({
    where: { id: saleId },
    include: { tenant: { include: { config: true } } },
  })
  if (!sale) return { ok: false, error: "Venta no encontrada", kind }
  if (!sale.cae || !sale.invoiceNumber || !sale.invoiceType) {
    return { ok: false, error: "La venta no tiene factura electrónica emitida", kind }
  }

  const cfg = (sale.tenant as { config: TenantConfigForNote | null }).config
  if (!cfg) return { ok: false, error: "Falta TenantConfig", kind }
  if (!cfg.afipEnabled || !cfg.afipReady) {
    return { ok: false, error: "AFIP no habilitado/probado", kind }
  }
  if (!cfg.afipCertX509 || !cfg.afipCertPrivateKey || !cfg.afipCertCuit) {
    return { ok: false, error: "Faltan credenciales AFIP", kind }
  }

  const facturaCode = INVOICE_LETTER_TO_CODE[sale.invoiceType]
  const noteCode = getNoteCode(facturaCode, kind)
  if (!noteCode) {
    return {
      ok: false,
      error: `Tipo de factura ${sale.invoiceType} no soporta nota de ${kind === "credit" ? "crédito" : "débito"}`,
      kind,
    }
  }

  const native = isNativeProvider(cfg.afipCertProvider)
  if (!native && !process.env.AFIP_SDK_ACCESS_TOKEN) {
    return { ok: false, error: "AFIP_SDK_ACCESS_TOKEN faltante", kind }
  }

  const ptoVta = sale.pointOfSale ?? cfg.afipPointOfSale ?? 1
  const totalAmount = Number(sale.total)
  const customerDocType = (sale.customerDocType as DocType) ?? "SIN_IDENTIFICAR"
  const customerDocNumber = sale.customerDocNumber ?? "0"
  const customerCondicion = (sale.customerCondicionIVA as
    | "RI"
    | "MONOTRIBUTO"
    | "EXENTO"
    | "CF") ?? "CF"

  // IVA simplificado: si era A, todo al 21%
  let importeNeto = totalAmount
  let importeIVA = 0
  const ivaItems: Array<{ id: number; baseImp: number; importe: number }> = []
  if (sale.invoiceType === "A") {
    importeNeto = round2(totalAmount / 1.21)
    importeIVA = round2(totalAmount - importeNeto)
    ivaItems.push({ id: 5, baseImp: importeNeto, importe: importeIVA })
  }

  const today = new Date()
  const fechaCmpInt = parseInt(today.toISOString().slice(0, 10).replace(/-/g, ""), 10)

  let result: { cae: string; caeFchVto: string; number: number }
  try {
    if (native) {
      const client = await buildWSFEClientForTenant(sale.tenantId)
      const last = await client.getLastVoucherNumber(ptoVta, noteCode)
      const nextNumber = last + 1
      const r = await client.requestCAE({
        cbteTipo: noteCode,
        ptoVta,
        cbteNro: nextNumber,
        cbteFch: fechaCmpInt,
        concepto: 1,
        docTipo: docTypeToAfipCode(customerDocType),
        docNro: Number(normalizeCuit(customerDocNumber) || "0"),
        impTotal: round2(totalAmount),
        impTotConc: 0,
        impNeto: round2(importeNeto),
        impOpEx: 0,
        impIVA: round2(importeIVA),
        impTrib: 0,
        monId: "PES",
        monCotiz: 1,
        iva: ivaItems.length > 0 ? ivaItems : undefined,
        cbtesAsoc: [
          {
            tipo: facturaCode,
            ptoVta,
            nro: sale.invoiceNumber,
          },
        ],
        condicionIVAReceptorId: condicionToReceptorId(customerCondicion),
      })
      if (r.resultado !== "A" || !r.cae || !r.caeFchVto) {
        const errMsg =
          r.errores.length > 0
            ? r.errores.map((e) => `[${e.code}] ${e.msg}`).join("; ")
            : r.observaciones.length > 0
              ? r.observaciones.map((o) => `[${o.code}] ${o.msg}`).join("; ")
              : "AFIP rechazó sin detalle"
        return { ok: false, error: errMsg, kind }
      }
      result = { cae: r.cae, caeFchVto: r.caeFchVto, number: nextNumber }
    } else {
      const accessToken = process.env.AFIP_SDK_ACCESS_TOKEN!
      const cert = decryptAfipCert(cfg.afipCertX509)
      const key = decryptAfipCert(cfg.afipCertPrivateKey)
      const Afip = await loadAfip()
      const afip = new Afip({
        CUIT: cfg.afipCertCuit,
        cert,
        key,
        production: cfg.afipMode === "PRODUCCION",
        access_token: accessToken,
      })

      const last = await afip.ElectronicBilling.GetLastVoucher(ptoVta, noteCode)
      const nextNumber = Number(last ?? 0) + 1

      const voucherData: Record<string, unknown> = {
        CantReg: 1,
        PtoVta: ptoVta,
        CbteTipo: noteCode,
        Concepto: 1,
        DocTipo: docTypeToAfipCode(customerDocType),
        DocNro: Number(normalizeCuit(customerDocNumber) || "0"),
        CbteDesde: nextNumber,
        CbteHasta: nextNumber,
        CbteFch: fechaCmpInt,
        ImpTotal: round2(totalAmount),
        ImpTotConc: 0,
        ImpNeto: round2(importeNeto),
        ImpOpEx: 0,
        ImpIVA: round2(importeIVA),
        ImpTrib: 0,
        MonId: "PES",
        MonCotiz: 1,
        CbtesAsoc: [{ Tipo: facturaCode, PtoVta: ptoVta, Nro: sale.invoiceNumber }],
      }
      if (ivaItems.length > 0) {
        voucherData.Iva = ivaItems.map((i) => ({
          Id: i.id,
          BaseImp: i.baseImp,
          Importe: i.importe,
        }))
      }

      const response = await afip.ElectronicBilling.createNextVoucher(voucherData)
      const cae = String(response?.CAE ?? "")
      const caeFchVto = String(response?.CAEFchVto ?? "")
      if (!cae || !caeFchVto) {
        return { ok: false, error: "AFIP no devolvió CAE", kind }
      }
      result = { cae, caeFchVto, number: nextNumber }
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), kind }
  }

  const yyyy = parseInt(result.caeFchVto.slice(0, 4))
  const mm = parseInt(result.caeFchVto.slice(4, 6)) - 1
  const dd = parseInt(result.caeFchVto.slice(6, 8))
  const caeExpiresAt = new Date(yyyy, mm, dd)

  const qrUrl = buildAfipQRPayload({
    fecha: today,
    cuitEmisor: cfg.afipCertCuit,
    ptoVta,
    tipoCmp: noteCode as InvoiceCode,
    nroCmp: result.number,
    importe: totalAmount,
    moneda: "PES",
    ctz: 1,
    tipoDocRec: customerDocType,
    nroDocRec: customerDocNumber,
    cae: result.cae,
  })

  // Solo la NC cancela la venta. La ND no — es un cargo adicional.
  if (kind === "credit") {
    await db.sale.update({
      where: { id: saleId },
      data: {
        status: "CANCELLED",
        cancelReason: `Nota de crédito ${sale.invoiceType} ${String(ptoVta).padStart(4, "0")}-${String(result.number).padStart(8, "0")} CAE ${result.cae}`,
      },
    })
  }
  // Marca salud del tenantConfig para que el banner "Último error" desaparezca.
  await db.tenantConfig
    .update({
      where: { tenantId: sale.tenantId },
      data: { afipLastSyncAt: new Date(), afipLastError: null },
    })
    .catch(() => {})

  return {
    ok: true,
    cae: result.cae,
    caeExpiresAt,
    invoiceNumber: result.number,
    invoiceCode: noteCode,
    qrUrl,
    kind,
  }
}

/** Shim para callers existentes — NC equivale a credit. */
export function issueCreditNote(saleId: string): Promise<NoteResult> {
  return issueCreditOrDebitNote(saleId, "credit")
}

/** Emite una nota de débito (cargo adicional) sobre la factura asociada. */
export function issueDebitNote(saleId: string): Promise<NoteResult> {
  return issueCreditOrDebitNote(saleId, "debit")
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
