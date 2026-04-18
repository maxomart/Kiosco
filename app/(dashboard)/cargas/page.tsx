"use client"

import { useEffect, useState } from "react"
import { formatCurrency } from "@/lib/utils"
import { Zap, Plus, Phone, TrendingUp, X, Trash2 } from "lucide-react"
import toast from "react-hot-toast"

const RECHARGE_TYPES = [
  { value: "CELULAR_CLARO", label: "Celular Claro" },
  { value: "CELULAR_MOVISTAR", label: "Celular Movistar" },
  { value: "CELULAR_PERSONAL", label: "Celular Personal" },
  { value: "SUBE", label: "SUBE" },
  { value: "SERVICIOS", label: "Servicios" },
  { value: "OTROS", label: "Otros" },
]

const TYPE_COLORS: Record<string, string> = {
  CELULAR_CLARO: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  CELULAR_MOVISTAR: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  CELULAR_PERSONAL: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  SUBE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  SERVICIOS: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  OTROS: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
}

interface Recharge {
  id: string
  type: string
  phoneNumber?: string
  amount: number
  commission: number
  profit: number
  reference?: string
  status: string
  notes?: string
  createdAt: string
}

const emptyForm = {
  type: "CELULAR_CLARO",
  phoneNumber: "",
  montoCobrado: 0,
  tuCosto: 0,
  reference: "",
}

export default function CargasPage() {
  const [recharges, setRecharges] = useState<Recharge[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const gananciaPreview = form.montoCobrado - form.tuCosto

  const fetchRecharges = async () => {
    try {
      const r = await fetch("/api/cargas")
      if (r.ok) setRecharges(await r.json())
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRecharges() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const profit = form.montoCobrado - form.tuCosto
      const r = await fetch("/api/cargas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          phoneNumber: form.phoneNumber || undefined,
          amount: form.montoCobrado,
          commission: form.tuCosto,
          profit,
          reference: form.reference || undefined,
        }),
      })
      if (r.ok) {
        toast.success("Recarga registrada")
        setForm(emptyForm)
        setShowForm(false)
        fetchRecharges()
      } else {
        const err = await r.json()
        toast.error(err.error ?? "Error al registrar recarga")
      }
    } catch {
      toast.error("Error de conexión")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRecharge = async (id: string) => {
    try {
      const res = await fetch(`/api/cargas/${id}`, { method: "DELETE" })
      if (res.ok) {
        setRecharges(prev => prev.filter(r => r.id !== id))
        toast.success("Recarga eliminada")
      } else {
        toast.error("No se pudo eliminar la recarga")
      }
    } catch {
      toast.error("Error de conexión")
    }
  }

  const totalProfit = recharges.reduce((s, r) => s + r.profit, 0)
  const totalAmount = recharges.reduce((s, r) => s + r.amount, 0)

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Cargas y Recargas</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
            {recharges.length} recargas registradas
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition text-sm font-bold"
        >
          <Plus size={16} />
          Nueva recarga
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Total cobrado</p>
          <p className="text-2xl font-bold text-gray-800 dark:text-white">{formatCurrency(totalAmount)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Ganancia total</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalProfit)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Cantidad</p>
          <p className="text-2xl font-bold text-gray-800 dark:text-white">{recharges.length}</p>
        </div>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-base font-bold text-gray-800 dark:text-white">Registrar recarga</h2>
              <button
                onClick={() => setShowForm(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Tipo */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                  Tipo
                </label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:border-blue-500 dark:focus:border-blue-400 transition text-sm dark:text-white"
                >
                  {RECHARGE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Teléfono */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                  Número de teléfono (opcional)
                </label>
                <input
                  type="text"
                  value={form.phoneNumber}
                  onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                  placeholder="ej: 11-1234-5678"
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:border-blue-500 dark:focus:border-blue-400 transition text-sm dark:text-white"
                />
              </div>

              {/* Monto cobrado y tu costo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                    Monto cobrado *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={form.montoCobrado || ""}
                    onChange={(e) => setForm({ ...form, montoCobrado: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:border-blue-500 dark:focus:border-blue-400 transition text-sm dark:text-white"
                  />
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Lo que cobró al cliente</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                    Tu costo
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.tuCosto || ""}
                    onChange={(e) => setForm({ ...form, tuCosto: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:border-blue-500 dark:focus:border-blue-400 transition text-sm dark:text-white"
                  />
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Lo que pagaste a la operadora</p>
                </div>
              </div>

              {/* Ganancia preview */}
              <div className="flex items-center gap-3 px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
                <TrendingUp size={16} className="text-green-600 dark:text-green-400 flex-shrink-0" />
                <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">Ganancia:</span>
                <span className={`text-base font-bold ml-auto ${gananciaPreview >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  {formatCurrency(gananciaPreview)}
                </span>
              </div>

              {/* Referencia */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                  Referencia (opcional)
                </label>
                <input
                  type="text"
                  value={form.reference}
                  onChange={(e) => setForm({ ...form, reference: e.target.value })}
                  placeholder="Número de transacción..."
                  className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:border-blue-500 dark:focus:border-blue-400 transition text-sm dark:text-white"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl transition text-sm font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl transition text-sm font-bold"
                >
                  {saving ? "Guardando..." : "Registrar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Tipo</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Teléfono</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Monto cobrado</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Tu costo</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Ganancia</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Fecha</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {recharges.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-gray-400 dark:text-gray-500">
                    <Zap size={48} className="mx-auto mb-3 opacity-40" />
                    <p>No hay recargas registradas</p>
                  </td>
                </tr>
              ) : (
                recharges.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition group">
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${TYPE_COLORS[r.type] ?? TYPE_COLORS.OTROS}`}>
                        {RECHARGE_TYPES.find((t) => t.value === r.type)?.label ?? r.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.phoneNumber ? (
                        <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
                          <Phone size={13} className="text-gray-400 dark:text-gray-500" />
                          {r.phoneNumber}
                        </div>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-gray-800 dark:text-white">{formatCurrency(r.amount)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-500 dark:text-gray-400">{formatCurrency(r.commission)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <TrendingUp size={13} className="text-green-500" />
                        <span className="text-sm font-semibold text-green-600">{formatCurrency(r.profit)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {new Date(r.createdAt).toLocaleDateString("es-AR", {
                        day: "numeric", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDeleteRecharge(r.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition opacity-0 group-hover:opacity-100"
                        title="Eliminar recarga"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
