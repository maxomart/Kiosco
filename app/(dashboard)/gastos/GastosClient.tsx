"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Trash2, TrendingDown, Zap, Phone, CreditCard, Wrench, Receipt } from "lucide-react"
import { formatCurrency, formatDateTime } from "@/lib/utils"
import { useConfirm } from "@/components/shared/ConfirmDialog"
import { CurrencyInput } from "@/components/ui/CurrencyInput"
import { PageTip } from "@/components/shared/PageTip"

interface Expense {
  id: string
  amount: number
  category: string
  notes: string | null
  createdAt: string
}

const EXPENSE_CATEGORIES = [
  "Alquiler", "Servicios", "Sueldos", "Mercadería", "Limpieza", "Impuestos",
  "Mantenimiento", "Publicidad", "Transporte", "Recargas", "Otros",
]

// Quick shortcuts that pre-fill the form with common expense types
const QUICK_SHORTCUTS = [
  { label: "Luz / Gas / Agua", category: "Servicios", icon: Zap, color: "text-amber-400", bg: "bg-amber-900/30" },
  { label: "Recarga celular", category: "Recargas", icon: Phone, color: "text-sky-400", bg: "bg-sky-900/30" },
  { label: "Alquiler", category: "Alquiler", icon: Receipt, color: "text-purple-400", bg: "bg-purple-900/30" },
  { label: "Mantenimiento", category: "Mantenimiento", icon: Wrench, color: "text-emerald-400", bg: "bg-emerald-900/30" },
]

