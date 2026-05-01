/**
 * Emisión de factura electrónica — Fase 2.
 *
 * Toma una venta (Sale.id) y la convierte en factura ARCA con CAE real:
 *   1. Carga la venta + items + datos del cliente
 *   2. Decide el tipo (A/B/C) según condición del emisor + cliente
 *   3. Calcula los importes netos / IVA según tipo
 *   4. Pega contra ARCA via @afipsdk/afip.js (vía AfipSDK proxy)
 *   5. Si OK → guarda CAE, número, QR en la Sale
 *   6. Si rechaza → guarda el error y deja afipStatus=REJECTED
 *
 * Idempotente: si la Sale ya tiene CAE no la re-emite.
 */

import { db } from "./db"
import { decryptAfipCert } from "./afip-crypto"
import { assertCanIssueInvoice } from "./afip-quota"
import {
  chooseInvoiceType,
  buildAfipQRPayload,
  validateCUIT,
  normalizeCuit,
  type CondicionIVA,
  type DocType,
} from "./afip"

type AfipInstance = any
let _AfipCtor: any = null
async function loadAfip(): Promise<any> {
  if (!_AfipCtor) {
    const mod: any = await import("@afipsdk/afip.js")
    _AfipCtor = mod?.default ?? mod
  }
  return _AfipCtor
}

export interface IssueResult {
  ok: boolean
  status: "APPROVED" | "REJECTED" | "PENDING"
  cae?: string
  caeExpiresAt?: Date
  invoiceNumber?: number
  invoiceLetter?: "A" | "B" | "C" | "M"
  invoiceCode?: number
  qrUrl?: string
  error?: string
}

/**
 * Mapea el customerDocType del schema al code AFIP. AFIP usa estos códigos:
 * 80=CUIT, 86=CUIL, 96=DNI, 99=Consumidor Final, 94=Pasaporte
 */
function docTypeToAfipCode(docType: DocType | string | null): number {
  switch (docType) {
    case "CUIT": return 80
    case "CUIL": return 86
    case "DNI": return 96
    case "EXTRANJERO": return 94
    default: return 99 // SIN_IDENTIFICAR / CF
  }
}

/**
 * Emite la factura electrónica para una venta. Si la venta ya tiene CAE,
 * la operación es no-op (idempotente).
 */
