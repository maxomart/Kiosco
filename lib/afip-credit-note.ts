/**
 * Emisión de nota de crédito — para anular una factura electrónica.
 *
 * Cuando el kiosquero anula una venta que ya tenía factura A/B/C emitida,
 * NO se "borra" la factura — se emite una nota de crédito asociada que
 * neutraliza el efecto fiscal. Códigos AFIP:
 *   - Factura A (1)  → Nota de crédito A (3)
 *   - Factura B (6)  → Nota de crédito B (8)
 *   - Factura C (11) → Nota de crédito C (13)
 *   - Factura M (51) → Nota de crédito M (53)
 */

import { db } from "./db"
import { decryptAfipCert } from "./afip-crypto"
import { buildAfipQRPayload, normalizeCuit, type DocType } from "./afip"

type AfipInstance = any
let _AfipCtor: any = null
async function loadAfip(): Promise<any> {
  if (!_AfipCtor) {
    const mod: any = await import("@afipsdk/afip.js")
    _AfipCtor = mod?.default ?? mod
  }
  return _AfipCtor
}

const FACTURA_TO_NOTA_CREDITO: Record<number, number> = {
  1: 3,    // A → NC A
  6: 8,    // B → NC B
  11: 13,  // C → NC C
  51: 53,  // M → NC M
}

const INVOICE_LETTER_TO_CODE: Record<string, number> = {
  A: 1,
  B: 6,
  C: 11,
  M: 51,
}

function docTypeToAfipCode(docType: DocType | string | null): number {
  switch (docType) {
    case "CUIT": return 80
    case "CUIL": return 86
    case "DNI": return 96
    case "EXTRANJERO": return 94
    default: return 99
  }
}

export interface CreditNoteResult {
  ok: boolean
  cae?: string
  caeExpiresAt?: Date
  invoiceNumber?: number
  invoiceCode?: number
  qrUrl?: string
  error?: string
}

/**
 * Emite una nota de crédito sobre la factura asociada a saleId. Requiere
 * que la venta tenga ya una factura emitida (cae no nulo). La NC neutraliza
 * el total de la factura original.
 */
