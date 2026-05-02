import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"

export const dynamic = "force-dynamic"

/** Productos activos para imprimir etiquetas. */
export async function GET() {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const products = await db.product.findMany({
    where: { tenantId: tenantId!, active: true },
    select: {
      id: true,
      name: true,
      barcode: true,
      sku: true,
      salePrice: true,
      category: { select: { name: true } },
    },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
  })

  const config = await db.tenantConfig.findUnique({
    where: { tenantId: tenantId! },
    select: { businessName: true },
  })

  return NextResponse.json({
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      barcode: p.barcode,
      sku: p.sku,
      salePrice: Number(p.salePrice),
      categoryName: p.category?.name ?? null,
    })),
    businessName: config?.businessName ?? null,
  })
}
