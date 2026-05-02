"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { TrendingUp, AlertTriangle, Sparkles, Clock, Package } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

interface Stockout {
  productId: string
  productName: string
  currentStock: number
  velocityPerDay: number
  daysUntilStockout: number | null
  stockoutDate: string | null
  severity: "critical" | "warning" | "ok"
}
interface Profitable {
  productId: string
  productName: string
  unitsSold: number
  profit: number
  marginPercent: number
}
interface DayClose {
  todaySoFar: number
  averageThisDayOfWeek: number
  estimatedClose: number
  confidence: "low" | "medium" | "high"
}
interface Data {
  stockouts: Stockout[]
  profitable: Profitable[]
  dayClose: DayClose
}

export function PredictiveInsights() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/predicciones", { cache: "no-store" })
      .then((r) => {
        // 403 = plan no incluye IA predictiva. No mostramos nada.
        if (r.status === 403) return null
        return r.ok ? r.json() : null
      })
      .then((d) => setData(d))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-48 bg-gray-900 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }
  if (!data) return null

  const criticalStockouts = data.stockouts.filter((s) => s.severity === "critical").slice(0, 5)
  const warningStockouts = data.stockouts.filter((s) => s.severity === "warning").slice(0, 5)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Cierre estimado */}
      <div className="bg-gradient-to-br from-purple-950/40 via-gray-900 to-gray-950 border border-purple-900/30 rounded-xl p-5 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-purple-600/20 blur-3xl rounded-full pointer-events-none" />
        <div className="relative space-y-3">
          <div className="flex items-center gap-2 text-xs text-purple-300">
            <Clock size={13} />
            <span className="uppercase tracking-wider font-bold">Cierre estimado de hoy</span>
            <span className="ml-auto text-[10px] text-gray-500">
              {data.dayClose.confidence === "high" ? "Alta confianza" : data.dayClose.confidence === "medium" ? "Media" : "Pocas señales"}
            </span>
          </div>
          <p className="text-3xl font-bold text-white tabular-nums">
            {formatCurrency(data.dayClose.estimatedClose)}
          </p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-gray-500">Hoy hasta ahora</p>
              <p className="text-gray-200 font-medium">{formatCurrency(data.dayClose.todaySoFar)}</p>
            </div>
            <div>
              <p className="text-gray-500">Promedio mismo día</p>
              <p className="text-gray-200 font-medium">{formatCurrency(data.dayClose.averageThisDayOfWeek)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stock por agotarse */}
      <div className={`rounded-xl p-5 border ${
        criticalStockouts.length > 0
          ? "bg-red-950/30 border-red-800/40"
          : warningStockouts.length > 0
          ? "bg-amber-950/30 border-amber-800/40"
          : "bg-gray-900 border-gray-800"
      }`}>
        <div className="flex items-center gap-2 text-xs mb-3">
          <AlertTriangle size={13} className={
            criticalStockouts.length > 0 ? "text-red-400" : warningStockouts.length > 0 ? "text-amber-400" : "text-emerald-400"
          } />
          <span className={`uppercase tracking-wider font-bold ${
            criticalStockouts.length > 0 ? "text-red-300" : warningStockouts.length > 0 ? "text-amber-300" : "text-emerald-300"
          }`}>
            Stock por agotarse
          </span>
        </div>
        {criticalStockouts.length === 0 && warningStockouts.length === 0 ? (
          <p className="text-sm text-emerald-200">Todo bien — sin alertas de stock crítico.</p>
        ) : (
          <div className="space-y-2">
            {[...criticalStockouts, ...warningStockouts].slice(0, 5).map((s) => (
              <div key={s.productId} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-gray-200 truncate flex-1">{s.productName}</span>
                <span className={`text-xs flex-shrink-0 ${
                  s.severity === "critical" ? "text-red-300" : "text-amber-300"
                }`}>
                  {s.daysUntilStockout === 0
                    ? "Sin stock"
                    : s.daysUntilStockout === 1
                    ? "1 día"
                    : `${s.daysUntilStockout} días`}
                </span>
              </div>
            ))}
          </div>
        )}
        <Link href="/inventario" className="text-xs text-gray-400 hover:text-gray-200 mt-3 inline-block">
          Ver inventario →
        </Link>
      </div>

      {/* Top rentables */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center gap-2 text-xs mb-3">
          <TrendingUp size={13} className="text-emerald-400" />
          <span className="text-emerald-300 uppercase tracking-wider font-bold">Top rentables (30d)</span>
        </div>
        {data.profitable.length === 0 ? (
          <p className="text-sm text-gray-400">Sin ventas suficientes para calcular.</p>
        ) : (
          <div className="space-y-2">
            {data.profitable.slice(0, 5).map((p) => (
              <div key={p.productId} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-gray-200 truncate flex-1">{p.productName}</span>
                <span className="text-xs text-emerald-300 flex-shrink-0">
                  {formatCurrency(p.profit)} <span className="text-gray-500">({p.marginPercent}%)</span>
                </span>
              </div>
            ))}
          </div>
        )}
        <Link href="/reportes" className="text-xs text-gray-400 hover:text-gray-200 mt-3 inline-block">
          Ver reportes →
        </Link>
      </div>
    </div>
  )
}
