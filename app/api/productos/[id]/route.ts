import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { z } from "zod"
import { calcProfitPercent } from "@/lib/utils"

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  barcode: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  costPrice: z.number().min(0).optional(),
  salePrice: z.number().min(0).optional(),
  profitPercent: z.number().optional(),
  stock: z.number().min(0).optional(),
  minStock: z.number().min(0).optional(),
  idealStock: z.number().min(0).optional(),
  unit: z.string().optional(),
  taxRate: z.enum(["ZERO", "REDUCED", "STANDARD"]).optional(),
  soldByWeight: z.boolean().optional(),
  hasExpiry: z.boolean().optional(),
  categoryId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  active: z.boolean().optional(),
})

// Convierte "" → null para campos que tienen UNIQUE constraint
// (SQLite/PostgreSQL permiten múltiples NULL pero no múltiples "")
function sanitizeNullable<T extends Record<string, any>>(data: T, fields: (keyof T)[]): T {
  const out = { ...data }
  for (const f of fields) {
    if (out[f] === "" || out[f] === undefined) {
      ;(out as any)[f] = null
    }
  }
  return out
}

// GET /api/productos/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, tenantId, isSuperAdmin } = await getSessionTenant()
  if (error) return error

  const where: any = { id: params.id }
  if (!isSuperAdmin) where.tenantId = tenantId ?? undefined

  const product = await db.product.findFirst({
    where,
    include: { category: true, supplier: true },
  })
  if (!product) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  return NextResponse.json({ product })
}

// PUT /api/productos/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, tenantId, session, isSuperAdmin } = await getSessionTenant()
  if (error) return error

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.errors },
      { status: 400 }
    )
  }

  // Convertir strings vacíos a null en campos con UNIQUE constraint
  const data = sanitizeNullable(parsed.data, ["barcode", "sku", "categoryId", "supplierId"])

  // Recalcular % de ganancia si vienen ambos precios
  let profitPercent: number | undefined
  if (data.costPrice !== undefined && data.salePrice !== undefined) {
    profitPercent = calcProfitPercent(data.costPrice, data.salePrice)
  }

  try {
    const whereClause: any = { id: params.id }
    if (!isSuperAdmin) whereClause.tenantId = tenantId ?? undefined

    const old = await db.product.findFirst({ where: whereClause })
    if (!old) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })

    const product = await db.product.update({
      where: { id: params.id },
      data: {
        ...data,
        ...(profitPercent !== undefined && { profitPercent }),
      },
      include: { category: true, supplier: true },
    })

    // Si cambió el stock, registrar movimiento
    if (data.stock !== undefined && data.stock !== old.stock) {
      await db.stockMovement.create({
        data: {
          productId: product.id,
          type: "ADJUSTMENT",
          quantity: data.stock - old.stock,
          stockBefore: old.stock,
          stockAfter: data.stock,
          userId: session!.user.id!,
          reason: "Ajuste manual desde inventario",
        },
      })
    }

    await db.auditLog.create({
      data: {
        userId: session!.user.id!,
        action: "UPDATE_PRODUCT",
        entity: "Product",
        entityId: product.id,
        oldValue: JSON.stringify(old),
        newValue: JSON.stringify(product),
        tenantId: tenantId ?? null,
      },
    })

    return NextResponse.json({ product })
  } catch (err: any) {
    console.error("[PUT /api/productos/[id]]", err)
    if (err.code === "P2002") {
      const field = err.meta?.target?.[0] || err.meta?.target
      const label = field === "barcode" ? "código de barras" : field === "sku" ? "SKU" : "campo único"
      return NextResponse.json(
        { error: `Ya existe otro producto con ese ${label}` },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 })
  }
}

// DELETE /api/productos/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, tenantId, isSuperAdmin } = await getSessionTenant()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const hard = searchParams.get("hard") === "true"

  try {
    // Verificar que el producto pertenezca al tenant
    const whereClause: any = { id: params.id }
    if (!isSuperAdmin) whereClause.tenantId = tenantId ?? undefined

    const existing = await db.product.findFirst({ where: whereClause })
    if (!existing) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
    }

    if (hard) {
      // Eliminación definitiva (solo si no tiene ventas)
      const hasVentas = await db.saleItem.count({ where: { productId: params.id } })
      if (hasVentas > 0) {
        return NextResponse.json(
          { error: "No se puede borrar: este producto tiene ventas registradas. Usá 'desactivar' en su lugar." },
          { status: 400 }
        )
      }
      await db.stockMovement.deleteMany({ where: { productId: params.id } })
      await db.product.delete({ where: { id: params.id } })
    } else {
      // Soft delete (desactivar) — liberar barcode y sku para reusar en otros productos
      await db.product.update({
        where: { id: params.id },
        data: { active: false, barcode: null, sku: null },
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[DELETE /api/productos/[id]]", err)
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 })
  }
}