export async function issueCreditNote(saleId: string): Promise<CreditNoteResult> {
  const sale = await db.sale.findUnique({
    where: { id: saleId },
    include: { tenant: { include: { config: true as any } } },
  })
  if (!sale) return { ok: false, error: "Venta no encontrada" }
  if (!sale.cae || !sale.invoiceNumber || !sale.invoiceType) {
    return { ok: false, error: "La venta no tiene factura electrónica emitida" }
  }

  const cfg: any = (sale.tenant as any).config
  if (!cfg?.afipEnabled || !cfg?.afipReady) {
    return { ok: false, error: "AFIP no habilitado/probado" }
  }

  const facturaCode = INVOICE_LETTER_TO_CODE[sale.invoiceType]
  const ncCode = FACTURA_TO_NOTA_CREDITO[facturaCode]
  if (!ncCode) {
    return { ok: false, error: `Tipo de factura ${sale.invoiceType} no soporta nota de crédito` }
  }

  const accessToken = process.env.AFIP_SDK_ACCESS_TOKEN
  if (!accessToken) return { ok: false, error: "AFIP_SDK_ACCESS_TOKEN faltante" }

  const cert = decryptAfipCert(cfg.afipCertX509)
  const key = decryptAfipCert(cfg.afipCertPrivateKey)
  const Afip = await loadAfip()
  const afip: AfipInstance = new Afip({
    CUIT: cfg.afipCertCuit,
    cert,
    key,
    production: cfg.afipMode === "PRODUCCION",
    access_token: accessToken,
  })

  const ptoVta = sale.pointOfSale ?? cfg.afipPointOfSale ?? 1
  const totalAmount = Number(sale.total)
  const customerDocType = (sale.customerDocType as DocType) ?? "SIN_IDENTIFICAR"
  const customerDocNumber = sale.customerDocNumber ?? "0"

  // IVA si era factura A (21%)
  let importeNeto = totalAmount
  let importeIVA = 0
  const ivas: Array<{ Id: number; BaseImp: number; Importe: number }> = []
  if (sale.invoiceType === "A") {
    importeNeto = Number((totalAmount / 1.21).toFixed(2))
    importeIVA = Number((totalAmount - importeNeto).toFixed(2))
    ivas.push({ Id: 5, BaseImp: importeNeto, Importe: importeIVA })
  }

  let nextNumber: number
  try {
    const last = await afip.ElectronicBilling.GetLastVoucher(ptoVta, ncCode)
    nextNumber = Number(last ?? 0) + 1
  } catch (err: any) {
    return { ok: false, error: `Error consultando último número: ${err?.message ?? err}` }
  }

  const today = new Date()
  const fechaCmp = parseInt(today.toISOString().slice(0, 10).replace(/-/g, ""))

  const voucherData: Record<string, unknown> = {
    CantReg: 1,
    PtoVta: ptoVta,
    CbteTipo: ncCode,
    Concepto: 1,
    DocTipo: docTypeToAfipCode(customerDocType),
    DocNro: Number(normalizeCuit(customerDocNumber) || "0"),
    CbteDesde: nextNumber,
    CbteHasta: nextNumber,
    CbteFch: fechaCmp,
    ImpTotal: Number(totalAmount.toFixed(2)),
    ImpTotConc: 0,
    ImpNeto: Number(importeNeto.toFixed(2)),
    ImpOpEx: 0,
    ImpIVA: Number(importeIVA.toFixed(2)),
    ImpTrib: 0,
    MonId: "PES",
    MonCotiz: 1,
    // Asociar a la factura original — clave para que ARCA acepte la NC
    CbtesAsoc: [
      {
        Tipo: facturaCode,
        PtoVta: ptoVta,
        Nro: sale.invoiceNumber,
      },
    ],
  }
  if (ivas.length > 0) (voucherData as any).Iva = ivas

  let response: any
  try {
    response = await afip.ElectronicBilling.createNextVoucher(voucherData)
  } catch (err: any) {
    return { ok: false, error: err?.message ?? String(err) }
  }

  const cae = String(response?.CAE ?? "")
  const caeFchVto = String(response?.CAEFchVto ?? "")
  if (!cae) return { ok: false, error: "ARCA no devolvió CAE" }

  const yyyy = parseInt(caeFchVto.slice(0, 4))
  const mm = parseInt(caeFchVto.slice(4, 6)) - 1
  const dd = parseInt(caeFchVto.slice(6, 8))
  const caeExpiresAt = new Date(yyyy, mm, dd)

  const qrUrl = buildAfipQRPayload({
    fecha: today,
    cuitEmisor: cfg.afipCertCuit,
    ptoVta,
    tipoCmp: ncCode as any,
    nroCmp: nextNumber,
    importe: totalAmount,
    moneda: "PES",
    ctz: 1,
    tipoDocRec: customerDocType,
    nroDocRec: customerDocNumber,
    cae,
  })

  // Marcar la venta como cancelada (la nota de crédito neutraliza la factura,
  // pero a nivel UI la mostramos como anulada). Guardamos los datos de la NC
  // en el campo `notes` para registro — en una versión más completa habría
  // un modelo separado CreditNote.
  await db.sale.update({
    where: { id: saleId },
    data: {
      status: "CANCELLED",
      cancelReason: `Nota de crédito ${sale.invoiceType} ${String(ptoVta).padStart(4, "0")}-${String(nextNumber).padStart(8, "0")} CAE ${cae}`,
    },
  })

  return {
    ok: true,
    cae,
    caeExpiresAt,
    invoiceNumber: nextNumber,
    invoiceCode: ncCode,
    qrUrl,
  }
}
