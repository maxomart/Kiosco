import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { can, hasFeature } from "@/lib/permissions"
import type { Plan } from "@/lib/utils"
import { startOfDay, endOfDay, format } from "date-fns"

export async function GET(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error) return error

  if (!can(session?.user?.role, "reports:read")) {
    return NextResponse.json({ error: "Sin permisos para ver reportes" }, { status: 403 })
  }

  // Plan: FREE gets reports_basic (today only), paid gets reports_full.
  const sub = await db.subscription.findUnique({
    where: { tenantId: tenantId! },
    select: { plan: true },
  })
  const plan = (sub?.plan as Plan) ?? "FREE"
  const hasFull = hasFeature(plan, "feature:reports_full")

  const { searchParams } = new URL(req.url)
  const requestedFrom = searchParams.get("from") ? new Date(searchParams.get("from")!) : startOfDay(new Date())
  const to = searchParams.get("to") ? new Date(searchParams.get("to")!) : endOfDay(new Date())

  // Clamp the lower bound to the plan's history window (FREE = 7d, STARTER = 90d, …)
  const { clampFromDate } = await import("@/lib/plan-guard")
  const from = clampFromDate(plan, requestedFrom)
  const wasClamped = from.getTime() !== requestedFrom.getTime()

  const tenantFilter = tenantId ? { tenantId } : {}
  const where = { ...tenantFilter, status: "COMPLETED", createdAt: { gte: from, lte: to } }

  let salesAgg, itemsRaw, paymentMethods, sales
  try {
    ;[salesAgg, itemsRaw, paymentMethods, sales] = await Promise.all([
      db.sale.aggregate({ where, _sum: { total: true, discountAmount: true, taxAmount: true }, _count: true, _avg: { total: true } }),
      db.saleItem.findMany({ where: { sale: { ...where } }, select: { productName: true, quantity: true, subtotal: true, costPrice: true } }),
      db.sale.groupBy({ by: ["paymentMethod"], where, _sum: { total: true }, _count: true }),
      db.sale.findMany({ where, select: { createdAt: true, total: true }, orderBy: { createdAt: "asc" } }),
    ])
  } catch (err) {
    console.error("[GET /api/reportes]", err)
    return NextResponse.json({ error: "Error al generar reporte" }, { status: 500 })
  }

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

  // FREE plan: only KPIs (no charts/breakdowns/topproducts) — encourages upgrade.
  return NextResponse.json({
    plan,
    isLimited: !hasFull,
    historyClampedTo: wasClamped ? from.toISOString() : null,
    totalSales: salesAgg._count,
    totalRevenue,
    totalCost: hasFull ? totalCost : 0,
    totalProfit: hasFull ? totalProfit : 0,
    profitMargin: hasFull && totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
    avgTicket: Number(salesAgg._avg.total ?? 0),
    topProducts: hasFull ? topProducts : [],
    salesByMethod: hasFull ? salesByMethod : [],
    dailySales: hasFull ? dailySales : [],
  })
}
