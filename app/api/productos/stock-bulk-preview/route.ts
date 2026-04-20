import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { can, hasFeature } from "@/lib/permissions"
import { getTenantPlan } from "@/lib/plan-guard"

export const dynamic = "force-dynamic"

const lineSchema = z.object({
  identifier: z.string().min(1),   // barcode OR sku OR name (we try all 3)
  quantity: z.number(),            // signed: positive for ADD, can be negative for ADJUSTMENT
  costPrice: z.number().optional(), // optional: update cost at the same time (when proveedor sube precios)
})

const bodySchema = z.object({
  lines: z.array(lineSchema).min(1).max(2000),
})

/**
 * Resolves a list of "barcode/sku/name + quantity" rows against the product
 * catalog. Returns matched + unmatched rows so the UI can show a preview
 * BEFORE the user commits the bulk update.
 *
 * Plan-gated: bulk stock loading is a STARTER+ feature (premium for the user).
 */
export async function POST(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })

  if (!can(session.user.role, "products:edit")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })
  }

  // Plan gate — bulk stock load is STARTER+
  const plan = await getTenantPlan(tenantId!)
  if (!hasFeature(plan, "feature:csv_import")) {
    return NextResponse.json({
      error: `La carga masiva de stock está incluida desde el plan Básico. Suscribite para activarla.`,
    }, { status: 402 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  // Pre-fetch all candidates by barcode and sku in batches
  const identifiers = parsed.data.lines.map((l) => l.identifier.trim()).filter(Boolean)
  const products = await db.product.findMany({
    where: {
      tenantId: tenantId!,
      OR: [
        { barcode: { in: identifiers } },
        { sku: { in: identifiers } },
      ],
    },
    select: { id: true, name: true, barcode: true, sku: true, stock: true, costPrice: true, salePrice: true },
  })

  type P = typeof products[number]
  const byBarcode = new Map(products.filter((p: P) => p.barcode).map((p: P) => [p.barcode!.trim(), p]))
  const bySku = new Map(products.filter((p: P) => p.sku).map((p: P) => [p.sku!.trim(), p]))

  // For unmatched IDs, do a fallback fuzzy search by name (LIMIT to remaining ids only,
  // to keep the query light). Just exact case-insensitive match — fuzzy is risky for stock.
  const remaining = parsed.data.lines.filter(
    (l) => !byBarcode.has(l.identifier.trim()) && !bySku.has(l.identifier.trim()),
  )
  let byName = new Map<string, P>()
  if (remaining.length > 0) {
    const names = remaining.map((l) => l.identifier.trim())
    const nameMatches = await db.product.findMany({
      where: {
        tenantId: tenantId!,
        name: { in: names, mode: "insensitive" },
      },
      select: { id: true, name: true, barcode: true, sku: true, stock: true, costPrice: true, salePrice: true },
    })
    byName = new Map(nameMatches.map((p: P) => [p.name.toLowerCase(), p]))
  }

  const matched: any[] = []
  const unmatched: { line: number; identifier: string; quantity: number }[] = []

  parsed.data.lines.forEach((line, idx) => {
    const id = line.identifier.trim()
    const p = (byBarcode.get(id) ?? bySku.get(id) ?? byName.get(id.toLowerCase())) as P | undefined
    if (!p) {
      unmatched.push({ line: idx + 1, identifier: id, quantity: line.quantity })
      return
    }
    matched.push({
      line: idx + 1,
      productId: p.id,
      productName: p.name,
      barcode: p.barcode,
      sku: p.sku,
      currentStock: p.stock,
      newStockADD: p.stock + line.quantity,
      currentCostPrice: Number(p.costPrice),
      currentSalePrice: Number(p.salePrice),
      quantity: line.quantity,
      costPriceUpdate: line.costPrice ?? null,
    })
  })

  return NextResponse.json({
    totalLines: parsed.data.lines.length,
    matchedCount: matched.length,
    unmatchedCount: unmatched.length,
    matched,
    unmatched,
  })
}
