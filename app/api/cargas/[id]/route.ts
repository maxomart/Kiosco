import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, tenantId, isSuperAdmin } = await getSessionTenant()
  if (error) return error

  const existing = await db.recharge.findUnique({
    where: { id: params.id },
    select: { tenantId: true },
  })
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  if (!isSuperAdmin && existing.tenantId !== tenantId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  try {
    await db.recharge.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[DELETE /api/cargas/[id]]", err)
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 })
  }
}
