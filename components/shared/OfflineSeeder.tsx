"use client"

import { useEffect } from "react"
import { cacheProducts, getMeta, type CachedProduct } from "@/lib/offline-store"

/**
 * OfflineSeeder — pre-carga el catálogo del tenant en IndexedDB al
 * primer mount del dashboard, y lo refresca cada 6h (y cuando vuelve
 * online si hay productos pendientes en cola).
 *
 * Sin esto el POS depende del cache HTTP del Service Worker, que el
 * browser puede limpiar agresivamente. Con esto, una vez que el
 * cajero carga el catálogo en su sesión, lo tiene 100% accesible
 * offline aunque borre el cache del browser.
 *
 * No renderiza nada — es un componente "side-effect-only" que se
 * monta en el dashboard layout.
 */

const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000 // 6 horas
const META_KEY = "products-last-seed-at"

export function OfflineSeeder() {
  useEffect(() => {
    if (typeof window === "undefined") return
    let cancelled = false

    const seed = async (force = false) => {
      try {
        if (!navigator.onLine) return
        // ¿Ya seedeamos hace poco? No re-pegamos al server.
        if (!force) {
          const last = await getMeta<number>(META_KEY)
          if (last && Date.now() - last < REFRESH_INTERVAL_MS) return
        }
        // Trae todos los productos activos del tenant. La paginación de
        // /api/productos por default usa pageSize alto, alcanza para 1500
        // (Plan Básico). Si crece a 5K (Pro) usamos cursor o stream.
        const res = await fetch("/api/productos?activo=true&pageSize=5000", {
          cache: "no-store",
        })
        if (!res.ok || cancelled) return
        const data = await res.json()
        const products: CachedProduct[] = (data.products ?? data.items ?? []).map((p: any) => ({
          id: p.id,
          name: p.name,
          barcode: p.barcode ?? null,
          sku: p.sku ?? null,
          salePrice: Number(p.salePrice ?? 0),
          costPrice: Number(p.costPrice ?? 0),
          stock: Number(p.stock ?? 0),
          minStock: Number(p.minStock ?? 5),
          soldByWeight: !!p.soldByWeight,
          taxRate: p.taxRate ?? undefined,
          category: p.category ? { name: p.category.name } : null,
        }))
        if (cancelled || products.length === 0) return
        await cacheProducts(products)
      } catch {
        // Sin sesión / 401 / 403 — silencioso, no bloqueamos el dashboard.
      }
    }

    // Seed inicial (lazy: 2s después del mount para no competir con el
    // first paint del dashboard, que es lo que el user ve primero).
    const initialTimer = setTimeout(() => seed(false), 2000)

    // Refresco al recuperar conexión (después de offline) — útil para
    // cuando el cajero volvió de un corte y queremos asegurar que el
    // catálogo local esté al día.
    const onOnline = () => seed(true)
    window.addEventListener("online", onOnline)

    return () => {
      cancelled = true
      clearTimeout(initialTimer)
      window.removeEventListener("online", onOnline)
    }
  }, [])

  return null
}
