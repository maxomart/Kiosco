"use client"

import { useState, useRef } from "react"
import { calcProfitPercent, calcSalePrice, formatCurrency } from "@/lib/utils"
import { X, Loader2, Package, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import toast from "react-hot-toast"
import NumberInput from "@/components/shared/NumberInput"

interface Product {
  id: string
  name: string
  barcode?: string
  sku?: string
  salePrice: number
  costPrice: number
  profitPercent: number
  stock: number
  minStock: number
  idealStock: number
  unit: string
  taxRate: string
  active: boolean
  description?: string
  soldByWeight?: boolean
  hasExpiry?: boolean
  categoryId?: string
  supplierId?: string
}

interface Category { id: string; name: string }
interface Supplier { id: string; name: string }

interface Props {
  product: Product | null
  categories: Category[]
  suppliers: Supplier[]
  onSave: (product: any) => void
  onClose: () => void
}

const UNITS = ["un", "kg", "g", "lt", "ml", "m", "cm", "caja", "pack", "docena"]
const TAX_RATES = [
  { value: "ZERO", label: "0% (exento)" },
  { value: "REDUCED", label: "10.5% (reducida)" },
  { value: "STANDARD", label: "21% (general)" },
]

export default function ProductModal({ product, categories, suppliers, onSave, onClose }: Props) {
  const isEdit = !!product
  const formRef = useRef<HTMLFormElement>(null)

  const [form, setForm] = useState({
    name: product?.name ?? "",
    barcode: product?.barcode ?? "",
    sku: product?.sku ?? "",
    description: product?.description ?? "",
    costPrice: product?.costPrice ?? 0,
    salePrice: product?.salePrice ?? 0,
    profitPercent: product?.profitPercent ?? 30,
    stock: product?.stock ?? 0,
    minStock: product?.minStock ?? 5,
    idealStock: product?.idealStock ?? 20,
    unit: product?.unit ?? "un",
    taxRate: product?.taxRate ?? "STANDARD",
    soldByWeight: product?.soldByWeight ?? false,
    hasExpiry: product?.hasExpiry ?? false,
    categoryId: product?.categoryId ?? "",
    supplierId: product?.supplierId ?? "",
    active: product?.active ?? true,
  })
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiReasoning, setAiReasoning] = useState<string | null>(null)
  const [tab, setTab] = useState<"basic" | "stock" | "pricing">("basic")
  // Track si el usuario tocó manualmente el precio de venta — si lo tocó,
  // cambios en costo NO recalculan el precio de venta automáticamente.
  const [salePriceTouched, setSalePriceTouched] = useState(isEdit)

  // IA: sugerir precio y categoría
  const suggestPrice = async () => {
    if (!form.name.trim()) { toast.error("Escribí primero el nombre"); return }
    setAiLoading(true)
    setAiReasoning(null)
    try {
      const res = await fetch("/api/ia/sugerir-precio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          costPrice: form.costPrice || undefined,
          categories: categories.map(c => c.name),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || "No se pudo obtener sugerencia")
        return
      }
      const data = await res.json()

      setForm(prev => {
        // Matchear categoría existente (case-insensitive)
        let newCategoryId = prev.categoryId
        if (data.category) {
          const match = categories.find(
            c => c.name.toLowerCase() === String(data.category).toLowerCase()
          )
          if (match) newCategoryId = match.id
        }

        // Si no tenemos costPrice todavía y la IA sugirió uno, usar ese.
        const suggestedCost = data.suggestedCostPrice ?? prev.costPrice
        const suggestedSale = Math.round(data.suggestedSalePrice ?? prev.salePrice)
        const suggestedProfit = data.profitPercent ?? prev.profitPercent

        return {
          ...prev,
          costPrice: suggestedCost,
          profitPercent: suggestedProfit,
          salePrice: suggestedSale,
          categoryId: newCategoryId,
        }
      })
      setSalePriceTouched(true)
      setAiReasoning(data.reasoning ?? null)
      toast.success(
        data.categoryIsNew
          ? `IA sugirió precio. Nueva categoría: ${data.category}`
          : "IA sugirió precio y categoría",
        { icon: "✨" }
      )
    } catch (err) {
      console.error(err)
      toast.error("Error al consultar IA")
    } finally {
      setAiLoading(false)
    }
  }

  // Cambio de costo: si el usuario NO tocó el precio de venta, recalcular.
  // Si ya lo tocó, solo actualizar el % de ganancia.
  const handleCostChange = (cost: number) => {
    setForm(prev => {
      if (!salePriceTouched && prev.profitPercent > 0) {
        const sale = calcSalePrice(cost, prev.profitPercent)
        return { ...prev, costPrice: cost, salePrice: Math.round(sale) }
      }
      // Recalcular % de ganancia manteniendo precio de venta actual
      const profit = prev.salePrice > 0 ? calcProfitPercent(cost, prev.salePrice) : prev.profitPercent
      return { ...prev, costPrice: cost, profitPercent: Math.round(profit * 100) / 100 }
    })
  }

  const handleProfitChange = (profit: number) => {
    setForm(prev => {
      const sale = calcSalePrice(prev.costPrice, profit)
      return { ...prev, profitPercent: profit, salePrice: Math.round(sale) }
    })
  }

  // Cambio de precio de venta: NO toca el costo (solo recalcula % de ganancia)
  const handleSalePriceChange = (sale: number) => {
    setSalePriceTouched(true)
    setForm(prev => {
      const profit = prev.costPrice > 0 ? calcProfitPercent(prev.costPrice, sale) : 0
      return { ...prev, salePrice: sale, profitPercent: Math.round(profit * 100) / 100 }
    })
  }

  // Evita que Enter en un input haga submit del form.
  // Las pistolas de escaneo HID emiten Enter al final — no queremos guardar al escanear.
  const preventEnterSubmit = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
      e.preventDefault()
    }
  }

  // Cuando el usuario pega o escanea un código, verificar si ya existe.
  // Si existe: ofrecer abrir ese producto para editarlo.
  const handleBarcodeBlur = async () => {
    const code = form.barcode.trim()
    if (!code || isEdit) return
    try {
      const res = await fetch(`/api/productos?barcode=${encodeURIComponent(code)}`)
      if (!res.ok) return
      const data = await res.json()
      const existing = data.products?.[0]
      if (existing) {
        toast(
          `Ya existe "${existing.name}" con ese código. Abrí el producto desde la lista para editarlo.`,
          { icon: "ℹ️", duration: 5000 }
        )
      }
    } catch {
      // ignorar
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error("El nombre es obligatorio"); return }
    if (form.salePrice <= 0) { toast.error("El precio de venta debe ser mayor a 0"); return }

    setLoading(true)
    try {
      const url = isEdit ? `/api/productos/${product!.id}` : "/api/productos"
      const method = isEdit ? "PUT" : "POST"

      // Limpiar strings vacíos para evitar problemas con UNIQUE en "":
      const payload = {
        ...form,
        barcode: form.barcode.trim() || null,
        sku: form.sku.trim() || null,
        description: form.description.trim() || null,
        categoryId: form.categoryId || null,
        supplierId: form.supplierId || null,
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || err.message || "Error al guardar")
      }

      const saved = await res.json()
      onSave(saved.product)
      toast.success(isEdit ? "Producto actualizado" : "Producto creado")
    } catch (err: any) {
      toast.error(err.message || "Error al guardar el producto")
    } finally {
      setLoading(false)
    }
  }

  const field = (label: string, children: React.ReactNode, required = false) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-fadeIn">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <Package size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-white">
              {isEdit ? "Editar producto" : "Nuevo producto"}
            </h2>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-700 px-6 flex-shrink-0">
          {[
            { key: "basic", label: "Datos básicos" },
            { key: "pricing", label: "Precios" },
            { key: "stock", label: "Stock" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key as any)}
              className={cn(
                "px-4 py-3 text-sm font-medium border-b-2 transition",
                tab === key
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Contenido */}
        <form ref={formRef} onSubmit={handleSubmit} onKeyDown={preventEnterSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-4">

            {/* TAB: DATOS BÁSICOS */}
            {tab === "basic" && (
              <>
                {field("Nombre del producto", (
                  <input
                    value={form.name}
                    onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej: Coca Cola 500ml"
                    className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl focus:border-blue-500 outline-none transition text-sm"
                  />
                ), true)}

                <div className="grid grid-cols-2 gap-4">
                  {field("Código de barras", (
                    <input
                      value={form.barcode}
                      onChange={e => setForm(prev => ({ ...prev, barcode: e.target.value }))}
                      onBlur={handleBarcodeBlur}
                      placeholder="Escanear o ingresar"
                      autoComplete="off"
                      className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl focus:border-blue-500 outline-none transition text-sm font-mono"
                    />
                  ))}
                  {field("SKU / Código interno", (
                    <input
                      value={form.sku}
                      onChange={e => setForm(prev => ({ ...prev, sku: e.target.value }))}
                      placeholder="Ej: BEB-001"
                      autoComplete="off"
                      className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl focus:border-blue-500 outline-none transition text-sm font-mono"
                    />
                  ))}
                </div>

                {field("Descripción", (
                  <textarea
                    value={form.description}
                    onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl focus:border-blue-500 outline-none transition text-sm resize-none"
                    rows={2}
                    placeholder="Descripción opcional..."
                  />
                ))}

                <div className="grid grid-cols-2 gap-4">
                  {field("Categoría", (
                    <select
                      value={form.categoryId}
                      onChange={e => setForm(prev => ({ ...prev, categoryId: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl focus:border-blue-500 outline-none transition text-sm"
                    >
                      <option value="">Sin categoría</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  ))}
                  {field("Proveedor", (
                    <select
                      value={form.supplierId}
                      onChange={e => setForm(prev => ({ ...prev, supplierId: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl focus:border-blue-500 outline-none transition text-sm"
                    >
                      <option value="">Sin proveedor</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  ))}
                </div>

                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.soldByWeight}
                      onChange={e => setForm(prev => ({ ...prev, soldByWeight: e.target.checked }))}
                      className="w-4 h-4 rounded accent-blue-600"
                    />
                    Vendido por peso
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.hasExpiry}
                      onChange={e => setForm(prev => ({ ...prev, hasExpiry: e.target.checked }))}
                      className="w-4 h-4 rounded accent-blue-600"
                    />
                    Tiene vencimiento
                  </label>
                </div>
              </>
            )}

            {/* TAB: PRECIOS */}
            {tab === "pricing" && (
              <>
                {/* Botón IA sugerir precio */}
                <button
                  type="button"
                  onClick={suggestPrice}
                  disabled={aiLoading || !form.name.trim()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-40 text-white rounded-xl font-semibold text-sm transition"
                >
                  {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  Sugerir precio y categoría con IA
                </button>

                {aiReasoning && (
                  <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-3 text-sm text-purple-800 dark:text-purple-300 flex gap-2">
                    <Sparkles size={14} className="flex-shrink-0 mt-0.5" />
                    <p>{aiReasoning}</p>
                  </div>
                )}

                <div className="bg-blue-50 dark:bg-gray-700/50 rounded-2xl p-4 grid grid-cols-3 gap-4">
                  {field("Precio de costo", (
                    <NumberInput
                      value={form.costPrice}
                      onChange={handleCostChange}
                      prefix="$"
                      placeholder="0"
                    />
                  ))}

                  {field("Ganancia %", (
                    <NumberInput
                      value={form.profitPercent}
                      onChange={handleProfitChange}
                      suffix="%"
                      placeholder="30"
                      formatThousands={false}
                    />
                  ))}

                  {field("Precio de venta", (
                    <NumberInput
                      value={form.salePrice}
                      onChange={handleSalePriceChange}
                      prefix="$"
                      placeholder="0"
                      className="border-2 border-blue-400 font-bold"
                    />
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {field("IVA", (
                    <select
                      value={form.taxRate}
                      onChange={e => setForm(prev => ({ ...prev, taxRate: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl focus:border-blue-500 outline-none transition text-sm"
                    >
                      {TAX_RATES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  ))}
                  {field("Unidad", (
                    <select
                      value={form.unit}
                      onChange={e => setForm(prev => ({ ...prev, unit: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl focus:border-blue-500 outline-none transition text-sm"
                    >
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  ))}
                </div>

                {/* Resumen de ganancia */}
                <div className="bg-green-50 dark:bg-gray-700/50 rounded-2xl p-4">
                  <p className="text-sm font-semibold text-green-800 dark:text-green-400 mb-2">Resumen de márgenes</p>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Costo</p>
                      <p className="font-bold text-gray-800 dark:text-white">{formatCurrency(form.costPrice)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Ganancia</p>
                      <p className="font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(form.salePrice - form.costPrice)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Venta</p>
                      <p className="font-bold text-blue-700 dark:text-blue-400">{formatCurrency(form.salePrice)}</p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* TAB: STOCK */}
            {tab === "stock" && (
              <>
                <div className="grid grid-cols-3 gap-4">
                  {field("Stock actual", (
                    <NumberInput value={form.stock} onChange={v => setForm(prev => ({ ...prev, stock: v }))} placeholder="0" />
                  ))}
                  {field("Stock mínimo", (
                    <NumberInput value={form.minStock} onChange={v => setForm(prev => ({ ...prev, minStock: v }))} placeholder="5" formatThousands={false} />
                  ))}
                  {field("Stock ideal", (
                    <NumberInput value={form.idealStock} onChange={v => setForm(prev => ({ ...prev, idealStock: v }))} placeholder="20" formatThousands={false} />
                  ))}
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 rounded-2xl p-4 text-sm text-gray-600 dark:text-gray-300">
                  <p className="font-medium text-gray-800 dark:text-white mb-2">Alertas de stock</p>
                  <ul className="space-y-1 text-sm">
                    <li>🔴 Sin stock: cuando llega a 0</li>
                    <li>🟠 Stock bajo: cuando cae al mínimo ({form.minStock} {form.unit})</li>
                    <li>🟡 Stock normal: entre mínimo e ideal</li>
                    <li>🟢 Stock ideal: {form.idealStock}+ {form.unit}</li>
                  </ul>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 flex gap-3 border-t border-gray-100 dark:border-gray-700 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold rounded-2xl transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : null}
              {isEdit ? "Guardar cambios" : "Crear producto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
