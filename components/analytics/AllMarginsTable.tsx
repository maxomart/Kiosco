"use client"

import { useState, useMemo } from "react"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import type { ProductMarginAnalysis } from "@/types"
import { Search, ChevronDown, ChevronUp } from "lucide-react"

interface AllMarginsTableProps {
  products: ProductMarginAnalysis[]
}

type Filter = "ALL" | "HIGH" | "MEDIUM" | "LOW" | "DEAD"

export function AllMarginsTable({ products }: AllMarginsTableProps) {
  const [expanded, setExpanded] = useState(false)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<Filter>("ALL")

  const counts = useMemo(() => {
    const c = { ALL: products.length, HIGH: 0, MEDIUM: 0, LOW: 0, DEAD: 0 }
    for (const p of products) c[p.healthStatus]++
    return c
  }, [products])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter((p) => {
      if (filter !== "ALL" && p.healthStatus !== filter) return false
      if (q && !p.productName.toLowerCase().includes(q)) return false
      return true
    })
  }, [products, search, filter])

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "HIGH":
        return "bg-emerald-900/40 text-emerald-300 border-emerald-700/50"
      case "MEDIUM":
        return "bg-amber-900/40 text-amber-300 border-amber-700/50"
      case "LOW":
        return "bg-orange-900/40 text-orange-300 border-orange-700/50"
      case "DEAD":
        return "bg-red-900/40 text-red-300 border-red-700/50"
      default:
        return "bg-gray-800 text-gray-400 border-gray-700"
    }
  }

  const getMarginColor = (margin: number) => {
    if (margin >= 25) return "text-emerald-400"
    if (margin >= 15) return "text-amber-400"
    return "text-red-400"
  }

  return (
    <Card padding="md">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full gap-4 text-left"
      >
        <div className="min-w-0">
          <p className="font-semibold text-gray-100">
            Ver todos los productos
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {products.length} productos · tabla compacta con búsqueda y filtros
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="mt-5 space-y-4">
          {/* Search + Filters */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar producto..."
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <FilterPill
                active={filter === "ALL"}
                onClick={() => setFilter("ALL")}
                label="Todos"
                count={counts.ALL}
              />
              <FilterPill
                active={filter === "HIGH"}
                onClick={() => setFilter("HIGH")}
                label="HIGH"
                count={counts.HIGH}
                variant="emerald"
              />
              <FilterPill
                active={filter === "MEDIUM"}
                onClick={() => setFilter("MEDIUM")}
                label="MEDIUM"
                count={counts.MEDIUM}
                variant="amber"
              />
              <FilterPill
                active={filter === "LOW"}
                onClick={() => setFilter("LOW")}
                label="LOW"
                count={counts.LOW}
                variant="orange"
              />
              <FilterPill
                active={filter === "DEAD"}
                onClick={() => setFilter("DEAD")}
                label="DEAD"
                count={counts.DEAD}
                variant="red"
              />
            </div>
          </div>

          {/* Tabla */}
          <div className="overflow-x-auto -mx-5">
            <div className="min-w-full inline-block align-middle px-5">
              <div className="overflow-hidden border border-gray-800 rounded-lg">
                <table className="min-w-full divide-y divide-gray-800 text-sm">
                  <thead className="bg-gray-900/50">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-medium text-gray-400 text-xs uppercase tracking-wider">
                        Producto
                      </th>
                      <th className="px-4 py-2.5 text-right font-medium text-gray-400 text-xs uppercase tracking-wider">
                        Margen
                      </th>
                      <th className="px-4 py-2.5 text-right font-medium text-gray-400 text-xs uppercase tracking-wider hidden md:table-cell">
                        Stock
                      </th>
                      <th className="px-4 py-2.5 text-right font-medium text-gray-400 text-xs uppercase tracking-wider hidden md:table-cell">
                        Vend. 30d
                      </th>
                      <th className="px-4 py-2.5 text-right font-medium text-gray-400 text-xs uppercase tracking-wider hidden lg:table-cell">
                        /día
                      </th>
                      <th className="px-4 py-2.5 text-center font-medium text-gray-400 text-xs uppercase tracking-wider">
                        Estado
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800 bg-gray-950/30">
                    {filtered.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-8 text-center text-gray-500"
                        >
                          Sin resultados
                        </td>
                      </tr>
                    ) : (
                      filtered.map((p) => (
                        <tr
                          key={p.productId}
                          className="hover:bg-gray-900/50 transition-colors"
                        >
                          <td className="px-4 py-2.5 text-gray-100 font-medium truncate max-w-[200px]">
                            {p.productName}
                          </td>
                          <td
                            className={`px-4 py-2.5 text-right font-semibold ${getMarginColor(
                              p.currentMarginPct
                            )}`}
                          >
                            {p.currentMarginPct.toFixed(1)}%
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-300 hidden md:table-cell">
                            {p.currentStock}
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-300 hidden md:table-cell">
                            {p.salesQuantity30d}
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-400 hidden lg:table-cell">
                            {p.avgDailySales.toFixed(1)}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusStyle(
                                p.healthStatus
                              )}`}
                            >
                              {p.healthStatus}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {filtered.length > 0 && (
            <p className="text-xs text-gray-500 text-center">
              Mostrando {filtered.length} de {products.length} productos
            </p>
          )}
        </div>
      )}
    </Card>
  )
}

function FilterPill({
  active,
  onClick,
  label,
  count,
  variant,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
  variant?: "emerald" | "amber" | "orange" | "red"
}) {
  const activeClasses = {
    emerald: "bg-emerald-900/50 text-emerald-300 border-emerald-700",
    amber: "bg-amber-900/50 text-amber-300 border-amber-700",
    orange: "bg-orange-900/50 text-orange-300 border-orange-700",
    red: "bg-red-900/50 text-red-300 border-red-700",
  }

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
        active
          ? variant
            ? activeClasses[variant]
            : "bg-accent-soft border-accent/50 text-accent"
          : "bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-700"
      }`}
    >
      {label}
      <span className="text-[10px] opacity-70">({count})</span>
    </button>
  )
}
