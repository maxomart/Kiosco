import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { can } from "@/lib/permissions"

const schema = z.object({
  keepId: z.string(),
  mergeIds: z.array(z.string().min(1)).min(1),
  sumStock: z.boolean().default(true),
})

/**
 * Merge duplicate products into one.
 * - Transfers SaleItem and RechargeItem references from mergeIds to keepId
 * - Optionally sums stock into keepId
 * - Soft-deletes mergeIds (active=false)
 */
export async function POST(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!can(session.user.role, "products:delete"))
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { keepId, mergeIds, sumStock } = parsed.data

  if (mergeIds.includes(keepId)) {
    return NextResponse.json({ error: "El producto a mantener no puede estar en la lista de merge" }, { status: 400 })
  }

  // Verify all products belong to tenant
  const allIds = [keepId, ...mergeIds]
  const products = await db.product.findMany({
    where: { id: { in: allIds }, tenantId: tenantId! },
    select: { id: true, stock: true },
  })
  if (products.length !== allIds.length) {
    return NextResponse.json({ error: "Algún producto no existe o no pertenece al tenant" }, { status: 400 })
  }

  try {
    const result = await db.$transaction(async (tx) => {
      // Transfer sale items (for historical analytics)
      await tx.saleItem.updateMany({
        where: { productId: { in: mergeIds } },
        data: { productId: keepId },
      })

      // Transfer recharge items (stock purchases)
      await tx.rechargeItem.updateMany({
        where: { productId: { in: mergeIds } },
        data: { productId: keepId },
      })

      // Transfer stock movements
      await tx.stockMovement.updateMany({
        where: { productId: { in: mergeIds } },
        data: { productId: keepId },
      })

      // Sum stock if requested
      if (sumStock) {
        const mergedStock = products
          .filter((p) => mergeIds.includes(p.id))
          .reduce((sum, p) => sum + p.stock, 0)
        await tx.product.update({
          where: { id: keepId },
          data: { stock: { increment: mergedStock } },
        })
      }

      // Soft-delete the duplicates
      const deleteResult = await tx.product.updateMany({
        where: { id: { in: mergeIds } },
        data: { active: false },
      })

      return { deleted: deleteResult.count }
    })

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          action: "PRODUCT_MERGE",
          entity: "Product",
          entityId: keepId,
          userId: session.user.id!,
          newValue: JSON.stringify({ keepId, mergeIds, sumStock }),
        },
      })
    } catch {
      // non-fatal
    }

    return NextResponse.json({ ok: true, merged: result.deleted })
  } catch (err) {
    console.error("[products/merge]", err)
    return NextResponse.json({ error: "Error al unificar productos" }, { status: 500 })
  }
}
