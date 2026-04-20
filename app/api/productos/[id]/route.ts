import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { z } from "zod"

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  barcode: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  costPrice: z.number().min(0).optional(),
  salePrice: z.number().min(0).optional(),
  stock: z.number().int().min(0).optional(),
  minStock: z.number().int().min(0).optional(),
  maxStock: z.number().int().optional().nullable(),
  description: z.string().optional().nullable(),
  image: z.string().optional().nullable(),
  soldByWeight: z.boolean().optional(),
  categoryId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  active: z.boolean().optional(),
})

async function ownerCheck(id: string, tenantId: string | null, isSuperAdmin: boolean) {
  const p = await db.product.findUnique({ where: { id }, select: { tenantId: true } })
  if (!p) return "not_found"
  if (!isSuperAdmin && p.tenantId !== tenantId) return "forbidden"
  return "ok"
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, tenantId, isSuperAdmin } = await getSessionTenant()
  if (error) return error
  const check = await ownerCheck(params.id, tenantId, isSuperAdmin)
  if (check === "not_found") return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  if (check === "forbidden") return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  const product = await db.product.findUnique({ where: { id: params.id }, include: { category: true, supplier: true } })
  return NextResponse.json({ product })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, tenantId, session, isSuperAdmin } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const check = await ownerCheck(params.id, tenantId, isSuperAdmin)
  if (check === "not_found") return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  if (check === "forbidden") return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })

  try {
    const oldProduct = await db.product.findUnique({ where: { id: params.id } })
    const product = await db.$transaction(async (tx) => {
      const p = await tx.product.update({ where: { id: params.id }, data: parsed.data })
      if (parsed.data.stock !== undefined && oldProduct && parsed.data.stock !== oldProduct.stock) {
        await tx.stockMovement.create({ data: { productId: p.id, type: "ADJUSTMENT", quantity: parsed.data.stock - oldProduct.stock, stockBefore: oldProduct.stock, stockAfter: parsed.data.stock, reason: "Ajuste manual", userId: session.user.id! } })
      }
      return p
    })
    return NextResponse.json({ product })
  } catch (err: any) {
    if (err?.code === "P2002") return NextResponse.json({ error: "Barcode o SKU ya existe" }, { status: 400 })
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, tenantId, session, isSuperAdmin } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  const check = await ownerCheck(params.id, tenantId, isSuperAdmin)
  if (check === "not_found") return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  if (check === "forbidden") return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  await db.product.update({ where: { id: params.id }, data: { active: false } })
  return NextResponse.json({ ok: true })
}
