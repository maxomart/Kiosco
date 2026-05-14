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
const DAY_LABELS_LONG = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"]
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
const HOURS = Array.from({ length: 24 }, (_, i) => i)

type Period = "this-week" | "last-week" | "30d" | "90d" | "custom"
type Metric = "count" | "total"

const PERIOD_OPTIONS: Array<{ value: Period; label: string }> = [
  { value: "this-week", label: "Esta semana" },
  { value: "last-week", label: "Semana pasada" },
  { value: "30d", label: "Últimos 30 días" },
  { value: "90d", label: "Últimos 90 días" },
]

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

/** Formatea pesos compactos: $44k, $1.2M, etc. */
function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`
  return `$${Math.round(n)}`
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
  const [metric, setMetric] = useState<Metric>("count")

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

  const cellMap = useMemo(() => {
    const m = new Map<string, Cell>()
    for (const c of cells) m.set(`${c.day}-${c.hour}`, c)
    return m
  }, [cells])

  const getValue = (c: Cell | undefined): number => {
    if (!c) return 0
    return metric === "count" ? c.count : c.total
  }

  const maxValue = useMemo(() => {
    if (cells.length === 0) return 1
    return Math.max(1, ...cells.map((c) => (metric === "count" ? c.count : c.total)))
  }, [cells, metric])

  // Solo mostrar horas con actividad (+/- 1)
  const { visibleHours, minHour, maxHour } = useMemo(() => {
    const activeHours = new Set(cells.filter((c) => c.count > 0).map((c) => c.hour))
    if (activeHours.size === 0) return { visibleHours: HOURS.slice(8, 23), minHour: 8, maxHour: 22 }
    const min = Math.max(0, Math.min(...activeHours) - 1)
    const max = Math.min(23, Math.max(...activeHours) + 1)
    return { visibleHours: HOURS.slice(min, max + 1), minHour: min, maxHour: max }
  }, [cells])

  // Pico (top 3) según métrica activa
  const topCells = useMemo(() => {
    return [...cells]
      .filter((c) => c.count > 0)
      .sort((a, b) => getValue(b) - getValue(a))
      .slice(0, 3)
  }, [cells, metric])

  // Mejor día (agregado por día de semana)
  const bestDay = useMemo(() => {
    if (cells.length === 0) return null
    const byDay = new Map<number, { count: number; total: number }>()
    for (const c of cells) {
      const prev = byDay.get(c.day) ?? { count: 0, total: 0 }
      byDay.set(c.day, { count: prev.count + c.count, total: prev.total + c.total })
    }
    let bestKey = -1
    let bestValue = 0
    for (const [day, agg] of byDay) {
      const v = metric === "count" ? agg.count : agg.total
      if (v > bestValue) {
        bestValue = v
        bestKey = day
      }
    }
    if (bestKey === -1) return null
    return { day: bestKey, ...byDay.get(bestKey)! }
  }, [cells, metric])

  // Mejor franja horaria (3h consecutivas con más actividad)
  const bestSlot = useMemo(() => {
    if (cells.length === 0) return null
    const byHour = new Array<{ count: number; total: number }>(24)
      .fill(null as never)
      .map(() => ({ count: 0, total: 0 }))
    for (const c of cells) {
      byHour[c.hour].count += c.count
      byHour[c.hour].total += c.total
    }
    let bestStart = -1
    let bestValue = 0
    for (let h = 0; h <= 21; h++) {
      const v =
        metric === "count"
          ? byHour[h].count + byHour[h + 1].count + byHour[h + 2].count
          : byHour[h].total + byHour[h + 1].total + byHour[h + 2].total
      if (v > bestValue) {
        bestValue = v
        bestStart = h
      }
    }
    if (bestStart === -1) return null
    return { start: bestStart, end: bestStart + 3, value: bestValue }
  }, [cells, metric])

  const totalSales = useMemo(() => cells.reduce((s, c) => s + c.count, 0), [cells])
  const totalRevenue = useMemo(() => cells.reduce((s, c) => s + c.total, 0), [cells])

  const getCellColor = (value: number): string => {
    if (value === 0) return "bg-gray-900/40 border-gray-800/40"
    const intensity = value / maxValue
    if (intensity > 0.66) return "bg-accent border-accent text-accent-foreground shadow-sm shadow-accent/30"
    if (intensity > 0.33) return "bg-accent/60 border-accent/60 text-accent-foreground"
    if (intensity > 0.1) return "bg-accent/30 border-accent/40 text-gray-100"
    return "bg-accent/10 border-accent/20 text-gray-400"
  }

  const peakCell = topCells[0] ?? null

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-100">
            Mapa de calor: ¿Cuándo vendés más?
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {range.label} ·{" "}
            <span className="text-gray-400">
              {totalSales.toLocaleString("es-AR")} ventas · ${totalRevenue.toLocaleString("es-AR")}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
          <span>Poco</span>
          <div className="w-3 h-3 rounded bg-accent/10 border border-accent/20" />
          <div className="w-3 h-3 rounded bg-accent/30 border border-accent/40" />
          <div className="w-3 h-3 rounded bg-accent/60 border border-accent/60" />
          <div className="w-3 h-3 rounded bg-accent border border-accent" />
          <span>Mucho</span>
        </div>
      </div>

      {/* Controles: período + métrica */}
      <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
        <div className="flex items-center gap-1 flex-wrap">
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
        <div className="inline-flex rounded-lg border border-gray-700 bg-gray-800 p-0.5">
          <button
            type="button"
            onClick={() => setMetric("count")}
            className={`px-2.5 py-1 text-[11px] rounded-md transition-colors ${
              metric === "count"
                ? "bg-accent text-accent-foreground font-medium"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Ventas
          </button>
          <button
            type="button"
            onClick={() => setMetric("total")}
            className={`px-2.5 py-1 text-[11px] rounded-md transition-colors ${
              metric === "total"
                ? "bg-accent text-accent-foreground font-medium"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Facturación
          </button>
        </div>
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
                      const value = getValue(c)
                      const isPeak = peakCell && peakCell.day === dayIdx && peakCell.hour === h
                      const display =
                        value === 0
                          ? ""
                          : metric === "count"
                            ? value.toString()
                            : fmtCompact(value)
                      return (
                        <td key={h} className="p-0.5">
                          <div
                            className={`w-7 h-6 rounded border ${getCellColor(value)} ${
                              isPeak
                                ? "ring-2 ring-amber-400/80 ring-offset-1 ring-offset-gray-900 z-10 relative"
                                : ""
                            } flex items-center justify-center transition-colors cursor-default`}
                            title={
                              c
                                ? `${DAY_LABELS_LONG[dayIdx]} ${h}:00 — ${c.count} ${c.count === 1 ? "venta" : "ventas"} · $${c.total.toLocaleString("es-AR")}`
                                : `${DAY_LABELS_LONG[dayIdx]} ${h}:00 — sin ventas`
                            }
                          >
                            {display && (
                              <span className="text-[8.5px] font-mono leading-none">{display}</span>
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

          {/* Insights */}
          <div className="mt-4 pt-4 border-t border-gray-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {bestDay && (
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-2.5">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">
                  Mejor día
                </div>
                <div className="text-sm font-medium text-gray-100 capitalize">
                  {DAY_LABELS_LONG[bestDay.day]}
                </div>
                <div className="text-[11px] text-gray-400">
                  {metric === "count"
                    ? `${bestDay.count} ventas`
                    : `$${bestDay.total.toLocaleString("es-AR")}`}
                </div>
              </div>
            )}
            {bestSlot && (
              <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-2.5">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">
                  Mejor franja
                </div>
                <div className="text-sm font-medium text-gray-100">
                  {bestSlot.start}:00 – {bestSlot.end}:00
                </div>
                <div className="text-[11px] text-gray-400">
                  {metric === "count"
                    ? `${bestSlot.value} ventas`
                    : `$${bestSlot.value.toLocaleString("es-AR")}`}
                </div>
              </div>
            )}
            {peakCell && (
              <div className="bg-amber-500/5 border border-amber-500/30 rounded-lg p-2.5">
                <div className="text-[10px] text-amber-400/80 uppercase tracking-wide mb-0.5 flex items-center gap-1">
                  <span>🏆</span> Hora pico
                </div>
                <div className="text-sm font-medium text-gray-100">
                  {DAY_LABELS[peakCell.day]} {peakCell.hour}:00
                </div>
                <div className="text-[11px] text-gray-400">
                  {peakCell.count} {peakCell.count === 1 ? "venta" : "ventas"} · $
                  {peakCell.total.toLocaleString("es-AR")}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
