import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"

const closeSchema = z.object({
  closingBalance: z.number().min(0),
  notes: z.string().optional().nullable(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, tenantId, isSuperAdmin } = await getSessionTenant()
  if (error) return error
  const { id } = await params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }
  const parsed = closeSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Monto de cierre requerido" }, { status: 400 })

  try {
    const cashSession = await db.cashSession.findUnique({ where: { id } })
    if (!cashSession) return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 })
    if (!isSuperAdmin && cashSession.tenantId !== tenantId) return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    if (cashSession.status !== "OPEN") return NextResponse.json({ error: "La caja ya está cerrada" }, { status: 400 })

    const salesTotal = await db.sale.aggregate({ where: { cashSessionId: id, status: "COMPLETED", paymentMethod: "CASH" }, _sum: { total: true } })
    const expectedCash = Number(cashSession.openingBalance) + Number(salesTotal._sum.total ?? 0)
    const difference = parsed.data.closingBalance - expectedCash

    const closed = await db.cashSession.update({
      where: { id },
      data: { status: "CLOSED", closingBalance: parsed.data.closingBalance, difference, closedAt: new Date(), notes: parsed.data.notes ?? null },
    })
    return NextResponse.json({ session: closed, expectedCash, difference })
  } catch (err) {
    console.error("[POST /api/caja/[id]/cerrar]", err)
    return NextResponse.json({ error: "Error al cerrar caja" }, { status: 500 })
  }
}
