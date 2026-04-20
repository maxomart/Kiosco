import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { PLAN_LIMITS } from "@/lib/utils"

interface CsvRow {
  nombre?: string
  name?: string
  precio_venta?: string
  price?: string
  costo?: string
  costPrice?: string
  stock?: string
  stock_minimo?: string
  minStock?: string
  codigo_barras?: string
  barcode?: string
  sku?: string
  unidad?: string
  unit?: string
  categoria?: string
  category?: string
}

function parseCSV(text: string): CsvRow[] {
  const lines = text.trim().split("\n")
  if (lines.length < 2) return []
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/["\r]/g, ""))
  return lines.slice(1).map(line => {
    const values = line.split(",").map(v => v.trim().replace(/["\r]/g, ""))
    return Object.fromEntries(headers.map((h, i) => [h, values[i] || ""])) as CsvRow
  })
}

export async function POST(req: NextRequest) {
  const { error, tenantId } = await getSessionTenant()
  if (error) return error

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "Archivo requerido" }, { status: 400 })

  // Check plan limit
  const [currentCount, sub] = await Promise.all([
    db.product.count({ where: { tenantId: tenantId!, active: true } }),
    db.subscription.findUnique({ where: { tenantId: tenantId! }, select: { plan: true } }),
  ])
  const plan = (sub?.plan ?? "FREE") as keyof typeof PLAN_LIMITS
  const limit = PLAN_LIMITS[plan].products

  const text = await file.text()
  const rows = parseCSV(text)

  if (rows.length === 0) return NextResponse.json({ error: "Archivo vacío o formato inválido" }, { status: 400 })
  if (currentCount + rows.length > limit)
    return NextResponse.json({ error: `Límite del plan: máximo ${limit} productos (actualmente ${currentCount})` }, { status: 403 })

  let imported = 0, updated = 0
  const errors: { row: number; message: string }[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2 // 1-indexed, skip header

    const name = row.nombre || row.name
    const priceRaw = row.precio_venta || row.price
    if (!name?.trim()) { errors.push({ row: rowNum, message: "Nombre requerido" }); continue }
    if (!priceRaw || isNaN(parseFloat(priceRaw))) { errors.push({ row: rowNum, message: "Precio inválido" }); continue }

    const barcode = row.codigo_barras || row.barcode || null
    const sku = row.sku || null

    // Find existing by barcode or sku
    const existing = barcode
      ? await db.product.findFirst({ where: { barcode, tenantId: tenantId! } })
      : sku
      ? await db.product.findFirst({ where: { sku, tenantId: tenantId! } })
      : null

    const data = {
      name: name.trim(),
      price: parseFloat(priceRaw),
      costPrice: parseFloat(row.costo || row.costPrice || "0") || 0,
      stock: parseInt(row.stock || "0") || 0,
      minStock: parseInt(row.stock_minimo || row.minStock || "5") || 5,
      barcode: barcode || null,
      sku: sku || null,
      unit: row.unidad || row.unit || "un",
      active: true,
    }

    try {
      if (existing) {
        await db.product.update({ where: { id: existing.id }, data })
        updated++
      } else {
        await db.product.create({ data: { ...data, tenantId: tenantId! } })
        imported++
      }
    } catch (e: any) {
      errors.push({ row: rowNum, message: e.message || "Error al guardar" })
    }
  }

  return NextResponse.json({ imported, updated, errors })
}
