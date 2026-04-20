"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Trash2, Truck, Users } from "lucide-react"
import { formatCurrency, formatDateTime } from "@/lib/utils"
import { SupplierManagerModal } from "@/components/shared/SupplierManagerModal"
import { useConfirm } from "@/components/shared/ConfirmDialog"

// NOTE: The current Recharge schema (prisma) tracks supplier-based recharges
// (e.g. telephony / utility credits) with cost, amount and profit — NOT product
// stock entries. Until the backend grows a proper StockEntry model, this page
// operates over the existing Recharge endpoints.
interface Recharge {
  id: string
  number: number
  cost: number
  amount: number
  profit: number
  notes: string | null
  createdAt: string
  supplier: { id: string; name: string } | null
}

interface Supplier { id: string; name: string }

export default function CargasPage() {
  const [recharges, setRecharges] = useState<Recharge[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ supplierId: "", cost: "", amount: "", notes: "" })
  const [saving, setSaving] = useState(false)
  const [showSuppliers, setShowSuppliers] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0] })
  const [to, setTo] = useState(() => new Date().toISOString().split("T")[0])
  const confirm = useConfirm()

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ from: `${from}T00:00:00`, to: `${to}T23:59:59` })
    const [rRes, sRes] = await Promise.all([
      fetch(`/api/cargas?${params}`),
      fetch("/api/proveedores"),
    ])
    if (rRes.ok) { const d = await rRes.json(); setRecharges(d.recharges || []) }
    if (sRes.ok) { const d = await sRes.json(); setSuppliers(d.suppliers || []) }
    setLoading(false)
  }, [from, to])

  useEffect(() => { load() }, [load])

  const profitPreview =
    form.cost && form.amount
      ? parseFloat(form.amount || "0") - parseFloat(form.cost || "0")
      : null

  const handleSave = async () => {
    setError(null)
    if (!form.supplierId) return setError("Seleccioná un proveedor")
    const cost = parseFloat(form.cost)
    const amount = parseFloat(form.amount)
    if (isNaN(cost) || cost < 0) return setError("Costo inválido")
    if (isNaN(amount) || amount < 0) return setError("Monto inválido")
    setSaving(true)
    const res = await fetch("/api/cargas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierId: form.supplierId,
        cost,
        amount,
        notes: form.notes || null,
      }),
    })
    if (res.ok) {
      setForm({ supplierId: "", cost: "", amount: "", notes: "" })
      setShowForm(false)
      await load()
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error || "Error al registrar carga")
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "¿Eliminar esta carga?",
      description: "Se quita del registro. Esta acción no se puede deshacer.",
      confirmText: "Eliminar",
      tone: "danger",
    })
    if (!ok) return
    setDeleting(id)
    await fetch(`/api/cargas/${id}`, { method: "DELETE" })
    await load()
    setDeleting(null)
  }

  const totalCost = recharges.reduce((acc, r) => acc + Number(r.cost), 0)
  const totalRevenue = recharges.reduce((acc, r) => acc + Number(r.amount), 0)
  const totalProfit = recharges.reduce((acc, r) => acc + Number(r.profit), 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Cargas</h1>
          <p className="text-gray-400 text-sm mt-1">Cargas y recargas a proveedores (telefonía, servicios, etc.)</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSuppliers(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors">
            <Users size={16} /> Proveedores
          </button>
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-accent-foreground text-sm font-medium transition-colors">
            <Plus size={16} /> Nueva carga
          </button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-4">
          <h3 className="text-white font-medium">Registrar carga</h3>
          {error && (
            <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Proveedor *</label>
              <select value={form.supplierId} onChange={e => setForm(f => ({ ...f, supplierId: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500">
                <option value="">Seleccionar...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {suppliers.length === 0 && (
                <p className="text-xs text-yellow-500 mt-1">
                  Necesitás dar de alta un proveedor antes.{" "}
                  <button type="button" onClick={() => setShowSuppliers(true)} className="text-accent underline hover:text-accent-hover">
                    Crear ahora
                  </button>
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Costo *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))}
                  min="0" step="0.01" placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Monto cobrado *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  min="0" step="0.01" placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500" />
              </div>
              {profitPreview !== null && (
                <p className={`text-xs mt-1 ${profitPreview >= 0 ? "text-green-400" : "text-red-400"}`}>
                  Ganancia: {formatCurrency(profitPreview)}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Notas</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Referencia, observaciones..."
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setShowForm(false); setError(null) }} className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors">Cancelar</button>
            <button onClick={handleSave} disabled={saving || !form.supplierId || !form.cost || !form.amount}
              className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium transition-colors">
              {saving ? "Guardando..." : "Registrar carga"}
            </button>
          </div>
        </div>
      )}

      {/* Stats + filter */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 rounded-xl px-4 py-3 border border-gray-800">
          <p className="text-xs text-gray-500">Costo período</p>
          <p className="text-white font-semibold">{formatCurrency(totalCost)}</p>
        </div>
        <div className="bg-gray-900 rounded-xl px-4 py-3 border border-gray-800">
          <p className="text-xs text-gray-500">Ingresos período</p>
          <p className="text-white font-semibold">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="bg-gray-900 rounded-xl px-4 py-3 border border-gray-800">
          <p className="text-xs text-gray-500">Ganancia período</p>
          <p className={`font-semibold ${totalProfit >= 0 ? "text-green-400" : "text-red-400"}`}>{formatCurrency(totalProfit)}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap md:justify-end">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500" />
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="p-4 text-left text-gray-400 font-medium">N°</th>
              <th className="p-4 text-left text-gray-400 font-medium">Proveedor</th>
              <th className="p-4 text-right text-gray-400 font-medium">Costo</th>
              <th className="p-4 text-right text-gray-400 font-medium">Cobrado</th>
              <th className="p-4 text-right text-gray-400 font-medium">Ganancia</th>
              <th className="p-4 text-left text-gray-400 font-medium">Fecha</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}><td colSpan={7} className="p-4"><div className="h-4 bg-gray-800 rounded animate-pulse" /></td></tr>
              ))
            ) : recharges.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-12 text-center text-gray-500">
                  <Truck size={36} className="mx-auto mb-2 opacity-30" />
                  No hay cargas en este período
                </td>
              </tr>
            ) : recharges.map(r => (
              <tr key={r.id} className="hover:bg-gray-800/30 transition-colors">
                <td className="p-4 font-mono text-purple-400">#{r.number}</td>
                <td className="p-4">
                  <p className="text-white">{r.supplier?.name ?? "—"}</p>
                  {r.notes && <p className="text-gray-500 text-xs mt-0.5">{r.notes}</p>}
                </td>
                <td className="p-4 text-right text-gray-300">{formatCurrency(r.cost)}</td>
                <td className="p-4 text-right text-gray-300">{formatCurrency(r.amount)}</td>
                <td className={`p-4 text-right font-medium ${Number(r.profit) >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {formatCurrency(r.profit)}
                </td>
                <td className="p-4 text-gray-400">{formatDateTime(r.createdAt)}</td>
                <td className="p-4">
                  <button onClick={() => handleDelete(r.id)} disabled={deleting === r.id}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50">
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SupplierManagerModal
        open={showSuppliers}
        onClose={() => setShowSuppliers(false)}
        onChanged={() => load()}
      />
    </div>
  )
}
