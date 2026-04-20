import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"

export async function GET() {
  const { error, tenantId } = await getSessionTenant()
  if (error) return error
  const session = await db.cashSession.findFirst({
    where: { tenantId: tenantId!, status: "OPEN" },
    include: { user: { select: { name: true } }, _count: { select: { sales: true } } },
  })
  if (!session) return NextResponse.json({ session: null })
  const salesTotal = await db.sale.aggregate({ where: { cashSessionId: session.id, status: "COMPLETED" }, _sum: { total: true } })
  return NextResponse.json({ session, salesTotal: salesTotal._sum.total ?? 0 })
}
