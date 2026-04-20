import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { getTenantPlan } from "@/lib/plan-guard"
import { hasFeature } from "@/lib/permissions"
import { PLAN_LIMITS } from "@/lib/utils"
import {
  parseSpreadsheet,
  normalizeRows,
  type ColumnMapping,
} from "@/lib/import-ai"

export const dynamic = "force-dynamic"
export const maxDuration = 120

/**
 * STEP 2 of the smart import flow.
 * Receives the file again + the mapping the user confirmed (possibly edited)
 * + the cost ratio they chose. Runs the full import.
 *
 * We re-receive the file (instead of holding parsed rows in memory between
 * requests) so this is stateless and resumable.
 */
export async function POST(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!["OWNER", "ADMIN"].includes(session.user.role ?? ""))
    return NextResponse.json({ error: "Sin permisos para importar" }, { status: 403 })

  const plan = await getTenantPlan(tenantId!)
  if (!hasFeature(plan, "feature:csv_import")) {
    return NextResponse.json({
      error: `Importar productos no está incluido en el plan ${plan}.`,
    }, { status: 402 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "Form data inválido" }, { status: 400 })
  }
  const file = formData.get("file") as File | null
  const mappingJson = formData.get("mapping") as string | null
  const defaultCostRatio = parseFloat((formData.get("defaultCostRatio") as string) ?? "0.75")
  const defaultMinStock = parseInt((formData.get("defaultMinStock") as string) ?? "5", 10)
  const createCategories = (formData.get("createCategories") as string) === "true"

  if (!file) return NextResponse.json({ error: "Archivo requerido" }, { status: 400 })
  if (!mappingJson) return NextResponse.json({ error: "Mapeo de columnas requerido" }, { status: 400 })

  let mapping: ColumnMapping
  try {
    mapping = JSON.parse(mappingJson)
  } catch {
    return NextResponse.json({ error: "Mapeo inválido" }, { status: 400 })
  }
  if (!mapping.fields?.name || !mapping.fields?.salePrice) {
    return NextResponse.json({
      error: "El mapeo debe incluir nombre y precio de venta.",
    }, { status: 400 })
  }

  let parsed
  try {
    parsed = await parseSpreadsheet(file)
  } catch (err) {
    return NextResponse.json({ error: "No se pudo leer el archivo" }, { status: 400 })
  }

  // Plan limit check before doing any DB writes
  const currentCount = await db.product.count({ where: { tenantId: tenantId!, active: true } })
  const limit = PLAN_LIMITS[plan].products
  const validRows = normalizeRows(parsed.rows, mapping, {
    defaultCostRatio: isFinite(defaultCostRatio) && defaultCostRatio > 0 ? defaultCostRatio : 0.75,
    defaultMinStock: isFinite(defaultMinStock) && defaultMinStock >= 0 ? defaultMinStock : 5,
  }).filter((r) => !r.error)

  if (isFinite(limit) && currentCount + validRows.length > limit) {
    return NextResponse.json({
      error: `Esta importación pasaría el límite del plan ${plan} (${limit} productos). Actualmente tenés ${currentCount} y querés agregar ${validRows.length}.`,
      currentCount,
      limit,
    }, { status: 403 })
  }

  // ── Pre-fetch existing categories + suppliers (for create-or-find) ──────────
  const existingCategories = createCategories
    ? new Map(
        (await db.category.findMany({ where: { tenantId: tenantId!, active: true }, select: { id: true, name: true } }))
          .map((c) => [normalizeName(c.name), c.id]),
      )
    : new Map<string, string>()

  // Run the import — process rows one by one for clear error reporting,
  // but batch the create category writes.
  const all = normalizeRows(parsed.rows, mapping, {
    defaultCostRatio: isFinite(defaultCostRatio) && defaultCostRatio > 0 ? defaultCostRatio : 0.75,
    defaultMinStock: isFinite(defaultMinStock) && defaultMinStock >= 0 ? defaultMinStock : 5,
  })

  let imported = 0
  let updated = 0
  const errors: { row: number; name: string; message: string }[] = []

  for (const row of all) {
    if (row.error) {
      errors.push({ row: row.rowNum, name: row.name || "—", message: row.error })
      continue
    }

    try {
      // Resolve / create category if needed
      let categoryId: string | null = null
      if (createCategories && row.categoryName) {
        const key = normalizeName(row.categoryName)
        let id = existingCategories.get(key) ?? null
        if (!id) {
          const created = await db.category.create({
            data: { name: row.categoryName.trim(), tenantId: tenantId! },
          }).catch(() => null)
          if (created) {
            id = created.id
            existingCategories.set(key, id)
          }
        }
        categoryId = id
      }

      // Find existing by barcode or sku
      const existing = row.barcode
        ? await db.product.findFirst({ where: { barcode: row.barcode, tenantId: tenantId! } })
        : row.sku
        ? await db.product.findFirst({ where: { sku: row.sku, tenantId: tenantId! } })
        : null

      const data = {
        name: row.name,
        salePrice: row.salePrice,
        costPrice: row.costPrice,
        stock: row.stock,
        minStock: row.minStock,
        barcode: row.barcode,
        sku: row.sku,
        description: row.description,
        active: true,
        ...(categoryId ? { categoryId } : {}),
      }

      if (existing) {
        await db.product.update({ where: { id: existing.id }, data })
        updated++
      } else {
        await db.product.create({ data: { ...data, tenantId: tenantId! } })
        imported++
      }
    } catch (e: any) {
      errors.push({ row: row.rowNum, name: row.name, message: e?.message ?? "Error al guardar" })
    }
  }

  return NextResponse.json({
    imported,
    updated,
    skipped: errors.length,
    errors: errors.slice(0, 50), // cap shown errors
    totalRows: all.length,
  })
}

function normalizeName(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
}
