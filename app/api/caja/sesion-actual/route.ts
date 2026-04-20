import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"

export async function GET() {
  const { error, tenantId } = await getSessionTenant()
  if (error) return error
  try {
    const session = await db.cashSession.findFirst({
      where: { tenantId: tenantId!, status: "OPEN" },
      include: { user: { select: { name: true } }, _count: { select: { sales: true } } },
    })
    if (!session) return NextResponse.json({ session: null })
    const salesTotal = await db.sale.aggregate({ where: { cashSessionId: session.id, tenantId: tenantId!, status: "COMPLETED" }, _sum: { total: true } })
    return NextResponse.json({ session, salesTotal: salesTotal._sum.total ?? 0 })
  } catch (err) {
    console.error("[GET /api/caja/sesion-actual]", err)
    return NextResponse.json({ error: "Error al obtener sesión" }, { status: 500 })
  }
}
