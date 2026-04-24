import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { can, hasFeature } from "@/lib/permissions"
import type { Plan } from "@/lib/utils"
import { z } from "zod"

async function getPlan(tenantId: string): Promise<Plan> {
  const sub = await db.subscription.findUnique({
    where: { tenantId },
    select: { plan: true },
  })
  return (sub?.plan as Plan) ?? "FREE"
}

const applySchema = z.object({
  changes: z
    .array(
      z.object({
        productId: z.string(),
        // Category: either existing id, or create new with name, or null to skip
        categoryAction: z.enum(["assign_existing", "create_new", "skip"]),
        categoryId: z.string().nullable().optional(),
        categoryName: z.string().nullable().optional(),
        // Supplier
        supplierAction: z.enum(["assign_existing", "create_new", "skip"]),
        supplierId: z.string().nullable().optional(),
        supplierName: z.string().nullable().optional(),
      })
    )
    .min(1),
})

/**
 * POST /api/productos/apply-enrichment
 * Receives user-confirmed changes and applies them:
 * - Creates new categories/suppliers where needed (deduped by name)
 * - Updates each product with final categoryId/supplierId
 */
export async function POST(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })

  if (!can(session.user.role, "products:edit")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  const plan = await getPlan(tenantId!)
  if (!hasFeature(plan, "feature:ai_assistant_full")) {
    return NextResponse.json({ error: "Funcionalidad bloqueada por tu plan" }, { status: 402 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  const parsed = applySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { changes } = parsed.data

  // Collect all unique new names to create
  const newCategoryNames = new Set<string>()
  const newSupplierNames = new Set<string>()
  for (const c of changes) {
    if (c.categoryAction === "create_new" && c.categoryName) {
      newCategoryNames.add(c.categoryName.trim())
    }
    if (c.supplierAction === "create_new" && c.supplierName) {
      newSupplierNames.add(c.supplierName.trim())
    }
  }

  // Get existing categories/suppliers to avoid duplicates
  const [existingCats, existingSups] = await Promise.all([
    db.category.findMany({
      where: { tenantId: tenantId!, name: { in: Array.from(newCategoryNames) } },
      select: { id: true, name: true },
    }),
    db.supplier.findMany({
      where: { tenantId: tenantId!, name: { in: Array.from(newSupplierNames) } },
      select: { id: true, name: true },
    }),
  ])
  const catByName = new Map(existingCats.map(c => [c.name.toLowerCase(), c.id]))
  const supByName = new Map(existingSups.map(s => [s.name.toLowerCase(), s.id]))

  const createdCategories: Array<{ id: string; name: string }> = []
  const createdSuppliers: Array<{ id: string; name: string }> = []
  let productsUpdated = 0

  try {
    await db.$transaction(async (tx) => {
      // Create missing categories
      for (const name of newCategoryNames) {
        if (catByName.has(name.toLowerCase())) continue
        try {
          const created = await tx.category.create({
            data: { name, tenantId: tenantId! },
            select: { id: true, name: true },
          })
          catByName.set(name.toLowerCase(), created.id)
          createdCategories.push(created)
        } catch {
          // Already exists (race condition)
          const again = await tx.category.findFirst({
            where: { name, tenantId: tenantId! },
            select: { id: true, name: true },
          })
          if (again) catByName.set(name.toLowerCase(), again.id)
        }
      }

      // Create missing suppliers
      for (const name of newSupplierNames) {
        if (supByName.has(name.toLowerCase())) continue
        const created = await tx.supplier.create({
          data: { name, tenantId: tenantId! },
          select: { id: true, name: true },
        })
        supByName.set(name.toLowerCase(), created.id)
        createdSuppliers.push(created)
      }

      // Apply changes
      for (const c of changes) {
        const update: { categoryId?: string | null; supplierId?: string | null } = {}

        if (c.categoryAction === "assign_existing" && c.categoryId) {
          update.categoryId = c.categoryId
        } else if (c.categoryAction === "create_new" && c.categoryName) {
          const id = catByName.get(c.categoryName.toLowerCase())
          if (id) update.categoryId = id
        }

        if (c.supplierAction === "assign_existing" && c.supplierId) {
          update.supplierId = c.supplierId
        } else if (c.supplierAction === "create_new" && c.supplierName) {
          const id = supByName.get(c.supplierName.toLowerCase())
          if (id) update.supplierId = id
        }

        if (Object.keys(update).length > 0) {
          await tx.product.updateMany({
            where: { id: c.productId, tenantId: tenantId! },
            data: update,
          })
          productsUpdated++
        }
      }
    })

    return NextResponse.json({
      productsUpdated,
      categoriesCreated: createdCategories,
      suppliersCreated: createdSuppliers,
    })
  } catch (err) {
    console.error("[apply-enrichment]", err)
    return NextResponse.json(
      { error: "Error al aplicar cambios" },
      { status: 500 }
    )
  }
}
