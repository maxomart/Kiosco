import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { can } from "@/lib/permissions"
import { getTenantPlan } from "@/lib/plan-guard"
import { PLAN_LIMITS } from "@/lib/utils"

export const dynamic = "force-dynamic"

/**
 * Crea productos en lote desde fuentes "no-CSV" (ej: foto procesada por IA,
 * texto pegado parseado, scanner barcode). El endpoint /importar/commit es
 * para CSVs con mapping IA; este es para items ya estructurados.
 *
 * Reglas:
 *   - Respeta el plan limit del tenant (corta cuando se llega al cap).
 *   - Si un barcode ya existe en el tenant, hace UPDATE en lugar de INSERT
 *     (no duplica).
 *   - Si falta name o ambos precios son 0, salta esa fila pero no falla
 *     la operación entera.
 */

const inputSchema = z.object({
  products: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        barcode: z.string().nullable().optional(),
        salePrice: z.number().min(0).optional().default(0),
        costPrice: z.number().min(0).optional().default(0),
        stock: z.number().min(0).optional().default(0),
        minStock: z.number().min(0).optional().default(5),
        categoryId: z.string().nullable().optional(),
        supplierId: z.string().nullable().optional(),
      })
    )
    .min(1, "Sin productos para crear")
    .max(200, "Demasiados productos por request (máx 200)"),
})

export async function POST(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!can(session.user.role, "products:create")) {
    return NextResponse.json({ error: "Sin permisos para crear productos" }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }
  const parsed = inputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", issues: parsed.error.issues }, { status: 422 })
  }
  const { products } = parsed.data

  // Plan limit: cuántos productos podemos crear todavía.
  const plan = await getTenantPlan(tenantId!)
  const currentCount = await db.product.count({ where: { tenantId: tenantId!, active: true } })
  const planLimit = PLAN_LIMITS[plan].products
  const remaining = planLimit === Number.POSITIVE_INFINITY
    ? Number.POSITIVE_INFINITY
    : Math.max(0, planLimit - currentCount)

  if (remaining === 0) {
    return NextResponse.json({
      error: `Tu plan ${plan} llegó al límite de ${planLimit} productos. Pasá a un plan superior para agregar más.`,
      code: "PLAN_LIMIT",
    }, { status: 402 })
  }

  // Cap por plan: solo creamos los primeros N que entren.
  const toProcess = remaining === Number.POSITIVE_INFINITY
    ? products
    : products.slice(0, remaining)
  const skippedDueToPlan = products.length - toProcess.length

  // Pre-cargamos los barcodes existentes del tenant para hacer UPSERT
  // sin atropellar uniqueness constraint.
  const allBarcodes = toProcess.map(p => p.barcode).filter((b): b is string => !!b)
  const existing = allBarcodes.length > 0
    ? await db.product.findMany({
        where: { tenantId: tenantId!, barcode: { in: allBarcodes } },
        select: { id: true, barcode: true },
      })
    : []
  const existingByBarcode = new Map(existing.map(p => [p.barcode!, p.id]))

  let created = 0
  let updated = 0
  let skipped = 0
  const errors: { name: string; message: string }[] = []

  for (const p of toProcess) {
    if (!p.name.trim()) { skipped++; continue }
    if (p.salePrice === 0 && p.costPrice === 0) { skipped++; continue }

    try {
      const existingId = p.barcode ? existingByBarcode.get(p.barcode) : undefined
      if (existingId) {
        // Update parcial: sumamos stock y refrescamos precios si vinieron.
        await db.product.update({
          where: { id: existingId },
          data: {
            ...(p.salePrice > 0 ? { salePrice: p.salePrice } : {}),
            ...(p.costPrice > 0 ? { costPrice: p.costPrice } : {}),
            ...(p.stock > 0 ? { stock: { increment: p.stock } } : {}),
          },
        })
        updated++
      } else {
        await db.product.create({
          data: {
            tenantId: tenantId!,
            name: p.name.trim(),
            barcode: p.barcode || null,
            salePrice: p.salePrice,
            costPrice: p.costPrice,
            stock: p.stock,
            minStock: p.minStock,
            categoryId: p.categoryId || null,
            supplierId: p.supplierId || null,
            active: true,
          },
        })
        created++
      }
    } catch (e: any) {
      errors.push({ name: p.name, message: e?.message ?? "Error desconocido" })
    }
  }

  return NextResponse.json({
    created,
    updated,
    skipped,
    skippedDueToPlan,
    totalRequested: products.length,
    errors,
    planLimit: planLimit === Number.POSITIVE_INFINITY ? null : planLimit,
    remainingAfter: planLimit === Number.POSITIVE_INFINITY
      ? null
      : Math.max(0, planLimit - currentCount - created),
  })
}
