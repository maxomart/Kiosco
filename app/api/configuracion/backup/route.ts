import { NextResponse } from "next/server"
import ExcelJS from "exceljs"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"

export const dynamic = "force-dynamic"

/**
 * GET /api/configuracion/backup
 *
 * Genera un .xlsx con todas las hojas del kiosquero, decorado con headers
 * estilizados, alternating rows, columnas auto-width, totales con formato.
 *
 * Hojas:
 *   1. Resumen        — KPIs, total ventas, ingresos, productos, etc.
 *   2. Productos      — catálogo completo con stock + precios + categoría
 *   3. Ventas         — historial completo
 *   4. Items vendidos — detalle por línea de cada venta
 *   5. Clientes       — clientes + cuenta corriente
 *   6. Cargas         — compras a proveedores
 *   7. Gastos         — gastos del negocio
 *   8. Configuración  — datos del negocio
 */
export async function GET() {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const tenant = await db.tenant.findUnique({
    where: { id: tenantId! },
    include: {
      config: true,
      products: {
        include: { category: true, supplier: true },
        orderBy: { name: "asc" },
      },
      clients: { orderBy: { name: "asc" } },
      sales: {
        include: { items: true, client: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
      recharges: { include: { supplier: true, items: true }, orderBy: { createdAt: "desc" } },
      expenses: { orderBy: { createdAt: "desc" } },
    },
  })
  if (!tenant) return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 })

  const wb = new ExcelJS.Workbook()
  wb.creator = "Orvex"
  wb.created = new Date()
  wb.title = `Backup ${tenant.name}`

  // Estilos compartidos
  const headerStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, color: { argb: "FFFFFFFF" }, size: 11 },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF7C3AED" } },
    alignment: { vertical: "middle", horizontal: "left" },
    border: {
      bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
    },
  }
  const altRowStyle: Partial<ExcelJS.Style> = {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } },
  }
  const moneyFmt = '"$ "#,##0.00'

  function applyTableStyle(ws: ExcelJS.Worksheet, headers: string[], dataRows: any[][]) {
    ws.addRow(headers)
    const headerRow = ws.getRow(1)
    headerRow.height = 24
    headerRow.eachCell((cell) => Object.assign(cell, { style: headerStyle }))

    dataRows.forEach((row, i) => {
      const r = ws.addRow(row)
      r.height = 20
      if (i % 2 === 1) {
        r.eachCell((cell) => Object.assign(cell, { style: { ...cell.style, ...altRowStyle } }))
      }
    })

    ws.columns.forEach((col) => {
      let max = 10
      col.eachCell?.({ includeEmpty: false }, (cell) => {
        const len = String(cell.value ?? "").length
        if (len > max) max = len
      })
      col.width = Math.min(max + 2, 50)
    })

    ws.views = [{ state: "frozen", ySplit: 1 }]
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } }
  }

  // ── Hoja 1: Resumen ─────────────────────────────────────────────────
  const summary = wb.addWorksheet("📊 Resumen")
  summary.mergeCells("A1:D1")
  summary.getCell("A1").value = `Backup completo — ${tenant.name}`
  summary.getCell("A1").font = { bold: true, size: 18, color: { argb: "FF111827" } }
  summary.getCell("A1").alignment = { vertical: "middle", horizontal: "center" }
  summary.getRow(1).height = 36

  summary.mergeCells("A2:D2")
  summary.getCell("A2").value = `Generado el ${new Date().toLocaleString("es-AR")}`
  summary.getCell("A2").font = { italic: true, color: { argb: "FF6B7280" } }
  summary.getCell("A2").alignment = { vertical: "middle", horizontal: "center" }

  const totalRevenue = tenant.sales.reduce((s, x) => s + Number(x.total), 0)
  const totalCost = tenant.sales.flatMap((x) => x.items).reduce((s, it) => s + Number(it.costPrice) * it.quantity, 0)
  const totalProfit = totalRevenue - totalCost
  const stats: Array<[string, string | number, string?]> = [
    ["Productos", tenant.products.length],
    ["Ventas totales", tenant.sales.length],
    ["Ingresos totales", totalRevenue, "money"],
    ["Costo total", totalCost, "money"],
    ["Ganancia bruta", totalProfit, "money"],
    ["Margen %", totalRevenue > 0 ? `${((totalProfit / totalRevenue) * 100).toFixed(1)}%` : "—"],
    ["Clientes", tenant.clients.length],
    ["Cargas / compras", tenant.recharges.length],
    ["Gastos registrados", tenant.expenses.length],
  ]
  summary.addRow([])
  summary.getRow(4).values = ["Métrica", "Valor"]
  summary.getRow(4).eachCell((cell) => Object.assign(cell, { style: headerStyle }))
  summary.getRow(4).height = 24
  stats.forEach(([label, value, fmt], i) => {
    const r = summary.addRow([label, value])
    r.height = 20
    if (fmt === "money") r.getCell(2).numFmt = moneyFmt
    if (i % 2 === 1) r.eachCell((cell) => Object.assign(cell, { style: { ...cell.style, ...altRowStyle } }))
  })
  summary.getColumn(1).width = 30
  summary.getColumn(2).width = 22

  // ── Hoja 2: Productos ──────────────────────────────────────────────
  const productsWs = wb.addWorksheet("📦 Productos")
  applyTableStyle(productsWs, [
    "Nombre", "Categoría", "Proveedor", "SKU", "Código barras",
    "Precio costo", "Precio venta", "Margen %", "Stock", "Stock mínimo", "Activo",
  ], tenant.products.map((p) => {
    const cost = Number(p.costPrice)
    const sale = Number(p.salePrice)
    const margin = sale > 0 ? ((sale - cost) / sale) * 100 : 0
    return [
      p.name,
      p.category?.name ?? "",
      p.supplier?.name ?? "",
      p.sku ?? "",
      p.barcode ?? "",
      cost,
      sale,
      Number(margin.toFixed(1)),
      p.stock,
      p.minStock,
      p.active ? "Sí" : "No",
    ]
  }))
  ;[6, 7].forEach((c) => (productsWs.getColumn(c).numFmt = moneyFmt))
  productsWs.getColumn(8).numFmt = '0.0"%"'

  // ── Hoja 3: Ventas ─────────────────────────────────────────────────
  const salesWs = wb.addWorksheet("💰 Ventas")
  applyTableStyle(salesWs, [
    "N°", "Fecha", "Cliente", "Items", "Subtotal", "Descuento", "Total",
    "Método pago", "Estado", "Factura", "CAE",
  ], tenant.sales.map((s) => [
    s.number,
    s.createdAt.toLocaleString("es-AR"),
    s.client?.name ?? "Consumidor final",
    s.items.length,
    Number(s.subtotal),
    Number(s.discountAmount),
    Number(s.total),
    s.paymentMethod,
    s.status,
    s.invoiceType ? `${s.invoiceType} ${String(s.pointOfSale ?? 1).padStart(4, "0")}-${String(s.invoiceNumber ?? 0).padStart(8, "0")}` : "",
    s.cae ?? "",
  ]))
  ;[5, 6, 7].forEach((c) => (salesWs.getColumn(c).numFmt = moneyFmt))

  // ── Hoja 4: Items vendidos ─────────────────────────────────────────
  const itemsWs = wb.addWorksheet("🛒 Items vendidos")
  applyTableStyle(itemsWs, [
    "Venta N°", "Fecha", "Producto", "Cantidad", "Precio unit.", "Subtotal",
  ], tenant.sales.flatMap((s) =>
    s.items.map((it) => [
      s.number,
      s.createdAt.toLocaleDateString("es-AR"),
      it.productName,
      it.quantity,
      Number(it.unitPrice),
      Number(it.subtotal),
    ])
  ))
  ;[5, 6].forEach((c) => (itemsWs.getColumn(c).numFmt = moneyFmt))

  // ── Hoja 5: Clientes ───────────────────────────────────────────────
  const clientsWs = wb.addWorksheet("👥 Clientes")
  applyTableStyle(clientsWs, [
    "Nombre", "Teléfono", "Email", "Crédito disponible", "Saldo actual", "Puntos",
  ], tenant.clients.map((c) => [
    c.name,
    c.phone ?? "",
    c.email ?? "",
    Number(c.creditLimit),
    Number(c.currentBalance),
    c.loyaltyPoints,
  ]))
  ;[4, 5].forEach((c) => (clientsWs.getColumn(c).numFmt = moneyFmt))

  // ── Hoja 6: Cargas ─────────────────────────────────────────────────
  const rechargesWs = wb.addWorksheet("📥 Cargas")
  applyTableStyle(rechargesWs, [
    "N°", "Fecha", "Proveedor", "Items", "Total",
  ], tenant.recharges.map((r) => [
    r.number,
    r.createdAt.toLocaleDateString("es-AR"),
    r.supplier?.name ?? "",
    r.items.length,
    Number(r.amount),
  ]))
  rechargesWs.getColumn(5).numFmt = moneyFmt

  // ── Hoja 7: Gastos ─────────────────────────────────────────────────
  const expensesWs = wb.addWorksheet("📤 Gastos")
  applyTableStyle(expensesWs, [
    "Fecha", "Categoría", "Monto", "Notas",
  ], tenant.expenses.map((e) => [
    e.createdAt.toLocaleDateString("es-AR"),
    e.category,
    Number(e.amount),
    e.notes ?? "",
  ]))
  expensesWs.getColumn(3).numFmt = moneyFmt

  // ── Hoja 8: Configuración ──────────────────────────────────────────
  const cfgWs = wb.addWorksheet("⚙️ Configuración")
  cfgWs.addRow(["Campo", "Valor"]).eachCell((cell) => Object.assign(cell, { style: headerStyle }))
  cfgWs.getRow(1).height = 24
  const cfgRows: Array<[string, string]> = [
    ["Nombre del negocio", tenant.config?.businessName ?? tenant.name],
    ["Tipo de negocio", tenant.config?.businessType ?? ""],
    ["Teléfono", tenant.config?.phone ?? ""],
    ["Email", tenant.config?.email ?? ""],
    ["CUIT/CUIL", tenant.config?.taxId ?? ""],
    ["Dirección", tenant.config?.address ?? ""],
    ["Moneda", tenant.config?.currency ?? "ARS"],
    ["Timezone", tenant.config?.timezone ?? ""],
    ["AFIP habilitado", tenant.config?.afipEnabled ? "Sí" : "No"],
    ["AFIP modo", tenant.config?.afipMode ?? ""],
    ["AFIP punto de venta", String(tenant.config?.afipPointOfSale ?? "")],
    ["Programa fidelidad", tenant.config?.loyaltyEnabled ? "Activo" : "Inactivo"],
  ]
  cfgRows.forEach(([k, v], i) => {
    const r = cfgWs.addRow([k, v])
    r.height = 20
    if (i % 2 === 1) r.eachCell((cell) => Object.assign(cell, { style: { ...cell.style, ...altRowStyle } }))
  })
  cfgWs.getColumn(1).width = 30
  cfgWs.getColumn(2).width = 50

  // Generar buffer y devolver
  const buffer = await wb.xlsx.writeBuffer()
  const slug = tenant.slug || "kiosco"
  const today = new Date().toISOString().split("T")[0]
  const filename = `orvex-backup-${slug}-${today}.xlsx`
  return new Response(buffer as any, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
