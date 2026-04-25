"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import {
  ShoppingBag,
  Search,
  XCircle,
  ChevronDown,
  ChevronRight,
  Sparkles,
  TrendingUp,
  Receipt,
  CreditCard,
  Users,
  Calendar,
  Filter,
} from "lucide-react"
import toast from "react-hot-toast"
import { formatCurrency, formatDateTime } from "@/lib/utils"
import { useConfirm } from "@/components/shared/ConfirmDialog"
import { PageTip } from "@/components/shared/PageTip"
import { SalesAIChat } from "@/components/ventas/SalesAIChat"

interface SaleItem { productName: string; quantity: number; unitPrice: number; subtotal: number }
interface Sale {
  id: string
  number: string
  status: "COMPLETED" | "CANCELLED" | "PENDING"
  total: number
  subtotal: number
  discountAmount: number
  taxAmount: number
  paymentMethod: string
  createdAt: string
  client: { name: string } | null
  cashSession: { id: string } | null
  items: SaleItem[]
  _count: { items: number }
}

const STATUS_LABELS: Record<string, string> = { COMPLETED: "Completada", CANCELLED: "Anulada", PENDING: "Pendiente" }
const STATUS_COLORS: Record<string, string> = {
  COMPLETED: "bg-emerald-900/40 text-emerald-300 border border-emerald-700/40",
  CANCELLED: "bg-red-900/40 text-red-300 border border-red-700/40",
  PENDING: "bg-amber-900/40 text-amber-300 border border-amber-700/40",
}
const METHOD_LABELS: Record<string, string> = {
  CASH: "Efectivo", DEBIT: "Débito", CREDIT: "Crédito", TRANSFER: "Transferencia",
  MERCADOPAGO: "Mercado Pago", UALA: "Ualá", MODO: "MODO",
  NARANJA_X: "Naranja X", CUENTA_DNI: "Cuenta DNI", LOYALTY_POINTS: "Puntos", MIXED: "Mixto",
}

const DATE_PRESETS = [
  { label: "Hoy", days: 0 },
  { label: "7 días", days: 7 },
  { label: "30 días", days: 30 },
  { label: "90 días", days: 90 },
]

