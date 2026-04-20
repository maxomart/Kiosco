import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { startOfDay, endOfDay, format } from "date-fns"

export async function GET(req: NextRequest) {
  const { error, tenantId } = await getSessionTenant()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const from = searchParams.get("from") ? new Date(searchParams.get("from")!) : startOfDay(new Date())
  const to = searchParams.get("to") ? new Date(searchParams.get("to")!) : endOfDay(new Date())
  const tenantFilter = tenantId ? { tenantId } : {}

  const where = { ...tenantFilter, status: "COMPLETED", createdAt: { gte: from, lte: to } }

  const [salesAgg, itemsRaw, paymentMethods, sales] = await Promise.all([
    db.sale.aggregate({ where, _sum: { total: true, discountAmount: true, taxAmount: true }, _count: true, _avg: { total: true } }),
    db.saleItem.findMany({ where: { sale: { ...where } }, select: { productName: true, quantity: true, subtotal: true, costPrice: true } }),
    db.sale.groupBy({ by: ["paymentMethod"], where, _sum: { total: true }, _count: true }),
    db.sale.findMany({ where, select: { createdAt: true, total: true }, orderBy: { createdAt: "asc" } }),
  ])

  // Total cost from items
  const totalCost = itemsRaw.reduce((acc, i) => acc + Number(i.costPrice) * i.quantity, 0)
  const totalRevenue = Number(salesAgg._sum.total ?? 0)
  const totalProfit = totalRevenue - totalCost

  // Top products
  const productMap: Record<string, { quantity: number; revenue: number }> = {}
  for (const item of itemsRaw) {
    if (!productMap[item.productName]) productMap[item.productName] = { quantity: 0, revenue: 0 }
    productMap[item.productName].quantity += item.quantity
    productMap[item.productName].revenue += Number(item.subtotal)
  }
  const topProducts = Object.entries(productMap)
    .map(([productName, v]) => ({ productName, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  // Sales by method
  const salesByMethod = paymentMethods.map(m => ({ method: m.paymentMethod, count: m._count, total: Number(m._sum.total ?? 0) }))

  // Daily sales
  const dailyMap: Record<string, { total: number; count: number }> = {}
  for (const s of sales) {
    const d = format(s.createdAt, "yyyy-MM-dd")
    if (!dailyMap[d]) dailyMap[d] = { total: 0, count: 0 }
    dailyMap[d].total += Number(s.total)
    dailyMap[d].count++
  }
  const dailySales = Object.entries(dailyMap).map(([date, v]) => ({ date, ...v }))

  return NextResponse.json({
    totalSales: salesAgg._count,
    totalRevenue,
    totalCost,
    totalProfit,
    profitMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
    avgTicket: Number(salesAgg._avg.total ?? 0),
    topProducts,
    salesByMethod,
    dailySales,
  })
}
