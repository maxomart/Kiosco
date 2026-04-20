"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Trash2, TrendingDown, Calendar, Filter } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"

interface Expense {
  id: string
  description: string
  amount: number
  category: string
  paymentMethod: string
  notes: string | null
  date: string
  createdAt: string
}

const EXPENSE_CATEGORIES = [
  "Alquiler", "Servicios", "Sueldos", "Mercadería", "Limpieza", "Impuestos",
  "Mantenimiento", "Publicidad", "Transporte", "Otros",
]
const PAYMENT_METHODS = ["CASH", "DEBIT", "CREDIT", "TRANSFER"]
const METHOD_LABELS: Record<string, string> = { CASH: "Efectivo", DEBIT: "Débito", CREDIT: "Crédito", TRANSFER: "Transferencia" }

export default function GastosPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [catFilter, setCatFilter] = useState("")
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0] })
  const [to, setTo] = useState(() => new Date().toISOString().split("T")[0])
  const [form, setForm] = useState({ description: "", amount: "", category: "Otros", paymentMethod: "CASH", notes: "", date: new Date().toISOString().split("T")[0] })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      from: `${from}T00:00:00`, to: `${to}T23:59:59`,
      ...(catFilter && { category: catFilter }),
    })
    const res = await fetch(`/api/gastos?${params}`)
    if (res.ok) {
      const d = await res.json()
      setExpenses(d.expenses || [])
      setTotal(d.total || 0)
    }
    setLoading(false)
  }, [from, to, catFilter])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    if (!form.description.trim() || !form.amount || isNaN(parseFloat(form.amount))) return
    setSaving(true)
    const res = await fetch("/api/gastos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
    })
    if (res.ok) {
      setForm({ description: "", amount: "", category: "Otros", paymentMethod: "CASH", notes: "", date: new Date().toISOString().split("T")[0] })
      setShowForm(false)
      await load()
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar gasto?")) return
    setDeleting(id)
    await fetch(`/api/gastos/${id}`, { method: "DELETE" })
    await load()
    setDeleting(null)
  }

  // Group by category for summary
  const byCat = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + Number(e.amount)
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Gastos</h1>
          <p className="text-gray-400 text-sm mt-1">Registro de egresos del negocio</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-colors">
          <Plus size={16} /> Nuevo gasto
        </button>
      </div>

      {/* New expense form */}
      {showForm && (
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-4">
          <h3 className="text-white font-medium">Registrar gasto</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-400 mb-1.5">Descripción *</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Ej: Pago de luz"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Monto *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  min="0" step="0.01" placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Categoría</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500">
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Método de pago</label>
              <select value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500">
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Fecha</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500" />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs text-gray-400 mb-1.5">Notas</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Observaciones opcionales"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors">Cancelar</button>
            <button onClick={handleSave} disabled={saving || !form.description || !form.amount}
              className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium transition-colors">
              {saving ? "Guardando..." : "Guardar gasto"}
            </button>
          </div>
        </div>
      )}

      {/* Summary + Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 md:col-span-1">
          <p className="text-gray-500 text-sm">Total período</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{formatCurrency(total)}</p>
          <p className="text-gray-600 text-xs mt-1">{expenses.length} gastos</p>
        </div>
        <div className="md:col-span-3 bg-gray-900 rounded-xl p-4 border border-gray-800">
          <div className="flex flex-wrap gap-2 mb-3">
            {Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cat, amt]) => (
              <div key={cat} className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-800 rounded-full">
                <span className="text-gray-300 text-xs">{cat}</span>
                <span className="text-red-400 text-xs font-medium">{formatCurrency(amt)}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500" />
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500" />
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
              className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500">
              <option value="">Todas las categorías</option>
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="p-4 text-left text-gray-400 font-medium">Descripción</th>
              <th className="p-4 text-left text-gray-400 font-medium">Categoría</th>
              <th className="p-4 text-left text-gray-400 font-medium">Método</th>
              <th className="p-4 text-left text-gray-400 font-medium">Fecha</th>
              <th className="p-4 text-right text-gray-400 font-medium">Monto</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={6} className="p-4"><div className="h-4 bg-gray-800 rounded animate-pulse" /></td></tr>
              ))
            ) : expenses.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-gray-500">
                  <TrendingDown size={36} className="mx-auto mb-2 opacity-30" />
                  No hay gastos en este período
                </td>
              </tr>
            ) : expenses.map(e => (
              <tr key={e.id} className="hover:bg-gray-800/30 transition-colors">
                <td className="p-4">
                  <p className="text-white">{e.description}</p>
                  {e.notes && <p className="text-gray-500 text-xs mt-0.5">{e.notes}</p>}
                </td>
                <td className="p-4">
                  <span className="px-2 py-0.5 bg-gray-800 text-gray-300 rounded-full text-xs">{e.category}</span>
                </td>
                <td className="p-4 text-gray-400">{METHOD_LABELS[e.paymentMethod] || e.paymentMethod}</td>
                <td className="p-4 text-gray-400">{formatDate(e.date || e.createdAt)}</td>
                <td className="p-4 text-right font-medium text-red-400">{formatCurrency(e.amount)}</td>
                <td className="p-4">
                  <button onClick={() => handleDelete(e.id)} disabled={deleting === e.id}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50">
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
