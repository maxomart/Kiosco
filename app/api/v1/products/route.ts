import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyApiKey, rateLimitHeaders } from "@/lib/api-auth"

/**
 * GET /api/v1/products
 * Auth: Authorization: Bearer rk_live_...
 * Query: ?limit=50&offset=0
 */
export async function GET(req: NextRequest) {
  const verified = await verifyApiKey(req)
  if (!verified) {
    return NextResponse.json(
      { error: "Bearer token inválido o revocado" },
      { status: 401, headers: rateLimitHeaders() },
    )
  }

  const { searchParams } = new URL(req.url)
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "50", 10), 1), 200)
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10), 0)

  const [items, total] = await Promise.all([
    db.product.findMany({
      where: { tenantId: verified.tenantId, active: true },
      skip: offset,
      take: limit,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        barcode: true,
        sku: true,
        salePrice: true,
        stock: true,
        category: { select: { name: true } },
      },
    }),
    db.product.count({ where: { tenantId: verified.tenantId, active: true } }),
  ])

  const data = items.map((p) => ({
    id: p.id,
    name: p.name,
    barcode: p.barcode,
    sku: p.sku,
    salePrice: Number(p.salePrice),
    stock: p.stock,
    categoryName: p.category?.name ?? null,
  }))

  return NextResponse.json(
    { data, pagination: { limit, offset, total } },
    { headers: rateLimitHeaders() },
  )
}
