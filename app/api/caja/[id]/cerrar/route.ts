import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, tenantId, isSuperAdmin } = await getSessionTenant()
  if (error) return error
  const body = await req.json()
  if (body.closingBalance == null) return NextResponse.json({ error: "Monto de cierre requerido" }, { status: 400 })

  const cashSession = await db.cashSession.findUnique({ where: { id: params.id } })
  if (!cashSession) return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 })
  if (!isSuperAdmin && cashSession.tenantId !== tenantId) return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  if (cashSession.status !== "OPEN") return NextResponse.json({ error: "La caja ya está cerrada" }, { status: 400 })

  const salesTotal = await db.sale.aggregate({ where: { cashSessionId: params.id, status: "COMPLETED", paymentMethod: "CASH" }, _sum: { total: true } })
  const expectedCash = Number(cashSession.openingBalance) + Number(salesTotal._sum.total ?? 0)
  const difference = Number(body.closingBalance) - expectedCash

  const closed = await db.cashSession.update({
    where: { id: params.id },
    data: { status: "CLOSED", closingBalance: body.closingBalance, difference, closedAt: new Date(), notes: body.notes },
  })
  return NextResponse.json({ session: closed, expectedCash, difference })
}