export default function VentasPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [methodFilter, setMethodFilter] = useState("")
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split("T")[0] })
  const [to, setTo] = useState(() => new Date().toISOString().split("T")[0])
  const [showAI, setShowAI] = useState(false)
  const confirm = useConfirm()
  const PER_PAGE = 25

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(page), limit: String(PER_PAGE),
      from: `${from}T00:00:00`, to: `${to}T23:59:59`,
      ...(search && { search }),
      ...(statusFilter && { status: statusFilter }),
      ...(methodFilter && { paymentMethod: methodFilter }),
    })
    const res = await fetch(`/api/ventas?${params}`)
    if (res.ok) { const d = await res.json(); setSales(d.sales || []); setTotal(d.total || 0) }
    setLoading(false)
  }, [page, search, statusFilter, methodFilter, from, to])

  useEffect(() => { load() }, [load])

  const handleCancel = async (id: string) => {
    const ok = await confirm({
      title: "¿Anular esta venta?",
      description: "Se reversa el stock y la venta queda marcada como anulada.",
      confirmText: "Anular venta",
      tone: "danger",
    })
    if (!ok) return
    setCancelling(id)
    const res = await fetch(`/api/ventas/${id}/anular`, { method: "POST" })
    if (!res.ok) { const d = await res.json(); toast.error(d.error || "Error al anular") }
    else toast.success("Venta anulada")
    await load()
    setCancelling(null)
  }

  const applyPreset = (days: number) => {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - days)
    setFrom(start.toISOString().split("T")[0])
    setTo(end.toISOString().split("T")[0])
    setPage(1)
  }

  // KPIs from current sales in view
  const kpis = useMemo(() => {
    const completed = sales.filter((s) => s.status === "COMPLETED")
    const revenue = completed.reduce((a, s) => a + Number(s.total), 0)
    const cancelled = sales.filter((s) => s.status === "CANCELLED").length
    const avgTicket = completed.length > 0 ? revenue / completed.length : 0
    const uniqueClients = new Set(completed.map((s) => s.client?.name).filter(Boolean)).size
    return { revenue, completed: completed.length, cancelled, avgTicket, uniqueClients }
  }, [sales])

  const totalPages = Math.ceil(total / PER_PAGE)
  const hasActiveFilters = search || statusFilter || methodFilter

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <PageTip id="ventas:intro" tone="accent">
        <strong>💡 Preguntale a tu negocio:</strong> usá el botón <strong>✨ Consultar con IA</strong> para hacer preguntas como{" "}
        <em>"¿cuánto vendí ayer?"</em> o <em>"¿cuál es mi producto más rentable?"</em>. Te responde al toque con tus datos reales.
      </PageTip>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Ventas</h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">
            Historial de transacciones · <span className="text-gray-300 font-medium">{total}</span> en el período
          </p>
        </div>
        <button
          onClick={() => setShowAI(true)}
          className="hidden md:flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-accent to-accent/80 hover:from-accent-hover text-accent-foreground font-semibold text-sm shadow-lg shadow-accent/20 transition-colors whitespace-nowrap"
        >
          <Sparkles size={16} />
          Consultar con IA
        </button>
      </div>

      {/* KPIs — 2 cols on mobile, 4 on tablet+ for compact reading */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-gradient-to-br from-emerald-900/30 to-emerald-950/30 border border-emerald-700/40 rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-900/50 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-emerald-400 truncate">Ingresos</p>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-white tabular-nums break-all">{formatCurrency(kpis.revenue)}</p>
          <p className="text-[11px] text-gray-500 mt-1">{kpis.completed} completadas</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-sky-900/40 flex items-center justify-center flex-shrink-0">
              <Receipt className="w-4 h-4 text-sky-400" />
            </div>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 truncate">Ticket prom.</p>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-white tabular-nums break-all">{formatCurrency(kpis.avgTicket)}</p>
          <p className="text-[11px] text-gray-500 mt-1">Por venta</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-accent-soft flex items-center justify-center flex-shrink-0">
              <Users className="w-4 h-4 text-accent" />
            </div>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 truncate">Clientes</p>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-white tabular-nums">{kpis.uniqueClients}</p>
          <p className="text-[11px] text-gray-500 mt-1">Únicos</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              kpis.cancelled > 0 ? "bg-red-900/40" : "bg-gray-800"
            }`}>
              <XCircle className={`w-4 h-4 ${kpis.cancelled > 0 ? "text-red-400" : "text-gray-500"}`} />
            </div>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 truncate">Anuladas</p>
          </div>
          <p className={`text-lg sm:text-2xl font-bold tabular-nums ${kpis.cancelled > 0 ? "text-red-400" : "text-white"}`}>
            {kpis.cancelled}
          </p>
          <p className="text-[11px] text-gray-500 mt-1">
            {kpis.completed + kpis.cancelled > 0
              ? `${((kpis.cancelled / (kpis.completed + kpis.cancelled)) * 100).toFixed(1)}% del total`
              : "En el período"}
          </p>
        </div>
      </div>

      {/* Date preset chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold flex items-center gap-1">
          <Calendar className="w-3 h-3" /> Período:
        </span>
        {DATE_PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => applyPreset(p.days)}
            className="px-3 py-1 rounded-full text-xs bg-gray-800 hover:bg-accent-soft hover:text-accent text-gray-400 border border-gray-800 hover:border-accent/50 transition-colors"
          >
            {p.label}
          </button>
        ))}
        <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1) }}
          className="px-2 py-1 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white focus:outline-none focus:border-accent" />
        <span className="text-gray-600 text-xs">—</span>
        <input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1) }}
          className="px-2 py-1 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white focus:outline-none focus:border-accent" />
      </div>

      {/* Filters */}
      <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-3 flex flex-wrap gap-2 items-center">
        <Filter className="w-4 h-4 text-gray-500" />
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar por número..."
            className="w-full pl-8 pr-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent" />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-accent">
          <option value="">Todos los estados</option>
          <option value="COMPLETED">Completadas</option>
          <option value="CANCELLED">Anuladas</option>
        </select>
        <select value={methodFilter} onChange={e => { setMethodFilter(e.target.value); setPage(1) }}
          className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-accent">
          <option value="">Todos los métodos</option>
          {Object.entries(METHOD_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {hasActiveFilters && (
          <button
            onClick={() => { setSearch(""); setStatusFilter(""); setMethodFilter("") }}
            className="text-xs text-gray-400 hover:text-accent px-2 py-1 rounded-lg hover:bg-gray-800 transition-colors"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-950/30">
                <th className="p-4 w-8"></th>
                <th className="p-4 text-left text-[10px] uppercase tracking-wider text-gray-500 font-semibold">N° Venta</th>
                <th className="p-4 text-left text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Fecha</th>
                <th className="p-4 text-left text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Cliente</th>
                <th className="p-4 text-left text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Método</th>
                <th className="p-4 text-right text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Items</th>
                <th className="p-4 text-right text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Total</th>
                <th className="p-4 text-center text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Estado</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-800/50">
                    <td colSpan={9} className="p-4"><div className="h-4 bg-gray-800 rounded animate-pulse" /></td>
                  </tr>
                ))
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center">
                    <div className="inline-flex w-16 h-16 rounded-2xl bg-gray-800/50 items-center justify-center mb-3">
                      <ShoppingBag className="w-7 h-7 text-gray-600" />
                    </div>
                    <p className="text-gray-400 font-medium mb-1">No hay ventas en este período</p>
                    {hasActiveFilters ? (
                      <button
                        onClick={() => { setSearch(""); setStatusFilter(""); setMethodFilter("") }}
                        className="text-xs text-accent hover:underline"
                      >
                        Limpiar filtros
                      </button>
                    ) : (
                      <p className="text-xs text-gray-500">
                        Cuando hagas ventas desde el <Link href="/pos" className="text-accent hover:underline">POS</Link> van a aparecer acá.
                      </p>
                    )}
                  </td>
                </tr>
              ) : sales.map(s => {
                const isExpanded = expanded === s.id
                return (
                  <React.Fragment key={s.id}>
                    <tr
                      className={`border-b border-gray-800/50 cursor-pointer transition-colors ${
                        isExpanded ? "bg-gray-800/40" : "hover:bg-gray-800/30"
                      } ${s.status === "CANCELLED" ? "opacity-60" : ""}`}
                      onClick={() => setExpanded(isExpanded ? null : s.id)}
                    >
                      <td className="p-4 text-gray-500">
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td className="p-4 font-mono text-accent font-medium">#{s.number}</td>
                      <td className="p-4 text-gray-300 text-xs">{formatDateTime(s.createdAt)}</td>
                      <td className="p-4 text-gray-300">
                        {s.client?.name || <span className="text-gray-600 italic">Consumidor final</span>}
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1 text-gray-300 text-xs">
                          <CreditCard className="w-3 h-3 text-gray-500" />
                          {METHOD_LABELS[s.paymentMethod] || s.paymentMethod}
                        </span>
                      </td>
                      <td className="p-4 text-right text-gray-300">{s._count?.items ?? s.items?.length ?? 0}</td>
                      <td className="p-4 text-right font-semibold text-white">{formatCurrency(s.total)}</td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[s.status]}`}>
                          {STATUS_LABELS[s.status]}
                        </span>
                      </td>
                      <td className="p-4" onClick={e => e.stopPropagation()}>
                        {s.status === "COMPLETED" && (
                          <button onClick={() => handleCancel(s.id)} disabled={cancelling === s.id}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50"
                            title="Anular venta">
                            <XCircle size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                    {isExpanded && s.items && (
                      <tr key={`${s.id}-detail`} className="border-b border-gray-800/50 bg-gray-950/50">
                        <td colSpan={9} className="px-12 py-4">
                          <div className="space-y-3">
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
                                Items ({s.items.length})
                              </p>
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-gray-500 border-b border-gray-800">
                                    <th className="pb-2 text-left font-medium">Producto</th>
                                    <th className="pb-2 text-right font-medium">Cant.</th>
                                    <th className="pb-2 text-right font-medium">P. Unit.</th>
                                    <th className="pb-2 text-right font-medium">Subtotal</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800/50">
                                  {s.items.map((item, i) => (
                                    <tr key={i}>
                                      <td className="py-1.5 text-gray-300">{item.productName}</td>
                                      <td className="py-1.5 text-right text-gray-400">{item.quantity}</td>
                                      <td className="py-1.5 text-right text-gray-400">{formatCurrency(item.unitPrice)}</td>
                                      <td className="py-1.5 text-right text-gray-300">{formatCurrency(item.subtotal)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  {s.discountAmount > 0 && (
                                    <tr>
                                      <td colSpan={3} className="pt-2 text-right text-gray-500">Descuento:</td>
                                      <td className="pt-2 text-right text-emerald-400">−{formatCurrency(s.discountAmount)}</td>
                                    </tr>
                                  )}
                                  <tr className="border-t border-gray-700">
                                    <td colSpan={3} className="pt-2 text-right text-gray-400 font-semibold">Total:</td>
                                    <td className="pt-2 text-right font-semibold text-white text-sm">{formatCurrency(s.total)}</td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800 bg-gray-950/30">
            <span className="text-xs text-gray-500">
              Página {page} de {totalPages} · {total} ventas
            </span>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 disabled:opacity-40 transition-colors">
                ← Anterior
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 disabled:opacity-40 transition-colors">
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* AI Chat */}
      <SalesAIChat open={showAI} onClose={() => setShowAI(false)} />

      {/* Floating AI button on mobile */}
      <button
        onClick={() => setShowAI(true)}
        className="md:hidden fixed bottom-6 right-6 w-14 h-14 rounded-full bg-accent text-accent-foreground shadow-2xl shadow-accent/30 flex items-center justify-center z-30 active:scale-95 transition-transform"
        aria-label="Preguntar a la IA"
      >
        <Sparkles className="w-6 h-6" />
      </button>
    </div>
  )
}
