import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { z } from "zod"

async function ensureOwnership(id: string, tenantId: string | null, isSuperAdmin: boolean) {
  const existing = await db.supplier.findUnique({ where: { id }, select: { tenantId: true } })
  if (!existing) return "not_found" as const
  if (!isSuperAdmin && existing.tenantId !== tenantId) return "forbidden" as const
  return "ok" as const
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  cuit: z.string().optional().nullable(),
  contact: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

// PUT /api/proveedores/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, tenantId, isSuperAdmin } = await getSessionTenant()
  if (error) return error

  const check = await ensureOwnership(params.id, tenantId, isSuperAdmin)
  if (check === "not_found") return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  if (check === "forbidden") return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  try {
    const supplier = await db.supplier.update({
      where: { id: params.id },
      data: {
        ...parsed.data,
        email: parsed.data.email || null,
        cuit: parsed.data.cuit || null,
        phone: parsed.data.phone || null,
        address: parsed.data.address || null,
        notes: parsed.data.notes || null,
      },
      include: { _count: { select: { products: true } } },
    })
    return NextResponse.json(supplier)
  } catch (err: any) {
    if (err?.code === "P2002") return NextResponse.json({ error: "El CUIT ya está en uso" }, { status: 400 })
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 })
  }
}

// DELETE /api/proveedores/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, tenantId, isSuperAdmin } = await getSessionTenant()
  if (error) return error

  const check = await ensureOwnership(params.id, tenantId, isSuperAdmin)
  if (check === "not_found") return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  if (check === "forbidden") return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  try {
    await db.supplier.update({ where: { id: params.id }, data: { active: false } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 })
  }
}
