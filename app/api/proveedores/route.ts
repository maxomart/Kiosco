import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { can } from "@/lib/permissions"
import { z } from "zod"

const schema = z.object({
  name: z.string().min(1),
  cuit: z.string().optional().nullable(),
  contact: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export async function GET() {
  const { error, tenantId } = await getSessionTenant()
  if (error) return error
  try {
    const suppliers = await db.supplier.findMany({ where: { active: true, ...(tenantId ? { tenantId } : {}) }, orderBy: { name: "asc" }, include: { _count: { select: { products: true } } } })
    return NextResponse.json({ suppliers })
  } catch (err) {
    console.error("[GET /api/proveedores]", err)
    return NextResponse.json({ error: "Error al obtener proveedores" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!can(session.user.role, "suppliers:manage"))
    return NextResponse.json({ error: "Sin permisos para gestionar proveedores" }, { status: 403 })
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  try {
    const supplier = await db.supplier.create({ data: { ...parsed.data, email: parsed.data.email || null, tenantId: tenantId! }, include: { _count: { select: { products: true } } } })
    return NextResponse.json({ supplier }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Error al crear" }, { status: 500 })
  }
}
