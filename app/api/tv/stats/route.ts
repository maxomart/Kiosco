import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { requireFeature } from "@/lib/plan-guard"

export const dynamic = "force-dynamic"

/** Stats live para el modo TV — refresca cada 30s desde el cliente. */
export async function GET() {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const planErr = await requireFeature(tenantId!, "feature:tv_mode")
  if (planErr) return planErr

  const now = new Date()
  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [todaySales, monthAgg, todayItems, lastSales, config] = await Promise.all([
    db.sale.findMany({
      where: { tenantId: tenantId!, status: "COMPLETED", createdAt: { gte: startOfDay } },
      select: { total: true, createdAt: true },
    }),
    db.sale.aggregate({
      where: { tenantId: tenantId!, status: "COMPLETED", createdAt: { gte: startOfMonth } },
      _sum: { total: true },
      _count: true,
    }),
    db.saleItem.findMany({
      where: { sale: { tenantId: tenantId!, status: "COMPLETED", createdAt: { gte: startOfDay } } },
      select: { productName: true, quantity: true, subtotal: true },
    }),
    db.sale.findMany({
      where: { tenantId: tenantId!, status: "COMPLETED", createdAt: { gte: startOfDay } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        total: true,
        createdAt: true,
        paymentMethod: true,
        items: { select: { productName: true, quantity: true } },
      },
    }),
    db.tenantConfig.findUnique({
      where: { tenantId: tenantId! },
      select: { businessName: true, logoUrl: true },
    }),
  ])

  const todayTotal = todaySales.reduce((s, x) => s + Number(x.total), 0)
  const todayCount = todaySales.length

  // Top productos del día
  const topMap = new Map<string, { name: string; qty: number; revenue: number }>()
  for (const it of todayItems) {
    const key = it.productName
    const r = topMap.get(key) ?? { name: it.productName, qty: 0, revenue: 0 }
    r.qty += it.quantity
    r.revenue += Number(it.subtotal)
    topMap.set(key, r)
  }
  const topProducts = Array.from(topMap.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5)

  // Ventas por hora (sólo desde apertura del día)
  const byHour = new Array(24).fill(0)
  for (const s of todaySales) {
    const h = new Date(s.createdAt).getHours()
    byHour[h] += Number(s.total)
  }

  return NextResponse.json({
    businessName: config?.businessName ?? "Orvex",
    logoUrl: config?.logoUrl ?? null,
    today: {
      total: todayTotal,
      count: todayCount,
      avgTicket: todayCount > 0 ? Math.round(todayTotal / todayCount) : 0,
      byHour,
    },
    month: {
      total: Number(monthAgg._sum.total ?? 0),
      count: monthAgg._count,
    },
    topProducts,
    recentSales: lastSales.map((s) => ({
      total: Number(s.total),
      createdAt: s.createdAt,
      paymentMethod: s.paymentMethod,
      itemsCount: s.items.reduce((n, i) => n + i.quantity, 0),
      firstItem: s.items[0]?.productName ?? "",
    })),
    serverTime: now.toISOString(),
  })
}
