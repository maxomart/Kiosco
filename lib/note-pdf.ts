/**
 * Genera un PDF (80mm térmico) para una nota de crédito o débito.
 *
 * Similar a receipt-pdf.ts (factura) pero con datos específicos de la NC/ND:
 *   - Tipo: "NOTA DE CRÉDITO X" o "NOTA DE DÉBITO X"
 *   - Asociación a la factura original (tipo + nro)
 *   - CAE + vencimiento
 *   - QR de validación AFIP (https://www.afip.gob.ar/fe/qr/...)
 *   - Concepto si la nota tiene uno guardado
 */

import { jsPDF } from "jspdf"
import { db } from "@/lib/db"

const MM_WIDTH = 80
const MARGIN_X = 4
const LINE_H = 4

function fmtMoney(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(n)
}

function fmtDateTime(d: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)
}

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d)
}

export async function generateNotePDF(noteId: string): Promise<Buffer> {
  const note = await db.afipNote.findUnique({
    where: { id: noteId },
    include: {
      sale: {
        select: {
          number: true,
          invoiceNumber: true,
          invoiceType: true,
          pointOfSale: true,
          client: { select: { name: true } },
        },
      },
      tenant: {
        select: {
          name: true,
          config: {
            select: { address: true, phone: true, taxId: true },
          },
        },
      },
    },
  })
  if (!note) throw new Error("Nota no encontrada")

  const cfg = note.tenant.config
  const isCredit = note.kind === "credit"
  const noteTypeLabel = isCredit ? "NOTA DE CRÉDITO" : "NOTA DE DÉBITO"
  const amount = Number(note.amount)

  // QR como data-url-image (jspdf no soporta URL ext, usamos quickchart o api.qrserver)
  // Cargamos como dataURL via fetch para evitar dependencia extra. Si falla
  // (sin internet), seguimos sin QR.
  let qrDataUrl: string | null = null
  if (note.qrUrl) {
    try {
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(note.qrUrl)}`
      const res = await fetch(qrApiUrl)
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer())
        qrDataUrl = `data:image/png;base64,${buf.toString("base64")}`
      }
    } catch {
      // Sin QR — el PDF sale igual con CAE en texto.
    }
  }

  // Estimación de altura
  const estHeight = 160 + (qrDataUrl ? 50 : 0) + (note.concept ? 10 : 0)
  const doc = new jsPDF({ unit: "mm", format: [MM_WIDTH, estHeight] })

  let y = 6
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.text(note.tenant.name, MM_WIDTH / 2, y, { align: "center" })
  y += LINE_H

  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  if (cfg?.address) {
    doc.text(cfg.address, MM_WIDTH / 2, y, {
      align: "center",
      maxWidth: MM_WIDTH - 2 * MARGIN_X,
    })
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

  // Separador
  y += 1
  doc.setLineWidth(0.2)
  doc.line(MARGIN_X, y, MM_WIDTH - MARGIN_X, y)
  y += LINE_H

  // Tipo de nota
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.text(`${noteTypeLabel} ${note.invoiceLetter}`, MM_WIDTH / 2, y, { align: "center" })
  y += LINE_H

  doc.setFontSize(9)
  const numero = `${String(note.pointOfSale).padStart(4, "0")}-${String(note.invoiceNumber).padStart(8, "0")}`
  doc.text(`N° ${numero}`, MM_WIDTH / 2, y, { align: "center" })
  y += LINE_H

  // Datos
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.text(fmtDateTime(note.createdAt), MM_WIDTH / 2, y, { align: "center" })
  y += LINE_H

  y += 1
  doc.line(MARGIN_X, y, MM_WIDTH - MARGIN_X, y)
  y += LINE_H

  // Factura asociada
  if (note.sale?.invoiceType && note.sale?.invoiceNumber) {
    const facNumero = `${String(note.sale.pointOfSale ?? note.pointOfSale).padStart(4, "0")}-${String(note.sale.invoiceNumber).padStart(8, "0")}`
    doc.text(`Asociada a Factura ${note.sale.invoiceType} N° ${facNumero}`, MARGIN_X, y, {
      maxWidth: MM_WIDTH - 2 * MARGIN_X,
    })
    y += LINE_H
  }

  if (note.sale?.client?.name) {
    doc.text(`Cliente: ${note.sale.client.name}`, MARGIN_X, y, {
      maxWidth: MM_WIDTH - 2 * MARGIN_X,
    })
    y += LINE_H
  }

  if (note.concept) {
    doc.text(`Concepto: ${note.concept}`, MARGIN_X, y, {
      maxWidth: MM_WIDTH - 2 * MARGIN_X,
    })
    y += LINE_H
  }

  // Total
  y += 1
  doc.line(MARGIN_X, y, MM_WIDTH - MARGIN_X, y)
  y += LINE_H
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.text(isCredit ? "TOTAL CRÉDITO" : "TOTAL DÉBITO", MARGIN_X, y)
  doc.text(fmtMoney(amount), MM_WIDTH - MARGIN_X, y, { align: "right" })
  y += LINE_H + 1

  // CAE
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.text(`CAE: ${note.cae}`, MARGIN_X, y)
  y += LINE_H
  doc.text(`Vto. CAE: ${fmtDate(note.caeExpiresAt)}`, MARGIN_X, y)
  y += LINE_H + 1

  // QR
  if (qrDataUrl) {
    const qrSize = 40
    const qrX = (MM_WIDTH - qrSize) / 2
    doc.addImage(qrDataUrl, "PNG", qrX, y, qrSize, qrSize)
    y += qrSize + 2
    doc.setFontSize(6)
    doc.setTextColor(120)
    doc.text("Comprobante autorizado por AFIP", MM_WIDTH / 2, y, { align: "center" })
    doc.setTextColor(0)
    y += LINE_H
  }

  const arrayBuffer = doc.output("arraybuffer") as ArrayBuffer
  return Buffer.from(arrayBuffer)
}
