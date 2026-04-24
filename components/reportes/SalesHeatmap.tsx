"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

interface Cell {
  day: number
  hour: number
  count: number
  total: number
}

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
// Re-order to start with Monday
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
const HOURS = Array.from({ length: 24 }, (_, i) => i)

export function SalesHeatmap({
  from,
  to,
}: {
  from: string
  to: string
}) {
  const [cells, setCells] = useState<Cell[]>([])
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
          setCells(data.heatmap ?? [])
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

  // Build a lookup
  const cellMap = new Map<string, Cell>()
  for (const c of cells) cellMap.set(`${c.day}-${c.hour}`, c)

  const maxTotal = Math.max(1, ...cells.map((c) => c.total))

  // Filter visible hours (only show range with activity, +/- 2)
  const activeHours = new Set(cells.filter((c) => c.count > 0).map((c) => c.hour))
  const minHour = activeHours.size > 0 ? Math.max(0, Math.min(...activeHours) - 1) : 8
  const maxHour = activeHours.size > 0 ? Math.min(23, Math.max(...activeHours) + 1) : 22
  const visibleHours = HOURS.slice(minHour, maxHour + 1)

  const getCellColor = (total: number): string => {
    if (total === 0) return "bg-gray-900/50 border-gray-800/50"
    const intensity = total / maxTotal
    if (intensity > 0.75) return "bg-accent border-accent text-accent-foreground"
    if (intensity > 0.5) return "bg-accent/70 border-accent/70 text-accent-foreground"
    if (intensity > 0.25) return "bg-accent/40 border-accent/40 text-gray-100"
    return "bg-accent/15 border-accent/20 text-gray-300"
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-100">
            Mapa de calor: ¿Cuándo vendés más?
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Días de la semana × hora del día. Cuanto más oscuro, más vendiste.
          </p>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-gray-500">
          <span>Menos</span>
          <div className="w-3 h-3 rounded bg-accent/15" />
          <div className="w-3 h-3 rounded bg-accent/40" />
          <div className="w-3 h-3 rounded bg-accent/70" />
          <div className="w-3 h-3 rounded bg-accent" />
          <span>Más</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-accent animate-spin" />
        </div>
      ) : cells.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">
          Sin datos suficientes para mostrar el mapa.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="text-[10px]">
            <thead>
              <tr>
                <th className="w-10"></th>
                {visibleHours.map((h) => (
                  <th key={h} className="px-1 py-1 text-gray-500 font-mono w-7 text-center">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAY_ORDER.map((dayIdx) => (
                <tr key={dayIdx}>
                  <td className="pr-2 text-gray-400 font-medium text-right">
                    {DAY_LABELS[dayIdx]}
                  </td>
                  {visibleHours.map((h) => {
                    const c = cellMap.get(`${dayIdx}-${h}`)
                    const total = c?.total ?? 0
                    const count = c?.count ?? 0
                    return (
                      <td key={h} className="p-0.5">
                        <div
                          className={`w-7 h-6 rounded border ${getCellColor(total)} flex items-center justify-center transition-colors group cursor-default relative`}
                          title={`${DAY_LABELS[dayIdx]} ${h}:00 · ${count} ventas · $ ${total.toLocaleString("es-AR")}`}
                        >
                          {count > 0 && (
                            <span className="text-[9px] font-mono">{count}</span>
                          )}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
