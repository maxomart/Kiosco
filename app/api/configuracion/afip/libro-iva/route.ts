import { NextRequest, NextResponse } from "next/server"
import ExcelJS from "exceljs"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { getTenantPlan } from "@/lib/plan-guard"
import { hasFeature } from "@/lib/permissions"

export const dynamic = "force-dynamic"

/**
 * GET /api/configuracion/afip/libro-iva?from=YYYY-MM-DD&to=YYYY-MM-DD&format=json|xlsx
 *
 * Devuelve el Libro IVA Ventas del período — todos los comprobantes
 * facturados (facturas + NC + ND) con CAE en el rango de fechas, en el
 * orden y formato que pide AFIP.
 *
 * `format=xlsx` → descarga .xlsx listo para el contador
 * `format=json` (default) → datos para renderizar tabla en la UI
 *
 * Gate: feature:afip_libro_iva (PRO+).
 */

const TIPO_LABEL: Record<number, string> = {
  1: "Factura A",
  2: "Nota de débito A",
  3: "Nota de crédito A",
  6: "Factura B",
  7: "Nota de débito B",
  8: "Nota de crédito B",
  11: "Factura C",
  12: "Nota de débito C",
  13: "Nota de crédito C",
  51: "Factura M",
  52: "Nota de débito M",
  53: "Nota de crédito M",
}

const DOC_LABEL: Record<string, string> = {
  CUIT: "CUIT",
  CUIL: "CUIL",
  DNI: "DNI",
  EXTRANJERO: "Pasaporte",
  SIN_IDENTIFICAR: "Consumidor Final",
}

interface LibroRow {
  fecha: Date
  tipoLabel: string
  tipoCode: number
  letra: string
  ptoVta: number
  numero: number
  numeroFormatted: string
  docTipo: string
  docNumero: string
  cliente: string | null
  total: number
  neto: number
  iva21: number
  iva105: number
  exento: number
  cae: string
  // Signo: NC resta, factura y ND suman.
  sign: 1 | -1
}

