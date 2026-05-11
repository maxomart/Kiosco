"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { TrendingUp, DollarSign, ShoppingBag, BarChart2, Download, Calendar, Lock, Sparkles, ArrowRight } from "lucide-react"
import { formatCurrency, formatCurrencyCompact, formatDate, type Plan } from "@/lib/utils"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts"
import { AIInsightsPanel } from "@/components/reportes/AIInsightsPanel"
import { SalesHeatmap } from "@/components/reportes/SalesHeatmap"
import { TopCategoriesPanel } from "@/components/reportes/TopCategoriesPanel"
import { InsightsBanner } from "@/components/reportes/InsightsBanner"
import { PageTip } from "@/components/shared/PageTip"

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
  afipNotes?: {
    credit: { count: number; total: number }
    debit: { count: number; total: number }
  }
  netInvoiced?: number
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

function StatBox({ label, value, fullValue, sub, color = "purple" }: { label: string; value: string; fullValue?: string; sub?: string; color?: string }) {
  const colorMap: Record<string, string> = { purple: "text-purple-400", green: "text-green-400", blue: "text-blue-400", yellow: "text-yellow-400", red: "text-red-400" }
  return (
    <div className="bg-gray-900 rounded-xl p-4 sm:p-5 border border-gray-800 min-w-0">
      <p className="text-gray-500 text-xs sm:text-sm mb-1 truncate">{label}</p>
      <p
        className={`text-xl sm:text-2xl font-bold tabular-nums truncate ${colorMap[color] ?? colorMap.purple}`}
        title={fullValue ?? value}
      >
        {value}
      </p>
      {sub && <p className="text-gray-500 text-xs mt-1 truncate">{sub}</p>}
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
  const [preset, setPreset] = useState<"1d" | "7d" | "30d" | "90d" | "custom">("30d")

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
    if (p === "1d") {
      // "Hoy" — desde 00:00 hasta ahora
    } else if (p === "7d") start.setDate(now.getDate() - 7)
    else if (p === "30d") start.setDate(now.getDate() - 30)
    else if (p === "90d") start.setDate(now.getDate() - 90)
    else return
    setFrom(start.toISOString().split("T")[0])
    setTo(now.toISOString().split("T")[0])
  }

  const exportCSV = () => {
    if (!data) return
    // CSV completo con costo + margen por día — para que el dueño pueda
    // mandárselo al contador o tirarlo en una hoja de cálculo y hacerle
    // pivot. Antes solo bajábamos fecha + cantidad + ingreso (inútil).
    const totalRevenue = data.totalRevenue || 0
    const totalCost = data.totalCost || 0
    const dayShare = (n: number) => totalRevenue > 0 ? n / totalRevenue : 0
    const rows: (string | number)[][] = [
      ["Fecha", "Cantidad ventas", "Ingresos ARS", "Costo estimado ARS", "Ganancia ARS", "Margen %"],
    ]
    for (const d of data.dailySales) {
      // Distribuimos el costo total proporcional al ingreso del día —
      // approximación, pero ya es mil veces más útil que solo ingresos.
      const cost = Math.round(totalCost * dayShare(d.total))
      const profit = d.total - cost
      const margin = d.total > 0 ? ((profit / d.total) * 100) : 0
      rows.push([d.date, d.count, Math.round(d.total), cost, profit, margin.toFixed(1).replace(".", ",")])
    }
    rows.push([]) // separador
    rows.push(["Resumen del período", `${from} a ${to}`])
    rows.push(["Total ventas", data.totalSales])
    rows.push(["Ingresos ARS", Math.round(totalRevenue)])
    rows.push(["Costo ARS", Math.round(totalCost)])
    rows.push(["Ganancia ARS", Math.round(data.totalProfit || 0)])
    rows.push(["Margen %", (data.profitMargin || 0).toFixed(1).replace(".", ",")])
    rows.push(["Ticket promedio ARS", Math.round(data.avgTicket || 0)])
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")
    // BOM para que Excel argentino abra los acentos bien
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `orvex-reporte-${from}-a-${to}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  /**
   * Export "IVA del mes" — CSV con cada venta del rango listada con su
   * IVA discriminado (21% por defecto sobre el total). Es lo que un
   * contador argentino te pide para cargar el monotributo o el IVA de
   * RI. No es un libro IVA legal pero ahorra horas de Excel.
   */
  const exportIVA = async () => {
    try {
      const res = await fetch(`/api/reportes/iva?from=${from}T00:00:00&to=${to}T23:59:59`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error ?? "No se pudo generar el reporte de IVA")
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `orvex-iva-${from}-a-${to}.csv`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      console.error("[exportIVA] failed", e)
      alert("Error al generar el CSV de IVA")
    }
  }

  /**
   * Stock muerto — productos con stock pero sin moverse en 60+ días.
   * El CSV trae el capital atrapado por producto y total, ordenado por
   * cuánto te está costando ese stock parado.
   */
  const exportDeadStock = async () => {
    try {
      const res = await fetch(`/api/reportes/stock-muerto?days=60&format=csv`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error ?? "No se pudo generar el reporte de stock muerto")
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `orvex-stock-muerto.csv`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      console.error("[exportDeadStock] failed", e)
      alert("Error al generar el CSV de stock muerto")
    }
  }

  /**
   * Plan de compras — qué reponer y cuánto basado en velocidad de venta.
   * El CSV trae cantidad sugerida y costo estimado por producto, ordenado
   * por urgencia (productos que se quedan sin stock primero).
   */
  const exportPlanCompras = async () => {
    try {
      const res = await fetch(`/api/reportes/plan-compras?lookbackDays=14&targetDays=14&format=csv`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error ?? "No se pudo generar el plan de compras")
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `orvex-plan-compras.csv`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      console.error("[exportPlanCompras] failed", e)
      alert("Error al generar el plan de compras")
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageTip id="reportes:ai-tip" tone="accent">
        <strong>✨ Nuevo:</strong> click en <strong>"Generar análisis con IA"</strong> abajo para que la IA te
        cuente en lenguaje natural cómo viene tu negocio, qué destacar y qué mejorar.
      </PageTip>

      {/* Insights accionables — solo se renderiza si hay alguno y el plan
          tiene IA. Antes vivía solo en el chatbot del home y nadie lo veía. */}
      <InsightsBanner />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Reportes</h1>
          <p className="text-gray-400 text-sm mt-1">Análisis de ventas y rentabilidad</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(["1d", "7d", "30d", "90d"] as const).map(p => (
            <button key={p} onClick={() => applyPreset(p)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${preset === p ? "bg-purple-600 text-white" : "bg-gray-800 hover:bg-gray-700 text-gray-300"}`}>
              {p === "1d" ? "Hoy" : p === "7d" ? "7 días" : p === "30d" ? "30 días" : "90 días"}
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
          <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors" title="Exportá fecha, cantidad, ingresos, costo, ganancia y margen del período">
            <Download size={14} /> CSV período
          </button>
          <button onClick={exportIVA} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors" title="CSV listo para tu contador con cada venta y su IVA 21% discriminado">
            <Download size={14} /> IVA contador
          </button>
          <button onClick={exportDeadStock} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors" title="Productos con stock pero sin venderse en 60 días — capital atrapado por producto">
            <Download size={14} /> Stock muerto
          </button>
          <button onClick={exportPlanCompras} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors" title="Qué reponer esta semana basado en velocidad de venta últimos 14 días">
            <Download size={14} /> Plan de compras
          </button>
          <a
            href="/tv"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-200 border border-purple-700/40 text-sm font-medium transition-colors"
            title="Vista full-screen para mostrar en TV/cartelera"
          >
            Pantalla TV
          </a>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              {...(i === 0 ? { "data-tour": "reportes-summary" } : {})}
              className="bg-gray-900 rounded-xl p-5 border border-gray-800 animate-pulse"
            >
              <div className="h-3 bg-gray-800 rounded mb-3 w-2/3" />
              <div className="h-7 bg-gray-800 rounded w-4/5" />
            </div>
          ))}
        </div>
      ) : data ? (
        <>
          {/* KPI Cards — usamos compact para que no se desborden cuando los números crecen */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            <div data-tour="reportes-summary">
              <StatBox label="Total ventas" value={String(data.totalSales)} color="blue" />
            </div>
            <StatBox label="Ingresos" value={formatCurrencyCompact(data.totalRevenue)} fullValue={formatCurrency(data.totalRevenue)} color="purple" />
            <StatBox label="Costo" value={formatCurrencyCompact(data.totalCost)} fullValue={formatCurrency(data.totalCost)} color="yellow" />
            <StatBox label="Ganancia" value={formatCurrencyCompact(data.totalProfit)} fullValue={formatCurrency(data.totalProfit)} color="green" />
            <StatBox label="Margen" value={`${data.profitMargin.toFixed(1)}%`} color={data.profitMargin >= 20 ? "green" : "yellow"} />
            <StatBox label="Ticket promedio" value={formatCurrencyCompact(data.avgTicket)} fullValue={formatCurrency(data.avgTicket)} color="purple" />
          </div>

          {/* Facturación neta — visible si hay NC o ND emitidas en el período */}
          {data.afipNotes &&
            (data.afipNotes.credit.count > 0 || data.afipNotes.debit.count > 0) && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-white font-semibold">Facturación neta AFIP</h3>
                    <p className="text-xs text-gray-500">
                      Ingresos brutos ajustados por NC (restan) y ND (suman) del período.
                    </p>
                  </div>
                  <Link
                    href="/notas"
                    className="text-xs text-purple-300 hover:text-purple-200 underline-offset-2 hover:underline"
                  >
                    Ver detalle →
                  </Link>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatBox
                    label="Ingresos brutos"
                    value={formatCurrencyCompact(data.totalRevenue)}
                    fullValue={formatCurrency(data.totalRevenue)}
                    color="purple"
                  />
                  <StatBox
                    label={`NC (${data.afipNotes.credit.count})`}
                    value={`−${formatCurrencyCompact(data.afipNotes.credit.total)}`}
                    fullValue={formatCurrency(data.afipNotes.credit.total)}
                    color="red"
                  />
                  <StatBox
                    label={`ND (${data.afipNotes.debit.count})`}
                    value={`+${formatCurrencyCompact(data.afipNotes.debit.total)}`}
                    fullValue={formatCurrency(data.afipNotes.debit.total)}
                    color="blue"
                  />
                  <StatBox
                    label="Neto"
                    value={formatCurrencyCompact(data.netInvoiced ?? data.totalRevenue)}
                    fullValue={formatCurrency(data.netInvoiced ?? data.totalRevenue)}
                    color="green"
                  />
                </div>
              </div>
            )}

          {/* AI Insights + comparison vs previous period (only for paid plans) */}
          {!isLimited && (
            <AIInsightsPanel
              from={`${from}T00:00:00`}
              to={`${to}T23:59:59`}
            />
          )}

          {/* Top categories + most profitable (paid plans) */}
          {!isLimited && (
            <TopCategoriesPanel
              from={`${from}T00:00:00`}
              to={`${to}T23:59:59`}
            />
          )}

          {/* Heatmap (paid plans) */}
          {!isLimited && (
            <SalesHeatmap
              from={`${from}T00:00:00`}
              to={`${to}T23:59:59`}
            />
          )}

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
