"use client"

import { useEffect, useMemo, useState } from "react"
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

type Period = "this-week" | "last-week" | "30d" | "90d" | "custom"

const PERIOD_OPTIONS: Array<{ value: Period; label: string }> = [
  { value: "this-week", label: "Esta semana" },
  { value: "last-week", label: "Semana pasada" },
  { value: "30d", label: "Últimos 30 días" },
  { value: "90d", label: "Últimos 90 días" },
]

/**
 * Calcula el rango de fechas para un period (lunes-domingo en AR/ES).
 * Devuelve ISO strings tal cual los espera el endpoint de insights.
 */
function getPeriodRange(p: Period, fallbackFrom: string, fallbackTo: string): {
  from: string
  to: string
  label: string
} {
  if (p === "custom") {
    return { from: fallbackFrom, to: fallbackTo, label: "Período personalizado" }
  }
  const now = new Date()
  const fmtRange = (a: Date, b: Date) =>
    `${a.toLocaleDateString("es-AR", { day: "numeric", month: "short" })} – ${b.toLocaleDateString("es-AR", { day: "numeric", month: "short" })}`

  if (p === "this-week" || p === "last-week") {
    // Lunes = primer día. JS Sunday = 0; conversión: (day + 6) % 7
    const dayOfWeek = (now.getDay() + 6) % 7
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - dayOfWeek)
    weekStart.setHours(0, 0, 0, 0)
    if (p === "last-week") {
      weekStart.setDate(weekStart.getDate() - 7)
    }
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)
    return {
      from: weekStart.toISOString(),
      to: weekEnd.toISOString(),
      label: `${p === "this-week" ? "Esta semana" : "Semana pasada"} · ${fmtRange(weekStart, weekEnd)}`,
    }
  }
  // 30d / 90d
  const days = p === "30d" ? 30 : 90
  const start = new Date(now)
  start.setDate(now.getDate() - days + 1)
  start.setHours(0, 0, 0, 0)
  return {
    from: start.toISOString(),
    to: now.toISOString(),
    label: `Últimos ${days} días · ${fmtRange(start, now)}`,
  }
}

export function SalesHeatmap({
  from,
  to,
}: {
  from: string
  to: string
}) {
  const [cells, setCells] = useState<Cell[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>("30d")

  const range = useMemo(() => getPeriodRange(period, from, to), [period, from, to])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ from: range.from, to: range.to })
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
  }, [range.from, range.to])

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

  // Pico del período: día + hora con más ventas (para destacar abajo)
  const peakCell = cells.reduce<Cell | null>((best, c) => {
    if (!best || c.total > best.total) return c
    return best
  }, null)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-100">
            Mapa de calor: ¿Cuándo vendés más?
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">{range.label}</p>
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

      {/* Selector de período */}
      <div className="flex items-center gap-1 flex-wrap mb-4">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setPeriod(opt.value)}
            className={`px-2.5 py-1 text-[11px] rounded-lg border transition-colors ${
              period === opt.value
                ? "bg-accent/20 border-accent/50 text-accent-foreground"
                : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-600"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-accent animate-spin" />
        </div>
      ) : cells.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">
          Sin ventas en este período. Probá otro rango.
        </div>
      ) : (
        <>
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
                      const isPeak =
                        peakCell && peakCell.day === dayIdx && peakCell.hour === h
                      return (
                        <td key={h} className="p-0.5">
                          <div
                            className={`w-7 h-6 rounded border ${getCellColor(total)} ${
                              isPeak ? "ring-2 ring-accent/60 ring-offset-1 ring-offset-gray-900" : ""
                            } flex items-center justify-center transition-colors group cursor-default relative`}
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

          {peakCell && peakCell.total > 0 && (
            <p className="text-[11px] text-gray-500 mt-3">
              🏆 Pico:{" "}
              <span className="text-accent font-medium">
                {DAY_LABELS[peakCell.day]} {peakCell.hour}:00
              </span>{" "}
              · {peakCell.count} ventas · ${peakCell.total.toLocaleString("es-AR")}
            </p>
          )}
        </>
      )}
    </div>
  )
}
