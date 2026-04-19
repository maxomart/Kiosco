import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { z } from "zod"

// POST /api/productos/bulk
// Actualización masiva de stock para varios productos de una vez.
// Body: { updates: [{ id, stock, costPrice?, salePrice? }, ...] }
const bulkUpdateSchema = z.object({
  updates: z.array(
    z.object({
      id: z.string(),
      stock: z.number().min(0).optional(),
      costPrice: z.number().min(0).optional(),
      salePrice: z.number().min(0).optional(),
      minStock: z.number().min(0).optional(),
    })
  ).min(1),
  reason: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const { error, session, tenantId, isSuperAdmin } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!["ADMIN", "OWNER", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  const body = await req.json()
  const parsed = bulkUpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const { updates, reason } = parsed.data
  const userId = session.user.id!

  try {
    await db.$transaction(async (tx) => {
      for (const u of updates) {
        const old = await tx.product.findUnique({ where: { id: u.id } })
        if (!old) continue
        if (!isSuperAdmin && old.tenantId !== tenantId) continue

        const updateData: any = {}
        if (u.costPrice !== undefined) updateData.costPrice = u.costPrice
        if (u.salePrice !== undefined) updateData.salePrice = u.salePrice
        if (u.minStock !== undefined) updateData.minStock = u.minStock
        if (u.stock !== undefined) updateData.stock = u.stock

        await tx.product.update({ where: { id: u.id }, data: updateData })

        if (u.stock !== undefined && u.stock !== old.stock) {
          await tx.stockMovement.create({
            data: {
              productId: u.id,
              type: u.stock > old.stock ? "PURCHASE" : "ADJUSTMENT",
              quantity: u.stock - old.stock,
              stockBefore: old.stock,
              stockAfter: u.stock,
              userId,
              reason: reason || "Carga masiva",
            },
          })
        }
      }
    })

    return NextResponse.json({ success: true, updated: updates.length })
  } catch (err) {
    console.error("[POST /api/productos/bulk]", err)
    return NextResponse.json({ error: "Error en actualización masiva" }, { status: 500 })
  }
}

// DELETE /api/productos/bulk
// Borra TODOS los productos (requiere confirmación en el body) — SIEMPRE alcance del tenant
export async function DELETE(req: NextRequest) {
  const { error, session, tenantId, isSuperAdmin } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!["ADMIN", "OWNER", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  if (body.confirm !== "BORRAR TODO") {
    return NextResponse.json(
      { error: "Para borrar todo envía { confirm: 'BORRAR TODO' }" },
      { status: 400 }
    )
  }

  const mode: "soft" | "hard" = body.mode === "hard" ? "hard" : "soft"
  // SUPER_ADMIN sin tenantId en body no puede borrar TODO a nivel global — requiere tenantId explícito
  const scopeTenantId: string | null = isSuperAdmin ? (body.tenantId ?? null) : tenantId
  if (!scopeTenantId) {
    return NextResponse.json(
      { error: "tenantId requerido para borrado masivo" },
      { status: 400 }
    )
  }
  const tenantFilter = { tenantId: scopeTenantId }

  try {
    if (mode === "hard") {
      // Hard delete dentro del tenant: requiere que no haya ventas de ese tenant
      const hasVentas = await db.saleItem.count({
        where: { product: { tenantId: scopeTenantId } },
      })
      if (hasVentas > 0) {
        return NextResponse.json(
          {
            error: "No se puede borrar definitivamente porque hay ventas registradas. Usá mode='soft' (desactivar).",
          },
          { status: 400 }
        )
      }
      await db.stockMovement.deleteMany({ where: { product: tenantFilter } })
      await db.product.deleteMany({ where: tenantFilter })
    } else {
      // Soft delete: desactivar solo los del tenant
      await db.product.updateMany({ where: tenantFilter, data: { active: false } })
    }

    await db.auditLog.create({
      data: {
        userId: session.user.id!,
        action: mode === "hard" ? "BULK_DELETE_PRODUCTS" : "BULK_DEACTIVATE_PRODUCTS",
        entity: "Product",
      },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[DELETE /api/productos/bulk]", err)
    return NextResponse.json({ error: "Error al borrar productos" }, { status: 500 })
  }
}
