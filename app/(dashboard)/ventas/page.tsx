"use client"

import React, { useState, useEffect, useCallback } from "react"
import { ShoppingBag, Search, Eye, XCircle, ChevronDown, ChevronRight } from "lucide-react"
import { formatCurrency, formatDateTime } from "@/lib/utils"

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
  COMPLETED: "bg-green-500/10 text-green-400",
  CANCELLED: "bg-red-500/10 text-red-400",
  PENDING: "bg-yellow-500/10 text-yellow-400",
}
const METHOD_LABELS: Record<string, string> = {
  CASH: "Efectivo", DEBIT: "Débito", CREDIT: "Crédito", TRANSFER: "Transferencia",
  MERCADOPAGO: "Mercado Pago", UALA: "Ualá", MODO: "MODO",
  NARANJA_X: "Naranja X", CUENTA_DNI: "Cuenta DNI", LOYALTY_POINTS: "Puntos", MIXED: "Mixto",
}

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
    if (!confirm("¿Anular esta venta? Se reversará el stock.")) return
    setCancelling(id)
    const res = await fetch(`/api/ventas/${id}/anular`, { method: "POST" })
    if (!res.ok) { const d = await res.json(); alert(d.error || "Error al anular") }
    await load()
    setCancelling(null)
  }

  const totalRevenue = sales.filter(s => s.status === "COMPLETED").reduce((acc, s) => acc + Number(s.total), 0)
  const totalPages = Math.ceil(total / PER_PAGE)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Ventas</h1>
          <p className="text-gray-400 text-sm mt-1">{total} transacciones · {formatCurrency(totalRevenue)} en el período</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar por número..."
            className="pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
        </div>
        <input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1) }}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500" />
        <input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1) }}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500" />
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500">
          <option value="">Todos los estados</option>
          <option value="COMPLETED">Completadas</option>
          <option value="CANCELLED">Anuladas</option>
        </select>
        <select value={methodFilter} onChange={e => { setMethodFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500">
          <option value="">Todos los métodos</option>
          {Object.entries(METHOD_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="p-4 w-8"></th>
              <th className="p-4 text-left text-gray-400 font-medium">N° Venta</th>
              <th className="p-4 text-left text-gray-400 font-medium">Fecha</th>
              <th className="p-4 text-left text-gray-400 font-medium">Cliente</th>
              <th className="p-4 text-left text-gray-400 font-medium">Método</th>
              <th className="p-4 text-right text-gray-400 font-medium">Items</th>
              <th className="p-4 text-right text-gray-400 font-medium">Total</th>
              <th className="p-4 text-center text-gray-400 font-medium">Estado</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-800/50">
                  <td colSpan={9} className="p-4"><div className="h-4 bg-gray-800 rounded animate-pulse" /></td>
                </tr>
              ))
            ) : sales.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-12 text-center text-gray-500">
                  <ShoppingBag size={40} className="mx-auto mb-3 opacity-30" />
                  No hay ventas en este período
                </td>
              </tr>
            ) : sales.map(s => (
              <React.Fragment key={s.id}>
                <tr className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors cursor-pointer"
                  onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
                  <td className="p-4 text-gray-500">
                    {expanded === s.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </td>
                  <td className="p-4 font-mono text-purple-400 font-medium">#{s.number}</td>
                  <td className="p-4 text-gray-300">{formatDateTime(s.createdAt)}</td>
                  <td className="p-4 text-gray-300">{s.client?.name || <span className="text-gray-600">Consumidor final</span>}</td>
                  <td className="p-4 text-gray-300">{METHOD_LABELS[s.paymentMethod] || s.paymentMethod}</td>
                  <td className="p-4 text-right text-gray-300">{s._count?.items ?? s.items?.length ?? 0}</td>
                  <td className="p-4 text-right font-semibold text-white">{formatCurrency(s.total)}</td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[s.status]}`}>
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
                {expanded === s.id && s.items && (
                  <tr key={`${s.id}-detail`} className="border-b border-gray-800/50 bg-gray-800/20">
                    <td colSpan={9} className="px-12 py-3">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-500">
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
                          <tr className="border-t border-gray-700">
                            <td colSpan={3} className="pt-2 text-right text-gray-500">
                              {s.discountAmount > 0 && `Descuento: -${formatCurrency(s.discountAmount)} · `}
                              Total:
                            </td>
                            <td className="pt-2 text-right font-semibold text-white">{formatCurrency(s.total)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <span className="text-sm text-gray-500">{total} ventas</span>
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
    </div>
  )
}
