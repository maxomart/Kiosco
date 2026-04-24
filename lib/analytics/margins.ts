import { db } from "@/lib/db"
import type { ProductMarginAnalysis } from "@/types"
import { subDays } from "date-fns"

export interface MarginSummary {
  topAttention: ProductMarginAnalysis[]  // Top 20 que necesitan acción
  deadCount: number                       // Productos sin ventas
  totalProducts: number
  avgMargin: number
  avgMarginActive: number                 // Solo productos que venden
}

export async function calculateProductMargins(
  tenantId: string,
  days: 30 | 90 | 365 = 30
): Promise<ProductMarginAnalysis[]> {
  const summary = await calculateMarginsSummary(tenantId, days)
  return summary.topAttention
}

export async function calculateMarginsSummary(
  tenantId: string,
  days: 30 | 90 | 365 = 30
): Promise<MarginSummary> {
  const startDate = subDays(new Date(), days)

  const products = await db.product.findMany({
    where: { tenantId, active: true },
    select: {
      id: true,
      name: true,
      costPrice: true,
      salePrice: true,
      stock: true,
    },
  })

  const saleItems = await db.saleItem.findMany({
    where: {
      sale: {
        tenantId,
        status: "COMPLETED",
        createdAt: { gte: startDate },
      },
    },
    select: {
      productId: true,
      quantity: true,
      costPrice: true,
      subtotal: true,
    },
  })

  const salesByProduct = new Map<
    string,
    { quantity: number; revenue: number; cost: number }
  >()

  for (const item of saleItems) {
    const current = salesByProduct.get(item.productId) || {
      quantity: 0,
      revenue: 0,
      cost: 0,
    }
    current.quantity += item.quantity
    current.revenue += Number(item.subtotal)
    current.cost += Number(item.costPrice) * item.quantity
    salesByProduct.set(item.productId, current)
  }

  const allAnalysis: ProductMarginAnalysis[] = products.map((product) => {
    const sales = salesByProduct.get(product.id) || {
      quantity: 0,
      revenue: 0,
      cost: 0,
    }

    const cost = Number(product.costPrice)
    const price = Number(product.salePrice)
    const currentMargin = price > cost ? ((price - cost) / price) * 100 : 0
    const potentialPrice = price * 1.1
    const potentialMargin =
      potentialPrice > cost
        ? ((potentialPrice - cost) / potentialPrice) * 100
        : 0

    const avgDailySales = sales.quantity / days
    const daysToStockout =
      avgDailySales > 0 ? Math.ceil(product.stock / avgDailySales) : 999
    const rotationRate = product.stock > 0 ? sales.quantity / product.stock : 0

    let healthStatus: "HIGH" | "MEDIUM" | "LOW" | "DEAD"
    if (sales.quantity < 1) {
      healthStatus = "DEAD"
    } else if (rotationRate < 0.3 || currentMargin < 10) {
      healthStatus = "LOW"
    } else if (rotationRate < 0.67 || currentMargin < 20) {
      healthStatus = "MEDIUM"
    } else {
      healthStatus = "HIGH"
    }

    return {
      productId: product.id,
      productName: product.name,
      currentMarginPct: Math.round(currentMargin * 10) / 10,
      potentialMarginPct: Math.round(potentialMargin * 10) / 10,
      salesQuantity30d: sales.quantity,
      daysToStockout,
      rotationRate: Math.round(rotationRate * 100) / 100,
      healthStatus,
      currentStock: product.stock,
      avgDailySales: Math.round(avgDailySales * 10) / 10,
    }
  })

  const active = allAnalysis.filter((p) => p.healthStatus !== "DEAD")
  const dead = allAnalysis.filter((p) => p.healthStatus === "DEAD")

  // Priorizar: LOW y MEDIUM con más ventas (son los que pueden mejorar)
  const priority = { LOW: 0, MEDIUM: 1, HIGH: 2, DEAD: 3 }
  const topAttention = active
    .sort((a, b) => {
      const p = priority[a.healthStatus] - priority[b.healthStatus]
      if (p !== 0) return p
      return b.salesQuantity30d - a.salesQuantity30d
    })
    .slice(0, 20)

  const avgMargin =
    allAnalysis.length > 0
      ? Math.round(
          (allAnalysis.reduce((sum, p) => sum + p.currentMarginPct, 0) /
            allAnalysis.length) *
            10
        ) / 10
      : 0

  const avgMarginActive =
    active.length > 0
      ? Math.round(
          (active.reduce((sum, p) => sum + p.currentMarginPct, 0) /
            active.length) *
            10
        ) / 10
      : 0

  return {
    topAttention,
    deadCount: dead.length,
    totalProducts: allAnalysis.length,
    avgMargin,
    avgMarginActive,
  }
}
