import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { getTenantPlan } from "@/lib/plan-guard"
import { hasFeature } from "@/lib/permissions"

export async function GET() {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  try {
    const plan = await getTenantPlan(tenantId!)
    const multiCash = hasFeature(plan, "feature:multi_cash")

    // Always prefer the user's OWN open session (so the POS picks the right one).
    let cashSession = await db.cashSession.findFirst({
      where: { tenantId: tenantId!, status: "OPEN", userId: session.user.id! },
      include: { user: { select: { name: true } }, _count: { select: { sales: true } } },
      orderBy: { createdAt: "desc" },
    })

    // For single-cash plans, fall back to ANY open session (legacy behaviour).
    if (!cashSession && !multiCash) {
      cashSession = await db.cashSession.findFirst({
        where: { tenantId: tenantId!, status: "OPEN" },
        include: { user: { select: { name: true } }, _count: { select: { sales: true } } },
      })
    }

    // For multi-cash plans, also expose the list of all currently open sessions.
    const openSessions = multiCash
      ? await db.cashSession.findMany({
          where: { tenantId: tenantId!, status: "OPEN" },
          include: { user: { select: { name: true } }, _count: { select: { sales: true } } },
          orderBy: { createdAt: "desc" },
        })
      : []

    if (!cashSession) {
      return NextResponse.json({ session: null, multiCash, openSessions })
    }

    // Calcular ganancia bruta, margen y neta
    const sales = await db.sale.findMany({
      where: { cashSessionId: cashSession.id, tenantId: tenantId!, status: "COMPLETED" },
      select: {
        total: true,
        items: { select: { costPrice: true, quantity: true } },
      },
    })

    const totalRevenue = sales.reduce((acc, s) => acc + Number(s.total), 0)
    const totalCost = sales.reduce(
      (acc, s) =>
        acc +
        s.items.reduce((a, i) => a + Number(i.costPrice) * i.quantity, 0),
      0
    )
    const grossProfit = totalRevenue - totalCost
    const marginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0

    // Gastos desde la apertura de caja
    const expensesAgg = await db.expense.aggregate({
      where: {
        tenantId: tenantId!,
        createdAt: { gte: cashSession.createdAt },
      },
      _sum: { amount: true },
    })
    const expensesTotal = Number(expensesAgg._sum.amount ?? 0)
    const netProfit = grossProfit - expensesTotal

    return NextResponse.json({
      session: cashSession,
      salesTotal: totalRevenue,
      totalRevenue,
      totalCost,
      grossProfit,
      marginPct: Math.round(marginPct * 10) / 10,
      expensesTotal,
      netProfit,
      multiCash,
      openSessions,
      ownedByCurrentUser: cashSession.userId === session.user.id,
    })
  } catch (err) {
    console.error("[GET /api/caja/sesion-actual]", err)
    return NextResponse.json({ error: "Error al obtener sesión" }, { status: 500 })
  }
}
