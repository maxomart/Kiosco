"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { TrendingUp, DollarSign, ShoppingBag, BarChart2, Download, Calendar, Lock, Sparkles, ArrowRight } from "lucide-react"
import { formatCurrency, formatDate, type Plan } from "@/lib/utils"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts"

interface ReportData {
  plan?: Plan
  isLimited?: boolean
  totalSales: number
  totalRevenue: number
  totalCost: number
  totalProfit: number
  profitMargin: number
  avgTicket: number
  topProducts: { productName: string; quantity: number; revenue: number }[]
  salesByMethod: { method: string; count: number; total: number }[]
  dailySales: { date: string; total: number; count: number }[]
}

function LockedChart({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-transparent pointer-events-none" />
      <div className="relative flex flex-col items-center justify-center text-center min-h-[220px] gap-3">
        <div className="w-12 h-12 rounded-xl bg-accent-soft flex items-center justify-center">
          <Lock className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h3 className="text-white font-semibold text-sm mb-1 flex items-center justify-center gap-1.5">
            {title}
            <Sparkles className="w-3 h-3 text-amber-400" />
          </h3>
          <p className="text-xs text-gray-400 max-w-xs">{description}</p>
        </div>
        <Link
          href="/configuracion/suscripcion"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-hover transition"
        >
          Suscribirme <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  )
}

const METHOD_LABELS: Record<string, string> = {
  CASH: "Efectivo", DEBIT: "Débito", CREDIT: "Crédito", TRANSFER: "Transferencia",
  MERCADOPAGO: "Mercado Pago", UALA: "Ualá", MODO: "MODO",
  NARANJA_X: "Naranja X", CUENTA_DNI: "Cuenta DNI", LOYALTY_POINTS: "Puntos", MIXED: "Mixto",
}
const COLORS = ["#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#6366f1", "#14b8a6", "#f97316", "#84cc16"]

function StatBox({ label, value, sub, color = "purple" }: { label: string; value: string; sub?: string; color?: string }) {
  const colorMap: Record<string, string> = { purple: "text-purple-400", green: "text-green-400", blue: "text-blue-400", yellow: "text-yellow-400" }
  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
      <p className="text-gray-500 text-sm mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colorMap[color] ?? colorMap.purple}`}>{value}</p>
      {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
    </div>
  )
}

