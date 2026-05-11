/**
 * Emisión de factura electrónica.
 *
 * Toma una venta (Sale.id) y la convierte en factura AFIP con CAE real:
 *   1. Carga la venta + items + datos del cliente
 *   2. Decide el tipo (A/B/C) según condición del emisor + cliente
 *   3. Calcula los importes netos / IVA según tipo
 *   4. Pega contra AFIP:
 *        - Path "native" (lib/afip-native): WSAA + WSFEv1 directo. Gratis,
 *          requiere cert habilitado del cliente.
 *        - Path "afipsdk" (default histórico): vía @afipsdk/afip.js. Paga,
 *          pero más simple. Lo dejamos como fallback.
 *      La elección depende de `TenantConfig.afipCertProvider`.
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
  type InvoiceCode,
} from "./afip"
import {
  buildWSFEClientForTenant,
  condicionToReceptorId,
  docTypeToAfipCode,
} from "./afip-native"

/**
 * AfipSDK no exporta tipos prolijos — modelamos sólo lo que usamos.
 * Si la shape cambiara con una versión nueva del paquete, ajustar acá.
 */
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
 * Subset de TenantConfig que necesitamos para emitir. Prisma no exporta los
 * tipos de relaciones incluidas de forma cómoda — declaramos los campos AFIP
 * que usamos acá para evitar `any` casts en el resto del archivo.
 */
interface TenantConfigForIssue {
  afipEnabled: boolean
  afipReady: boolean
  afipMode: string | null
  afipCondicionIVA: string | null
  afipPointOfSale: number | null
  afipCertCuit: string | null
  afipCertX509: string | null
  afipCertPrivateKey: string | null
  afipCertProvider: string | null
}

/**
 * Resultado intermedio del provider AFIP — abstracto entre native y sdk.
 * caeFchVto en formato YYYYMMDD (string).
 */
interface ProviderResult {
  cae: string
  caeFchVto: string
  number: number
  raw?: unknown
}

