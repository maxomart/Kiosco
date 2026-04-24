import { db } from "@/lib/db"
import type { StockPrediction } from "@/types"
import { subDays } from "date-fns"

export async function predictStockLevels(
  tenantId: string,
  days: 30 | 90 = 30
): Promise<StockPrediction[]> {
  const startDate = subDays(new Date(), days)

  // Get all active products
  const products = await db.product.findMany({
    where: { tenantId, active: true },
    select: {
      id: true,
      name: true,
      stock: true,
      costPrice: true,
      salePrice: true,
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
    },
  })

  // Aggregate sales by product
  const salesByProduct = new Map<string, number>()
  for (const item of saleItems) {
    const current = salesByProduct.get(item.productId) || 0
    salesByProduct.set(item.productId, current + item.quantity)
  }

  // Calculate predictions
  const predictions: StockPrediction[] = products
    .map((product) => {
      const totalQuantitySold = salesByProduct.get(product.id) || 0
      const avgDailySales = totalQuantitySold / days
      const daysUntilStockout =
        avgDailySales > 0
          ? Math.ceil(product.stock / avgDailySales)
          : 999

      // Recommend 30 days of stock
      const recommendedQuantity = Math.ceil(avgDailySales * 30)
      const estimatedCost =
        recommendedQuantity * Number(product.costPrice)

      // Urgency levels
      let urgency: "CRITICAL" | "HIGH" | "NORMAL" | "LOW"
      if (daysUntilStockout <= 3) {
        urgency = "CRITICAL"
      } else if (daysUntilStockout <= 7) {
        urgency = "HIGH"
      } else if (daysUntilStockout <= 15) {
        urgency = "NORMAL"
      } else {
        urgency = "LOW"
      }

      return {
        productId: product.id,
        productName: product.name,
        currentStock: product.stock,
        avgDailySales: Math.round(avgDailySales * 10) / 10,
        daysUntilStockout,
        recommendedQuantity,
        estimatedCost: Math.round(estimatedCost),
        urgency,
      }
    })
    .filter((p) => p.urgency !== "LOW") // Only show products that need attention
    .sort((a, b) => {
      const urgencyOrder = {
        CRITICAL: 0,
        HIGH: 1,
        NORMAL: 2,
        LOW: 3,
      }
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
    })

  return predictions
}
