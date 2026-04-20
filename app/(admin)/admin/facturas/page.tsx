"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { ExternalLink, ChevronLeft, ChevronRight } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import Breadcrumbs from "@/components/admin/Breadcrumbs"

interface Invoice {
  id: string
  number: string
  amount: string
  currency: string
  status: string
  paidAt: string | null
  pdfUrl: string | null
  createdAt: string
  subscription: {
    plan: string
    tenant: { id: string; name: string; slug: string }
  }
}

const STATUSES = ["PAID", "PENDING", "FAILED", "REFUNDED"]

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const limit = 25

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      ...(status && { status }),
      ...(from && { from }),
      ...(to && { to }),
    })
    try {
      const res = await fetch(`/api/admin/invoices?${params}`)
      if (res.ok) {
        const d = await res.json()
        setInvoices(d.invoices || [])
        setTotal(d.total || 0)
      }
    } finally { setLoading(false) }
  }, [page, status, from, to])

  useEffect(() => { load() }, [load])

  const totalPaid = invoices.filter(i => i.status === "PAID").reduce((acc, i) => acc + Number(i.amount), 0)
  const pages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="p-6 space-y-6">
      <Breadcrumbs items={[{ label: "Admin", href: "/admin" }, { label: "Facturas" }]} />

      <div>
        <h1 className="text-2xl font-bold text-white">Facturas</h1>
        <p className="text-gray-400 text-sm mt-1">
          {total} facturas · ${totalPaid.toFixed(0)} cobradas en esta página
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
          <option value="">Todos los estados</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <div className="flex items-center gap-2 text-sm">
          <label className="text-gray-400">Desde</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white" />
          <label className="text-gray-400">Hasta</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white" />
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400">
              <th className="p-4 text-left font-medium">Número</th>
              <th className="p-4 text-left font-medium">Tenant</th>
              <th className="p-4 text-right font-medium">Monto</th>
              <th className="p-4 text-center font-medium">Estado</th>
              <th className="p-4 text-left font-medium">Pagada</th>
              <th className="p-4 text-left font-medium">Creada</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}><td colSpan={7} className="p-4"><div className="h-4 bg-gray-800 rounded animate-pulse" /></td></tr>
            )) : invoices.length === 0 ? (
              <tr><td colSpan={7} className="p-12 text-center text-gray-500">No hay facturas.</td></tr>
            ) : invoices.map(inv => (
              <tr key={inv.id} className="hover:bg-gray-800/30">
                <td className="p-4 text-white font-mono text-xs">{inv.number}</td>
                <td className="p-4">
                  <Link href={`/admin/tenants/${inv.subscription.tenant.id}`} className="text-purple-300 hover:text-purple-200">
                    {inv.subscription.tenant.name}
                  </Link>
                </td>
                <td className="p-4 text-right text-gray-200">{formatCurrency(Number(inv.amount), inv.currency)}</td>
                <td className="p-4 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    inv.status === "PAID" ? "bg-green-500/10 text-green-400" :
                    inv.status === "PENDING" ? "bg-yellow-500/10 text-yellow-400" :
                    "bg-red-500/10 text-red-400"
                  }`}>{inv.status}</span>
                </td>
                <td className="p-4 text-gray-400">{inv.paidAt ? formatDate(inv.paidAt) : "—"}</td>
                <td className="p-4 text-gray-400">{formatDate(inv.createdAt)}</td>
                <td className="p-4 text-right">
                  {inv.pdfUrl ? (
                    <a href={inv.pdfUrl} target="_blank" rel="noopener" className="text-purple-400 hover:text-purple-300 inline-flex items-center gap-1 text-xs">
                      PDF <ExternalLink size={12} />
                    </a>
                  ) : <span className="text-gray-600 text-xs">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Página {page} de {pages}</p>
        <div className="flex gap-1">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
            className="p-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40">
            <ChevronLeft size={14} />
          </button>
          <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}
            className="p-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