export default function ReportesPage({ plan = "STARTER" }: { plan?: Plan }) {
  const isLimited = plan === "FREE"
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30)
    return d.toISOString().split("T")[0]
  })
  const [to, setTo] = useState(() => new Date().toISOString().split("T")[0])
  const [preset, setPreset] = useState<"7d" | "30d" | "90d" | "custom">("30d")

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reportes?from=${from}T00:00:00&to=${to}T23:59:59`)
      if (!res.ok) {
        console.error("[Reportes] API error", res.status)
        // Set safe empty defaults so the page renders without crashing
        setData({
          totalSales: 0, totalRevenue: 0, totalCost: 0, totalProfit: 0,
          profitMargin: 0, avgTicket: 0, topProducts: [],
          salesByMethod: [], dailySales: [],
        } as any)
      } else {
        const json = await res.json()
        // Coerce arrays so .map/.sort never crash
        setData({
          ...json,
          topProducts: Array.isArray(json.topProducts) ? json.topProducts : [],
          salesByMethod: Array.isArray(json.salesByMethod) ? json.salesByMethod : [],
          dailySales: Array.isArray(json.dailySales) ? json.dailySales : [],
        })
      }
    } catch (e) {
      console.error("[Reportes] fetch failed", e)
      setData({
        totalSales: 0, totalRevenue: 0, totalCost: 0, totalProfit: 0,
        profitMargin: 0, avgTicket: 0, topProducts: [],
        salesByMethod: [], dailySales: [],
      } as any)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [from, to])

  const applyPreset = (p: typeof preset) => {
    setPreset(p)
    const now = new Date()
    const start = new Date()
    if (p === "7d") start.setDate(now.getDate() - 7)
    else if (p === "30d") start.setDate(now.getDate() - 30)
    else if (p === "90d") start.setDate(now.getDate() - 90)
    else return
    setFrom(start.toISOString().split("T")[0])
    setTo(now.toISOString().split("T")[0])
  }

  const exportCSV = () => {
    if (!data) return
    const rows = [["Fecha", "Ventas", "Ingresos"], ...data.dailySales.map(d => [d.date, d.count, d.total])]
    const csv = rows.map(r => r.join(",")).join("\n")
    const a = document.createElement("a"); a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`; a.download = "reporte.csv"; a.click()
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Reportes</h1>
          <p className="text-gray-400 text-sm mt-1">Análisis de ventas y rentabilidad</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(["7d", "30d", "90d"] as const).map(p => (
            <button key={p} onClick={() => applyPreset(p)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${preset === p ? "bg-purple-600 text-white" : "bg-gray-800 hover:bg-gray-700 text-gray-300"}`}>
              {p === "7d" ? "7 días" : p === "30d" ? "30 días" : "90 días"}
            </button>
          ))}
          <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-1.5 border border-gray-700">
            <Calendar size={14} className="text-gray-400" />
            <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPreset("custom") }}
              className="bg-transparent text-sm text-white focus:outline-none" />
            <span className="text-gray-500">—</span>
            <input type="date" value={to} onChange={e => { setTo(e.target.value); setPreset("custom") }}
              className="bg-transparent text-sm text-white focus:outline-none" />
          </div>
          <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors">
            <Download size={14} /> CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-gray-900 rounded-xl p-5 border border-gray-800 animate-pulse">
              <div className="h-3 bg-gray-800 rounded mb-3 w-2/3" />
              <div className="h-7 bg-gray-800 rounded w-4/5" />
            </div>
          ))}
        </div>
      ) : data ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatBox label="Total ventas" value={String(data.totalSales)} color="blue" />
            <StatBox label="Ingresos" value={formatCurrency(data.totalRevenue)} color="purple" />
            <StatBox label="Costo" value={formatCurrency(data.totalCost)} color="yellow" />
            <StatBox label="Ganancia" value={formatCurrency(data.totalProfit)} color="green" />
            <StatBox label="Margen" value={`${data.profitMargin.toFixed(1)}%`} color={data.profitMargin >= 20 ? "green" : "yellow"} />
            <StatBox label="Ticket promedio" value={formatCurrency(data.avgTicket)} color="purple" />
          </div>

          {/* FREE plan banner */}
          {isLimited && (
            <div className="flex items-center gap-3 bg-accent-soft border border-accent/30 rounded-xl px-4 py-3">
              <Sparkles className="w-5 h-5 text-accent flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-100">Estás viendo reportes básicos</p>
                <p className="text-xs text-gray-400">Suscribite para desbloquear gráficos, top productos, evolución diaria y desglose por método de pago.</p>
              </div>
              <Link href="/configuracion/suscripcion"
                className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-accent-foreground text-sm font-medium transition">
                Mejorar plan
              </Link>
            </div>
          )}

          {/* Charts row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily sales line */}
            {isLimited ? (
              <LockedChart title="Ventas diarias" description="Visualizá la evolución de tus ingresos día a día con un gráfico interactivo." />
            ) : (
              <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                <h3 className="text-white font-semibold mb-4">Ventas diarias</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={data.dailySales} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }}
                      tickFormatter={v => v.slice(5)} />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: "8px" }}
                      labelStyle={{ color: "#9ca3af" }} formatter={(v: number) => [formatCurrency(v), "Ingresos"]} />
                    <Line type="monotone" dataKey="total" stroke="var(--color-accent)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Top products bar */}
            {isLimited ? (
              <LockedChart title="Top productos por ingresos" description="Identificá rápidamente qué productos te dan más ganancia." />
            ) : (
              <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                <h3 className="text-white font-semibold mb-4">Top 10 productos por ingresos</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.topProducts} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 10 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="productName" tick={{ fill: "#9ca3af", fontSize: 11 }}
                      tickFormatter={v => v.length > 14 ? v.slice(0, 14) + "…" : v} width={60} />
                    <Tooltip contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: "8px" }}
                      formatter={(v: number) => [formatCurrency(v), "Ingresos"]} />
                    <Bar dataKey="revenue" fill="var(--color-accent)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Charts row 2 */}
          {!isLimited && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Payment methods pie */}
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <h3 className="text-white font-semibold mb-4">Métodos de pago</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={data.salesByMethod} dataKey="total" nameKey="method" cx="50%" cy="50%"
                    innerRadius={55} outerRadius={85} paddingAngle={2}
                    label={({ percent }) => percent ? `${(percent * 100).toFixed(0)}%` : ""}
                    labelLine={false}>
                    {data.salesByMethod.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Legend formatter={v => METHOD_LABELS[v] || v} wrapperStyle={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: "8px" }}
                    formatter={(v: number, n) => [formatCurrency(v), METHOD_LABELS[n] || n]} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Sales by method table */}
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 lg:col-span-2">
              <h3 className="text-white font-semibold mb-4">Desglose por método de pago</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-800">
                      <th className="pb-3 text-left font-medium">Método</th>
                      <th className="pb-3 text-right font-medium">Transacciones</th>
                      <th className="pb-3 text-right font-medium">Total</th>
                      <th className="pb-3 text-right font-medium">% Ingresos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {[...data.salesByMethod].sort((a, b) => b.total - a.total).map((m, i) => (
                      <tr key={m.method} className="hover:bg-gray-800/30 transition-colors">
                        <td className="py-3 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="text-white">{METHOD_LABELS[m.method] || m.method}</span>
                        </td>
                        <td className="py-3 text-right text-gray-300">{m.count}</td>
                        <td className="py-3 text-right text-gray-300">{formatCurrency(m.total)}</td>
                        <td className="py-3 text-right text-gray-400">
                          {data.totalRevenue > 0 ? ((m.total / data.totalRevenue) * 100).toFixed(1) : "0"}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          )}

          {/* Daily sales table — paid only */}
          {!isLimited && (
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <h3 className="text-white font-semibold mb-4">Detalle diario</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-800">
                    <th className="pb-3 text-left font-medium">Fecha</th>
                    <th className="pb-3 text-right font-medium">Transacciones</th>
                    <th className="pb-3 text-right font-medium">Total</th>
                    <th className="pb-3 text-right font-medium">Ticket promedio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {[...data.dailySales].sort((a, b) => b.date.localeCompare(a.date)).map(d => (
                    <tr key={d.date} className="hover:bg-gray-800/30 transition-colors">
                      <td className="py-3 text-white">{formatDate(d.date)}</td>
                      <td className="py-3 text-right text-gray-300">{d.count}</td>
                      <td className="py-3 text-right text-gray-300">{formatCurrency(d.total)}</td>
                      <td className="py-3 text-right text-gray-400">{formatCurrency(d.count > 0 ? d.total / d.count : 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          )}
        </>
      ) : (
        <div className="flex items-center justify-center h-64 text-gray-500">Error al cargar reportes</div>
      )}
    </div>
  )
}
