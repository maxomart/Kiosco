"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"

interface Cell {
  day: number
  hour: number
  count: number
  total: number
}

interface DayBreakdownEntry {
  day: number
  date: string
  count: number
  total: number
}

const DAY_LABELS_LONG = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"]

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
  return `$${Math.round(n).toLocaleString("es-AR")}`
}

function fmtHour(h: number): string {
  return `${h}:00`
}

function fmtRange(h: number): string {
  return `${h}:00 a ${h + 1}:00`
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

  // Por hora del día
  const byHour = useMemo(() => {
    const arr = Array.from({ length: 24 }, () => ({ count: 0, total: 0 }))
    for (const c of cells) {
      arr[c.hour].count += c.count
      arr[c.hour].total += c.total
    }
    return arr
  }, [cells])

  // Promedio por día de la semana (sumando todos los lunes, todos los martes, etc / N)
  const dayStats = useMemo(() => {
    const byDay = new Map<number, DayBreakdownEntry[]>()
    for (const e of dayBreakdown) {
      const list = byDay.get(e.day) ?? []
      list.push(e)
      byDay.set(e.day, list)
    }
    const out = Array.from({ length: 7 }, (_, d) => {
      const entries = byDay.get(d) ?? []
      const count = entries.reduce((s, e) => s + e.count, 0)
      const total = entries.reduce((s, e) => s + e.total, 0)
      const weeks = entries.length
      return {
        day: d,
        count,
        total,
        weeks,
        avgCount: weeks > 0 ? count / weeks : 0,
        avgTotal: weeks > 0 ? total / weeks : 0,
      }
    })
    return out
  }, [dayBreakdown])

  const getHourValue = (h: number) =>
    metric === "count" ? byHour[h].count : byHour[h].total

  const getDayValue = (d: (typeof dayStats)[number]) =>
    metric === "count" ? d.avgCount : d.avgTotal

  // Top 1 hora
  const peakHour = useMemo(() => {
    let bestH = -1
    let bestV = 0
    for (let h = 0; h < 24; h++) {
      const v = getHourValue(h)
      if (v > bestV) {
        bestV = v
        bestH = h
      }
    }
    return bestH === -1 ? null : { hour: bestH, value: bestV, ...byHour[bestH] }
  }, [byHour, metric])

  // Top 1 día
  const bestDay = useMemo(() => {
    let best = dayStats[0]
    for (const d of dayStats) {
      if (getDayValue(d) > getDayValue(best)) best = d
    }
    return best && getDayValue(best) > 0 ? best : null
  }, [dayStats, metric])

  // Mejor franja 3h
  const bestSlot = useMemo(() => {
    let bestStart = -1
    let bestV = 0
    for (let h = 0; h <= 21; h++) {
      const v = getHourValue(h) + getHourValue(h + 1) + getHourValue(h + 2)
      if (v > bestV) {
        bestV = v
        bestStart = h
      }
    }
    return bestStart === -1 ? null : { start: bestStart, end: bestStart + 3, value: bestV }
  }, [byHour, metric])

  // Top 5 momentos exactos (día + hora) ordenados por valor
  const topMoments = useMemo(() => {
    return [...cells]
      .filter((c) => c.count > 0)
      .sort((a, b) => (metric === "count" ? b.count - a.count : b.total - a.total))
      .slice(0, 5)
  }, [cells, metric])

  // Día más flojo (con al menos 1 venta)
  const worstDay = useMemo(() => {
    const active = dayStats.filter((d) => d.weeks > 0)
    if (active.length === 0) return null
    return active.reduce((a, b) => (getDayValue(a) < getDayValue(b) ? a : b))
  }, [dayStats, metric])

  const totalSales = cells.reduce((s, c) => s + c.count, 0)
  const totalRevenue = cells.reduce((s, c) => s + c.total, 0)
  const hasData = cells.length > 0

  // Construir frase principal del insight
  const mainInsight = useMemo(() => {
    if (!peakHour || !bestDay) return null
    const dayName = DAY_LABELS_LONG[bestDay.day]
    const hourTxt = fmtRange(peakHour.hour)
    const valueTxt =
      metric === "count"
        ? `${bestDay.avgCount.toFixed(1)} ventas`
        : fmtMoney(bestDay.avgTotal)
    return `Tu mejor día es el ${dayName} (en promedio ${valueTxt}), y tu hora más fuerte es de ${hourTxt}.`
  }, [peakHour, bestDay, metric])

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-100">¿Cuándo vendés más?</h3>
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
        <div className="space-y-5">
          {/* Frase principal — el insight de un vistazo */}
          {mainInsight && (
            <div className="bg-accent/10 border border-accent/30 rounded-lg p-4">
              <p className="text-sm text-gray-100 leading-relaxed">{mainInsight}</p>
            </div>
          )}

          {/* Tres bullets clave */}
          <div className="space-y-2.5 text-sm">
            {peakHour && (
              <div className="flex items-baseline gap-3">
                <span className="text-amber-400 shrink-0 w-5 text-center">🕐</span>
                <div className="flex-1">
                  <div className="text-gray-100">
                    <span className="font-medium">Hora pico:</span>{" "}
                    <span className="tabular-nums">{fmtRange(peakHour.hour)}</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {metric === "count"
                      ? `${peakHour.count} ventas se hicieron en esa franja durante todo el período`
                      : `${fmtMoney(peakHour.total)} facturados en esa franja durante todo el período`}
                  </div>
                </div>
              </div>
            )}

            {bestDay && (
              <div className="flex items-baseline gap-3">
                <span className="text-accent shrink-0 w-5 text-center">📅</span>
                <div className="flex-1">
                  <div className="text-gray-100">
                    <span className="font-medium">Mejor día:</span>{" "}
                    <span className="capitalize">{DAY_LABELS_LONG[bestDay.day]}</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    En un {DAY_LABELS_LONG[bestDay.day]} típico vendés{" "}
                    {metric === "count"
                      ? `${bestDay.avgCount.toFixed(1)} unidades`
                      : fmtMoney(bestDay.avgTotal)}
                    {bestDay.weeks > 1 && ` (promedio de ${bestDay.weeks} ${DAY_LABELS_LONG[bestDay.day]}s)`}
                  </div>
                </div>
              </div>
            )}

            {bestSlot && (
              <div className="flex items-baseline gap-3">
                <span className="text-emerald-400 shrink-0 w-5 text-center">⏰</span>
                <div className="flex-1">
                  <div className="text-gray-100">
                    <span className="font-medium">Franja más fuerte:</span>{" "}
                    <span className="tabular-nums">
                      {fmtHour(bestSlot.start)} a {fmtHour(bestSlot.end)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    Son las 3 horas seguidas con más actividad —{" "}
                    {metric === "count"
                      ? `${bestSlot.value} ventas en total`
                      : `${fmtMoney(bestSlot.value)} facturados`}
                  </div>
                </div>
              </div>
            )}

            {worstDay && bestDay && worstDay.day !== bestDay.day && (
              <div className="flex items-baseline gap-3">
                <span className="text-gray-500 shrink-0 w-5 text-center">📉</span>
                <div className="flex-1">
                  <div className="text-gray-100">
                    <span className="font-medium">Día más flojo:</span>{" "}
                    <span className="capitalize">{DAY_LABELS_LONG[worstDay.day]}</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    En un {DAY_LABELS_LONG[worstDay.day]} típico vendés{" "}
                    {metric === "count"
                      ? `${worstDay.avgCount.toFixed(1)} unidades`
                      : fmtMoney(worstDay.avgTotal)}{" "}
                    — pensá una promo o ajustá horarios
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Top 5 momentos */}
          {topMoments.length > 0 && (
            <div className="pt-4 border-t border-gray-800">
              <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2.5">
                Top 5 momentos
              </h4>
              <ol className="space-y-1.5">
                {topMoments.map((m, idx) => (
                  <li
                    key={`${m.day}-${m.hour}`}
                    className="flex items-baseline gap-3 text-sm"
                  >
                    <span className="text-gray-500 font-mono text-xs w-4 text-right shrink-0">
                      {idx + 1}.
                    </span>
                    <span className="text-gray-100 capitalize flex-1">
                      {DAY_LABELS_LONG[m.day]} a las{" "}
                      <span className="tabular-nums">{fmtRange(m.hour)}</span>
                    </span>
                    <span className="text-gray-400 text-xs tabular-nums">
                      {metric === "count"
                        ? `${m.count} ${m.count === 1 ? "venta" : "ventas"}`
                        : fmtMoney(m.total)}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
