import { db } from "@/lib/db"
import type { ProductMarginAnalysis } from "@/types"
import { subDays } from "date-fns"

export async function calculateProductMargins(
  tenantId: string,
  days: 30 | 90 | 365 = 30
): Promise<ProductMarginAnalysis[]> {
  const startDate = subDays(new Date(), days)

  // Get all active products
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

  // Get sales data for period
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

  // Aggregate sales by product
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

  // Calculate metrics for each product
  const analysis: ProductMarginAnalysis[] = products.map((product) => {
    const sales = salesByProduct.get(product.id) || {
      quantity: 0,
      revenue: 0,
      cost: 0,
    }

    const cost = Number(product.costPrice)
    const price = Number(product.salePrice)
    const currentMargin = price > cost ? ((price - cost) / price) * 100 : 0
    // Potential: +10% on price
    const potentialPrice = price * 1.1
    const potentialMargin =
      potentialPrice > cost
        ? ((potentialPrice - cost) / potentialPrice) * 100
        : 0

    const avgDailySales = sales.quantity / days
    const daysToStockout =
      avgDailySales > 0
        ? Math.ceil(product.stock / avgDailySales)
        : 999

    const rotationRate = product.stock > 0 ? sales.quantity / product.stock : 0

    // Health status: based on rotation (2x/month = 0.067/day) and margin
    let healthStatus: "HIGH" | "MEDIUM" | "LOW" | "DEAD"
    if (rotationRate < 0.1 && sales.quantity < 1) {
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

  // Sort: DEAD first, then by margin
  return analysis.sort((a, b) => {
    const statusOrder = { DEAD: 0, LOW: 1, MEDIUM: 2, HIGH: 3 }
    const statusDiff =
      statusOrder[a.healthStatus] - statusOrder[b.healthStatus]
    if (statusDiff !== 0) return statusDiff
    return a.currentMarginPct - b.currentMarginPct
  })
}
