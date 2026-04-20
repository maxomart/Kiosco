import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"

async function own(id: string, tenantId: string | null, sup: boolean) {
  const c = await db.client.findUnique({ where: { id }, select: { tenantId: true } })
  if (!c) return "not_found"; if (!sup && c.tenantId !== tenantId) return "forbidden"; return "ok"
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, tenantId, isSuperAdmin } = await getSessionTenant()
  if (error) return error
  const check = await own(params.id, tenantId, isSuperAdmin)
  if (check !== "ok") return NextResponse.json({ error: check === "not_found" ? "No encontrado" : "No autorizado" }, { status: check === "not_found" ? 404 : 403 })
  const body = await req.json()
  try {
    const client = await db.client.update({ where: { id: params.id }, data: { ...body, email: body.email || null } })
    return NextResponse.json({ client })
  } catch (err: any) {
    if (err?.code === "P2002") return NextResponse.json({ error: "DNI ya en uso" }, { status: 400 })
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, tenantId, isSuperAdmin } = await getSessionTenant()
  if (error) return error
  const check = await own(params.id, tenantId, isSuperAdmin)
  if (check !== "ok") return NextResponse.json({ error: check === "not_found" ? "No encontrado" : "No autorizado" }, { status: check === "not_found" ? 404 : 403 })
  await db.client.update({ where: { id: params.id }, data: { active: false } })
  return NextResponse.json({ ok: true })
}
