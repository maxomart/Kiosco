import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"

// DELETE /api/gastos/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, tenantId, isSuperAdmin } = await getSessionTenant()
  if (error) return error

  const existing = await db.expense.findUnique({
    where: { id: params.id },
    select: { tenantId: true },
  })
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  if (!isSuperAdmin && existing.tenantId !== tenantId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  try {
    await db.expense.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Error al eliminar gasto" }, { status: 500 })
  }
}
