import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { startOfDay, endOfDay, startOfMonth, endOfMonth, subDays, format } from "date-fns"
import { es } from "date-fns/locale"

export async function GET() {
  const { error, tenantId, isSuperAdmin } = await getSessionTenant()
  if (error) return error

  const now = new Date()
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  // Base filter for tenant isolation
  const tenantFilter = !isSuperAdmin && tenantId ? { tenantId } : {}

  try {
    const [salesTodayAgg, salesMonthAgg, topProductsRaw] = await Promise.all([
      db.sale.aggregate({
        where: { ...tenantFilter, createdAt: { gte: todayStart, lte: todayEnd }, status: "COMPLETED" },
        _sum: { total: true },
        _count: true,
      }),
      db.sale.aggregate({
        where: { ...tenantFilter, createdAt: { gte: monthStart, lte: monthEnd }, status: "COMPLETED" },
        _sum: { total: true },
        _count: true,
      }),
      db.saleItem.groupBy({
        by: ["productId", "productName"],
        where: {
          sale: { ...tenantFilter, createdAt: { gte: todayStart, lte: todayEnd }, status: "COMPLETED" },
        },
        _sum: { quantity: true, subtotal: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
      }),
    ])

    // Last 7 days sales
    const last7Days = await Promise.all(
      Array.from({ length: 7 }, (_, i) => {
        const day = subDays(now, 6 - i)
        return db.sale.aggregate({
          where: {
            ...tenantFilter,
            createdAt: { gte: startOfDay(day), lte: endOfDay(day) },
            status: "COMPLETED",
          },
          _sum: { total: true },
          _count: true,
        }).then((agg) => ({
          date: format(day, "yyyy-MM-dd"),
          label: format(day, "EEE d", { locale: es }),
          total: agg._sum.total ?? 0,
          count: agg._count,
        }))
      })
    )

    const topProducts = topProductsRaw.map((p) => ({
      productId: p.productId,
      productName: p.productName,
      totalQty: p._sum.quantity ?? 0,
      totalRevenue: p._sum.subtotal ?? 0,
    }))

    return NextResponse.json({
      salesToday: { total: salesTodayAgg._sum.total ?? 0, count: salesTodayAgg._count },
      salesMonth: { total: salesMonthAgg._sum.total ?? 0, count: salesMonthAgg._count },
      topProducts,
      last7Days,
    })
  } catch (err) {
    console.error("Error en reportes:", err)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
