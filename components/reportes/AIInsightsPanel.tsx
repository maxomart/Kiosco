"use client"

import { useEffect, useState } from "react"
import { Sparkles, Loader2, RefreshCw, TrendingUp, AlertTriangle, Lightbulb } from "lucide-react"

interface AIInsights {
  summary: string
  highlights: string[]
  recommendations: string[]
}

interface PeriodChanges {
  revenue: number
  profit: number
  salesCount: number
  avgTicket: number
}

interface InsightsResponse {
  period: { from: string; to: string; days: number }
  current: { revenue: number; profit: number; salesCount: number; avgTicket: number; itemsSold: number }
  changes: PeriodChanges
  netProfit: number
  expenses: number
  aiInsights: AIInsights | null
}

export function AIInsightsPanel({
  from,
  to,
}: {
  from: string
  to: string
}) {
  const [data, setData] = useState<InsightsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  const load = async (withAI = false) => {
    setError(null)
    if (withAI) setAiLoading(true)
    else setLoading(true)
    try {
      const params = new URLSearchParams({ from, to, ...(withAI && { ai: "true" }) })
      const res = await fetch(`/api/reportes/insights?${params}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || "Error al cargar insights")
        return
      }
      setData(json)
    } catch {
      setError("Error de red")
    } finally {
      setLoading(false)
      setAiLoading(false)
    }
  }

  useEffect(() => {
    load(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to])

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-accent-soft/30 to-accent-soft/10 border border-accent/30 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-accent animate-pulse" />
          <h3 className="text-sm font-semibold text-gray-100">Cargando insights...</h3>
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-gray-800 rounded animate-pulse w-3/4" />
          <div className="h-3 bg-gray-800 rounded animate-pulse w-1/2" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-4 text-sm text-red-300">
        {error}
      </div>
    )
  }

  if (!data) return null

  const { current, changes, netProfit, expenses, aiInsights } = data

  const formatPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`
  const trendColor = (v: number) => v > 0 ? "text-emerald-400" : v < 0 ? "text-red-400" : "text-gray-400"

  return (
    <div className="space-y-4">
      {/* Comparison metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <ComparisonCard
          label="Ingresos"
          value={`$ ${current.revenue.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`}
          change={changes.revenue}
        />
        <ComparisonCard
          label="Ganancia bruta"
          value={`$ ${current.profit.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`}
          change={changes.profit}
        />
        <ComparisonCard
          label="Ventas"
          value={String(current.salesCount)}
          change={changes.salesCount}
        />
        <ComparisonCard
          label="Ticket promedio"
          value={`$ ${current.avgTicket.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`}
          change={changes.avgTicket}
        />
      </div>

      {/* Net profit bar */}
      {expenses > 0 && (
        <div className="bg-gradient-to-r from-emerald-900/30 to-emerald-950/20 border border-emerald-700/40 rounded-xl p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-wider text-emerald-400 font-semibold">
                Ganancia neta del período
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Bruta $ {current.profit.toLocaleString("es-AR", { maximumFractionDigits: 0 })} − gastos $ {expenses.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
              </p>
            </div>
            <p className={`text-2xl font-bold ${netProfit >= 0 ? "text-emerald-300" : "text-red-400"}`}>
              {netProfit >= 0 ? "+" : ""}$ {netProfit.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
      )}

      {/* AI Insights card */}
      <div className="bg-gradient-to-br from-accent-soft/40 to-accent-soft/10 border border-accent/30 rounded-xl p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-100">Análisis con IA</h3>
              <p className="text-[11px] text-gray-400">Resumen automático del período</p>
            </div>
          </div>
          {aiInsights && (
            <button
              onClick={() => load(true)}
              disabled={aiLoading}
              className="text-xs text-accent hover:underline flex items-center gap-1 disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${aiLoading ? "animate-spin" : ""}`} />
              Regenerar
            </button>
          )}
        </div>

        {!aiInsights && !aiLoading && (
          <button
            onClick={() => load(true)}
            className="w-full py-3 rounded-lg bg-accent hover:bg-accent-hover text-accent-foreground font-medium text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Generar análisis con IA
          </button>
        )}

        {aiLoading && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin text-accent" />
            Analizando tus datos...
          </div>
        )}

        {aiInsights && (
          <div className="space-y-4">
            {/* Summary */}
            <p className="text-sm text-gray-200 leading-relaxed">
              {aiInsights.summary}
            </p>

            {/* Highlights */}
            {aiInsights.highlights.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingUp className="w-3.5 h-3.5 text-sky-400" />
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-sky-400">
                    Lo más destacado
                  </p>
                </div>
                <ul className="space-y-1.5">
                  {aiInsights.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-200">
                      <span className="text-sky-400 mt-1 flex-shrink-0">•</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {aiInsights.recommendations.length > 0 && (
              <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-amber-400">
                    Recomendaciones
                  </p>
                </div>
                <ul className="space-y-1.5">
                  {aiInsights.recommendations.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-200">
                      <span className="text-amber-400 mt-0.5 flex-shrink-0">→</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ComparisonCard({
  label,
  value,
  change,
}: {
  label: string
  value: string
  change: number
}) {
  const positive = change > 0.5
  const negative = change < -0.5
  const trendColor = positive ? "text-emerald-400" : negative ? "text-red-400" : "text-gray-500"
  const trendBg = positive ? "bg-emerald-900/40" : negative ? "bg-red-900/40" : "bg-gray-800"
  const arrow = positive ? "↗" : negative ? "↘" : "→"

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
      <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{label}</p>
      <p className="text-lg font-bold text-white mt-1 truncate">{value}</p>
      <div className={`inline-flex items-center gap-1 mt-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${trendBg} ${trendColor}`}>
        <span>{arrow}</span>
        <span>
          {change >= 0 ? "+" : ""}
          {change.toFixed(1)}%
        </span>
        <span className="text-[9px] opacity-70">vs período anterior</span>
      </div>
    </div>
  )
}
