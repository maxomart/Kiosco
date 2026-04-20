"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Trash2, Package, Search } from "lucide-react"
import { formatCurrency, formatDateTime } from "@/lib/utils"

interface Recharge {
  id: string
  quantity: number
  unitCost: number
  totalCost: number
  notes: string | null
  createdAt: string
  product: { id: string; name: string; stock: number; unit: string }
  supplier: { id: string; name: string } | null
}

interface Product { id: string; name: string; stock: number; unit: string; costPrice: number }
interface Supplier { id: string; name: string }

export default function CargasPage() {
  const [recharges, setRecharges] = useState<Recharge[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [productSearch, setProductSearch] = useState("")
  const [form, setForm] = useState({ productId: "", supplierId: "", quantity: "", unitCost: "", notes: "" })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split("T")[0] })
  const [to, setTo] = useState(() => new Date().toISOString().split("T")[0])

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ from: `${from}T00:00:00`, to: `${to}T23:59:59` })
    const [rRes, pRes, sRes] = await Promise.all([
      fetch(`/api/cargas?${params}`),
      fetch("/api/productos?limit=200"),
      fetch("/api/proveedores"),
    ])
    if (rRes.ok) { const d = await rRes.json(); setRecharges(d.recharges || []) }
    if (pRes.ok) { const d = await pRes.json(); setProducts(d.products || []) }
    if (sRes.ok) { const d = await sRes.json(); setSuppliers(d.suppliers || []) }
    setLoading(false)
  }, [from, to])

  useEffect(() => { load() }, [load])

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  ).slice(0, 10)

  const selectedProduct = products.find(p => p.id === form.productId)

  const handleSave = async () => {
    if (!form.productId || !form.quantity || isNaN(parseInt(form.quantity))) return
    setSaving(true)
    const res = await fetch("/api/cargas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: form.productId,
        supplierId: form.supplierId || null,
        quantity: parseInt(form.quantity),
        unitCost: parseFloat(form.unitCost || "0"),
        notes: form.notes || null,
      }),
    })
    if (res.ok) {
      setForm({ productId: "", supplierId: "", quantity: "", unitCost: "", notes: "" })
      setProductSearch("")
      setShowForm(false)
      await load()
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta carga? Se reversará el stock.")) return
    setDeleting(id)
    await fetch(`/api/cargas/${id}`, { method: "DELETE" })
    await load()
    setDeleting(null)
  }

  const totalInvested = recharges.reduce((acc, r) => acc + Number(r.totalCost), 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Cargas de stock</h1>
          <p className="text-gray-400 text-sm mt-1">Registro de ingreso de mercadería</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-colors">
          <Plus size={16} /> Nueva carga
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-4">
          <h3 className="text-white font-medium">Registrar ingreso de stock</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Product search */}
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-400 mb-1.5">Producto *</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={productSearch} onChange={e => { setProductSearch(e.target.value); setForm(f => ({ ...f, productId: "" })) }}
                  placeholder="Buscar producto..."
                  className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500" />
              </div>
              {productSearch && !form.productId && (
                <div className="mt-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden shadow-lg z-10 relative">
                  {filteredProducts.length === 0 ? (
                    <div className="p-3 text-gray-500 text-sm">Sin resultados</div>
                  ) : filteredProducts.map(p => (
                    <button key={p.id} onClick={() => {
                      setForm(f => ({ ...f, productId: p.id, unitCost: String(p.costPrice) }))
                      setProductSearch(p.name)
                    }} className="w-full text-left px-4 py-2.5 hover:bg-gray-700 text-sm text-white flex items-center justify-between transition-colors">
                      <span>{p.name}</span>
                      <span className="text-gray-500 text-xs">Stock: {p.stock} {p.unit}</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedProduct && (
                <p className="mt-1.5 text-xs text-purple-400">Stock actual: {selectedProduct.stock} {selectedProduct.unit}</p>
              )}
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Cantidad *</label>
              <input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                min="1" step="1" placeholder="0"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Costo unitario</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" value={form.unitCost} onChange={e => setForm(f => ({ ...f, unitCost: e.target.value }))}
                  min="0" step="0.01" placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500" />
              </div>
              {form.quantity && form.unitCost && (
                <p className="text-xs text-gray-500 mt-1">Total: {formatCurrency(parseInt(form.quantity || "0") * parseFloat(form.unitCost || "0"))}</p>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Proveedor</label>
              <select value={form.supplierId} onChange={e => setForm(f => ({ ...f, supplierId: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500">
                <option value="">Sin proveedor</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Notas</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Remito, observaciones..."
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors">Cancelar</button>
            <button onClick={handleSave} disabled={saving || !form.productId || !form.quantity}
              className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium transition-colors">
              {saving ? "Guardando..." : "Registrar carga"}
            </button>
          </div>
        </div>
      )}

      {/* Stats + filter */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="bg-gray-900 rounded-xl px-4 py-3 border border-gray-800 flex items-center gap-3">
          <Package size={18} className="text-purple-400" />
          <div>
            <p className="text-xs text-gray-500">Inversión período</p>
            <p className="text-white font-semibold">{formatCurrency(totalInvested)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
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
              <th className="p-4 text-left text-gray-400 font-medium">Producto</th>
              <th className="p-4 text-left text-gray-400 font-medium">Proveedor</th>
              <th className="p-4 text-right text-gray-400 font-medium">Cantidad</th>
              <th className="p-4 text-right text-gray-400 font-medium">Costo unit.</th>
              <th className="p-4 text-right text-gray-400 font-medium">Total</th>
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
                  <Package size={36} className="mx-auto mb-2 opacity-30" />
                  No hay cargas en este período
                </td>
              </tr>
            ) : recharges.map(r => (
              <tr key={r.id} className="hover:bg-gray-800/30 transition-colors">
                <td className="p-4">
                  <p className="text-white">{r.product.name}</p>
                  {r.notes && <p className="text-gray-500 text-xs mt-0.5">{r.notes}</p>}
                </td>
                <td className="p-4 text-gray-400">{r.supplier?.name || "—"}</td>
                <td className="p-4 text-right text-green-400 font-medium">+{r.quantity} {r.product.unit}</td>
                <td className="p-4 text-right text-gray-300">{formatCurrency(r.unitCost)}</td>
                <td className="p-4 text-right font-medium text-white">{formatCurrency(r.totalCost)}</td>
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
    </div>
  )
}
