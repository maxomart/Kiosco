import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { can } from "@/lib/permissions"

const schema = z.object({
  productIds: z.array(z.string().min(1)).min(1, "No seleccionaste productos"),
  categoryId: z.string().nullable(),
})

/**
 * PATCH /api/productos/bulk-category
 * Body: { productIds: string[], categoryId: string | null }
 * Sets the categoryId on all selected products. Passing null un-categorizes them.
 */
export async function PATCH(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })

  if (!can(session.user.role, "products:edit")) {
    return NextResponse.json({ error: "Sin permisos para editar productos" }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { productIds, categoryId } = parsed.data

  // If a category was provided, verify it belongs to this tenant
  if (categoryId) {
    const cat = await db.category.findUnique({
      where: { id: categoryId },
      select: { tenantId: true, active: true },
    })
    if (!cat || cat.tenantId !== tenantId || !cat.active) {
      return NextResponse.json({ error: "Categoría inválida" }, { status: 400 })
    }
  }

  try {
    const result = await db.product.updateMany({
      where: {
        id: { in: productIds },
        tenantId: tenantId!,
      },
      data: { categoryId },
    })
    return NextResponse.json({ updated: result.count })
  } catch (err) {
    console.error("[bulk-category]", err)
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 })
  }
}
