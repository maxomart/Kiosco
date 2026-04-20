import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (session.user.role !== "OWNER" && session.user.role !== "ADMIN")
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  const { id } = await params
  const user = await db.user.findUnique({ where: { id }, select: { tenantId: true, role: true } })
  if (!user || user.tenantId !== tenantId)
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
  if (user.role === "OWNER")
    return NextResponse.json({ error: "No se puede desactivar al dueño" }, { status: 400 })

  await db.user.update({ where: { id }, data: { active: false } })
  return NextResponse.json({ ok: true })
}
