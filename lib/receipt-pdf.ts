/**
 * Generates a thermal-printer-friendly 80mm receipt PDF.
 *
 * Format:
 *   - Width: 80mm
 *   - Height: dynamic (depends on item count)
 *   - Tenant name centered + optional logo + address
 *   - Sale info: ticket #, date, cashier
 *   - Item list (compact, monospace-ish)
 *   - Subtotal / discount / total
 *   - Payment method
 *   - "Gracias por su compra"
 *   - Optional QR linking to a public sale page (out of scope, just the QR url)
 *
 * Compatible with most ESC/POS thermal printers via the browser print dialog
 * (Chrome's "Save as PDF" → printer driver respects 80mm width).
 */

import { jsPDF } from "jspdf"
import { db } from "@/lib/db"

const MM_WIDTH = 80
const MARGIN_X = 4
const LINE_H = 4

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  DEBIT: "Débito",
  CREDIT: "Crédito",
  TRANSFER: "Transferencia",
  MERCADOPAGO: "Mercado Pago",
  UALA: "Ualá",
  MODO: "MODO",
  NARANJA_X: "Naranja X",
  CUENTA_DNI: "Cuenta DNI",
  LOYALTY_POINTS: "Puntos",
  MIXED: "Mixto",
  CUENTA_CORRIENTE: "Cuenta corriente",
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(n)
}

function fmtDateTime(d: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(d)
}

export async function generateReceiptPDF(saleId: string): Promise<Buffer> {
  const sale = await db.sale.findUnique({
    where: { id: saleId },
    include: {
      items: true,
      user: { select: { name: true } },
      client: { select: { name: true } },
      tenant: {
        select: {
          name: true,
          config: { select: { address: true, phone: true, taxId: true, logoUrl: true } },
        },
      },
    },
  })
  if (!sale) throw new Error("Venta no encontrada")

  const cfg = sale.tenant.config

  // Estimate height
  const baseLines = 14
  const itemLines = sale.items.length * 2 + 2
  const estHeight = Math.max(120, (baseLines + itemLines) * LINE_H + 40)

  const doc = new jsPDF({ unit: "mm", format: [MM_WIDTH, estHeight] })

  let y = 6
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.text(sale.tenant.name, MM_WIDTH / 2, y, { align: "center" })
  y += LINE_H

  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  if (cfg?.address) {
    doc.text(cfg.address, MM_WIDTH / 2, y, { align: "center", maxWidth: MM_WIDTH - 2 * MARGIN_X })
    y += LINE_H
  }
  if (cfg?.phone) {
    doc.text(`Tel: ${cfg.phone}`, MM_WIDTH / 2, y, { align: "center" })
    y += LINE_H
  }
  if (cfg?.taxId) {
    doc.text(`CUIT: ${cfg.taxId}`, MM_WIDTH / 2, y, { align: "center" })
    y += LINE_H
  }

  // Separator
  y += 1
  doc.setLineWidth(0.2)
  doc.line(MARGIN_X, y, MM_WIDTH - MARGIN_X, y)
  y += LINE_H

  // Sale info
  doc.setFontSize(8)
  doc.text(`TICKET #${sale.number}`, MARGIN_X, y)
  doc.text(fmtDateTime(sale.createdAt), MM_WIDTH - MARGIN_X, y, { align: "right" })
  y += LINE_H
  if (sale.user?.name) {
    doc.setFontSize(7)
    doc.text(`Cajero: ${sale.user.name}`, MARGIN_X, y)
    y += LINE_H
  }
  if (sale.client?.name) {
    doc.text(`Cliente: ${sale.client.name}`, MARGIN_X, y)
    y += LINE_H
  }

  // Items header
  y += 1
  doc.line(MARGIN_X, y, MM_WIDTH - MARGIN_X, y)
  y += LINE_H
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7)
  doc.text("Producto", MARGIN_X, y)
  doc.text("Subt.", MM_WIDTH - MARGIN_X, y, { align: "right" })
  y += LINE_H
  doc.setFont("helvetica", "normal")

  for (const it of sale.items) {
    const name = it.productName.length > 28 ? it.productName.slice(0, 28) + "…" : it.productName
    doc.text(name, MARGIN_X, y)
    doc.text(fmtMoney(Number(it.subtotal)), MM_WIDTH - MARGIN_X, y, { align: "right" })
    y += LINE_H - 0.5
    doc.setFontSize(6)
    doc.setTextColor(120)
    doc.text(`${it.quantity} x ${fmtMoney(Number(it.unitPrice))}`, MARGIN_X, y)
    doc.setTextColor(0)
    doc.setFontSize(7)
    y += LINE_H - 0.5
  }

  // Totals
  y += 1
  doc.line(MARGIN_X, y, MM_WIDTH - MARGIN_X, y)
  y += LINE_H

  const subtotal = Number(sale.subtotal)
  const discountAmount = Number(sale.discountAmount)
  const total = Number(sale.total)

  doc.setFontSize(7)
  doc.text("Subtotal", MARGIN_X, y)
  doc.text(fmtMoney(subtotal), MM_WIDTH - MARGIN_X, y, { align: "right" })
  y += LINE_H

  if (discountAmount > 0) {
    doc.text(`Desc. ${Number(sale.discountPercent)}%`, MARGIN_X, y)
    doc.text(`-${fmtMoney(discountAmount)}`, MM_WIDTH - MARGIN_X, y, { align: "right" })
    y += LINE_H
  }

  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.text("TOTAL", MARGIN_X, y)
  doc.text(fmtMoney(total), MM_WIDTH - MARGIN_X, y, { align: "right" })
  y += LINE_H + 1

  // Payment
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.text(`Pago: ${PAYMENT_LABELS[sale.paymentMethod] ?? sale.paymentMethod}`, MARGIN_X, y)
  y += LINE_H
  if (sale.cashReceived != null) {
    doc.text(`Recibido: ${fmtMoney(Number(sale.cashReceived))}`, MARGIN_X, y); y += LINE_H
    if (sale.change != null && Number(sale.change) > 0) {
      doc.text(`Vuelto: ${fmtMoney(Number(sale.change))}`, MARGIN_X, y); y += LINE_H
    }
  }

  // Footer
  y += 2
  doc.line(MARGIN_X, y, MM_WIDTH - MARGIN_X, y)
  y += LINE_H
  doc.setFont("helvetica", "bold")
  doc.text("¡GRACIAS POR SU COMPRA!", MM_WIDTH / 2, y, { align: "center" })
  y += LINE_H
  doc.setFont("helvetica", "normal")
  doc.setFontSize(6)
  doc.setTextColor(120)
  doc.text("Este ticket no es válido como factura", MM_WIDTH / 2, y, { align: "center" })

  const arrayBuffer = doc.output("arraybuffer") as ArrayBuffer
  return Buffer.from(arrayBuffer)
}
