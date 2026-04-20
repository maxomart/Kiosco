import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, tenantId, isSuperAdmin } = await getSessionTenant()
  if (error) return error
  const sale = await db.sale.findUnique({
    where: { id: params.id },
    include: { items: true, user: { select: { name: true } }, client: { select: { name: true } } },
  })
  if (!sale) return NextResponse.json({ error: "No encontrada" }, { status: 404 })
  if (!isSuperAdmin && sale.tenantId !== tenantId) return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  return NextResponse.json({ sale })
}
