import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { can } from "@/lib/permissions"
import { checkQuota } from "@/lib/plan-guard"

export async function POST(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!can(session.user.role, "categories:manage"))
    return NextResponse.json({ error: "Sin permisos para gestionar categorías" }, { status: 403 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  const rawNames: string[] = Array.isArray(body?.names) ? body.names : []
  // Normalize, deduplicate case-insensitive, trim
  const seen = new Set<string>()
  const unique: string[] = []
  for (const raw of rawNames) {
    if (typeof raw !== "string") continue
    const name = raw.trim()
    if (!name || name.length > 60) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(name)
  }

  if (unique.length === 0) {
    return NextResponse.json({ error: "No se recibió ningún nombre válido" }, { status: 400 })
  }
  if (unique.length > 200) {
    return NextResponse.json({ error: "Máximo 200 categorías por importación" }, { status: 400 })
  }

  // Get existing names for this tenant to skip duplicates
  const existing = await db.category.findMany({
    where: { tenantId: tenantId! },
    select: { name: true },
  })
  const existingSet = new Set(existing.map((c) => c.name.toLowerCase()))

  const toCreate = unique.filter((n) => !existingSet.has(n.toLowerCase()))
  const skipped = unique.filter((n) => existingSet.has(n.toLowerCase()))

  // Check plan quota BEFORE creating
  const quota = await checkQuota(tenantId!, "categories")
  // `quota.limit` and `quota.current` may tell us how many we can add.
  if (!quota.ok && toCreate.length > 0) {
    return NextResponse.json({ error: quota.message }, { status: 403 })
  }
  // If limit is finite, cap the number we try to create
  type QuotaLoose = { limit?: number | null; current?: number | null }
  const q = quota as unknown as QuotaLoose
  if (typeof q.limit === "number" && typeof q.current === "number") {
    const remaining = Math.max(0, q.limit - q.current)
    if (toCreate.length > remaining) {
      return NextResponse.json({
        error: `Tu plan permite crear ${remaining} categoría${remaining !== 1 ? "s" : ""} más. Intentaste crear ${toCreate.length}.`,
        code: "QUOTA_EXCEEDED",
        remaining,
        requested: toCreate.length,
      }, { status: 403 })
    }
  }

  // Create all in one transaction
  try {
    const created = await db.$transaction(
      toCreate.map((name) =>
        db.category.create({
          data: { name, tenantId: tenantId! },
          select: { id: true, name: true },
        })
      )
    )

    return NextResponse.json({
      created,
      createdCount: created.length,
      skipped,
      skippedCount: skipped.length,
    })
  } catch (err) {
    console.error("[POST /api/categorias/bulk]", err)
    return NextResponse.json({ error: "Error al crear categorías" }, { status: 500 })
  }
}
