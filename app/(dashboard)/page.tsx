import { Metadata } from "next"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from "date-fns"
import DashboardClient from "@/components/dashboard/DashboardClient"

export const metadata: Metadata = {
  title: "Dashboard | KioscoApp",
}

async function getDashboardData() {
  const now = new Date()
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  const [
    salesToday,
    salesMonth,
    totalProducts,
    allActiveProducts,
    recentSales,
    topProducts,
    salesTodayRaw,
  ] = await Promise.all([
    db.sale.aggregate({
      where: { createdAt: { gte: todayStart, lte: todayEnd }, status: "COMPLETED" },
      _sum: { total: true },
      _count: true,
    }),
    db.sale.aggregate({
      where: { createdAt: { gte: monthStart, lte: monthEnd }, status: "COMPLETED" },
      _sum: { total: true },
      _count: true,
    }),
    db.product.count({ where: { active: true } }),
    // Traemos todos los productos activos para filtrar lowStock en JS
    // (evita la comparación columna-a-columna que no funciona en Prisma)
    db.product.findMany({
      where: { active: true },
      select: {
        id: true, name: true, stock: true, minStock: true,
        idealStock: true, unit: true,
      },
      orderBy: { stock: "asc" },
    }),
    db.sale.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      where: { status: "COMPLETED" },
      include: { user: { select: { name: true } }, items: true },
    }),
    db.saleItem.groupBy({
      by: ["productId", "productName"],
      where: {
        sale: { createdAt: { gte: todayStart, lte: todayEnd }, status: "COMPLETED" }
      },
      _sum: { quantity: true, subtotal: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
    // Todas las ventas de hoy para agrupar por hora en JS (compatible SQLite + PostgreSQL)
    db.sale.findMany({
      where: { createdAt: { gte: todayStart, lte: todayEnd }, status: "COMPLETED" },
      select: { createdAt: true, total: true },
    }),
  ])

  // Filtrar low stock en JS — compatible con cualquier DB
  const lowStockProducts = allActiveProducts.filter(p => p.stock <= p.minStock)

  // Agrupar ventas por hora en JS — compatible SQLite y PostgreSQL
  const salesByHour = Array.from({ length: 14 }, (_, i) => {
    const h = i + 7 // 7am a 9pm
    const hourSales = salesTodayRaw.filter(
      s => new Date(s.createdAt).getHours() === h
    )
    return {
      hour: h,
      total: hourSales.reduce((acc, s) => acc + s.total, 0),
      count: hourSales.length,
    }
  })

  return {
    salesToday: {
      total: salesToday._sum.total || 0,
      count: salesToday._count,
    },
    salesMonth: {
      total: salesMonth._sum.total || 0,
      count: salesMonth._count,
    },
    totalProducts,
    lowStockProducts: JSON.parse(JSON.stringify(lowStockProducts.slice(0, 5))),
    recentSales: JSON.parse(JSON.stringify(recentSales)),
    topProducts,
    salesByHour,
  }
}

export default async function DashboardPage() {
  const session = await auth()
  let data

  try {
    data = await getDashboardData()
  } catch {
    data = {
      salesToday: { total: 0, count: 0 },
      salesMonth: { total: 0, count: 0 },
      totalProducts: 0,
      lowStockProducts: [],
      recentSales: [],
      topProducts: [],
      salesByHour: [],
    }
  }

  return <DashboardClient data={data} userName={session?.user?.name ?? "Usuario"} />
}
