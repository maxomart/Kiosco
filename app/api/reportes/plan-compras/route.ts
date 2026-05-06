import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { can } from "@/lib/permissions"

export const dynamic = "force-dynamic"

/**
 * Plan de compras semanal — sugiere qué reponer y cuánto, basado en la
 * velocidad de venta de los últimos N días. Es la pregunta que el
 * kiosquero se hace todos los lunes: "¿qué le pido al mayorista?".
 *
 * Lógica simple, transparente (no IA, deterministica):
 *   1. Por cada producto activo: cuántas unidades se vendieron en los
 *      últimos 14 días (default).
 *   2. Velocidad diaria = vendido / 14.
 *   3. Días de cobertura actual = stock / velocidadDiaria.
 *   4. Cantidad sugerida = velocidadDiaria * targetCoverDays - stock.
 *      (Default targetCoverDays = 14 días = 2 semanas de buffer.)
 *   5. Solo incluimos productos con sugerencia > 0.
 *
 * Devuelve JSON o CSV (?format=csv).
 */
export async function GET(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error) return error
  if (!can(session?.user?.role, "products:read")) {
    return NextResponse.json({ error: "Sin permisos para ver inventario" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const lookbackParam = parseInt(searchParams.get("lookbackDays") ?? "14", 10)
  const lookback = Number.isFinite(lookbackParam) && lookbackParam >= 7 ? Math.min(lookbackParam, 90) : 14
  const targetParam = parseInt(searchParams.get("targetDays") ?? "14", 10)
  const targetDays = Number.isFinite(targetParam) && targetParam >= 7 ? Math.min(targetParam, 60) : 14
  const format = searchParams.get("format") ?? "json"

  const since = new Date(Date.now() - lookback * 24 * 60 * 60 * 1000)

  const products = await db.product.findMany({
    where: { tenantId: tenantId!, active: true },
    select: {
      id: true,
      name: true,
      sku: true,
      stock: true,
      minStock: true,
      costPrice: true,
      category: { select: { name: true } },
      supplier: { select: { name: true } },
    },
  })

  // Sumar unidades vendidas en el período por producto.
  const itemsAgg = await db.saleItem.groupBy({
    by: ["productId"],
    where: {
      sale: {
        tenantId: tenantId!,
        status: "COMPLETED",
        createdAt: { gte: since },
      },
      productId: { in: products.map(p => p.id) },
    },
    _sum: { quantity: true },
  })
  const soldByProduct = new Map(
    itemsAgg.map(r => [r.productId, Number(r._sum.quantity ?? 0)])
  )

  type Suggestion = {
    id: string
    name: string
    sku: string | null
    category: string | null
    supplier: string | null
    stock: number
    soldLastNDays: number
    velocityPerDay: number
    daysOfCoverage: number | null
    suggestedQty: number
    estimatedCost: number
  }

  const suggestions: Suggestion[] = []
  for (const p of products) {
    const sold = soldByProduct.get(p.id) ?? 0
    if (sold === 0 && p.stock > p.minStock) continue
    const velocity = sold / lookback
    const coverage = velocity > 0 ? p.stock / velocity : null
    // Cantidad necesaria para cubrir targetDays + buffer mínimo.
    // Si no hay velocidad pero stock está bajo el mínimo, sugerimos mínimo.
    let suggested = 0
    if (velocity > 0) {
      suggested = Math.max(0, Math.ceil(velocity * targetDays - p.stock))
    } else if (p.stock < p.minStock) {
      suggested = p.minStock - p.stock
    }
    if (suggested <= 0) continue
    suggestions.push({
      id: p.id,
      name: p.name,
      sku: p.sku,
      category: p.category?.name ?? null,
      supplier: p.supplier?.name ?? null,
      stock: p.stock,
      soldLastNDays: sold,
      velocityPerDay: Math.round(velocity * 10) / 10,
      daysOfCoverage: coverage !== null ? Math.round(coverage * 10) / 10 : null,
      suggestedQty: suggested,
      estimatedCost: Math.round(Number(p.costPrice) * suggested),
    })
  }

  // Ordenamos por urgencia: primero los que tienen menos días de cobertura
  // (= se quedan sin stock antes), después por costo descendente.
  suggestions.sort((a, b) => {
    const ca = a.daysOfCoverage ?? -1
    const cb = b.daysOfCoverage ?? -1
    if (ca !== cb) return ca - cb
    return b.estimatedCost - a.estimatedCost
  })

  const totalCost = suggestions.reduce((acc, s) => acc + s.estimatedCost, 0)

  if (format === "csv") {
    const rows: (string | number)[][] = [
      [
        "Producto",
        "SKU",
        "Categoría",
        "Proveedor",
        "Stock actual",
        `Vendido ${lookback}d`,
        "Velocidad/día",
        "Días cobertura",
        "Cantidad sugerida",
        "Costo estimado ARS",
      ],
    ]
    for (const s of suggestions) {
      rows.push([
        s.name,
        s.sku ?? "",
        s.category ?? "",
        s.supplier ?? "",
        s.stock,
        s.soldLastNDays,
        s.velocityPerDay.toFixed(1).replace(".", ","),
        s.daysOfCoverage !== null ? s.daysOfCoverage.toFixed(1).replace(".", ",") : "—",
        s.suggestedQty,
        s.estimatedCost,
      ])
    }
    rows.push([])
    rows.push(["", "", "", "", "", "", "", "", "TOTAL ESTIMADO ARS", totalCost])
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")
    return new NextResponse("﻿" + csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="orvex-plan-compras-${targetDays}d.csv"`,
      },
    })
  }

  return NextResponse.json({
    lookbackDays: lookback,
    targetDays,
    totalProducts: suggestions.length,
    totalEstimatedCost: totalCost,
    items: suggestions,
  })
}
