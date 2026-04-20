import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"

// POST — bulk update prices / stock
export async function POST(req: NextRequest) {
  const { error, tenantId } = await getSessionTenant()
  if (error) return error

  const body = await req.json()
  const { updates } = body as { updates: { id: string; price?: number; stock?: number; costPrice?: number }[] }
  if (!Array.isArray(updates) || updates.length === 0)
    return NextResponse.json({ error: "Sin cambios" }, { status: 400 })

  // Verify all products belong to tenant
  const ids = updates.map(u => u.id)
  const products = await db.product.findMany({ where: { id: { in: ids } }, select: { id: true, tenantId: true } })
  const invalid = products.filter(p => p.tenantId !== tenantId)
  if (invalid.length > 0) return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  const ops = updates.map(u =>
    db.product.update({
      where: { id: u.id },
      data: {
        ...(u.price !== undefined && { price: u.price }),
        ...(u.costPrice !== undefined && { costPrice: u.costPrice }),
        ...(u.stock !== undefined && { stock: u.stock }),
      },
    })
  )
  await db.$transaction(ops)
  return NextResponse.json({ updated: updates.length })
}

// DELETE — bulk delete
export async function DELETE(req: NextRequest) {
  const { error, tenantId } = await getSessionTenant()
  if (error) return error

  const body = await req.json()
  const { ids } = body as { ids: string[] }
  if (!Array.isArray(ids) || ids.length === 0)
    return NextResponse.json({ error: "Sin IDs" }, { status: 400 })

  // Soft delete only products that belong to this tenant
  const result = await db.product.updateMany({
    where: { id: { in: ids }, tenantId: tenantId! },
    data: { active: false },
  })
  return NextResponse.json({ deleted: result.count })
}
