import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"

const updatesSchema = z.object({
  updates: z
    .array(
      z.object({
        id: z.string().min(1),
        salePrice: z.number().min(0).optional(),
        costPrice: z.number().min(0).optional(),
        stock: z.number().int().min(0).optional(),
      })
    )
    .min(1),
})

const deleteSchema = z.object({ ids: z.array(z.string().min(1)).min(1) })

// POST — bulk update prices / stock
export async function POST(req: NextRequest) {
  const { error, tenantId } = await getSessionTenant()
  if (error) return error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }
  const parsed = updatesSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Sin cambios" }, { status: 400 })
  const { updates } = parsed.data

  try {
    // Verify all products belong to tenant
    const ids = updates.map(u => u.id)
    const products = await db.product.findMany({ where: { id: { in: ids } }, select: { id: true, tenantId: true } })
    if (products.length !== ids.length) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
    const invalid = products.filter(p => p.tenantId !== tenantId)
    if (invalid.length > 0) return NextResponse.json({ error: "No autorizado" }, { status: 403 })

    const ops = updates.map(u =>
      db.product.update({
        where: { id: u.id },
        data: {
          ...(u.salePrice !== undefined && { salePrice: u.salePrice }),
          ...(u.costPrice !== undefined && { costPrice: u.costPrice }),
          ...(u.stock !== undefined && { stock: u.stock }),
        },
      })
    )
    await db.$transaction(ops)
    return NextResponse.json({ updated: updates.length })
  } catch (err) {
    console.error("[POST /api/productos/bulk]", err)
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 })
  }
}

// DELETE — bulk delete
export async function DELETE(req: NextRequest) {
  const { error, tenantId } = await getSessionTenant()
  if (error) return error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }
  const parsed = deleteSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Sin IDs" }, { status: 400 })
  const { ids } = parsed.data

  try {
    // Soft delete only products that belong to this tenant
    const result = await db.product.updateMany({
      where: { id: { in: ids }, tenantId: tenantId! },
      data: { active: false },
    })
    return NextResponse.json({ deleted: result.count })
  } catch (err) {
    console.error("[DELETE /api/productos/bulk]", err)
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 })
  }
}
