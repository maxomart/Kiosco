"use client"

import { useEffect, useState } from "react"
import { Tag, TrendingUp, Loader2 } from "lucide-react"

interface CategoryRow {
  name: string
  revenue: number
  profit: number
  qty: number
  marginPct: number
}

interface ProductRow {
  name: string
  revenue: number
  profit: number
  qty: number
  marginPct: number
}

export function TopCategoriesPanel({ from, to }: { from: string; to: string }) {
  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [topByMargin, setTopByMargin] = useState<ProductRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ from, to })
        const res = await fetch(`/api/reportes/insights?${params}`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          setCategories(data.topCategories ?? [])
          setTopByMargin(data.topByMargin ?? [])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [from, to])

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 text-accent animate-spin" />
          </div>
        ))}
      </div>
    )
  }

  const maxCatRevenue = Math.max(1, ...categories.map((c) => c.revenue))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Top Categories */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-sky-900/40 flex items-center justify-center">
            <Tag className="w-4 h-4 text-sky-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-100">Top categorías</h3>
            <p className="text-[11px] text-gray-500">Por ingresos</p>
          </div>
        </div>
        {categories.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">Sin ventas en este período</p>
        ) : (
          <div className="space-y-2">
            {categories.slice(0, 7).map((c) => {
              const pct = (c.revenue / maxCatRevenue) * 100
              return (
                <div key={c.name}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-200 truncate max-w-[200px]">{c.name}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`font-medium ${c.marginPct >= 25 ? "text-emerald-400" : c.marginPct >= 15 ? "text-amber-400" : "text-red-400"}`}>
                        {c.marginPct.toFixed(0)}%
                      </span>
                      <span className="text-gray-300 font-semibold">$ {c.revenue.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-sky-600 to-sky-400 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Top by margin */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-emerald-900/40 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-100">Más rentables</h3>
            <p className="text-[11px] text-gray-500">Mayor ganancia neta del período</p>
          </div>
        </div>
        {topByMargin.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">Sin datos suficientes</p>
        ) : (
          <div className="space-y-2">
            {topByMargin.map((p, i) => (
              <div key={p.name} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800/40 transition-colors">
                <span className="w-5 h-5 rounded bg-emerald-900/40 text-emerald-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-100 truncate">{p.name}</p>
                  <p className="text-[10px] text-gray-500">
                    {p.qty} unid. · margen {p.marginPct.toFixed(0)}%
                  </p>
                </div>
                <p className="text-sm font-semibold text-emerald-300 flex-shrink-0">
                  +$ {p.profit.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
