/**
 * Builds a compact, factual snapshot of the tenant's current business
 * state for the AI assistant. Kept short to fit within prompt budgets
 * and avoid leaking unnecessary data.
 */

import { db } from "@/lib/db"
import type { Plan } from "@/lib/utils"

export interface BusinessContext {
  tenantName: string
  plan: Plan
  today: {
    sales: number
    revenue: number
    avgTicket: number
  }
  yesterday: {
    sales: number
    revenue: number
  }
  last7Days: {
    sales: number
    revenue: number
  }
  inventory: {
    totalProducts: number
    outOfStock: { name: string; minStock: number }[]
    lowStock: { name: string; stock: number; minStock: number }[]
  }
  topSellers7d: { name: string; quantitySold: number; revenue: number }[]
  cashSession: {
    isOpen: boolean
    openingBalance: number | null
    sinceHours: number | null
  }
  generatedAt: string
}

export async function buildBusinessContext(
  tenantId: string,
  plan: Plan
): Promise<BusinessContext> {
  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999)
  const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1)
  const yesterdayEnd = new Date(todayEnd); yesterdayEnd.setDate(yesterdayEnd.getDate() - 1)
  const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7); sevenDaysAgo.setHours(0, 0, 0, 0)

  const [tenant, todayAgg, yesterdayAgg, weekAgg, products, weekItems, openSession] =
    await Promise.all([
      db.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      }),
      db.sale.aggregate({
        where: { tenantId, status: "COMPLETED", createdAt: { gte: todayStart, lte: todayEnd } },
        _sum: { total: true },
        _count: true,
        _avg: { total: true },
      }),
      db.sale.aggregate({
        where: { tenantId, status: "COMPLETED", createdAt: { gte: yesterdayStart, lte: yesterdayEnd } },
        _sum: { total: true },
        _count: true,
      }),
      db.sale.aggregate({
        where: { tenantId, status: "COMPLETED", createdAt: { gte: sevenDaysAgo } },
        _sum: { total: true },
        _count: true,
      }),
      db.product.findMany({
        where: { tenantId, active: true },
        select: { id: true, name: true, stock: true, minStock: true },
        orderBy: { stock: "asc" },
      }),
      db.saleItem.findMany({
        where: { sale: { tenantId, status: "COMPLETED", createdAt: { gte: sevenDaysAgo } } },
        select: { productName: true, quantity: true, subtotal: true },
      }),
      db.cashSession.findFirst({
        where: { tenantId, status: "OPEN" },
        select: { openingBalance: true, createdAt: true },
      }),
    ])

  type ProductRow = { name: string; stock: number; minStock: number }
  const outOfStock = products
    .filter((p: ProductRow) => p.stock <= 0)
    .slice(0, 15)
    .map((p: ProductRow) => ({ name: p.name, minStock: p.minStock }))
  const lowStock = products
    .filter((p: ProductRow) => p.stock > 0 && p.stock <= p.minStock)
    .slice(0, 15)
    .map((p: ProductRow) => ({ name: p.name, stock: p.stock, minStock: p.minStock }))

  // Aggregate top sellers from items
  const sellerMap = new Map<string, { quantitySold: number; revenue: number }>()
  for (const item of weekItems) {
    const cur = sellerMap.get(item.productName) ?? { quantitySold: 0, revenue: 0 }
    cur.quantitySold += item.quantity
    cur.revenue += Number(item.subtotal ?? 0)
    sellerMap.set(item.productName, cur)
  }
  const topSellers7d = Array.from(sellerMap.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  return {
    tenantName: tenant?.name ?? "tu negocio",
    plan,
    today: {
      sales: todayAgg._count ?? 0,
      revenue: Number(todayAgg._sum.total ?? 0),
      avgTicket: Number(todayAgg._avg.total ?? 0),
    },
    yesterday: {
      sales: yesterdayAgg._count ?? 0,
      revenue: Number(yesterdayAgg._sum.total ?? 0),
    },
    last7Days: {
      sales: weekAgg._count ?? 0,
      revenue: Number(weekAgg._sum.total ?? 0),
    },
    inventory: {
      totalProducts: products.length,
      outOfStock,
      lowStock,
    },
    topSellers7d,
    cashSession: {
      isOpen: !!openSession,
      openingBalance: openSession ? Number(openSession.openingBalance) : null,
      sinceHours: openSession
        ? Math.floor((now.getTime() - openSession.createdAt.getTime()) / 1000 / 60 / 60)
        : null,
    },
    generatedAt: now.toISOString(),
  }
}

/** Render the context as a compact bulleted summary for the system prompt. */
export function renderContextForPrompt(ctx: BusinessContext): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(n)

  const out: string[] = []
  out.push(`# Negocio: ${ctx.tenantName} (Plan: ${ctx.plan})`)
  out.push("")
  out.push("## Ventas")
  out.push(`- Hoy: ${ctx.today.sales} ventas · ${fmt(ctx.today.revenue)} (ticket promedio ${fmt(ctx.today.avgTicket)})`)
  out.push(`- Ayer: ${ctx.yesterday.sales} ventas · ${fmt(ctx.yesterday.revenue)}`)
  out.push(`- Últimos 7 días: ${ctx.last7Days.sales} ventas · ${fmt(ctx.last7Days.revenue)}`)
  out.push("")
  out.push(`## Inventario (${ctx.inventory.totalProducts} productos activos)`)
  if (ctx.inventory.outOfStock.length > 0) {
    out.push(`- ❌ Sin stock (${ctx.inventory.outOfStock.length}): ${ctx.inventory.outOfStock.map((p) => p.name).join(", ")}`)
  } else {
    out.push(`- Sin productos agotados.`)
  }
  if (ctx.inventory.lowStock.length > 0) {
    out.push(`- ⚠️ Stock bajo (${ctx.inventory.lowStock.length}): ${ctx.inventory.lowStock.map((p) => `${p.name} (${p.stock} restantes, mín ${p.minStock})`).join(", ")}`)
  } else {
    out.push(`- Stock saludable.`)
  }
  out.push("")
  if (ctx.topSellers7d.length > 0) {
    out.push(`## Más vendidos (7 días)`)
    for (const t of ctx.topSellers7d) {
      out.push(`- ${t.name}: ${t.quantitySold} unidades, ${fmt(t.revenue)}`)
    }
    out.push("")
  }
  if (ctx.cashSession.isOpen) {
    out.push(`## Caja`)
    out.push(`- Caja ABIERTA hace ${ctx.cashSession.sinceHours}h con apertura de ${fmt(ctx.cashSession.openingBalance ?? 0)}`)
  }
  out.push("")
  out.push(`Datos generados: ${new Date(ctx.generatedAt).toLocaleString("es-AR")}`)
  return out.join("\n")
}
