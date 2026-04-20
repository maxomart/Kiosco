import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { z } from "zod"

const schema = z.object({ name: z.string().min(1).optional(), cuit: z.string().optional().nullable(), contact: z.string().optional().nullable(), phone: z.string().optional().nullable(), email: z.string().email().optional().nullable().or(z.literal("")), address: z.string().optional().nullable(), notes: z.string().optional().nullable() })

async function own(id: string, tenantId: string | null, sup: boolean) {
  const s = await db.supplier.findUnique({ where: { id }, select: { tenantId: true } })
  if (!s) return "not_found"; if (!sup && s.tenantId !== tenantId) return "forbidden"; return "ok"
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, tenantId, isSuperAdmin } = await getSessionTenant()
  if (error) return error
  const check = await own(params.id, tenantId, isSuperAdmin)
  if (check === "not_found") return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  if (check === "forbidden") return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  const supplier = await db.supplier.update({ where: { id: params.id }, data: { ...parsed.data, email: parsed.data.email || null }, include: { _count: { select: { products: true } } } })
  return NextResponse.json({ supplier })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, tenantId, isSuperAdmin } = await getSessionTenant()
  if (error) return error
  const check = await own(params.id, tenantId, isSuperAdmin)
  if (check === "not_found") return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  if (check === "forbidden") return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  await db.supplier.update({ where: { id: params.id }, data: { active: false } })
  return NextResponse.json({ ok: true })
}
