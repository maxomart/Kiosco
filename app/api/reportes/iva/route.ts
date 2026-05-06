import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { can } from "@/lib/permissions"
import { startOfDay, endOfDay, format } from "date-fns"

export const dynamic = "force-dynamic"

/**
 * Export "IVA del período" — CSV listo para mandarle al contador.
 *
 * Cada fila es una venta con su CAE (si lo tiene), el total final, la base
 * imponible (total / 1.21) y el IVA discriminado (21% de la base). No es
 * un libro IVA legal pero le ahorra al kiosquero horas de Excel cuando le
 * tiene que pasar la información al contador para que cargue Monotributo
 * o IVA Responsable Inscripto.
 *
 * Si el usuario tiene `taxAmount` registrado en la venta (porque emitió
 * factura A/B con AFIP) lo usa tal cual. Si no, calcula con la fórmula
 * estándar: base = total / 1.21, IVA = base * 0.21.
 */
const IVA_RATE = 0.21

export async function GET(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error) return error
  if (!can(session?.user?.role, "reports:export")) {
    return NextResponse.json({ error: "Sin permisos para exportar reportes" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from") ? new Date(searchParams.get("from")!) : startOfDay(new Date())
  const to = searchParams.get("to") ? new Date(searchParams.get("to")!) : endOfDay(new Date())

  const sales = await db.sale.findMany({
    where: {
      tenantId: tenantId!,
      status: "COMPLETED",
      createdAt: { gte: from, lte: to },
    },
    select: {
      number: true,
      createdAt: true,
      total: true,
      discountAmount: true,
      taxAmount: true,
      paymentMethod: true,
      cae: true,
      invoiceType: true,
      invoiceNumber: true,
      pointOfSale: true,
      customerDocType: true,
      customerDocNumber: true,
    },
    orderBy: { createdAt: "asc" },
  })

  const rows: (string | number)[][] = [
    [
      "Fecha",
      "Hora",
      "Nro venta",
      "Tipo factura",
      "Nro factura AFIP",
      "CAE",
      "Tipo doc cliente",
      "Nro doc cliente",
      "Método pago",
      "Total",
      "Base imponible",
      "IVA 21%",
      "Descuento",
    ],
  ]

  let totalFinal = 0
  let totalBase = 0
  let totalIva = 0

  for (const s of sales) {
    const total = Number(s.total)
    const taxStored = Number(s.taxAmount ?? 0)
    // Si la venta ya trae el IVA discriminado (factura A con AFIP), úsalo.
    // Si no, calculamos con el total inverso al 21%.
    const iva = taxStored > 0 ? taxStored : Math.round((total / (1 + IVA_RATE)) * IVA_RATE * 100) / 100
    const base = Math.round((total - iva) * 100) / 100
    const fecha = format(s.createdAt, "yyyy-MM-dd")
    const hora = format(s.createdAt, "HH:mm")
    // Número AFIP completo: punto de venta + 8 dígitos del comprobante
    // (ej: 0001-00000123). Si no se emitió factura electrónica, vacío.
    const numFactura = s.invoiceNumber && s.pointOfSale
      ? `${String(s.pointOfSale).padStart(4, "0")}-${String(s.invoiceNumber).padStart(8, "0")}`
      : ""
    rows.push([
      fecha,
      hora,
      s.number ?? "",
      s.invoiceType ?? "",
      numFactura,
      s.cae ?? "",
      s.customerDocType ?? "Consumidor Final",
      s.customerDocNumber ?? "",
      s.paymentMethod ?? "",
      total.toFixed(2).replace(".", ","),
      base.toFixed(2).replace(".", ","),
      iva.toFixed(2).replace(".", ","),
      Number(s.discountAmount ?? 0).toFixed(2).replace(".", ","),
    ])
    totalFinal += total
    totalBase += base
    totalIva += iva
  }

  rows.push([])
  rows.push(["TOTALES", "", "", "", "", "", "", "", "", totalFinal.toFixed(2).replace(".", ","), totalBase.toFixed(2).replace(".", ","), totalIva.toFixed(2).replace(".", ","), ""])

  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")
  // BOM UTF-8 para que Excel argentino abra los acentos sin romperse.
  const body = "﻿" + csv

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orvex-iva.csv"`,
    },
  })
}
