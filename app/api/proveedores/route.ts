import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { z } from "zod"

const supplierSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  cuit: z.string().optional().nullable(),
  contact: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email("Email inválido").optional().nullable().or(z.literal("")),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

// GET /api/proveedores
export async function GET() {
  const { error, tenantId } = await getSessionTenant()
  if (error) return error
  try {
    const suppliers = await db.supplier.findMany({
      where: { active: true, ...(tenantId ? { tenantId } : {}) },
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
    })
    return NextResponse.json(suppliers)
  } catch {
    return NextResponse.json({ error: "Error al obtener proveedores" }, { status: 500 })
  }
}

// POST /api/proveedores
export async function POST(req: NextRequest) {
  const { error, tenantId } = await getSessionTenant()
  if (error) return error

  const body = await req.json()
  const parsed = supplierSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  const data = parsed.data
  try {
    const supplier = await db.supplier.create({
      data: {
        name: data.name,
        cuit: data.cuit || null,
        contact: data.contact || null,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        notes: data.notes || null,
        tenantId: tenantId ?? null,
      },
      include: { _count: { select: { products: true } } },
    })
    return NextResponse.json(supplier, { status: 201 })
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "El CUIT ya está registrado" }, { status: 400 })
    }
    return NextResponse.json({ error: "Error al crear proveedor" }, { status: 500 })
  }
}
