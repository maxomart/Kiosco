/**
 * Invoice PDF generator — produces an A4 PDF in AFIP format using jsPDF.
 *
 * Layout (per AFIP RG 1415 + RG 4892):
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ [LOGO]   Tenant info       │ ┌───┐  ORIGINAL            │
 *   │  Razón social, dom., CUIT  │ │ A │  Cód. 01             │
 *   │  Cond. IVA, IIBB           │ └───┘                       │
 *   │                            │  Nº  0001-00000123          │
 *   │                            │  Fecha:  19/04/2026         │
 *   ├─────────────────────────────────────────────────────────┤
 *   │  CLIENTE: Razón social ... CUIT ...   Cond.IVA ...      │
 *   ├─────────────────────────────────────────────────────────┤
 *   │  Cant │ Descripción │ P.Unit │ %IVA │ Subtotal           │
 *   │  ...                                                     │
 *   ├─────────────────────────────────────────────────────────┤
 *   │  Subtotal neto: $XXX                                     │
 *   │  IVA 10.5% / 21%: $XXX                                   │
 *   │  TOTAL: $XXX                                             │
 *   ├─────────────────────────────────────────────────────────┤
 *   │  [QR]   CAE: 7412…   Vto: 29/04/2026                     │
 *   │         Comprobante autorizado por AFIP                  │
 *   └─────────────────────────────────────────────────────────┘
 *
 * NOTE: We don't have a real QR encoder dependency installed. We render a
 * placeholder bordered box with the AFIP URL printed underneath — the URL is
 * still valid and the user can scan it with any AFIP QR tool. TODO: add the
 * `qrcode` npm package once the user is OK with the dep.
 */

import { jsPDF } from "jspdf"
import { db } from "@/lib/db"
import {
  buildAfipQRPayload,
  formatComprobanteNumber,
  type CondicionIVA,
  type DocType,
  type InvoiceCode,
  type InvoiceLetter,
} from "@/lib/afip"

const CONDICION_LABEL: Record<CondicionIVA, string> = {
  RI: "IVA Responsable Inscripto",
  MONOTRIBUTO: "Responsable Monotributo",
  EXENTO: "IVA Exento",
  CF: "Consumidor Final",
}

const CODE_LABEL: Record<InvoiceCode, string> = {
  1: "01",
  6: "06",
  11: "11",
  51: "51",
}

interface PdfData {
  saleId: string
  emitter: {
    name: string
    cuit: string
    address: string
    condicion: CondicionIVA
    iibb?: string | null
    logoUrl?: string | null
  }
  customer: {
    name: string
    docType: DocType
    docNumber: string
    condicion: CondicionIVA
    address?: string | null
  }
  invoice: {
    letter: InvoiceLetter
    code: InvoiceCode
    pos: number
    number: number
    date: Date
    cae: string
    caeExpiresAt: Date
    qrUrl: string
  }
  items: Array<{
    description: string
    quantity: number
    unitPrice: number
    taxRate: number
    subtotal: number
  }>
  totals: {
    subtotalNeto: number
    iva105: number
    iva21: number
    total: number
  }
  copy: "ORIGINAL" | "DUPLICADO"
}

