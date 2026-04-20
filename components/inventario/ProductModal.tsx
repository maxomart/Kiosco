"use client"

import { useState, useEffect } from "react"
import { X, Loader2 } from "lucide-react"

interface Product {
  id: string
  name: string
  barcode: string | null
  sku: string | null
  description: string | null
  price: number
  costPrice: number
  stock: number
  minStock: number
  unit: string
  active: boolean
  categoryId: string | null
  supplierId: string | null
  category: { id: string; name: string } | null
  supplier: { id: string; name: string } | null
}

interface Props {
  product: Product | null
  categories: { id: string; name: string }[]
  suppliers: { id: string; name: string }[]
  onClose: () => void
  onSaved: () => void
}

const UNITS = ["un", "kg", "g", "lt", "ml", "caja", "docena", "bolsa", "paq"]

export default function ProductModal({ product, categories, suppliers, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    name: "", barcode: "", sku: "", description: "", price: "", costPrice: "",
    stock: "", minStock: "5", unit: "un", active: true, categoryId: "", supplierId: "",
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name,
        barcode: product.barcode || "",
        sku: product.sku || "",
        description: product.description || "",
        price: String(product.price),
        costPrice: String(product.costPrice),
        stock: String(product.stock),
        minStock: String(product.minStock),
        unit: product.unit,
        active: product.active,
        categoryId: product.categoryId || "",
        supplierId: product.supplierId || "",
      })
    }
  }, [product])

  const set = (key: string, val: string | boolean) =>
    setForm(f => ({ ...f, [key]: val }))

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = "Nombre requerido"
    if (!form.price || isNaN(parseFloat(form.price)) || parseFloat(form.price) < 0) e.price = "Precio inválido"
    if (form.costPrice && isNaN(parseFloat(form.costPrice))) e.costPrice = "Costo inválido"
    if (form.stock && isNaN(parseInt(form.stock))) e.stock = "Stock inválido"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    const body = {
      name: form.name.trim(),
      barcode: form.barcode.trim() || null,
      sku: form.sku.trim() || null,
      description: form.description.trim() || null,
      price: parseFloat(form.price),
      costPrice: parseFloat(form.costPrice || "0"),
      stock: parseInt(form.stock || "0"),
      minStock: parseInt(form.minStock || "5"),
      unit: form.unit,
      active: form.active,
      categoryId: form.categoryId || null,
      supplierId: form.supplierId || null,
    }
    const res = await fetch(product ? `/api/productos/${product.id}` : "/api/productos", {
      method: product ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (res.ok) { onSaved() }
    else {
      const d = await res.json()
      if (d.error) setErrors({ _global: d.error })
    }
    setSaving(false)
  }

  const margin = form.price && form.costPrice && parseFloat(form.costPrice) > 0
    ? ((parseFloat(form.price) - parseFloat(form.costPrice)) / parseFloat(form.costPrice) * 100).toFixed(1)
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
          <h2 className="text-white font-semibold text-lg">{product ? "Editar producto" : "Nuevo producto"}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {errors._global && (
            <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{errors._global}</div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Nombre *</label>
            <input value={form.name} onChange={e => set("name", e.target.value)}
              className={`w-full px-3 py-2.5 bg-gray-800 border rounded-lg text-white text-sm focus:outline-none focus:border-purple-500 ${errors.name ? "border-red-500" : "border-gray-700"}`} />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
          </div>

          {/* Barcode + SKU */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Código de barras</label>
              <input value={form.barcode} onChange={e => set("barcode", e.target.value)}
                placeholder="7891234567890"
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500 font-mono" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">SKU</label>
              <input value={form.sku} onChange={e => set("sku", e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500" />
            </div>
          </div>

          {/* Price + Cost */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Precio de venta *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" value={form.price} onChange={e => set("price", e.target.value)}
                  min="0" step="0.01" placeholder="0.00"
                  className={`w-full pl-7 pr-3 py-2.5 bg-gray-800 border rounded-lg text-white text-sm focus:outline-none focus:border-purple-500 ${errors.price ? "border-red-500" : "border-gray-700"}`} />
              </div>
              {errors.price && <p className="text-red-400 text-xs mt-1">{errors.price}</p>}
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">
                Costo
                {margin !== null && <span className={`ml-2 text-xs ${parseFloat(margin) >= 20 ? "text-green-400" : parseFloat(margin) >= 10 ? "text-yellow-400" : "text-red-400"}`}>margen {margin}%</span>}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" value={form.costPrice} onChange={e => set("costPrice", e.target.value)}
                  min="0" step="0.01" placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500" />
              </div>
            </div>
          </div>

          {/* Stock + MinStock + Unit */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Stock</label>
              <input type="number" value={form.stock} onChange={e => set("stock", e.target.value)}
                min="0" step="1"
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Stock mínimo</label>
              <input type="number" value={form.minStock} onChange={e => set("minStock", e.target.value)}
                min="0" step="1"
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Unidad</label>
              <select value={form.unit} onChange={e => set("unit", e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500">
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {/* Category + Supplier */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Categoría</label>
              <select value={form.categoryId} onChange={e => set("categoryId", e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500">
                <option value="">Sin categoría</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Proveedor</label>
              <select value={form.supplierId} onChange={e => set("supplierId", e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500">
                <option value="">Sin proveedor</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Descripción</label>
            <textarea value={form.description} onChange={e => set("description", e.target.value)}
              rows={2} placeholder="Descripción opcional..."
              className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500 resize-none" />
          </div>

          {/* Active */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div onClick={() => set("active", !form.active)}
              className={`w-11 h-6 rounded-full transition-colors relative ${form.active ? "bg-purple-600" : "bg-gray-700"}`}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.active ? "left-5" : "left-0.5"}`} />
            </div>
            <span className="text-sm text-gray-300">Producto activo</span>
          </label>
        </div>

        <div className="flex gap-3 p-5 border-t border-gray-800 sticky bottom-0 bg-gray-900">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2">
            {saving && <Loader2 size={15} className="animate-spin" />}
            {saving ? "Guardando..." : product ? "Guardar cambios" : "Crear producto"}
          </button>
        </div>
      </div>
    </div>
  )
}