export default function GastosPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [catFilter, setCatFilter] = useState("")
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0] })
  const [to, setTo] = useState(() => new Date().toISOString().split("T")[0])
  const [form, setForm] = useState({ description: "", amount: "", category: "Otros" })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const confirm = useConfirm()

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ from: `${from}T00:00:00`, to: `${to}T23:59:59` })
    const res = await fetch(`/api/gastos?${params}`)
    if (res.ok) {
      const d = await res.json()
      setExpenses(d.expenses || [])
    }
    setLoading(false)
  }, [from, to])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    setError(null)
    const amount = parseFloat(form.amount)
    if (isNaN(amount) || amount <= 0) return setError("Monto inválido")
    setSaving(true)
    // Backend schema only accepts { category, amount, notes }; we squash the
    // user-typed description into notes so the data still gets persisted.
    const notes = [form.description.trim(), null].filter(Boolean).join(" ").trim() || null
    const res = await fetch("/api/gastos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: form.category, amount, notes }),
    })
    if (res.ok) {
      setForm({ description: "", amount: "", category: "Otros" })
      setShowForm(false)
      await load()
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error || "Error al guardar gasto")
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "¿Eliminar gasto?",
      description: "Se borra del registro de gastos. Esta acción no se puede deshacer.",
      confirmText: "Eliminar",
      tone: "danger",
    })
    if (!ok) return
    setDeleting(id)
    await fetch(`/api/gastos/${id}`, { method: "DELETE" })
    await load()
    setDeleting(null)
  }

  const filteredExpenses = catFilter ? expenses.filter(e => e.category === catFilter) : expenses
  const total = filteredExpenses.reduce((acc, e) => acc + Number(e.amount), 0)

  // Group by category for summary
  const byCat = filteredExpenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + Number(e.amount)
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageTip id="gastos:intro" tone="amber">
        Registrá acá todo lo que pagás <strong>que no es mercadería</strong>: alquiler, luz, sueldos,
        recargas de servicios. Usá los atajos de abajo para cargar más rápido. Los gastos se descuentan
        automáticamente en el cálculo de ganancia neta de la <strong>Caja</strong>.
      </PageTip>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Gastos</h1>
          <p className="text-gray-400 text-sm mt-1">Registrá lo que sale de caja — servicios, sueldos, alquiler, recargas…</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-accent-foreground text-sm font-medium transition-colors">
          <Plus size={16} /> Nuevo gasto
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-red-900/30 to-red-950/30 border border-red-700/40 rounded-xl p-4">
          <p className="text-xs text-red-400 uppercase tracking-wider font-medium">Total período</p>
          <p className="text-2xl font-bold text-white mt-2">{formatCurrency(total)}</p>
          <p className="text-[10px] text-gray-500 mt-1">
            {filteredExpenses.length} gasto{filteredExpenses.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Promedio</p>
          <p className="text-2xl font-bold text-white mt-2">
            {filteredExpenses.length > 0 ? formatCurrency(total / filteredExpenses.length) : "$0"}
          </p>
          <p className="text-[10px] text-gray-500 mt-1">Por gasto</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Top categoría</p>
          {Object.entries(byCat).length > 0 ? (
            <>
              <p className="text-lg font-bold text-white mt-2 truncate">
                {Object.entries(byCat).sort((a, b) => b[1] - a[1])[0][0]}
              </p>
              <p className="text-[10px] text-red-400 mt-1">
                {formatCurrency(Object.entries(byCat).sort((a, b) => b[1] - a[1])[0][1])}
              </p>
            </>
          ) : (
            <p className="text-lg text-gray-600 mt-2">—</p>
          )}
        </div>
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Último gasto</p>
          {filteredExpenses[0] ? (
            <>
              <p className="text-sm font-semibold text-white mt-2 truncate">
                {filteredExpenses[0].notes || filteredExpenses[0].category}
              </p>
              <p className="text-[10px] text-gray-500 mt-1">
                {formatDateTime(filteredExpenses[0].createdAt)}
              </p>
            </>
          ) : (
            <p className="text-lg text-gray-600 mt-2">—</p>
          )}
        </div>
      </div>

      {/* Quick shortcuts — only shown when form is closed */}
      {!showForm && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {QUICK_SHORTCUTS.map((s) => {
            const Icon = s.icon
            return (
              <button
                key={s.label}
                onClick={() => {
                  setForm({ description: s.label, amount: "", category: s.category })
                  setShowForm(true)
                }}
                className="flex items-center gap-3 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-xl p-3 text-left transition-colors"
              >
                <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-4 h-4 ${s.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{s.label}</p>
                  <p className="text-[10px] text-gray-500">{s.category}</p>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* New expense form */}
      {showForm && (
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-4">
          <div>
            <h3 className="text-white font-semibold">Registrar nuevo gasto</h3>
            <p className="text-xs text-gray-500 mt-1">Todo lo que pagaste — se suma al cálculo de ganancia neta en Caja</p>
          </div>
          {error && (
            <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">Descripción</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Ej: Luz de enero, alquiler, recarga celular…"
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-accent transition-colors" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">Categoría</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-accent">
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs text-gray-400 uppercase tracking-wider mb-1.5">Monto pagado *</label>
              <CurrencyInput
                value={parseFloat(form.amount) || 0}
                onValueChange={(n) => setForm(f => ({ ...f, amount: String(n) }))}
                placeholder="0"
                className="text-xl font-semibold py-3.5"
              />
              <div className="flex gap-2 mt-2 flex-wrap">
                {[1000, 5000, 10000, 50000, 100000].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, amount: String((parseFloat(f.amount) || 0) + n) }))}
                    className="text-xs px-2 py-1 rounded bg-gray-800 hover:bg-accent-soft hover:text-accent text-gray-400 transition-colors"
                  >
                    +${n.toLocaleString("es-AR")}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2 border-t border-gray-800">
            <button onClick={() => { setShowForm(false); setError(null); setForm({ description: "", amount: "", category: "Otros" }) }}
              className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving || !form.amount || parseFloat(form.amount) <= 0}
              className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-50 text-accent-foreground text-sm font-medium transition-colors">
              {saving ? "Guardando..." : `Guardar ${form.amount ? formatCurrency(parseFloat(form.amount)) : "gasto"}`}
            </button>
          </div>
        </div>
      )}

      {/* Filters bar */}
      <div className="bg-gray-900 rounded-xl p-3 border border-gray-800 flex flex-wrap gap-2 items-center">
        <span className="text-xs text-gray-500 uppercase tracking-wider">Filtros:</span>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
          className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white focus:outline-none focus:border-accent" />
        <span className="text-xs text-gray-600">—</span>
        <input type="date" value={to} onChange={e => setTo(e.target.value)}
          className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white focus:outline-none focus:border-accent" />
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white focus:outline-none focus:border-accent">
          <option value="">Todas las categorías</option>
          {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Desglose por categoría */}
      {Object.entries(byCat).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
            <button
              key={cat}
              onClick={() => setCatFilter(catFilter === cat ? "" : cat)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border transition-colors ${
                catFilter === cat
                  ? "bg-red-900/40 border-red-700/50 text-red-200"
                  : "bg-gray-900 border-gray-800 text-gray-300 hover:border-gray-700"
              }`}
            >
              <span>{cat}</span>
              <span className="font-semibold text-red-400">{formatCurrency(amt)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="p-4 text-left text-gray-400 font-medium">Descripción</th>
              <th className="p-4 text-left text-gray-400 font-medium">Categoría</th>
              <th className="p-4 text-left text-gray-400 font-medium">Fecha</th>
              <th className="p-4 text-right text-gray-400 font-medium">Monto</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={5} className="p-4"><div className="h-4 bg-gray-800 rounded animate-pulse" /></td></tr>
              ))
            ) : filteredExpenses.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-12 text-center text-gray-500">
                  <TrendingDown size={36} className="mx-auto mb-2 opacity-30" />
                  No hay gastos en este período
                </td>
              </tr>
            ) : filteredExpenses.map(e => (
              <tr key={e.id} className="hover:bg-gray-800/30 transition-colors">
                <td className="p-4">
                  <p className="text-white">{e.notes || <span className="text-gray-500 italic">Sin descripción</span>}</p>
                </td>
                <td className="p-4">
                  <span className="px-2 py-0.5 bg-gray-800 text-gray-300 rounded-full text-xs">{e.category}</span>
                </td>
                <td className="p-4 text-gray-400">{formatDateTime(e.createdAt)}</td>
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
