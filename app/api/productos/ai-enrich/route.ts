import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { can, hasFeature } from "@/lib/permissions"
import type { Plan } from "@/lib/utils"
import { suggestEnrichment, type ProductToEnrich } from "@/lib/inventory-ai"
import { z } from "zod"

async function getPlan(tenantId: string): Promise<Plan> {
  const sub = await db.subscription.findUnique({
    where: { tenantId },
    select: { plan: true },
  })
  return (sub?.plan as Plan) ?? "FREE"
}

const schema = z.object({
  // Optional filter: only process products missing category, or missing supplier, or both
  scope: z.enum(["missing_any", "missing_category", "missing_supplier", "all"]).default("missing_any"),
  // Optional: only analyze these specific product IDs
  productIds: z.array(z.string()).optional(),
  // Limit analysis to N products (to control cost)
  limit: z.number().int().min(1).max(500).default(200),
})

/**
 * POST /api/productos/ai-enrich
 * Body: { scope, productIds?, limit }
 * Returns: { suggestions: EnrichSuggestion[], analyzed: number, categoriesExisting: [...], suppliersExisting: [...] }
 *
 * Does NOT mutate data. The client previews and then calls apply-enrichment.
 */
export async function POST(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })

  if (!can(session.user.role, "products:edit")) {
    return NextResponse.json({ error: "Sin permisos para editar productos" }, { status: 403 })
  }

  const plan = await getPlan(tenantId!)
  if (!hasFeature(plan, "feature:ai_assistant_full")) {
    return NextResponse.json(
      { error: "Auto-organizar con IA disponible desde plan Profesional", code: "FEATURE_LOCKED", requiredPlan: "PROFESSIONAL" },
      { status: 402 }
    )
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { scope, productIds, limit } = parsed.data

  // Build where clause
  const where: any = { tenantId: tenantId!, active: true }
  if (productIds && productIds.length > 0) where.id = { in: productIds }
  else if (scope === "missing_category") where.categoryId = null
  else if (scope === "missing_supplier") where.supplierId = null
  else if (scope === "missing_any") where.OR = [{ categoryId: null }, { supplierId: null }]

  const products = await db.product.findMany({
    where,
    take: limit,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      category: { select: { name: true } },
      supplier: { select: { name: true } },
    },
  })

  if (products.length === 0) {
    return NextResponse.json({ suggestions: [], analyzed: 0, message: "No hay productos para analizar" })
  }

  const [categories, suppliers] = await Promise.all([
    db.category.findMany({
      where: { tenantId: tenantId!, active: true },
      select: { id: true, name: true },
    }),
    db.supplier.findMany({
      where: { tenantId: tenantId!, active: true },
      select: { id: true, name: true },
    }),
  ])

  const toEnrich: ProductToEnrich[] = products.map(p => ({
    id: p.id,
    name: p.name,
    categoryName: p.category?.name ?? null,
    supplierName: p.supplier?.name ?? null,
  }))

  try {
    const suggestions = await suggestEnrichment(toEnrich, categories, suppliers)

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          action: "AI_ENRICH_INVENTORY",
          entity: "Product",
          entityId: null,
          userId: session.user.id!,
          newValue: JSON.stringify({ analyzed: suggestions.length, scope }),
        },
      })
    } catch {
      // non-fatal
    }

    return NextResponse.json({
      suggestions,
      analyzed: suggestions.length,
      categoriesExisting: categories,
      suppliersExisting: suppliers,
    })
  } catch (err) {
    console.error("[ai-enrich]", err)
    return NextResponse.json(
      { error: "Error al analizar productos con IA" },
      { status: 502 }
    )
  }
}
