"use client"

import { useEffect, useState, useCallback } from "react"
import { formatCurrency, formatDateTime, PAYMENT_METHOD_LABELS } from "@/lib/utils"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts"
import {
  TrendingUp, ShoppingCart, Package, Calendar,
  Ban, RefreshCw, AlertTriangle, CheckCircle2, X
} from "lucide-react"
import toast from "react-hot-toast"
import { cn } from "@/lib/utils"

interface ReportData {
  salesToday: { total: number; count: number }
  salesMonth: { total: number; count: number }
  topProducts: { productName: string; totalQty: number; totalRevenue: number }[]
  last7Days: { date: string; label: string; total: number; count: number }[]
}

interface Sale {
  id: string
  number: number
  total: number
  subtotal: number
  discountAmount: number
  status: "COMPLETED" | "CANCELLED" | "REFUNDED"
  paymentMethod: string
  cancelReason?: string
  createdAt: string
  items: { id: string; productName: string; quantity: number; unitPrice: number }[]
  user?: { name: string }
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-3">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">{label}</p>
        <p className="text-sm font-bold text-blue-600">{formatCurrency(payload[0].value)}</p>
        {payload[1] && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{payload[1].value} ventas</p>
        )}
      </div>
    )
  }
  return null
}

function AnularModal({
  sale,
  onConfirm,
  onClose,
}: {
  sale: Sale
  onConfirm: (reason: string) => Promise<void>
  onClose: () => void
}) {
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    if (!reason.trim()) { toast.error("Ingresá el motivo de anulación"); return }
    setLoading(true)
    try {
      await onConfirm(reason)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
            <Ban size={20} className="text-red-600" />
          </div>
          <div>
            <h2 className="font-bold text-gray-800 dark:text-white">Anular venta #{sale.number}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {formatCurrency(sale.total)} · {sale.items.length} producto{sale.items.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={20} />
          </button>
        </div>

        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-3 mb-4">
          <div className="flex gap-2">
            <AlertTriangle size={16} className="text-orange-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-orange-700 dark:text-orange-300">
              Esta acción anulará la venta y <strong>devolverá el stock</strong> de todos los productos.
              No se puede revertir.
            </p>
          </div>
        </div>

        <div className="mb-5">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Motivo de anulación *
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej: Error en cobro, cliente se arrepintió..."
            className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl outline-none focus:border-red-400 text-sm"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 dark:border-gray-700 rounded-xl font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !reason.trim()}
            className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-xl font-bold text-sm transition flex items-center justify-center gap-2"
          >
            {loading ? <RefreshCw size={16} className="animate-spin" /> : <Ban size={16} />}
            Anular venta
          </button>
        </div>
      </div>
    </div>
  )
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  COMPLETED: { label: "Completada", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  CANCELLED: { label: "Anulada", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  REFUNDED: { label: "Devuelta", cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
}

const today = new Date().toISOString().slice(0, 10)

export default function ReportesPage() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const [data, setData] = useState<ReportData | null>(null)
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [salesLoading, setSalesLoading] = useState(true)
  const [anularTarget, setAnularTarget] = useState<Sale | null>(null)
  const [dateFilter, setDateFilter] = useState(today)

  const loadReport = useCallback(() => {
    setLoading(true)
    const url = dateFilter ? `/api/reportes?date=${dateFilter}` : "/api/reportes"
    fetch(url)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [dateFilter])

  const loadSales = useCallback(() => {
    setSalesLoading(true)
    const url = dateFilter ? `/api/ventas?limit=100&date=${dateFilter}` : "/api/ventas?limit=100"
    fetch(url)
      .then((r) => r.json())
      .then((d) => setSales(d.sales ?? []))
      .catch(() => {})
      .finally(() => setSalesLoading(false))
  }, [dateFilter])

  useEffect(() => {
    loadReport()
    loadSales()
  }, [loadReport, loadSales])

  const handleAnular = async (reason: string) => {
    if (!anularTarget) return
    const res = await fetch(`/api/ventas/${anularTarget.id}/anular`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    })
    if (res.ok) {
      toast.success(`Venta #${anularTarget.number} anulada y stock restaurado`)
      setAnularTarget(null)
      loadSales()
      loadReport()
    } else {
      const err = await res.json()
      toast.error(err.error ?? "Error al anular")
    }
  }

  const handlePrint = async (period: "day" | "week" | "month") => {
    const dateLabel = period === "day"
      ? (dateFilter || today)
      : period === "week"
      ? "Últimos 7 días"
      : "Este mes"

    let salesForPrint = filteredSales

    // Para semana y mes, cargar el rango completo con fetch
    if (period === "week") {
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      const weekFrom = weekAgo.toISOString().slice(0, 10)
      try {
        const r = await fetch(`/api/ventas?limit=500&from=${weekFrom}&to=${today}`)
        const d = await r.json()
        salesForPrint = d.sales ?? []
      } catch {
        toast.error("Error al cargar ventas semanales")
        return
      }
    } else if (period === "month") {
      const monthStart = new Date()
      monthStart.setDate(1)
      const monthFrom = monthStart.toISOString().slice(0, 10)
      try {
        const r = await fetch(`/api/ventas?limit=500&from=${monthFrom}&to=${today}`)
        const d = await r.json()
        salesForPrint = d.sales ?? []
      } catch {
        toast.error("Error al cargar ventas mensuales")
        return
      }
    }

    // Crear ventana de impresión
    const printWindow = window.open("", "_blank", "width=900,height=700")
    if (!printWindow) { toast.error("Permitir popups para descargar PDF"); return }

    const PAYMENT_LABELS: Record<string, string> = {
      CASH: "Efectivo", DEBIT: "Débito", CREDIT: "Crédito",
      TRANSFER: "Transferencia", MERCADOPAGO: "MercadoPago",
      UALA: "Ualá", MODO: "Modo", MIXED: "Mixto",
    }

    const completedSales = salesForPrint.filter((s: any) => s.status === "COMPLETED")
    const totalSales = completedSales.reduce((s: number, v: any) => s + v.total, 0)
    const byMethod = completedSales.reduce((acc: any, s: any) => {
      const m = s.paymentMethod
      if (!acc[m]) acc[m] = { count: 0, total: 0 }
      acc[m].count++
      acc[m].total += s.total
      return acc
    }, {})

    const fmt = (n: number) => `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reporte ${dateLabel}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; color: #111; }
      h1 { margin: 0; font-size: 22px; }
      .header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 20px; }
      .kpis { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 24px; }
      .kpi { border: 1px solid #ddd; border-radius: 8px; padding: 12px; text-align: center; }
      .kpi-label { font-size: 11px; color: #666; text-transform: uppercase; }
      .kpi-value { font-size: 20px; font-weight: bold; margin-top: 4px; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px; }
      th { background: #f5f5f5; padding: 8px; text-align: left; border: 1px solid #ddd; }
      td { padding: 7px 8px; border: 1px solid #ddd; }
      .right { text-align: right; }
      .center { text-align: center; }
      .cancelled { background: #fff5f5; }
      .footer { font-size: 11px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 10px; margin-top: 20px; }
      h3 { border-bottom: 1px solid #eee; padding-bottom: 6px; }
      @media print { button { display: none; } }
    </style></head><body>
    <div class="header">
      <h1>KioscoApp — Reporte de Ventas</h1>
      <p style="margin:4px 0 0;color:#555;font-size:13px">${period === "day" ? "Reporte diario" : period === "week" ? "Reporte semanal" : "Reporte mensual"} · ${dateLabel}</p>
    </div>
    <div class="kpis">
      <div class="kpi"><div class="kpi-label">Total ventas</div><div class="kpi-value">${fmt(totalSales)}</div></div>
      <div class="kpi"><div class="kpi-label">Transacciones</div><div class="kpi-value">${completedSales.length}</div></div>
      <div class="kpi"><div class="kpi-label">Ticket promedio</div><div class="kpi-value">${completedSales.length > 0 ? fmt(totalSales / completedSales.length) : "$0"}</div></div>
    </div>
    <h3>Por método de pago</h3>
    <table>
      <thead><tr><th>Método</th><th class="right">Cantidad</th><th class="right">Total</th></tr></thead>
      <tbody>
        ${Object.entries(byMethod).map(([m, v]: any) => `<tr><td>${PAYMENT_LABELS[m] ?? m}</td><td class="right">${v.count}</td><td class="right"><b>${fmt(v.total)}</b></td></tr>`).join("")}
      </tbody>
    </table>
    <h3>Detalle de ventas (${salesForPrint.length})</h3>
    <table>
      <thead><tr><th>#</th><th>Fecha/Hora</th><th>Método</th><th class="right">Total</th><th class="center">Estado</th></tr></thead>
      <tbody>
        ${salesForPrint.slice(0, 200).map((s: any) => `
          <tr class="${s.status === "CANCELLED" ? "cancelled" : ""}">
            <td>#${s.number}</td>
            <td>${new Date(s.createdAt).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
            <td>${PAYMENT_LABELS[s.paymentMethod] ?? s.paymentMethod}</td>
            <td class="right"><b>${fmt(s.total)}</b></td>
            <td class="center" style="color:${s.status === "CANCELLED" ? "#dc2626" : "#16a34a"}">${s.status === "COMPLETED" ? "✓" : s.status === "CANCELLED" ? "✗" : "↩"}</td>
          </tr>`).join("")}
      </tbody>
    </table>
    <div class="footer">Generado el ${new Date().toLocaleString("es-AR")} · KioscoApp</div>
    <button onclick="window.print()" style="position:fixed;bottom:20px;right:20px;padding:10px 20px;background:#2563eb;color:white;border:none;border-radius:8px;font-size:14px;cursor:pointer;font-weight:bold">🖨️ Imprimir / Guardar PDF</button>
    </body></html>`

    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => printWindow.print(), 500)
  }

  const emptyData = {
    salesToday: { total: 0, count: 0 },
    salesMonth: { total: 0, count: 0 },
    topProducts: [],
    last7Days: [],
  }

  const d = data ?? emptyData

  // Filtrar ventas localmente por fecha si hay filtro
  const filteredSales = dateFilter
    ? sales.filter(s => s.createdAt.startsWith(dateFilter))
    : sales

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Reportes</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">Resumen de ventas y estadísticas</p>
        </div>
        {/* Filtro de fecha */}
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar size={16} className="text-gray-400" />
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm dark:text-white outline-none focus:border-blue-500"
          />
          <button
            onClick={() => setDateFilter(today)}
            className="px-3 py-2 text-sm font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/50 transition"
          >
            Hoy
          </button>
          <button
            onClick={() => setDateFilter("")}
            className="px-3 py-2 text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition"
          >
            Todos
          </button>
          <div className="flex items-center gap-1 ml-2 border-l border-gray-200 dark:border-gray-700 pl-2">
            <span className="text-xs text-gray-400 mr-1">PDF:</span>
            <button
              onClick={() => handlePrint("day")}
              className="px-2.5 py-2 text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 transition"
              title="Reporte del día seleccionado"
            >
              Día
            </button>
            <button
              onClick={() => handlePrint("week")}
              className="px-2.5 py-2 text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 transition"
              title="Reporte semanal"
            >
              Semana
            </button>
            <button
              onClick={() => handlePrint("month")}
              className="px-2.5 py-2 text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 transition"
              title="Reporte mensual"
            >
              Mes
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Ventas hoy</p>
            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <TrendingUp size={16} className="text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-800 dark:text-white">{formatCurrency(d.salesToday.total)}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{d.salesToday.count} transacciones</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Ventas este mes</p>
            <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
              <Calendar size={16} className="text-green-600 dark:text-green-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-800 dark:text-white">{formatCurrency(d.salesMonth.total)}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{d.salesMonth.count} transacciones</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Ticket promedio hoy</p>
            <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
              <ShoppingCart size={16} className="text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-800 dark:text-white">
            {d.salesToday.count > 0 ? formatCurrency(d.salesToday.total / d.salesToday.count) : formatCurrency(0)}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">por transacción</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Productos top</p>
            <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
              <Package size={16} className="text-orange-600 dark:text-orange-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-800 dark:text-white">{d.topProducts.length}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">más vendidos hoy</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <h2 className="text-base font-bold text-gray-800 dark:text-white mb-4">Ventas — últimos 7 días</h2>
          {d.last7Days.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 dark:text-gray-500">
              <p>Sin datos de ventas</p>
            </div>
          ) : !mounted ? (
            <div className="h-[220px] bg-gray-50 dark:bg-gray-700/30 rounded-xl animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={d.last7Days} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:opacity-20" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <h2 className="text-base font-bold text-gray-800 dark:text-white mb-4">Top 5 productos hoy</h2>
          {d.topProducts.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 dark:text-gray-500">
              <p className="text-sm">Sin ventas hoy</p>
            </div>
          ) : (
            <div className="space-y-3">
              {d.topProducts.slice(0, 5).map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-400 flex-shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">{p.productName}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{p.totalQty} unidades</p>
                  </div>
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-300 flex-shrink-0">
                    {formatCurrency(p.totalRevenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Historial de ventas con opción de anular */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h2 className="font-bold text-gray-800 dark:text-white">Historial de ventas</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {dateFilter ? `Ventas del ${dateFilter}` : "Todas las ventas"} · podés anular ventas completadas
            </p>
          </div>
          <button
            onClick={loadSales}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition"
            title="Actualizar"
          >
            <RefreshCw size={16} className={cn(salesLoading && "animate-spin")} />
          </button>
        </div>

        {/* Filtro de fecha para la tabla */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-gray-400" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm dark:text-white outline-none focus:border-blue-500"
            />
          </div>
          <button
            onClick={() => setDateFilter(today)}
            className="px-3 py-2 text-sm font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/50 transition"
          >
            Hoy
          </button>
          <button
            onClick={() => setDateFilter("")}
            className="px-3 py-2 text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition"
          >
            Todos
          </button>
          {dateFilter && (
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
              {filteredSales.length} resultado{filteredSales.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {salesLoading ? (
          <div className="py-12 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="py-12 text-center text-gray-400 dark:text-gray-500">
            <ShoppingCart size={40} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">
              {dateFilter ? `No hay ventas para el ${dateFilter}` : "No hay ventas registradas"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 text-left border-b border-gray-100 dark:border-gray-700">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">#</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Fecha</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Productos</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Pago</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {filteredSales.map((sale) => {
                  const st = STATUS_LABELS[sale.status] ?? STATUS_LABELS.COMPLETED
                  const isCancelled = sale.status !== "COMPLETED"
                  return (
                    <tr
                      key={sale.id}
                      className={cn(
                        "group hover:bg-gray-50/50 dark:hover:bg-gray-700/40 transition",
                        isCancelled && "opacity-60"
                      )}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm font-bold text-gray-700 dark:text-gray-300">
                          #{sale.number}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {formatDateTime(sale.createdAt)}
                        {sale.user?.name && (
                          <span className="block text-xs text-gray-400 dark:text-gray-500">{sale.user.name}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-700 dark:text-gray-300">
                          {sale.items.slice(0, 2).map((item) => (
                            <span key={item.id} className="block truncate max-w-[160px]">
                              {item.quantity}× {item.productName}
                            </span>
                          ))}
                          {sale.items.length > 2 && (
                            <span className="text-xs text-gray-400">+{sale.items.length - 2} más</span>
                          )}
                        </div>
                        {isCancelled && sale.cancelReason && (
                          <span className="text-xs text-red-500 dark:text-red-400 block mt-0.5">
                            Motivo: {sale.cancelReason}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {PAYMENT_METHOD_LABELS[sale.paymentMethod] ?? sale.paymentMethod}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-gray-800 dark:text-gray-200">
                          {formatCurrency(sale.total)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", st.cls)}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {!isCancelled && (
                          <button
                            onClick={() => setAnularTarget(sale)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition opacity-0 group-hover:opacity-100"
                            title="Anular esta venta"
                          >
                            <Ban size={13} />
                            Anular
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de anulación */}
      {anularTarget && (
        <AnularModal
          sale={anularTarget}
          onConfirm={handleAnular}
          onClose={() => setAnularTarget(null)}
        />
      )}
    </div>
  )
}