export async function issueElectronicInvoice(saleId: string): Promise<IssueResult> {
  const sale = await db.sale.findUnique({
    where: { id: saleId },
    include: {
      items: true,
      tenant: {
        include: { config: true as any },
      },
      client: true,
    },
  })
  if (!sale) return { ok: false, status: "REJECTED", error: "Venta no encontrada" }

  // Idempotencia
  if (sale.cae && sale.afipStatus === "APPROVED") {
    return {
      ok: true,
      status: "APPROVED",
      cae: sale.cae,
      caeExpiresAt: sale.caeExpiresAt ?? undefined,
      invoiceNumber: sale.invoiceNumber ?? undefined,
      qrUrl: sale.afipQrUrl ?? undefined,
    }
  }

  const cfg: any = (sale.tenant as any).config
  if (!cfg) {
    return { ok: false, status: "REJECTED", error: "Falta TenantConfig" }
  }
  if (!cfg.afipEnabled) {
    return { ok: false, status: "REJECTED", error: "AFIP no está habilitado para este tenant" }
  }
  if (!cfg.afipReady) {
    return { ok: false, status: "REJECTED", error: "AFIP no probado todavía. Probá la conexión primero." }
  }
  if (!cfg.afipCertX509 || !cfg.afipCertPrivateKey || !cfg.afipCertCuit) {
    return { ok: false, status: "REJECTED", error: "Faltan credenciales AFIP" }
  }

  // Chequeo de quota mensual según plan
  try {
    await assertCanIssueInvoice(sale.tenantId)
  } catch (err: any) {
    return { ok: false, status: "REJECTED", error: err?.message ?? "Quota agotada" }
  }

  const accessToken = process.env.AFIP_SDK_ACCESS_TOKEN
  if (!accessToken) {
    return { ok: false, status: "REJECTED", error: "AFIP_SDK_ACCESS_TOKEN no configurado" }
  }

  const emitterCondicion: CondicionIVA = (cfg.afipCondicionIVA ?? "MONOTRIBUTO") as CondicionIVA
  const customerCondicion: CondicionIVA =
    (sale.customerCondicionIVA as CondicionIVA) ?? (sale.client ? "CF" : "CF")
  const customerDocType: DocType = (sale.customerDocType as DocType) ?? "SIN_IDENTIFICAR"
  const customerDocNumber = sale.customerDocNumber ?? "0"

  const { letter, code } = chooseInvoiceType(emitterCondicion, customerCondicion)
  const ptoVta = cfg.afipPointOfSale ?? sale.pointOfSale ?? 1

  // Cálculos fiscales
  const totalAmount = Number(sale.total)
  // Para Monotributo (factura C) y para B emitida por RI sin discriminación
  // de IVA, mandamos el total como "neto sin IVA". Para A se discrimina.
  let importeNeto = totalAmount
  let importeIVA = 0
  const ivas: Array<{ Id: number; BaseImp: number; Importe: number }> = []
  if (letter === "A") {
    // RI factura a otro RI con IVA discriminado al 21% (simplificado:
    // asumimos que todos los items son al 21%; en una versión más completa
    // habría que inspeccionar item.taxRate y agrupar)
    importeNeto = Number((totalAmount / 1.21).toFixed(2))
    importeIVA = Number((totalAmount - importeNeto).toFixed(2))
    ivas.push({ Id: 5, BaseImp: importeNeto, Importe: importeIVA }) // Id 5 = 21%
  }

  // Construir Afip client
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

  // Próximo número de comprobante para esta combinación (PoS, tipo)
  let nextNumber: number
  try {
    const last = await afip.ElectronicBilling.GetLastVoucher(ptoVta, code)
    nextNumber = Number(last ?? 0) + 1
  } catch (err: any) {
    const msg = err?.message ?? String(err)
    await db.sale.update({
      where: { id: saleId },
      data: { afipStatus: "REJECTED", afipError: msg.slice(0, 500) },
    })
    return { ok: false, status: "REJECTED", error: `Error consultando último número: ${msg}` }
  }

  const today = new Date()
  const fechaCmp = today.toISOString().slice(0, 10).replace(/-/g, "") // YYYYMMDD

  // Validar CUIT del cliente si es A
  if (letter === "A" && !validateCUIT(customerDocNumber)) {
    return {
      ok: false,
      status: "REJECTED",
      error: "Para emitir Factura A, el cliente debe tener CUIT válido",
    }
  }

  const voucherData: Record<string, unknown> = {
    CantReg: 1,
    PtoVta: ptoVta,
    CbteTipo: code,
    Concepto: 1, // 1=Productos, 2=Servicios, 3=Productos+Servicios
    DocTipo: docTypeToAfipCode(customerDocType),
    DocNro: Number(normalizeCuit(customerDocNumber) || "0"),
    CbteDesde: nextNumber,
    CbteHasta: nextNumber,
    CbteFch: parseInt(fechaCmp),
    ImpTotal: Number(totalAmount.toFixed(2)),
    ImpTotConc: 0,
    ImpNeto: Number(importeNeto.toFixed(2)),
    ImpOpEx: 0,
    ImpIVA: Number(importeIVA.toFixed(2)),
    ImpTrib: 0,
    MonId: "PES",
    MonCotiz: 1,
  }
  if (ivas.length > 0) {
    (voucherData as any).Iva = ivas
  }

  let response: any
  try {
    response = await afip.ElectronicBilling.createNextVoucher(voucherData)
  } catch (err: any) {
    const msg = err?.message ?? String(err)
    await db.sale.update({
      where: { id: saleId },
      data: { afipStatus: "REJECTED", afipError: msg.slice(0, 500) },
    })
    return { ok: false, status: "REJECTED", error: msg }
  }

  const cae = String(response?.CAE ?? "")
  const caeFchVto = String(response?.CAEFchVto ?? "") // YYYYMMDD
  if (!cae || !caeFchVto) {
    await db.sale.update({
      where: { id: saleId },
      data: { afipStatus: "REJECTED", afipError: "Sin CAE en respuesta" },
    })
    return { ok: false, status: "REJECTED", error: "ARCA no devolvió CAE" }
  }

  // Parsear fecha YYYYMMDD a Date
  const yyyy = parseInt(caeFchVto.slice(0, 4))
  const mm = parseInt(caeFchVto.slice(4, 6)) - 1
  const dd = parseInt(caeFchVto.slice(6, 8))
  const caeExpiresAt = new Date(yyyy, mm, dd)

  // Construir el QR
  const qrUrl = buildAfipQRPayload({
    fecha: today,
    cuitEmisor: cfg.afipCertCuit,
    ptoVta,
    tipoCmp: code as any,
    nroCmp: nextNumber,
    importe: totalAmount,
    moneda: "PES",
    ctz: 1,
    tipoDocRec: customerDocType,
    nroDocRec: customerDocNumber,
    cae,
  })

  // Persistir en la venta
  await db.sale.update({
    where: { id: saleId },
    data: {
      cae,
      caeExpiresAt,
      pointOfSale: ptoVta,
      invoiceNumber: nextNumber,
      invoiceType: letter,
      afipQrUrl: qrUrl,
      afipStatus: "APPROVED",
      afipError: null,
    },
  })

  return {
    ok: true,
    status: "APPROVED",
    cae,
    caeExpiresAt,
    invoiceNumber: nextNumber,
    invoiceLetter: letter,
    invoiceCode: code,
    qrUrl,
  }
}
