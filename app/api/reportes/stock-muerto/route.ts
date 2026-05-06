import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { can } from "@/lib/permissions"

export const dynamic = "force-dynamic"

/**
 * Stock muerto — productos que no se vendieron en los últimos N días pero
 * todavía tenés en góndola. Muestra el capital atrapado (stock × costo)
 * para que el dueño priorice qué liquidar primero.
 *
 * Default: productos sin venderse en 60 días con stock > 0.
 * Devuelve JSON o CSV (?format=csv).
 *
 * Lógica:
 *   1. Para cada producto activo con stock > 0, buscamos la última venta
 *      (max createdAt en SaleItem joineado a Sale completed).
 *   2. Filtramos los que vendieron por última vez antes del cutoff o
 *      nunca vendieron (= stock comprado y nunca movido).
 *   3. Ordenamos por capital atrapado descendente.
 */
export async function GET(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error) return error
  if (!can(session?.user?.role, "products:read")) {
    return NextResponse.json({ error: "Sin permisos para ver inventario" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const daysParam = parseInt(searchParams.get("days") ?? "60", 10)
  const days = Number.isFinite(daysParam) && daysParam >= 7 ? Math.min(daysParam, 365) : 60
  const format = searchParams.get("format") ?? "json"

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  // Productos activos con stock > 0
  const products = await db.product.findMany({
    where: { tenantId: tenantId!, active: true, stock: { gt: 0 } },
    select: {
      id: true,
      name: true,
      sku: true,
      stock: true,
      costPrice: true,
      salePrice: true,
      createdAt: true,
      category: { select: { name: true } },
    },
  })

  // Última venta por producto. SaleItem no tiene createdAt directo;
  // joineamos con Sale.createdAt y agrupamos en JS. Para tenants con
  // catálogos chicos (Básico = 1.000 prods, Pro = 5.000) es trivial;
  // si crecemos a Empresa con 50K, vale la pena migrar a raw SQL.
  const items = await db.saleItem.findMany({
    where: {
      sale: { tenantId: tenantId!, status: "COMPLETED" },
      productId: { in: products.map(p => p.id) },
    },
    select: { productId: true, sale: { select: { createdAt: true } } },
    orderBy: { sale: { createdAt: "desc" } },
  })
  const lastSaleByProduct = new Map<string, Date>()
  for (const it of items) {
    if (!lastSaleByProduct.has(it.productId)) {
      lastSaleByProduct.set(it.productId, it.sale.createdAt)
    }
  }

  type DeadItem = {
    id: string
    name: string
    sku: string | null
    category: string | null
    stock: number
    costPrice: number
    salePrice: number
    capitalAtrapado: number
    lastSoldAt: string | null
    daysSinceLastSale: number | null
  }

  const dead: DeadItem[] = []
  for (const p of products) {
    const last = lastSaleByProduct.get(p.id) ?? null
    const isDead = !last || last < cutoff
    if (!isDead) continue
    const cost = Number(p.costPrice)
    const capital = Math.round(cost * p.stock)
    const daysSince = last
      ? Math.floor((Date.now() - last.getTime()) / (24 * 60 * 60 * 1000))
      : null
    dead.push({
      id: p.id,
      name: p.name,
      sku: p.sku,
      category: p.category?.name ?? null,
      stock: p.stock,
      costPrice: cost,
      salePrice: Number(p.salePrice),
      capitalAtrapado: capital,
      lastSoldAt: last ? last.toISOString().split("T")[0] : null,
      daysSinceLastSale: daysSince,
    })
  }

  dead.sort((a, b) => b.capitalAtrapado - a.capitalAtrapado)

  const totalCapital = dead.reduce((acc, d) => acc + d.capitalAtrapado, 0)

  if (format === "csv") {
    const rows: (string | number)[][] = [
      ["Producto", "SKU", "Categoría", "Stock", "Costo unit", "Capital atrapado", "Última venta", "Días sin moverse"],
    ]
    for (const d of dead) {
      rows.push([
        d.name,
        d.sku ?? "",
        d.category ?? "",
        d.stock,
        d.costPrice.toFixed(2).replace(".", ","),
        d.capitalAtrapado,
        d.lastSoldAt ?? "Nunca",
        d.daysSinceLastSale ?? "—",
      ])
    }
    rows.push([])
    rows.push(["", "", "", "", "TOTAL CAPITAL ATRAPADO ARS", totalCapital])
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")
    return new NextResponse("﻿" + csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="orvex-stock-muerto-${days}d.csv"`,
      },
    })
  }

  return NextResponse.json({
    daysThreshold: days,
    totalProducts: dead.length,
    totalCapitalAtrapado: totalCapital,
    items: dead,
  })
}
