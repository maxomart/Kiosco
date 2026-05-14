"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, Clock, Calendar, TrendingUp } from "lucide-react"

interface Cell {
  day: number
  hour: number
  count: number
  total: number
}

interface DayBreakdownEntry {
  day: number
  date: string // yyyy-mm-dd
  count: number
  total: number
}

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
const DAY_LABELS_LONG = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

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

function fmtMoney(n: number): string {
  return `$${n.toLocaleString("es-AR")}`
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`
  return `$${Math.round(n)}`
}

/** "2026-05-11" → "11 may" en es-AR */
function fmtShortDate(yyyymmdd: string): string {
  const [y, m, d] = yyyymmdd.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString("es-AR", { day: "numeric", month: "short" })
}

export function SalesHeatmap({
  from,
  to,
}: {
  from: string
  to: string
}) {
  const [cells, setCells] = useState<Cell[]>([])
  const [dayBreakdown, setDayBreakdown] = useState<DayBreakdownEntry[]>([])
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
          setDayBreakdown(data.dayBreakdown ?? [])
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

  // Agregado por hora (0-23)
  const byHour = useMemo(() => {
    const arr = Array.from({ length: 24 }, () => ({ count: 0, total: 0 }))
    for (const c of cells) {
      arr[c.hour].count += c.count
      arr[c.hour].total += c.total
    }
    return arr
  }, [cells])

  // Agrupar dayBreakdown por día de la semana
  const byDayOfWeek = useMemo(() => {
    const map = new Map<number, DayBreakdownEntry[]>()
    for (const e of dayBreakdown) {
      const list = map.get(e.day) ?? []
      list.push(e)
      map.set(e.day, list)
    }
    return map
  }, [dayBreakdown])

  // Totales y promedios por día de la semana
  const dayStats = useMemo(() => {
    const out = new Map<
      number,
      { total: number; count: number; weeks: number; avgCount: number; avgTotal: number }
    >()
    for (let d = 0; d < 7; d++) {
      const entries = byDayOfWeek.get(d) ?? []
      const count = entries.reduce((s, e) => s + e.count, 0)
      const total = entries.reduce((s, e) => s + e.total, 0)
      const weeks = entries.length
      out.set(d, {
        count,
        total,
        weeks,
        avgCount: weeks > 0 ? count / weeks : 0,
        avgTotal: weeks > 0 ? total / weeks : 0,
      })
    }
    return out
  }, [byDayOfWeek])

  const getValue = (d: { count: number; total: number }): number =>
    metric === "count" ? d.count : d.total

  // Rango horario activo con padding
  const { hourStart, hourEnd } = useMemo(() => {
    const activeHours = byHour
      .map((h, idx) => ({ idx, active: h.count > 0 }))
      .filter((x) => x.active)
      .map((x) => x.idx)
    if (activeHours.length === 0) return { hourStart: 8, hourEnd: 22 }
    return {
      hourStart: Math.max(0, Math.min(...activeHours) - 1),
      hourEnd: Math.min(23, Math.max(...activeHours) + 1),
    }
  }, [byHour])

  const maxHourValue = useMemo(
    () => Math.max(1, ...byHour.map(getValue)),
    [byHour, metric]
  )

  // Para los días: usamos el PROMEDIO (por semana) como métrica principal
  // así "Lun" representa "lo que vendés en un lunes típico"
  const maxDayAvg = useMemo(() => {
    let max = 1
    for (const d of dayStats.values()) {
      const v = metric === "count" ? d.avgCount : d.avgTotal
      if (v > max) max = v
    }
    return max
  }, [dayStats, metric])

  // Pico de hora
  const peakHour = useMemo(() => {
    let bestIdx = -1
    let bestVal = 0
    byHour.forEach((h, idx) => {
      const v = getValue(h)
      if (v > bestVal) {
        bestVal = v
        bestIdx = idx
      }
    })
    if (bestIdx === -1) return null
    return { hour: bestIdx, ...byHour[bestIdx] }
  }, [byHour, metric])

  // Mejor día (por promedio)
  const bestDay = useMemo(() => {
    let bestIdx = -1
    let bestVal = 0
    for (const [day, s] of dayStats) {
      const v = metric === "count" ? s.avgCount : s.avgTotal
      if (v > bestVal) {
        bestVal = v
        bestIdx = day
      }
    }
    if (bestIdx === -1) return null
    return { day: bestIdx, ...dayStats.get(bestIdx)! }
  }, [dayStats, metric])

  // Mejor franja de 3h
  const bestSlot = useMemo(() => {
    let bestStart = -1
    let bestVal = 0
    for (let h = 0; h <= 21; h++) {
      const v = getValue(byHour[h]) + getValue(byHour[h + 1]) + getValue(byHour[h + 2])
      if (v > bestVal) {
        bestVal = v
        bestStart = h
      }
    }
    if (bestStart === -1) return null
    return { start: bestStart, end: bestStart + 3, value: bestVal }
  }, [byHour, metric])

  // Max value across individual day breakdowns (para las mini-sparklines)
  const maxBreakdownValue = useMemo(() => {
    return Math.max(1, ...dayBreakdown.map(getValue))
  }, [dayBreakdown, metric])

  const totalSales = useMemo(() => cells.reduce((s, c) => s + c.count, 0), [cells])
  const totalRevenue = useMemo(() => cells.reduce((s, c) => s + c.total, 0), [cells])

  const visibleHours = Array.from(
    { length: hourEnd - hourStart + 1 },
    (_, i) => i + hourStart
  )
  const hasData = cells.length > 0

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-100">
            ¿Cuándo vendés más?
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {range.label}
            {hasData && (
              <>
                {" · "}
                <span className="text-gray-400">
                  {totalSales.toLocaleString("es-AR")} ventas · {fmtMoney(totalRevenue)}
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Controles */}
      <div className="flex items-center justify-between gap-2 flex-wrap mb-5">
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
            Por ventas
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
            Por facturación
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-accent animate-spin" />
        </div>
      ) : !hasData ? (
        <div className="text-center py-16 text-gray-500 text-sm">
          Sin ventas en este período. Probá otro rango.
        </div>
      ) : (
        <>
          {/* Insights destacados */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-6">
            {peakHour && (
              <div className="bg-amber-500/5 border border-amber-500/30 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-[10px] text-amber-400/90 uppercase tracking-wide mb-1">
                  <Clock className="w-3 h-3" /> Hora pico
                </div>
                <div className="text-lg font-semibold text-gray-100 tabular-nums">
                  {peakHour.hour}:00 – {peakHour.hour + 1}:00
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">
                  {metric === "count"
                    ? `${peakHour.count} ventas en total`
                    : `${fmtMoney(peakHour.total)} facturados`}
                </div>
              </div>
            )}
            {bestDay && (
              <div className="bg-accent/5 border border-accent/30 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-[10px] text-accent uppercase tracking-wide mb-1">
                  <Calendar className="w-3 h-3" /> Mejor día
                </div>
                <div className="text-lg font-semibold text-gray-100">
                  {DAY_LABELS_LONG[bestDay.day]}
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">
                  Promedio:{" "}
                  {metric === "count"
                    ? `${bestDay.avgCount.toFixed(1)} ventas/día`
                    : fmtMoney(Math.round(bestDay.avgTotal))}
                </div>
              </div>
            )}
            {bestSlot && (
              <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-400/90 uppercase tracking-wide mb-1">
                  <TrendingUp className="w-3 h-3" /> Franja más activa
                </div>
                <div className="text-lg font-semibold text-gray-100 tabular-nums">
                  {bestSlot.start}:00 – {bestSlot.end}:00
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">
                  {metric === "count"
                    ? `${bestSlot.value} ventas en 3 horas`
                    : `${fmtMoney(bestSlot.value)} en 3 horas`}
                </div>
              </div>
            )}
          </div>

          {/* Gráfico 1: Por hora del día */}
          <div className="mb-7">
            <div className="flex items-baseline justify-between mb-3">
              <h4 className="text-xs font-semibold text-gray-200">Por hora del día</h4>
              <span className="text-[10px] text-gray-500">
                {hourStart}:00 – {hourEnd + 1}:00
              </span>
            </div>
            <div className="flex items-end gap-[3px] h-32 px-1">
              {visibleHours.map((h) => {
                const value = getValue(byHour[h])
                const heightPct = (value / maxHourValue) * 100
                const isPeak = peakHour?.hour === h
                const isBestSlot =
                  bestSlot && h >= bestSlot.start && h < bestSlot.end
                return (
                  <div
                    key={h}
                    className="flex-1 flex flex-col items-center justify-end h-full group cursor-default min-w-0"
                    title={`${h}:00 – ${h + 1}:00 · ${byHour[h].count} ventas · ${fmtMoney(byHour[h].total)}`}
                  >
                    {value > 0 && (
                      <span className="text-[9px] text-gray-400 font-mono mb-0.5 group-hover:text-white transition-colors tabular-nums">
                        {metric === "count" ? value : fmtCompact(value)}
                      </span>
                    )}
                    <div
                      className={`w-full rounded-t transition-all ${
                        value === 0
                          ? "bg-gray-800/40"
                          : isPeak
                            ? "bg-amber-400 group-hover:bg-amber-300"
                            : isBestSlot
                              ? "bg-accent group-hover:bg-accent/90"
                              : "bg-accent/40 group-hover:bg-accent/70"
                      }`}
                      style={{ height: `${Math.max(value === 0 ? 2 : 4, heightPct)}%` }}
                    />
                  </div>
                )
              })}
            </div>
            <div className="flex gap-[3px] mt-1.5 px-1">
              {visibleHours.map((h) => (
                <div
                  key={h}
                  className="flex-1 text-center text-[9px] text-gray-500 font-mono tabular-nums min-w-0"
                >
                  {h % 2 === 0 || visibleHours.length <= 12 ? h : ""}
                </div>
              ))}
            </div>
          </div>

          {/* Gráfico 2: Por día de la semana — promedio + sparkline semanal */}
          <div>
            <div className="flex items-baseline justify-between mb-3">
              <h4 className="text-xs font-semibold text-gray-200">Por día de la semana</h4>
              <span className="text-[10px] text-gray-500">
                Promedio por día · {metric === "count" ? "ventas" : "facturación"}
              </span>
            </div>
            <div className="space-y-2.5">
              {DAY_ORDER.map((dayIdx) => {
                const stats = dayStats.get(dayIdx)!
                const avgValue = metric === "count" ? stats.avgCount : stats.avgTotal
                const totalValue = metric === "count" ? stats.count : stats.total
                const widthPct = (avgValue / maxDayAvg) * 100
                const isBest = bestDay?.day === dayIdx
                const entries = byDayOfWeek.get(dayIdx) ?? []

                return (
                  <div key={dayIdx} className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3">
                    <div className="text-[11px] text-gray-400 font-medium text-right">
                      {DAY_LABELS[dayIdx]}
                    </div>

                    {/* Barra de promedio + sparkline de semanas individuales encima */}
                    <div className="space-y-1.5">
                      {/* Sparkline: una barrita por cada lunes/martes/etc del período */}
                      {entries.length > 0 ? (
                        <div className="flex items-end gap-0.5 h-5">
                          {entries.map((e) => {
                            const v = getValue(e)
                            const hPct = (v / maxBreakdownValue) * 100
                            return (
                              <div
                                key={e.date}
                                className={`flex-1 min-w-[3px] max-w-[14px] rounded-sm transition-colors ${
                                  isBest ? "bg-accent/70 hover:bg-accent" : "bg-gray-700 hover:bg-gray-600"
                                }`}
                                style={{ height: `${Math.max(8, hPct)}%` }}
                                title={`${fmtShortDate(e.date)} · ${e.count} ${e.count === 1 ? "venta" : "ventas"} · ${fmtMoney(e.total)}`}
                              />
                            )
                          })}
                        </div>
                      ) : (
                        <div className="h-5 flex items-center text-[10px] text-gray-600">
                          Sin datos
                        </div>
                      )}

                      {/* Barra principal con el promedio */}
                      <div className="bg-gray-800/40 rounded h-3 overflow-hidden relative">
                        <div
                          className={`h-full rounded transition-all ${
                            avgValue === 0
                              ? ""
                              : isBest
                                ? "bg-accent"
                                : "bg-accent/40"
                          }`}
                          style={{ width: `${Math.max(avgValue === 0 ? 0 : 3, widthPct)}%` }}
                        />
                      </div>
                    </div>

                    {/* Promedio + total a la derecha */}
                    <div className="text-right min-w-[7rem]">
                      <div className={`text-xs font-medium tabular-nums ${isBest ? "text-accent" : "text-gray-200"}`}>
                        {metric === "count"
                          ? `${avgValue.toFixed(1)} prom.`
                          : `${fmtCompact(avgValue)} prom.`}
                      </div>
                      <div className="text-[10px] text-gray-500 tabular-nums">
                        {stats.weeks} {stats.weeks === 1 ? "día" : "días"} ·{" "}
                        {metric === "count" ? `${totalValue} en total` : fmtCompact(totalValue)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-[10px] text-gray-500 mt-3 leading-snug">
              Cada barrita chica = un lunes/martes/etc del período. La barra grande = promedio.
              Pasá el mouse para ver detalle de cada día.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