/** True si la config indica usar AFIP nativo. */
function isNativeProvider(provider: string | null | undefined): boolean {
  return (provider ?? "").toLowerCase() === "native"
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
      tenant: { include: { config: true } },
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

  const cfg = (sale.tenant as { config: TenantConfigForIssue | null }).config
  if (!cfg) return { ok: false, status: "REJECTED", error: "Falta TenantConfig" }
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
  } catch (err) {
    return {
      ok: false,
      status: "REJECTED",
      error: err instanceof Error ? err.message : "Quota agotada",
    }
  }

  const native = isNativeProvider(cfg.afipCertProvider)

  // El SDK requiere access_token global; si vamos por sdk y falta, fallar acá.
  if (!native && !process.env.AFIP_SDK_ACCESS_TOKEN) {
    return { ok: false, status: "REJECTED", error: "AFIP_SDK_ACCESS_TOKEN no configurado" }
  }

  const emitterCondicion: CondicionIVA = (cfg.afipCondicionIVA ?? "MONOTRIBUTO") as CondicionIVA
  const customerCondicion: CondicionIVA =
    (sale.customerCondicionIVA as CondicionIVA) ?? (sale.client ? "CF" : "CF")
  const customerDocType: DocType = (sale.customerDocType as DocType) ?? "SIN_IDENTIFICAR"
  const customerDocNumber = sale.customerDocNumber ?? "0"

  const { letter, code } = chooseInvoiceType(emitterCondicion, customerCondicion)
  const ptoVta = cfg.afipPointOfSale ?? sale.pointOfSale ?? 1

  // Cálculos fiscales (simplificado: si es A, todo al 21%).
  const totalAmount = Number(sale.total)
  let importeNeto = totalAmount
  let importeIVA = 0
  const ivaItems: Array<{ id: number; baseImp: number; importe: number }> = []
  if (letter === "A") {
    importeNeto = Number((totalAmount / 1.21).toFixed(2))
    importeIVA = Number((totalAmount - importeNeto).toFixed(2))
    ivaItems.push({ id: 5, baseImp: importeNeto, importe: importeIVA }) // Id 5 = 21%
  }

  // Validar CUIT del cliente si es A
  if (letter === "A" && !validateCUIT(customerDocNumber)) {
    return {
      ok: false,
      status: "REJECTED",
      error: "Para emitir Factura A, el cliente debe tener CUIT válido",
    }
  }

  const today = new Date()
  const fechaCmpInt = parseInt(today.toISOString().slice(0, 10).replace(/-/g, ""), 10)

  // ---------------------------------------------------------------------------
  // Llamada al provider AFIP
  // ---------------------------------------------------------------------------
  let providerResult: ProviderResult
  try {
    if (native) {
      providerResult = await issueViaNative({
        tenantId: sale.tenantId,
        ptoVta,
        code,
        customerDocType,
        customerDocNumber,
        customerCondicion,
        totalAmount,
        importeNeto,
        importeIVA,
        fechaCmpInt,
        ivaItems,
      })
    } else {
      providerResult = await issueViaSDK({
        cfg,
        ptoVta,
        code,
        customerDocType,
        customerDocNumber,
        totalAmount,
        importeNeto,
        importeIVA,
        fechaCmpInt,
        ivaItems,
      })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await db.sale.update({
      where: { id: saleId },
      data: { afipStatus: "REJECTED", afipError: msg.slice(0, 500) },
    })
    return { ok: false, status: "REJECTED", error: msg }
  }

  const { cae, caeFchVto, number: nextNumber } = providerResult

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
    tipoCmp: code as InvoiceCode,
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

// =============================================================================
// Provider: AFIP nativo (lib/afip-native)
// =============================================================================

interface ProviderArgsBase {
  ptoVta: number
  code: number
  customerDocType: DocType
  customerDocNumber: string
  totalAmount: number
  importeNeto: number
  importeIVA: number
  fechaCmpInt: number
  ivaItems: Array<{ id: number; baseImp: number; importe: number }>
}

async function issueViaNative(
  args: ProviderArgsBase & { tenantId: string; customerCondicion: CondicionIVA },
): Promise<ProviderResult> {
  const client = await buildWSFEClientForTenant(args.tenantId)

  const last = await client.getLastVoucherNumber(args.ptoVta, args.code)
  const nextNumber = last + 1

  const r = await client.requestCAE({
    cbteTipo: args.code,
    ptoVta: args.ptoVta,
    cbteNro: nextNumber,
    cbteFch: args.fechaCmpInt,
    concepto: 1,
    docTipo: docTypeToAfipCode(args.customerDocType),
    docNro: Number(normalizeCuit(args.customerDocNumber) || "0"),
    impTotal: round2(args.totalAmount),
    impTotConc: 0,
    impNeto: round2(args.importeNeto),
    impOpEx: 0,
    impIVA: round2(args.importeIVA),
    impTrib: 0,
    monId: "PES",
    monCotiz: 1,
    iva: args.ivaItems.length > 0 ? args.ivaItems.map((i) => ({
      id: i.id,
      baseImp: i.baseImp,
      importe: i.importe,
    })) : undefined,
    condicionIVAReceptorId: condicionToReceptorId(args.customerCondicion),
  })

  if (r.resultado !== "A" || !r.cae || !r.caeFchVto) {
    const errMsg =
      r.errores.length > 0
        ? r.errores.map((e) => `[${e.code}] ${e.msg}`).join("; ")
        : r.observaciones.length > 0
          ? r.observaciones.map((o) => `[${o.code}] ${o.msg}`).join("; ")
          : "AFIP rechazó sin detalle"
    throw new Error(errMsg)
  }

  return {
    cae: r.cae,
    caeFchVto: r.caeFchVto,
    number: nextNumber,
    raw: r.raw,
  }
}

// =============================================================================
// Provider: AfipSDK (fallback histórico)
// =============================================================================

async function issueViaSDK(
  args: ProviderArgsBase & { cfg: TenantConfigForIssue },
): Promise<ProviderResult> {
  const accessToken = process.env.AFIP_SDK_ACCESS_TOKEN!
  // Las nullables ya fueron descartadas por el caller (issueElectronicInvoice
  // chequea cert/key/cuit antes de delegar). Non-null assertion es seguro.
  const cert = decryptAfipCert(args.cfg.afipCertX509!)
  const key = decryptAfipCert(args.cfg.afipCertPrivateKey!)
  const Afip = await loadAfip()
  const afip = new Afip({
    CUIT: args.cfg.afipCertCuit!,
    cert,
    key,
    production: args.cfg.afipMode === "PRODUCCION",
    access_token: accessToken,
  })

  const last = await afip.ElectronicBilling.GetLastVoucher(args.ptoVta, args.code)
  const nextNumber = Number(last ?? 0) + 1

  const voucherData: Record<string, unknown> = {
    CantReg: 1,
    PtoVta: args.ptoVta,
    CbteTipo: args.code,
    Concepto: 1,
    DocTipo: docTypeToAfipCode(args.customerDocType),
    DocNro: Number(normalizeCuit(args.customerDocNumber) || "0"),
    CbteDesde: nextNumber,
    CbteHasta: nextNumber,
    CbteFch: args.fechaCmpInt,
    ImpTotal: round2(args.totalAmount),
    ImpTotConc: 0,
    ImpNeto: round2(args.importeNeto),
    ImpOpEx: 0,
    ImpIVA: round2(args.importeIVA),
    ImpTrib: 0,
    MonId: "PES",
    MonCotiz: 1,
  }
  if (args.ivaItems.length > 0) {
    voucherData.Iva = args.ivaItems.map((i) => ({
      Id: i.id,
      BaseImp: i.baseImp,
      Importe: i.importe,
    }))
  }

  const response = await afip.ElectronicBilling.createNextVoucher(voucherData)
  const cae = String(response?.CAE ?? "")
  const caeFchVto = String(response?.CAEFchVto ?? "")
  if (!cae || !caeFchVto) {
    throw new Error("AFIP no devolvió CAE")
  }
  return { cae, caeFchVto, number: nextNumber, raw: response }
}

// =============================================================================
// Helpers
// =============================================================================

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
