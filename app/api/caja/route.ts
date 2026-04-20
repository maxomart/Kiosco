import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"

export async function GET() {
  const { error, tenantId } = await getSessionTenant()
  if (error) return error
  const sessions = await db.cashSession.findMany({ where: { ...(tenantId ? { tenantId } : {}) }, orderBy: { createdAt: "desc" }, take: 20, include: { user: { select: { name: true } } } })
  return NextResponse.json({ sessions })
}

export async function POST(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const body = await req.json()
  if (body.openingBalance == null || isNaN(body.openingBalance)) return NextResponse.json({ error: "Monto inicial requerido" }, { status: 400 })

  const open = await db.cashSession.findFirst({ where: { tenantId: tenantId!, status: "OPEN" } })
  if (open) return NextResponse.json({ error: "Ya hay una caja abierta", session: open }, { status: 409 })

  const cashSession = await db.cashSession.create({ data: { openingBalance: body.openingBalance, tenantId: tenantId!, userId: session.user.id! } })
  return NextResponse.json({ session: cashSession }, { status: 201 })
}
