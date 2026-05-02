import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { predictStockouts } from "@/lib/predictions"

export const dynamic = "force-dynamic"

/**
 * Lista de proveedores con sus productos por reponer.
 * Usa la misma lógica de IA predictiva (predictStockouts) que el dashboard
 * para sugerir cantidades a pedir, basadas en velocidad de venta.
 */
export async function GET() {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const stockouts = await predictStockouts(tenantId!)

  // Solo productos que necesitan reponerse (critical o warning)
  const needsRestock = stockouts.filter((s) => s.severity !== "ok")
  const productIds = needsRestock.map((s) => s.productId)

  const products = await db.product.findMany({
    where: { id: { in: productIds }, tenantId: tenantId! },
    select: {
      id: true,
      name: true,
      sku: true,
      barcode: true,
      stock: true,
      minStock: true,
      maxStock: true,
      costPrice: true,
      supplierId: true,
      supplier: { select: { id: true, name: true, contact: true, phone: true, email: true } },
    },
  })

  // Agrupar por proveedor
  const bySupplier = new Map<string, {
    supplierId: string | null
    supplierName: string
    contact: string | null
    phone: string | null
    email: string | null
    items: Array<{
      productId: string
      productName: string
      sku: string | null
      barcode: string | null
      currentStock: number
      minStock: number
      maxStock: number | null
      velocityPerDay: number
      daysUntilStockout: number | null
      severity: string
      suggestedQty: number
      costPrice: number
      estimatedCost: number
    }>
    totalItems: number
    totalEstimated: number
  }>()

  const stockoutById = new Map(needsRestock.map((s) => [s.productId, s]))

  for (const p of products) {
    const stockout = stockoutById.get(p.id)
    if (!stockout) continue

    // Sugerir reponer: maxStock si existe, si no, llegar a 30 días de stock o 2× minStock
    const targetStock = p.maxStock
      ? p.maxStock
      : Math.max(p.minStock * 2, Math.ceil(stockout.velocityPerDay * 30))
    const suggestedQty = Math.max(1, targetStock - p.stock)
    const cost = Number(p.costPrice)

    const supplierKey = p.supplierId ?? "__no_supplier__"
    if (!bySupplier.has(supplierKey)) {
      bySupplier.set(supplierKey, {
        supplierId: p.supplierId,
        supplierName: p.supplier?.name ?? "Sin proveedor asignado",
        contact: p.supplier?.contact ?? null,
        phone: p.supplier?.phone ?? null,
        email: p.supplier?.email ?? null,
        items: [],
        totalItems: 0,
        totalEstimated: 0,
      })
    }
    const group = bySupplier.get(supplierKey)!
    group.items.push({
      productId: p.id,
      productName: p.name,
      sku: p.sku,
      barcode: p.barcode,
      currentStock: p.stock,
      minStock: p.minStock,
      maxStock: p.maxStock,
      velocityPerDay: stockout.velocityPerDay,
      daysUntilStockout: stockout.daysUntilStockout,
      severity: stockout.severity,
      suggestedQty,
      costPrice: cost,
      estimatedCost: cost * suggestedQty,
    })
    group.totalItems += suggestedQty
    group.totalEstimated += cost * suggestedQty
  }

  // Ordenar por urgencia: proveedores con más items críticos primero
  const groups = Array.from(bySupplier.values()).sort((a, b) => {
    const critA = a.items.filter((i) => i.severity === "critical").length
    const critB = b.items.filter((i) => i.severity === "critical").length
    if (critA !== critB) return critB - critA
    return b.items.length - a.items.length
  })

  return NextResponse.json({ groups })
}
