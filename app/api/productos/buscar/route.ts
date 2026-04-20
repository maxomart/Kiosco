import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"

export async function GET(req: NextRequest) {
  const { error, tenantId } = await getSessionTenant()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q")?.trim() ?? ""
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100)

  const where = {
    tenantId: tenantId!,
    active: true,
    ...(q.length > 0 && {
      OR: [
        { name: { contains: q, mode: "insensitive" as const } },
        { barcode: { contains: q, mode: "insensitive" as const } },
        { sku: { contains: q, mode: "insensitive" as const } },
      ],
    }),
  }

  const products = await db.product.findMany({
    where,
    take: limit,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      barcode: true,
      sku: true,
      salePrice: true,
      costPrice: true,
      stock: true,
      minStock: true,
      soldByWeight: true,
      image: true,
      active: true,
      category: {
        select: { id: true, name: true },
      },
    },
  })

  return NextResponse.json({ products })
}
