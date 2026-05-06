import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { lookupKnownBrand } from "@/lib/known-brands-ar"

export const dynamic = "force-dynamic"

/**
 * Sugerencias de productos basadas en el catálogo agregado de TODOS los
 * kioscos de Orvex. Es el efecto red: cuando un kiosquero nuevo carga
 * productos, le sugerimos opciones que ya cargaron 5+ kioscos antes —
 * con el precio promedio del mercado y la categoría más común.
 *
 * Privacidad:
 *   - Solo agregamos productos que aparecen en >= MIN_TENANTS (default 3)
 *     tenants distintos. Sino estaríamos revelando data de un kiosco
 *     puntual con su precio exacto.
 *   - Excluimos al tenant actual del agregado (sino se ve a sí mismo).
 *   - Solo devolvemos rangos / promedios, nunca precios de un kiosco.
 *
 * Resultado: si 47 kioscos cargaron "Coca-Cola 2.25L" entre $2.300 y
 * $2.600, le mostramos "Coca-Cola 2.25L · 47 kioscos · ~$2.450" para
 * que el nuevo arranque con ese baseline en lugar de tipear todo.
 *
 * Fallback: si la query no matchea suficientes tenants, miramos el
 * catálogo curado `lib/known-brands-ar.ts` para sugerir al menos
 * categoría/proveedor.
 */

const MIN_TENANTS = 3
const MAX_RESULTS = 6

interface Suggestion {
  name: string
  barcode: string | null
  category: string | null
  supplier: string | null
  /** Precio sugerido (mediana entre todos los kioscos). */
  suggestedSalePrice: number | null
  /** Costo sugerido si hay datos. */
  suggestedCostPrice: number | null
  /** Cuántos kioscos lo tienen cargado. */
  tenantCount: number
  /** Origen de la sugerencia: "comunidad" o "catalogo-curado". */
  source: "comunidad" | "catalogo-curado"
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function median(numbers: number[]): number {
  if (numbers.length === 0) return 0
  const sorted = [...numbers].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export async function GET(req: NextRequest) {
  // El autocomplete de inventario lo queremos disponible para TODOS los
  // planes y todos los roles (incluso CASHIER) — sino el cajero tipea un
  // producto nuevo y no recibe ayuda del catálogo. Con sesión cualquiera
  // ve sugerencias agregadas (no expone data específica de un kiosco).
  const session = await auth()
  if (!session) return NextResponse.json({ suggestions: [] })

  const tenantId = session.user.tenantId ?? null

  const { searchParams } = new URL(req.url)
  const rawQ = (searchParams.get("q") ?? "").trim()
  if (rawQ.length < 2) return NextResponse.json({ suggestions: [] })

  const q = normalize(rawQ)
  const isBarcode = /^\d{8,14}$/.test(rawQ)

  // 1) Buscamos productos en otros tenants que matcheen el query.
  //    Para ser eficientes traemos ~300 candidatos y agregamos en JS.
  //    Si la app crece a 100K productos esto va a doler — ahí migramos
  //    a una vista materializada actualizada por job nocturno.
  //    Si el user es SUPER_ADMIN sin tenant, "tenantId not in nada" =
  //    todos los productos (no auto-filtrado, está OK para admin).
  const candidates = await db.product.findMany({
    where: {
      ...(tenantId ? { tenantId: { not: tenantId } } : {}),
      active: true,
      ...(isBarcode
        ? { barcode: rawQ }
        : { name: { contains: rawQ, mode: "insensitive" } }),
    },
    select: {
      name: true,
      barcode: true,
      salePrice: true,
      costPrice: true,
      tenantId: true,
      category: { select: { name: true } },
      supplier: { select: { name: true } },
    },
    take: 300,
  })

  // 2) Agrupamos por barcode (si existe) o por nombre normalizado.
  type Bucket = {
    name: string
    barcode: string | null
    tenantIds: Set<string>
    salePrices: number[]
    costPrices: number[]
    categories: Map<string, number>
    suppliers: Map<string, number>
  }
  const buckets = new Map<string, Bucket>()

  for (const p of candidates) {
    const key = p.barcode ? `b:${p.barcode}` : `n:${normalize(p.name)}`
    if (!buckets.has(key)) {
      buckets.set(key, {
        name: p.name,
        barcode: p.barcode,
        tenantIds: new Set(),
        salePrices: [],
        costPrices: [],
        categories: new Map(),
        suppliers: new Map(),
      })
    }
    const b = buckets.get(key)!
    b.tenantIds.add(p.tenantId)
    const sale = Number(p.salePrice)
    const cost = Number(p.costPrice)
    if (sale > 0) b.salePrices.push(sale)
    if (cost > 0) b.costPrices.push(cost)
    if (p.category?.name) b.categories.set(p.category.name, (b.categories.get(p.category.name) ?? 0) + 1)
    if (p.supplier?.name) b.suppliers.set(p.supplier.name, (b.suppliers.get(p.supplier.name) ?? 0) + 1)
  }

  // 3) Filtramos por privacidad y armamos resultado.
  const fromCommunity: Suggestion[] = []
  for (const b of buckets.values()) {
    if (b.tenantIds.size < MIN_TENANTS) continue
    const topCategory = [...b.categories.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    const topSupplier = [...b.suppliers.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    fromCommunity.push({
      name: b.name,
      barcode: b.barcode,
      category: topCategory,
      supplier: topSupplier,
      suggestedSalePrice: b.salePrices.length > 0 ? Math.round(median(b.salePrices)) : null,
      suggestedCostPrice: b.costPrices.length > 0 ? Math.round(median(b.costPrices)) : null,
      tenantCount: b.tenantIds.size,
      source: "comunidad",
    })
  }
  fromCommunity.sort((a, b) => b.tenantCount - a.tenantCount)

  // 4) Si no llegamos a MAX_RESULTS, complementamos con el catálogo
  //    curado de marcas argentinas (categoría + proveedor sugeridos).
  const result: Suggestion[] = fromCommunity.slice(0, MAX_RESULTS)
  if (result.length < MAX_RESULTS) {
    const known = lookupKnownBrand(rawQ)
    if (known) {
      // Evitamos duplicar si ya tenemos algo del mismo proveedor/marca
      // dentro de los resultados de la comunidad.
      const dup = result.some(r => r.supplier === known.supplier)
      if (!dup) {
        result.push({
          name: rawQ.charAt(0).toUpperCase() + rawQ.slice(1),
          barcode: null,
          category: known.category ?? null,
          supplier: known.supplier,
          suggestedSalePrice: null,
          suggestedCostPrice: null,
          tenantCount: 0,
          source: "catalogo-curado",
        })
      }
    }
  }

  return NextResponse.json({ suggestions: result })
}