function fmt(n: number): string {
  return new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function renderPDF(data: PdfData): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const pageW = 210
  let y = 12

  // Letter box top-right (between header sections)
  const boxX = 95
  const boxY = 10
  const boxW = 20
  const boxH = 22
  doc.setLineWidth(0.4)
  doc.rect(boxX, boxY, boxW, boxH)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(34)
  doc.text(data.invoice.letter, boxX + boxW / 2, boxY + 14, { align: "center" })
  doc.setFontSize(7)
  doc.setFont("helvetica", "normal")
  doc.text(`COD. ${CODE_LABEL[data.invoice.code]}`, boxX + boxW / 2, boxY + 19.5, { align: "center" })

  // Left header: tenant info
  doc.setFont("helvetica", "bold")
  doc.setFontSize(13)
  doc.text(data.emitter.name, 12, y + 4)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  y += 9
  doc.text(data.emitter.address || "—", 12, y)
  y += 4
  doc.text(`CUIT: ${data.emitter.cuit}`, 12, y)
  y += 4
  doc.text(CONDICION_LABEL[data.emitter.condicion], 12, y)
  if (data.emitter.iibb) {
    y += 4
    doc.text(`IIBB: ${data.emitter.iibb}`, 12, y)
  }

  // Right header: type + number + date + ORIGINAL
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.text(`FACTURA ${data.invoice.letter}`, 120, 14)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.text(data.copy, 175, 14)

  doc.setFontSize(10)
  doc.text(
    `Nº ${formatComprobanteNumber(data.invoice.pos, data.invoice.number)}`,
    120,
    22,
  )
  doc.setFontSize(9)
  doc.text(`Fecha: ${data.invoice.date.toLocaleDateString("es-AR")}`, 120, 28)

  // Divider
  y = 38
  doc.setLineWidth(0.2)
  doc.line(10, y, pageW - 10, y)
  y += 6

  // Customer block
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.text("Cliente:", 12, y)
  doc.setFont("helvetica", "normal")
  doc.text(data.customer.name || "Consumidor Final", 28, y)
  y += 5
  doc.text(`${data.customer.docType}: ${data.customer.docNumber || "—"}`, 12, y)
  doc.text(CONDICION_LABEL[data.customer.condicion], 80, y)
  if (data.customer.address) {
    y += 5
    doc.text(`Domicilio: ${data.customer.address}`, 12, y)
  }
  y += 6
  doc.line(10, y, pageW - 10, y)
  y += 6

  // Items table header
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.text("Cant.", 12, y)
  doc.text("Descripción", 28, y)
  doc.text("P. Unit.", 130, y, { align: "right" })
  doc.text("IVA%", 150, y, { align: "right" })
  doc.text("Subtotal", 198, y, { align: "right" })
  y += 4
  doc.line(10, y, pageW - 10, y)
  y += 4

  // Items rows
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  for (const it of data.items) {
    if (y > 240) { doc.addPage(); y = 20 }
    doc.text(String(it.quantity), 12, y)
    const descLines = doc.splitTextToSize(it.description, 95)
    doc.text(descLines, 28, y)
    doc.text(`$ ${fmt(it.unitPrice)}`, 130, y, { align: "right" })
    doc.text(`${(it.taxRate * 100).toFixed(1)}%`, 150, y, { align: "right" })
    doc.text(`$ ${fmt(it.subtotal)}`, 198, y, { align: "right" })
    y += Math.max(5, descLines.length * 4)
  }

  // Totals
  y += 4
  doc.line(120, y, pageW - 10, y)
  y += 5
  doc.setFontSize(9)
  doc.text("Subtotal (neto):", 130, y)
  doc.text(`$ ${fmt(data.totals.subtotalNeto)}`, 198, y, { align: "right" })
  y += 5
  if (data.totals.iva105 > 0) {
    doc.text("IVA 10.5%:", 130, y)
    doc.text(`$ ${fmt(data.totals.iva105)}`, 198, y, { align: "right" })
    y += 5
  }
  if (data.totals.iva21 > 0) {
    doc.text("IVA 21%:", 130, y)
    doc.text(`$ ${fmt(data.totals.iva21)}`, 198, y, { align: "right" })
    y += 5
  }
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.text("TOTAL:", 130, y + 2)
  doc.text(`$ ${fmt(data.totals.total)}`, 198, y + 2, { align: "right" })
  y += 12

  // Footer: QR + CAE
  doc.setLineWidth(0.2)
  doc.line(10, y, pageW - 10, y)
  y += 5

  // QR placeholder (square box) — TODO: add real QR via `qrcode` package.
  const qrSize = 28
  doc.setLineWidth(0.3)
  doc.rect(12, y, qrSize, qrSize)
  doc.setFontSize(6)
  doc.setFont("helvetica", "italic")
  doc.text("QR AFIP", 12 + qrSize / 2, y + qrSize / 2, { align: "center" })

  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.text(`CAE: ${data.invoice.cae}`, 50, y + 5)
  doc.text(`Vto. CAE: ${data.invoice.caeExpiresAt.toLocaleDateString("es-AR")}`, 50, y + 11)
  doc.setFontSize(7)
  doc.setFont("helvetica", "italic")
  doc.text("Comprobante autorizado por AFIP", 50, y + 17)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(6)
  // Print the URL so it's at least scannable manually.
  const urlLines = doc.splitTextToSize(data.invoice.qrUrl, 145)
  doc.text(urlLines, 50, y + 22)

  const ab = doc.output("arraybuffer") as ArrayBuffer
  return Buffer.from(new Uint8Array(ab))
}

