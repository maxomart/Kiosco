import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { getTenantPlan } from "@/lib/plan-guard"
import { hasFeature } from "@/lib/permissions"
import { PLAN_LIMITS } from "@/lib/utils"
import {
  parseSpreadsheet,
  mapColumnsWithAI,
  normalizeRows,
} from "@/lib/import-ai"

export const dynamic = "force-dynamic"
export const maxDuration = 30

/**
 * STEP 1 of the smart import flow.
 * Receives a file, parses it, asks the AI to map columns, returns a preview.
 * No DB writes — the user sees the mapping + sample, can adjust, then confirms.
 */
export async function POST(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!["OWNER", "ADMIN"].includes(session.user.role ?? ""))
    return NextResponse.json({ error: "Sin permisos para importar" }, { status: 403 })

  // Plan gate — CSV import is STARTER+. FREE can manually add products.
  const plan = await getTenantPlan(tenantId!)
  if (!hasFeature(plan, "feature:csv_import")) {
    return NextResponse.json({
      error: `Importar productos no está incluido en el plan ${plan}. Suscribite a Starter o superior.`,
    }, { status: 402 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "Form data inválido" }, { status: 400 })
  }
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "Archivo requerido" }, { status: 400 })

  // Soft size limit: 10MB
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Archivo demasiado grande (máx 10 MB)" }, { status: 413 })
  }

  let parsed
  try {
    parsed = await parseSpreadsheet(file)
  } catch (err: any) {
    console.error("[importar/preview] parse error", err)
    return NextResponse.json({
      error: "No se pudo leer el archivo. Asegurate de que sea un Excel (.xlsx) o CSV válido.",
    }, { status: 400 })
  }

  if (parsed.rows.length === 0) {
    return NextResponse.json({ error: "El archivo no tiene filas con datos" }, { status: 400 })
  }

  // Plan limit check
  const currentCount = await db.product.count({ where: { tenantId: tenantId!, active: true } })
  const limit = PLAN_LIMITS[plan].products
  const wouldExceed = isFinite(limit) && currentCount + parsed.rows.length > limit

  // AI mapping (sample only — keep tokens small)
  const sample = parsed.rows.slice(0, 5)
  const mapping = await mapColumnsWithAI(parsed.headers, sample)

  // Build a small preview using the mapping
  const previewRows = normalizeRows(parsed.rows.slice(0, 8), mapping)

  return NextResponse.json({
    sheetName: parsed.sheetName,
    headers: parsed.headers,
    totalRows: parsed.totalRows,
    sample, // raw first rows so the UI can render them
    mapping,
    preview: previewRows, // normalized first rows showing what'll be imported
    planContext: {
      plan,
      currentCount,
      limit,
      wouldExceed,
      remaining: isFinite(limit) ? Math.max(0, limit - currentCount) : Infinity,
    },
  })
}
