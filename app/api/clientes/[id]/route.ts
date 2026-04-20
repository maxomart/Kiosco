import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  dni: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  active: z.boolean().optional(),
  creditLimit: z.number().nonnegative().optional(),
})

async function own(id: string, tenantId: string | null, sup: boolean) {
  const c = await db.client.findUnique({ where: { id }, select: { tenantId: true } })
  if (!c) return "not_found"; if (!sup && c.tenantId !== tenantId) return "forbidden"; return "ok"
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, tenantId, isSuperAdmin } = await getSessionTenant()
  if (error) return error
  const { id } = await params
  const check = await own(id, tenantId, isSuperAdmin)
  if (check !== "ok") return NextResponse.json({ error: check === "not_found" ? "No encontrado" : "No autorizado" }, { status: check === "not_found" ? 404 : 403 })
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  try {
    const client = await db.client.update({ where: { id }, data: { ...parsed.data, email: parsed.data.email || null } })
    return NextResponse.json({ client })
  } catch (err: any) {
    if (err?.code === "P2002") return NextResponse.json({ error: "DNI ya en uso" }, { status: 400 })
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, tenantId, isSuperAdmin } = await getSessionTenant()
  if (error) return error
  const { id } = await params
  const check = await own(id, tenantId, isSuperAdmin)
  if (check !== "ok") return NextResponse.json({ error: check === "not_found" ? "No encontrado" : "No autorizado" }, { status: check === "not_found" ? 404 : 403 })
  try {
    await db.client.update({ where: { id }, data: { active: false } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[DELETE /api/clientes/[id]]", err)
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 })
  }
}
