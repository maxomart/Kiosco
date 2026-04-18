import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"

// GET /api/caja — get current open session
export async function GET() {
  const { error, tenantId, isSuperAdmin } = await getSessionTenant()
  if (error) return error

  const tenantFilter = !isSuperAdmin && tenantId ? { tenantId } : {}

  try {
    const cashSession = await db.cashSession.findFirst({
      where: { ...tenantFilter, status: "OPEN" },
      orderBy: { openedAt: "desc" },
      include: {
        user: { select: { name: true } },
        _count: { select: { sales: true } },
      },
    })

    if (!cashSession) {
      return NextResponse.json({ session: null })
    }

    // Compute sales total for this session
    const salesTotalAgg = await db.sale.aggregate({
      where: { cashSessionId: cashSession.id, status: "COMPLETED" },
      _sum: { total: true },
    })

    return NextResponse.json({
      session: {
        ...cashSession,
        salesTotalSum: salesTotalAgg._sum.total ?? 0,
      },
    })
  } catch (err) {
    console.error("Error en caja GET:", err)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

// POST /api/caja — open or close session
export async function POST(req: NextRequest) {
  const { error, tenantId, session, isSuperAdmin } = await getSessionTenant()
  if (error) return error

  const body = await req.json()
  const { action, openingBalance, sessionId, closingBalance } = body

  const tenantFilter = !isSuperAdmin && tenantId ? { tenantId } : {}

  try {
    if (action === "open") {
      // Check if there is already an open session for this tenant
      const existing = await db.cashSession.findFirst({
        where: { ...tenantFilter, status: "OPEN" },
      })
      if (existing) {
        return NextResponse.json({ error: "Ya hay una sesión de caja abierta" }, { status: 409 })
      }

      const newSession = await db.cashSession.create({
        data: {
          userId: session!.user.id!,
          status: "OPEN",
          openingBalance: parseFloat(openingBalance) || 0,
          tenantId: tenantId ?? null,
        },
      })

      return NextResponse.json({ session: newSession }, { status: 201 })
    }

    if (action === "close") {
      if (!sessionId) {
        return NextResponse.json({ error: "sessionId requerido" }, { status: 400 })
      }

      // Compute expected cash
      const salesTotalAgg = await db.sale.aggregate({
        where: { cashSessionId: sessionId, status: "COMPLETED" },
        _sum: { total: true },
      })
      const expensesAgg = await db.expense.aggregate({
        where: { cashSessionId: sessionId },
        _sum: { amount: true },
      })

      // Verificar que la sesión pertenezca al tenant
      const openSession = await db.cashSession.findFirst({
        where: { id: sessionId, ...tenantFilter },
      })
      if (!openSession) {
        return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 })
      }

      const salesTotal = salesTotalAgg._sum.total ?? 0
      const expensesTotal = expensesAgg._sum.amount ?? 0
      const expectedCash = openSession.openingBalance + salesTotal - expensesTotal
      const actualClosing = parseFloat(closingBalance) || 0
      const difference = actualClosing - expectedCash

      const closed = await db.cashSession.update({
        where: { id: sessionId },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
          closingBalance: actualClosing,
          expectedCash,
          difference,
        },
      })

      return NextResponse.json({ session: closed })
    }

    return NextResponse.json({ error: "Acción inválida" }, { status: 400 })
  } catch (err) {
    console.error("Error en caja POST:", err)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
