"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  BookOpen,
  Download,
  Calendar,
  ChevronLeft,
  Loader2,
  Sparkles,
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"

interface Row {
  fecha: string
  tipoLabel: string
  tipoCode: number
  letra: string
  numeroFormatted: string
  docTipo: string
  docNumero: string
  cliente: string | null
  total: number
  neto: number
  iva21: number
  iva105: number
  exento: number
  cae: string
  isNC: boolean
}

interface Totals {
  total: number
  neto: number
  iva21: number
  iva105: number
  exento: number
}

const DATE_PRESETS = [
  { label: "Mes actual", offset: 0 },
  { label: "Mes pasado", offset: -1 },
  { label: "Hace 2 meses", offset: -2 },
  { label: "Hace 3 meses", offset: -3 },
]

function monthBounds(offset = 0): { from: string; to: string } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)
  return {
    from: start.toISOString().split("T")[0],
    to: end.toISOString().split("T")[0],
  }
}

export default function LibroIvaPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [totals, setTotals] = useState<Totals>({ total: 0, neto: 0, iva21: 0, iva105: 0, exento: 0 })
  const [loading, setLoading] = useState(true)
  const [paywall, setPaywall] = useState(false)
  const defaults = monthBounds(0)
  const [from, setFrom] = useState(defaults.from)
  const [to, setTo] = useState(defaults.to)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ from, to, format: "json" })
      const r = await fetch(`/api/configuracion/afip/libro-iva?${params}`, { cache: "no-store" })
      if (r.status === 402) {
        setPaywall(true)
        return
      }
      const d = await r.json()
      if (r.ok) {
        setRows(d.rows ?? [])
        setTotals(d.totals ?? { total: 0, neto: 0, iva21: 0, iva105: 0, exento: 0 })
      }
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => {
    load()
  }, [load])

  const applyPreset = (offset: number) => {
    const b = monthBounds(offset)
    setFrom(b.from)
    setTo(b.to)
  }

  const downloadXlsx = () => {
    const params = new URLSearchParams({ from, to, format: "xlsx" })
    window.open(`/api/configuracion/afip/libro-iva?${params}`, "_blank")
  }

  if (paywall) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Link
          href="/configuracion/afip"
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-purple-300 mb-4"
        >
          <ChevronLeft size={12} />
          Volver a configuración AFIP
        </Link>
        <div className="bg-gradient-to-br from-purple-950/40 via-gray-900 to-gray-950 border border-purple-700/40 rounded-2xl p-8 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
            <Sparkles className="w-7 h-7 text-purple-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Libro IVA Ventas</h1>
            <p className="text-sm text-gray-400 mt-1">
              Exportá tu Libro IVA del mes listo para mandárselo al contador o subirlo al portal de AFIP.
              Disponible en el Plan Profesional.
            </p>
          </div>
          <ul className="text-sm text-gray-300 text-left max-w-md mx-auto space-y-1.5">
            <li>📊 Facturas + NC + ND del período, con CAE</li>
            <li>📁 Excel listo para tu contador</li>
            <li>🧮 Totales de neto, IVA y exento ya calculados</li>
            <li>📅 Cualquier mes del histórico</li>
          </ul>
          <Link
            href="/configuracion/suscripcion"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-colors"
          >
            Ver Plan Profesional
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-5 space-y-5">
      <Link
        href="/configuracion/afip"
        className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-purple-300 transition-colors"
      >
        <ChevronLeft size={12} />
        Volver a configuración AFIP
      </Link>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <BookOpen className="text-purple-400" size={26} />
          <div>
            <h1 className="text-2xl font-bold text-white">Libro IVA Ventas</h1>
            <p className="text-xs text-gray-500">
              Comprobantes con valor fiscal del período — pasale el Excel a tu contador.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={downloadXlsx}
          disabled={loading || rows.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm disabled:opacity-50"
        >
          <Download size={14} /> Descargar Excel
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI label="Comprobantes" value={String(rows.length)} />
        <KPI label="Neto" value={formatCurrency(totals.neto)} />
        <KPI label="IVA 21%" value={formatCurrency(totals.iva21)} />
        <KPI label="IVA 10.5%" value={formatCurrency(totals.iva105)} />
        <KPI label="Total neto" value={formatCurrency(totals.total)} accent />
      </div>

      {/* Filtros */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[11px] text-gray-500 mb-1">
            <Calendar size={11} className="inline mr-1" /> Desde
          </label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-[11px] text-gray-500 mb-1">Hasta</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
          />
        </div>
        <div className="flex gap-1">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p.offset)}
              className="px-2.5 py-1.5 text-xs rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">
            <Loader2 size={16} className="inline animate-spin mr-1" /> Cargando…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No hay comprobantes en este período.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-950/40 border-b border-gray-800">
                <tr className="text-[11px] uppercase tracking-wider text-gray-500">
                  <th className="text-left p-3 font-medium">Fecha</th>
                  <th className="text-left p-3 font-medium">Tipo</th>
                  <th className="text-left p-3 font-medium">Número</th>
                  <th className="text-left p-3 font-medium">Doc</th>
                  <th className="text-left p-3 font-medium">Cliente</th>
                  <th className="text-right p-3 font-medium">Neto</th>
                  <th className="text-right p-3 font-medium">IVA 21%</th>
                  <th className="text-right p-3 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr
                    key={idx}
                    className={`border-b border-gray-800/40 ${
                      r.isNC ? "bg-red-950/10" : ""
                    } hover:bg-gray-800/30`}
                  >
                    <td className="p-2.5 text-gray-300">{new Date(r.fecha).toLocaleDateString("es-AR")}</td>
                    <td className="p-2.5 text-gray-300">
                      <span className={r.isNC ? "text-red-400" : ""}>{r.tipoLabel}</span>
                    </td>
                    <td className="p-2.5 font-mono text-gray-300">{r.numeroFormatted}</td>
                    <td className="p-2.5 text-gray-400">{r.docTipo}{r.docNumero !== "0" ? ` · ${r.docNumero}` : ""}</td>
                    <td className="p-2.5 text-gray-300">{r.cliente ?? <span className="text-gray-600">CF</span>}</td>
                    <td className="p-2.5 text-right tabular-nums text-gray-300">{formatCurrency(r.neto)}</td>
                    <td className="p-2.5 text-right tabular-nums text-gray-300">{formatCurrency(r.iva21)}</td>
                    <td className={`p-2.5 text-right tabular-nums font-medium ${r.isNC ? "text-red-400" : "text-white"}`}>
                      {formatCurrency(r.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-950/60 font-bold text-white">
                <tr>
                  <td colSpan={5} className="p-3 text-right">
                    TOTALES
                  </td>
                  <td className="p-3 text-right tabular-nums">{formatCurrency(totals.neto)}</td>
                  <td className="p-3 text-right tabular-nums">{formatCurrency(totals.iva21)}</td>
                  <td className="p-3 text-right tabular-nums">{formatCurrency(totals.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11px] text-gray-500">
        Tip: el Excel exportado tiene una columna por tipo de IVA (21%, 10.5%, exento). Las NC aparecen
        en rojo y restan del total. Si tu contador necesita formato específico de AFIP (RG 1361/02), avisanos.
      </p>
    </div>
  )
}

function KPI({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        accent
          ? "bg-purple-950/30 border-purple-700/40"
          : "bg-gray-900 border-gray-800"
      }`}
    >
      <p className="text-[10px] uppercase tracking-wider text-gray-500">{label}</p>
      <p
        className={`text-lg font-bold tabular-nums mt-1 ${
          accent ? "text-purple-200" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  )
}
