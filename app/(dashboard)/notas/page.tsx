"use client"

import { Fragment, useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  Receipt,
  FileMinus,
  FilePlus2,
  Download,
  QrCode,
  Calendar,
  Filter,
  ExternalLink,
} from "lucide-react"
import { formatCurrency, formatDateTime } from "@/lib/utils"

interface SaleRef {
  id: string
  number: number
  invoiceNumber: number | null
  invoiceType: string | null
  pointOfSale: number | null
  clientName: string | null
}

interface NoteRow {
  id: string
  kind: "credit" | "debit"
  cae: string
  caeExpiresAt: string
  invoiceNumber: number
  invoiceLetter: string
  pointOfSale: number
  amount: number
  concept: string | null
  qrUrl: string | null
  createdAt: string
  sale: SaleRef | null
}

interface Summary {
  credit: { count: number; total: number }
  debit: { count: number; total: number }
}

const DATE_PRESETS = [
  { label: "Hoy", days: 0 },
  { label: "7 días", days: 7 },
  { label: "30 días", days: 30 },
  { label: "90 días", days: 90 },
]

export default function NotasPage() {
  const [notes, setNotes] = useState<NoteRow[]>([])
  const [summary, setSummary] = useState<Summary>({ credit: { count: 0, total: 0 }, debit: { count: 0, total: 0 } })
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [kindFilter, setKindFilter] = useState<"" | "credit" | "debit">("")
  const [from, setFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split("T")[0]
  })
  const [to, setTo] = useState(() => new Date().toISOString().split("T")[0])
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<string | null>(null)
  const PER_PAGE = 25

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PER_PAGE),
      from: `${from}T00:00:00`,
      to: `${to}T23:59:59`,
      ...(kindFilter ? { kind: kindFilter } : {}),
    })
    try {
      const r = await fetch(`/api/notas?${params.toString()}`, { cache: "no-store" })
      if (r.ok) {
        const d = await r.json()
        setNotes(d.notes ?? [])
        setSummary(d.summary ?? { credit: { count: 0, total: 0 }, debit: { count: 0, total: 0 } })
        setTotal(d.total ?? 0)
      }
    } finally {
      setLoading(false)
    }
  }, [page, kindFilter, from, to])

  useEffect(() => {
    load()
  }, [load])

  const applyPreset = (days: number) => {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - days)
    setFrom(start.toISOString().split("T")[0])
    setTo(end.toISOString().split("T")[0])
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))
  const netBalance = summary.debit.total - summary.credit.total

  return (
    <div className="space-y-5 p-5">
      <div className="flex items-center gap-3">
        <Receipt className="text-purple-400" size={26} />
        <div>
          <h1 className="text-2xl font-bold text-white">Notas de crédito y débito</h1>
          <p className="text-xs text-gray-500">
            Historial de NC/ND emitidas en AFIP — descargá comprobantes y validá con el QR.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wider">
            <FileMinus size={14} className="text-red-400" /> Notas de crédito
          </div>
          <p className="text-2xl font-bold text-white mt-2 tabular-nums">
            {formatCurrency(summary.credit.total)}
          </p>
          <p className="text-xs text-gray-500 mt-1">{summary.credit.count} emitidas</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wider">
            <FilePlus2 size={14} className="text-blue-400" /> Notas de débito
          </div>
          <p className="text-2xl font-bold text-white mt-2 tabular-nums">
            {formatCurrency(summary.debit.total)}
          </p>
          <p className="text-xs text-gray-500 mt-1">{summary.debit.count} emitidas</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wider">
            <Receipt size={14} className="text-purple-400" /> Saldo neto
          </div>
          <p
            className={`text-2xl font-bold mt-2 tabular-nums ${netBalance >= 0 ? "text-emerald-400" : "text-red-400"}`}
          >
            {netBalance >= 0 ? "+" : ""}
            {formatCurrency(netBalance)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Débitos − Créditos</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gray-500 font-semibold">
          <Filter size={12} /> Filtros
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Tipo</label>
            <select
              value={kindFilter}
              onChange={(e) => {
                setKindFilter(e.target.value as "" | "credit" | "debit")
                setPage(1)
              }}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
            >
              <option value="">Todos</option>
              <option value="credit">Solo NC</option>
              <option value="debit">Solo ND</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-gray-500 mb-1">
              <Calendar size={11} className="inline mr-1" />
              Desde
            </label>
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value)
                setPage(1)
              }}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Hasta</label>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value)
                setPage(1)
              }}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
            />
          </div>

          <div className="flex gap-1">
            {DATE_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p.days)}
                className="px-2.5 py-1.5 text-xs rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">Cargando…</div>
        ) : notes.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No hay notas en este período.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-950/40 border-b border-gray-800">
              <tr className="text-[11px] uppercase tracking-wider text-gray-500">
                <th className="text-left p-3 font-medium">Tipo</th>
                <th className="text-left p-3 font-medium">Número</th>
                <th className="text-left p-3 font-medium">Factura asociada</th>
                <th className="text-left p-3 font-medium">Cliente</th>
                <th className="text-right p-3 font-medium">Monto</th>
                <th className="text-left p-3 font-medium">Fecha</th>
                <th className="text-right p-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {notes.map((n) => {
                const isCredit = n.kind === "credit"
                const isExp = expanded === n.id
                const Icon = isCredit ? FileMinus : FilePlus2
                const accentColor = isCredit ? "text-red-400" : "text-blue-400"
                const numero = `${String(n.pointOfSale).padStart(4, "0")}-${String(n.invoiceNumber).padStart(8, "0")}`
                const facNumero = n.sale?.invoiceNumber
                  ? `${String(n.sale.pointOfSale ?? n.pointOfSale).padStart(4, "0")}-${String(n.sale.invoiceNumber).padStart(8, "0")}`
                  : null
                return (
                  <Fragment key={n.id}>
                    <tr
                      onClick={() => setExpanded(isExp ? null : n.id)}
                      className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer transition-colors"
                    >
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${accentColor}`}>
                          <Icon size={14} /> {isCredit ? "NC" : "ND"} {n.invoiceLetter}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-xs text-gray-300">{numero}</td>
                      <td className="p-3 text-xs text-gray-400">
                        {n.sale?.invoiceType && facNumero ? (
                          <Link
                            href={`/ventas?search=${n.sale.number}`}
                            className="hover:text-purple-300 underline-offset-2 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Factura {n.sale.invoiceType} {facNumero}
                          </Link>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      <td className="p-3 text-xs text-gray-300">
                        {n.sale?.clientName ?? <span className="text-gray-600">Consumidor final</span>}
                      </td>
                      <td className={`p-3 text-right font-medium tabular-nums ${accentColor}`}>
                        {isCredit ? "−" : "+"}
                        {formatCurrency(n.amount)}
                      </td>
                      <td className="p-3 text-xs text-gray-400">{formatDateTime(n.createdAt)}</td>
                      <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1">
                          <a
                            href={`/api/sales/notes/${n.id}/ticket`}
                            target="_blank"
                            rel="noopener"
                            className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                            title="Descargar comprobante PDF"
                          >
                            <Download size={14} />
                          </a>
                          {n.qrUrl && (
                            <a
                              href={n.qrUrl}
                              target="_blank"
                              rel="noopener"
                              className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                              title="Validar en AFIP"
                            >
                              <ExternalLink size={14} />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExp && (
                      <tr className="border-b border-gray-800/50 bg-gray-950/40">
                        <td colSpan={7} className="p-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">CAE</p>
                              <p className="font-mono text-gray-300 break-all">{n.cae}</p>
                              <p className="text-[10px] text-gray-500 mt-1">
                                Vence {new Date(n.caeExpiresAt).toLocaleDateString("es-AR")}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Concepto</p>
                              <p className="text-gray-300">
                                {n.concept ?? <span className="text-gray-600 italic">Sin concepto</span>}
                              </p>
                            </div>
                            {n.qrUrl && (
                              <div className="flex justify-center md:justify-end">
                                <div className="bg-white p-2 rounded-lg">
                                  <img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(n.qrUrl)}`}
                                    alt="QR AFIP"
                                    className="w-24 h-24"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-gray-800 text-xs">
            <span className="text-gray-500">
              Página {page} de {totalPages} · {total} notas
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 disabled:opacity-40"
              >
                ← Anterior
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 disabled:opacity-40"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
