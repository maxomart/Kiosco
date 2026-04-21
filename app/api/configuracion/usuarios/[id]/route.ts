import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"

async function resolveUser(id: string, tenantId: string) {
  const user = await db.user.findUnique({ where: { id }, select: { tenantId: true, role: true, active: true } })
  if (!user || user.tenantId !== tenantId) return null
  return user
}

/** Toggle active/inactive */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (session.user.role !== "OWNER" && session.user.role !== "ADMIN")
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  const { id } = await params
  const user = await resolveUser(id, tenantId!)
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
  if (user.role === "OWNER") return NextResponse.json({ error: "No se puede modificar al dueño" }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const active = typeof body.active === "boolean" ? body.active : !user.active

  await db.user.update({ where: { id }, data: { active } })
  return NextResponse.json({ ok: true, active })
}

/** Hard delete */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (session.user.role !== "OWNER" && session.user.role !== "ADMIN")
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  const { id } = await params
  const user = await resolveUser(id, tenantId!)
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
  if (user.role === "OWNER") return NextResponse.json({ error: "No se puede eliminar al dueño" }, { status: 400 })

  await db.user.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
