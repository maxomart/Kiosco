import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"

export const dynamic = "force-dynamic"

/**
 * Reporte de comisiones por empleado en un período.
 * Solo OWNER y ADMIN pueden ver el reporte completo. Un CASHIER ve solo el suyo.
 *
 * Query params:
 *   - from = YYYY-MM-DD (default: primer día del mes actual)
 *   - to   = YYYY-MM-DD (default: hoy, inclusive hasta 23:59:59)
 */
export async function GET(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const url = new URL(req.url)
  const fromStr = url.searchParams.get("from")
  const toStr = url.searchParams.get("to")
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const from = fromStr ? new Date(`${fromStr}T00:00:00`) : startOfMonth
  const to = toStr ? new Date(`${toStr}T23:59:59.999`) : now

  // Si es CASHIER, sólo su id
  const userFilter = session.user.role === "CASHIER" ? { userId: session.user.id! } : {}

  const users = await db.user.findMany({
    where: { tenantId: tenantId!, active: true, ...(session.user.role === "CASHIER" ? { id: session.user.id! } : {}) },
    select: { id: true, name: true, email: true, role: true, commissionPercent: true },
    orderBy: { name: "asc" },
  })

  const sales = await db.sale.findMany({
    where: {
      tenantId: tenantId!,
      status: "COMPLETED",
      createdAt: { gte: from, lte: to },
      ...userFilter,
    },
    select: { userId: true, total: true, createdAt: true },
  })

  const byUser = new Map<string, { totalSales: number; salesCount: number }>()
  for (const s of sales) {
    const r = byUser.get(s.userId) ?? { totalSales: 0, salesCount: 0 }
    r.totalSales += Number(s.total)
    r.salesCount += 1
    byUser.set(s.userId, r)
  }

  const rows = users.map((u) => {
    const stats = byUser.get(u.id) ?? { totalSales: 0, salesCount: 0 }
    const pct = Number(u.commissionPercent)
    const commission = Math.round((stats.totalSales * pct) / 100)
    return {
      userId: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      commissionPercent: pct,
      totalSales: stats.totalSales,
      salesCount: stats.salesCount,
      commission,
    }
  })
  rows.sort((a, b) => b.commission - a.commission)

  const totalCommissions = rows.reduce((s, r) => s + r.commission, 0)
  const totalSales = rows.reduce((s, r) => s + r.totalSales, 0)

  return NextResponse.json({
    from: from.toISOString(),
    to: to.toISOString(),
    rows,
    totals: { commissions: totalCommissions, sales: totalSales, salesCount: sales.length },
  })
}
