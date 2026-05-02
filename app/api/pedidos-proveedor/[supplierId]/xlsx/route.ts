import { NextRequest, NextResponse } from "next/server"
import ExcelJS from "exceljs"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { predictStockouts } from "@/lib/predictions"
import { requireFeature } from "@/lib/plan-guard"

export const dynamic = "force-dynamic"

/** Genera un .xlsx con la plantilla de pedido para un proveedor específico. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ supplierId: string }> }) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const planErr = await requireFeature(tenantId!, "feature:supplier_orders")
  if (planErr) return planErr

  const { supplierId } = await params
  const noSupplier = supplierId === "sin-proveedor"

  const supplier = noSupplier
    ? null
    : await db.supplier.findUnique({
        where: { id: supplierId },
        select: { id: true, name: true, contact: true, phone: true, email: true, tenantId: true },
      })
  if (!noSupplier && (!supplier || supplier.tenantId !== tenantId!)) {
    return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 })
  }

  const tenant = await db.tenant.findUnique({
    where: { id: tenantId! },
    select: { name: true, config: { select: { businessName: true, phone: true } } },
  })
  const businessName = tenant?.config?.businessName ?? tenant?.name ?? "Mi negocio"
  const businessPhone = tenant?.config?.phone ?? ""

  const stockouts = await predictStockouts(tenantId!)
  const needsRestock = stockouts.filter((s) => s.severity !== "ok")
  const productIds = needsRestock.map((s) => s.productId)

  const products = await db.product.findMany({
    where: {
      id: { in: productIds },
      tenantId: tenantId!,
      ...(noSupplier ? { supplierId: null } : { supplierId }),
    },
    select: {
      id: true,
      name: true,
      sku: true,
      barcode: true,
      stock: true,
      minStock: true,
      maxStock: true,
      costPrice: true,
    },
    orderBy: { name: "asc" },
  })

  const stockoutById = new Map(needsRestock.map((s) => [s.productId, s]))
  const items = products.map((p) => {
    const so = stockoutById.get(p.id)!
    const targetStock = p.maxStock ? p.maxStock : Math.max(p.minStock * 2, Math.ceil(so.velocityPerDay * 30))
    const suggestedQty = Math.max(1, targetStock - p.stock)
    const cost = Number(p.costPrice)
    return {
      ...p,
      velocityPerDay: so.velocityPerDay,
      daysUntilStockout: so.daysUntilStockout,
      severity: so.severity,
      suggestedQty,
      cost,
      estimatedCost: cost * suggestedQty,
    }
  })

  // ─── Build Excel ───
  const wb = new ExcelJS.Workbook()
  wb.creator = "Orvex"
  wb.created = new Date()
  const supplierName = supplier?.name ?? "Sin proveedor"
  wb.title = `Pedido ${supplierName}`

  const ws = wb.addWorksheet("Pedido")

  // Encabezado tipo "carta"
  ws.mergeCells("A1:G1")
  ws.getCell("A1").value = `PEDIDO — ${supplierName}`
  ws.getCell("A1").font = { name: "Calibri", size: 18, bold: true, color: { argb: "FF7C3AED" } }
  ws.getCell("A1").alignment = { horizontal: "center", vertical: "middle" }
  ws.getRow(1).height = 30

  ws.mergeCells("A2:G2")
  ws.getCell("A2").value = `De: ${businessName}${businessPhone ? "  ·  Tel: " + businessPhone : ""}`
  ws.getCell("A2").font = { name: "Calibri", size: 11, italic: true, color: { argb: "FF6B7280" } }
  ws.getCell("A2").alignment = { horizontal: "center" }

  ws.mergeCells("A3:G3")
  ws.getCell("A3").value = `Fecha: ${new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}`
  ws.getCell("A3").font = { name: "Calibri", size: 11, color: { argb: "FF6B7280" } }
  ws.getCell("A3").alignment = { horizontal: "center" }

  if (supplier) {
    ws.mergeCells("A4:G4")
    const contactBits = [supplier.contact, supplier.phone, supplier.email].filter(Boolean).join("  ·  ")
    ws.getCell("A4").value = contactBits ? `Contacto del proveedor: ${contactBits}` : ""
    ws.getCell("A4").font = { name: "Calibri", size: 10, color: { argb: "FF9CA3AF" } }
    ws.getCell("A4").alignment = { horizontal: "center" }
  }

  // Headers de tabla en fila 6
  const headerRow = ws.getRow(6)
  const headers = ["Código", "Producto", "Stock actual", "Días hasta agotar", "Cantidad pedida", "Costo unit.", "Subtotal"]
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = h
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } }
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7C3AED" } }
    cell.alignment = { horizontal: "center", vertical: "middle" }
    cell.border = {
      top: { style: "thin", color: { argb: "FF7C3AED" } },
      bottom: { style: "thin", color: { argb: "FF7C3AED" } },
    }
  })
  headerRow.height = 22

  // Filas de productos
  let total = 0
  items.forEach((it, idx) => {
    const row = ws.getRow(7 + idx)
    row.getCell(1).value = it.barcode ?? it.sku ?? "—"
    row.getCell(2).value = it.name
    row.getCell(3).value = it.stock
    row.getCell(4).value = it.daysUntilStockout ?? "—"
    row.getCell(5).value = it.suggestedQty
    row.getCell(6).value = it.cost
    row.getCell(6).numFmt = '"$"#,##0.00'
    row.getCell(7).value = { formula: `E${row.number}*F${row.number}` }
    row.getCell(7).numFmt = '"$"#,##0.00'

    // Stripes
    if (idx % 2 === 0) {
      for (let c = 1; c <= 7; c++) {
        row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } }
      }
    }
    // Severidad → color en columna 4
    const sev = row.getCell(4)
    if (it.severity === "critical") {
      sev.font = { color: { argb: "FFDC2626" }, bold: true }
    } else if (it.severity === "warning") {
      sev.font = { color: { argb: "FFD97706" }, bold: true }
    }
    // Cantidad pedida en negrita
    row.getCell(5).font = { bold: true, color: { argb: "FF111827" } }

    total += it.estimatedCost
  })

  // Total
  const totalRow = ws.getRow(7 + items.length + 1)
  totalRow.getCell(6).value = "TOTAL ESTIMADO"
  totalRow.getCell(6).font = { bold: true, size: 12, color: { argb: "FF111827" } }
  totalRow.getCell(6).alignment = { horizontal: "right" }
  totalRow.getCell(7).value = total
  totalRow.getCell(7).numFmt = '"$"#,##0.00'
  totalRow.getCell(7).font = { bold: true, size: 12, color: { argb: "FF7C3AED" } }
  totalRow.getCell(7).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3E8FF" } }

  // Footer
  const noteRow = ws.getRow(7 + items.length + 4)
  ws.mergeCells(`A${noteRow.number}:G${noteRow.number}`)
  noteRow.getCell(1).value = "Cantidades sugeridas calculadas con la velocidad de venta de los últimos 14 días."
  noteRow.getCell(1).font = { italic: true, size: 9, color: { argb: "FF9CA3AF" } }
  noteRow.getCell(1).alignment = { horizontal: "center" }

  // Anchos
  ws.getColumn(1).width = 16
  ws.getColumn(2).width = 38
  ws.getColumn(3).width = 12
  ws.getColumn(4).width = 18
  ws.getColumn(5).width = 16
  ws.getColumn(6).width = 14
  ws.getColumn(7).width = 14

  // Freeze header
  ws.views = [{ state: "frozen", ySplit: 6 }]

  const buf = await wb.xlsx.writeBuffer()
  const slug = supplierName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  const filename = `pedido-${slug}-${new Date().toISOString().slice(0, 10)}.xlsx`

  return new NextResponse(buf as any, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
