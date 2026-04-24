import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { can } from "@/lib/permissions"
import { similarity } from "@/lib/fuzzy-match"

interface ProductSummary {
  id: string
  name: string
  barcode: string | null
  stock: number
  salePrice: number
  category: { name: string } | null
}

/**
 * Detect likely-duplicate products in the tenant inventory.
 * Matches by:
 *   1. Same barcode (almost certainly same product)
 *   2. Fuzzy name similarity >= 0.8
 * Returns groups of potential duplicates.
 */
export async function GET() {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!can(session.user.role, "products:read"))
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })

  const products = (await db.product.findMany({
    where: { tenantId: tenantId!, active: true },
    select: {
      id: true,
      name: true,
      barcode: true,
      stock: true,
      salePrice: true,
      category: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  })) as unknown as ProductSummary[]

  const groups: Array<{
    reason: "barcode" | "name"
    items: Array<ProductSummary & { salePrice: number }>
  }> = []
  const seenIds = new Set<string>()

  // 1) Group by barcode (exact)
  const byBarcode = new Map<string, ProductSummary[]>()
  for (const p of products) {
    if (!p.barcode) continue
    const list = byBarcode.get(p.barcode) ?? []
    list.push(p)
    byBarcode.set(p.barcode, list)
  }
  for (const [, list] of byBarcode) {
    if (list.length > 1) {
      for (const p of list) seenIds.add(p.id)
      groups.push({
        reason: "barcode",
        items: list.map((p) => ({ ...p, salePrice: Number(p.salePrice) })),
      })
    }
  }

  // 2) Fuzzy name matching (for products not already grouped by barcode)
  const candidates = products.filter((p) => !seenIds.has(p.id))
  // Simple O(n²) scan — fine for up to ~2000 products (< 4M comparisons)
  for (let i = 0; i < candidates.length; i++) {
    const a = candidates[i]
    if (seenIds.has(a.id)) continue
    const similar: ProductSummary[] = [a]
    for (let j = i + 1; j < candidates.length; j++) {
      const b = candidates[j]
      if (seenIds.has(b.id)) continue
      if (similarity(a.name, b.name) >= 0.8) {
        similar.push(b)
      }
    }
    if (similar.length > 1) {
      for (const p of similar) seenIds.add(p.id)
      groups.push({
        reason: "name",
        items: similar.map((p) => ({ ...p, salePrice: Number(p.salePrice) })),
      })
    }
  }

  return NextResponse.json({
    groups,
    totalProducts: products.length,
    totalGroups: groups.length,
    totalDuplicates: groups.reduce((s, g) => s + g.items.length, 0),
  })
}