/**
 * Generates a PDF for the given saleId (server-side). Caller must ensure the
 * sale belongs to the requesting tenant (this function does not check auth).
 */
export async function generateInvoicePDF(saleId: string, copy: "ORIGINAL" | "DUPLICADO" = "ORIGINAL"): Promise<Buffer> {
  const sale = await db.sale.findUnique({
    where: { id: saleId },
    include: {
      items: true,
      client: true,
      tenant: { include: { config: true } },
    },
  })
  if (!sale) throw new Error("Venta no encontrada")
  if (!sale.cae || !sale.invoiceNumber || !sale.pointOfSale || !sale.invoiceType) {
    throw new Error("La venta no tiene CAE asignado todavía")
  }

  const cfg = sale.tenant.config!
  const TAX_RATES: Record<string, number> = { ZERO: 0, REDUCED: 0.105, STANDARD: 0.21 }

  const items = sale.items.map((i) => ({
    description: i.productName,
    quantity: i.quantity,
    unitPrice: Number(i.unitPrice),
    taxRate: TAX_RATES[i.taxRate] ?? 0.21,
    subtotal: Number(i.subtotal),
  }))

  let iva105 = 0, iva21 = 0, neto = 0
  for (const it of items) {
    const base = it.subtotal / (1 + it.taxRate)
    const iva = it.subtotal - base
    neto += base
    if (Math.abs(it.taxRate - 0.105) < 0.001) iva105 += iva
    if (Math.abs(it.taxRate - 0.21) < 0.001) iva21 += iva
  }

  const letter = (sale.invoiceType ?? "B") as InvoiceLetter
  const codeMap: Record<InvoiceLetter, InvoiceCode> = { A: 1, B: 6, C: 11, M: 51 }

  const data: PdfData = {
    saleId: sale.id,
    emitter: {
      name: cfg.businessName ?? sale.tenant.name,
      cuit: cfg.afipCertCuit ?? cfg.taxId ?? "—",
      address: cfg.address ?? "",
      condicion: (cfg.afipCondicionIVA as CondicionIVA) ?? "RI",
      iibb: null,
      logoUrl: cfg.logoUrl,
    },
    customer: {
      name: sale.client?.name ?? "Consumidor Final",
      docType: (sale.customerDocType as DocType) ?? "SIN_IDENTIFICAR",
      docNumber: sale.customerDocNumber ?? "0",
      condicion: (sale.customerCondicionIVA as CondicionIVA) ?? "CF",
      address: sale.client?.address ?? null,
    },
    invoice: {
      letter,
      code: codeMap[letter],
      pos: sale.pointOfSale,
      number: sale.invoiceNumber,
      date: sale.createdAt,
      cae: sale.cae,
      caeExpiresAt: sale.caeExpiresAt ?? new Date(),
      qrUrl: sale.afipQrUrl ?? buildAfipQRPayload({
        fecha: sale.createdAt,
        cuitEmisor: cfg.afipCertCuit ?? "0",
        ptoVta: sale.pointOfSale,
        tipoCmp: codeMap[letter],
        nroCmp: sale.invoiceNumber,
        importe: Number(sale.total),
        moneda: "PES",
        ctz: 1,
        tipoDocRec: (sale.customerDocType as DocType) ?? "SIN_IDENTIFICAR",
        nroDocRec: sale.customerDocNumber ?? "0",
        cae: sale.cae,
      }),
    },
    items,
    totals: {
      subtotalNeto: round2(neto),
      iva105: round2(iva105),
      iva21: round2(iva21),
      total: Number(sale.total),
    },
    copy,
  }

  return renderPDF(data)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