export async function GET(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) {
    return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  if (session.user.role !== "OWNER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos para ver el Libro IVA" }, { status: 403 })
  }

  const plan = await getTenantPlan(tenantId!)
  if (!hasFeature(plan, "feature:afip_libro_iva")) {
    return NextResponse.json(
      { error: "Libro IVA Ventas disponible en Plan Profesional o superior" },
      { status: 402 },
    )
  }

  const sp = req.nextUrl.searchParams
  const fromStr = sp.get("from")
  const toStr = sp.get("to")
  const format = sp.get("format") ?? "json"

  // Default: mes actual
  const now = new Date()
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1)
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  const from = fromStr ? new Date(fromStr) : defaultFrom
  const to = toStr ? new Date(toStr + "T23:59:59") : defaultTo

  // Comprobantes = facturas (Sale con CAE) + notas crédito/débito (AfipNote)
  const [sales, notes] = await Promise.all([
    db.sale.findMany({
      where: {
        tenantId: tenantId!,
        cae: { not: null },
        afipStatus: "APPROVED",
        createdAt: { gte: from, lte: to },
      },
      orderBy: { createdAt: "asc" },
      include: { client: { select: { name: true } } },
    }),
    db.afipNote.findMany({
      where: { tenantId: tenantId!, createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: "asc" },
      include: {
        sale: {
          select: {
            client: { select: { name: true } },
            customerDocType: true,
            customerDocNumber: true,
          },
        },
      },
    }),
  ])

  const rows: LibroRow[] = []

  for (const s of sales) {
    const total = Number(s.total)
    const tipoCode = mapInvoiceTypeToCode(s.invoiceType)
    const isA = s.invoiceType === "A"
    // Para A: discriminamos IVA al 21% (simplificado — el código de emisión
    // hoy asume todo al 21%). Para B/C/M: el IVA va en el total, no se discrimina.
    const neto = isA ? Math.round((total / 1.21) * 100) / 100 : total
    const iva21 = isA ? Math.round((total - neto) * 100) / 100 : 0
    rows.push({
      fecha: s.createdAt,
      tipoLabel: TIPO_LABEL[tipoCode] ?? "Comprobante",
      tipoCode,
      letra: s.invoiceType ?? "",
      ptoVta: s.pointOfSale ?? 0,
      numero: s.invoiceNumber ?? 0,
      numeroFormatted: formatNumero(s.pointOfSale ?? 0, s.invoiceNumber ?? 0),
      docTipo: DOC_LABEL[s.customerDocType ?? "SIN_IDENTIFICAR"] ?? "SIN ID",
      docNumero: s.customerDocNumber ?? "0",
      cliente: s.client?.name ?? null,
      total,
      neto,
      iva21,
      iva105: 0,
      exento: 0,
      cae: s.cae ?? "",
      sign: 1,
    })
  }

  for (const n of notes) {
    const total = Number(n.amount)
    const isA = n.invoiceLetter === "A"
    const neto = isA ? Math.round((total / 1.21) * 100) / 100 : total
    const iva21 = isA ? Math.round((total - neto) * 100) / 100 : 0
    const sign: 1 | -1 = n.kind === "credit" ? -1 : 1
    rows.push({
      fecha: n.createdAt,
      tipoLabel: TIPO_LABEL[n.invoiceCode] ?? "Comprobante",
      tipoCode: n.invoiceCode,
      letra: n.invoiceLetter,
      ptoVta: n.pointOfSale,
      numero: n.invoiceNumber,
      numeroFormatted: formatNumero(n.pointOfSale, n.invoiceNumber),
      docTipo:
        DOC_LABEL[n.sale.customerDocType ?? "SIN_IDENTIFICAR"] ?? "SIN ID",
      docNumero: n.sale.customerDocNumber ?? "0",
      cliente: n.sale.client?.name ?? null,
      total,
      neto,
      iva21,
      iva105: 0,
      exento: 0,
      cae: n.cae,
      sign,
    })
  }

  // Orden cronológico + por número
  rows.sort((a, b) => a.fecha.getTime() - b.fecha.getTime() || a.numero - b.numero)

  // Totales — NC resta
  const totals = rows.reduce(
    (acc, r) => {
      const f = r.sign
      acc.total += r.total * f
      acc.neto += r.neto * f
      acc.iva21 += r.iva21 * f
      acc.iva105 += r.iva105 * f
      acc.exento += r.exento * f
      return acc
    },
    { total: 0, neto: 0, iva21: 0, iva105: 0, exento: 0 },
  )

  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet("Libro IVA Ventas")
    ws.columns = [
      { header: "Fecha", key: "fecha", width: 12 },
      { header: "Tipo", key: "tipo", width: 22 },
      { header: "Número", key: "numero", width: 14 },
      { header: "Doc tipo", key: "docTipo", width: 14 },
      { header: "Doc nro", key: "docNumero", width: 16 },
      { header: "Cliente", key: "cliente", width: 24 },
      { header: "Neto", key: "neto", width: 14, style: { numFmt: '"$"#,##0.00' } },
      { header: "IVA 21%", key: "iva21", width: 12, style: { numFmt: '"$"#,##0.00' } },
      { header: "IVA 10.5%", key: "iva105", width: 12, style: { numFmt: '"$"#,##0.00' } },
      { header: "Exento", key: "exento", width: 12, style: { numFmt: '"$"#,##0.00' } },
      { header: "Total", key: "total", width: 14, style: { numFmt: '"$"#,##0.00' } },
      { header: "CAE", key: "cae", width: 16 },
    ]
    ws.getRow(1).font = { bold: true }
    for (const r of rows) {
      ws.addRow({
        fecha: r.fecha.toLocaleDateString("es-AR"),
        tipo: r.tipoLabel,
        numero: r.numeroFormatted,
        docTipo: r.docTipo,
        docNumero: r.docNumero,
        cliente: r.cliente ?? "—",
        neto: r.neto * r.sign,
        iva21: r.iva21 * r.sign,
        iva105: r.iva105 * r.sign,
        exento: r.exento * r.sign,
        total: r.total * r.sign,
        cae: r.cae,
      })
    }
    // Fila de totales
    ws.addRow({})
    const totalsRow = ws.addRow({
      tipo: "TOTALES",
      neto: totals.neto,
      iva21: totals.iva21,
      iva105: totals.iva105,
      exento: totals.exento,
      total: totals.total,
    })
    totalsRow.font = { bold: true }

    const buf = await wb.xlsx.writeBuffer()
    return new NextResponse(buf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="libro-iva-ventas-${fmtFile(from)}_${fmtFile(to)}.xlsx"`,
      },
    })
  }

  return NextResponse.json({
    from: from.toISOString(),
    to: to.toISOString(),
    count: rows.length,
    totals,
    rows: rows.map((r) => ({
      fecha: r.fecha.toISOString(),
      tipoLabel: r.tipoLabel,
      tipoCode: r.tipoCode,
      letra: r.letra,
      numeroFormatted: r.numeroFormatted,
      docTipo: r.docTipo,
      docNumero: r.docNumero,
      cliente: r.cliente,
      total: r.total * r.sign,
      neto: r.neto * r.sign,
      iva21: r.iva21 * r.sign,
      iva105: r.iva105 * r.sign,
      exento: r.exento * r.sign,
      cae: r.cae,
      isNC: r.sign === -1,
    })),
  })
}

function mapInvoiceTypeToCode(letter: string | null): number {
  switch (letter) {
    case "A":
      return 1
    case "B":
      return 6
    case "C":
      return 11
    case "M":
      return 51
    default:
      return 0
  }
}

function formatNumero(pos: number, nro: number): string {
  return `${String(pos).padStart(4, "0")}-${String(nro).padStart(8, "0")}`
}

function fmtFile(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`
}
