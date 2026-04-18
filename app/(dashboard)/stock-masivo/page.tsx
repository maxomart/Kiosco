"use client"

import { useState, useEffect } from "react"
import { formatCurrency } from "@/lib/utils"
import { Layers, Save, ChevronDown, ChevronRight, Loader2, CheckCircle } from "lucide-react"
import toast from "react-hot-toast"

interface Product {
  id: string
  name: string
  barcode?: string
  stock: number
  unit: string
  salePrice: number
  costPrice: number
  category?: { id: string; name: string; color?: string }
}

export default function StockMasivoPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [stockUpdates, setStockUpdates] = useState<Record<string, number>>({})
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch("/api/productos?limit=500")
      .then(r => r.json())
      .then(data => {
        const prods = data.products ?? data
        setProducts(prods)
        // Inicializar con stock actual
        const init: Record<string, number> = {}
        prods.forEach((p: Product) => { init[p.id] = p.stock })
        setStockUpdates(init)
        // Expandir todas las categorías
        const cats: Record<string, boolean> = {}
        prods.forEach((p: Product) => {
          const key = p.category?.id ?? "sin-categoria"
          cats[key] = true
        })
        setExpandedCats(cats)
      })
      .catch(() => toast.error("Error cargando productos"))
      .finally(() => setLoading(false))
  }, [])

  // Agrupar por categoría
  const grouped = products.reduce((acc, p) => {
    const key = p.category?.id ?? "sin-categoria"
    const label = p.category?.name ?? "Sin categoría"
    const color = p.category?.color ?? "#6b7280"
    if (!acc[key]) acc[key] = { label, color, products: [] }
    acc[key].products.push(p)
    return acc
  }, {} as Record<string, { label: string; color: string; products: Product[] }>)

  const handleSave = async () => {
    // Solo enviar los que cambiaron
    const updates = products
      .filter(p => stockUpdates[p.id] !== p.stock)
      .map(p => ({ id: p.id, stock: stockUpdates[p.id] ?? p.stock }))

    if (updates.length === 0) {
      toast("No hay cambios para guardar", { icon: "ℹ️" })
      return
    }

    setSaving(true)
    try {
      const r = await fetch("/api/productos/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates, reason: "Carga masiva de stock" }),
      })
      if (r.ok) {
        // Actualizar productos locales
        setProducts(prev => prev.map(p => ({
          ...p,
          stock: stockUpdates[p.id] ?? p.stock
        })))
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
        toast.success(`${updates.length} productos actualizados`)
      } else {
        const err = await r.json()
        toast.error(err.error ?? "Error al guardar")
      }
    } catch {
      toast.error("Error de conexión")
    } finally {
      setSaving(false)
    }
  }

  const changedCount = products.filter(p => stockUpdates[p.id] !== p.stock).length

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Stock Masivo</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
            Actualizá el stock de varios productos a la vez, ordenados por categoría
          </p>
        </div>
        <div className="flex items-center gap-3">
          {changedCount > 0 && (
            <span className="text-sm text-orange-600 dark:text-orange-400 font-medium">
              {changedCount} cambio{changedCount !== 1 ? "s" : ""} sin guardar
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || changedCount === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition text-sm"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <CheckCircle size={16} /> : <Save size={16} />}
            {saving ? "Guardando..." : saved ? "¡Guardado!" : "Guardar todo"}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {Object.entries(grouped).map(([catId, { label, color, products: catProducts }]) => {
          const isExpanded = expandedCats[catId] !== false
          return (
            <div key={catId} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
              <button
                onClick={() => setExpandedCats(prev => ({ ...prev, [catId]: !isExpanded }))}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
              >
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="font-bold text-gray-800 dark:text-white flex-1 text-left">{label}</span>
                <span className="text-sm text-gray-400 dark:text-gray-500 mr-2">{catProducts.length} producto{catProducts.length !== 1 ? "s" : ""}</span>
                {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
              </button>

              {isExpanded && (
                <div className="border-t border-gray-100 dark:border-gray-700">
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-0 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide px-5 py-2 bg-gray-50 dark:bg-gray-700/30">
                    <span>Producto</span>
                    <span className="w-24 text-center">Stock actual</span>
                    <span className="w-32 text-center">Nuevo stock</span>
                    <span className="w-24 text-right">Precio</span>
                  </div>
                  {catProducts.map((product, idx) => {
                    const currentVal = stockUpdates[product.id] ?? product.stock
                    const changed = currentVal !== product.stock
                    return (
                      <div
                        key={product.id}
                        className={`grid grid-cols-[1fr_auto_auto_auto] gap-0 items-center px-5 py-3 ${idx > 0 ? "border-t border-gray-50 dark:border-gray-700/50" : ""} ${changed ? "bg-amber-50/50 dark:bg-amber-900/10" : ""}`}
                      >
                        <div>
                          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{product.name}</p>
                          {product.barcode && <p className="text-xs text-gray-400 font-mono">{product.barcode}</p>}
                        </div>
                        <div className="w-24 text-center">
                          <span className="text-sm text-gray-500 dark:text-gray-400">{product.stock} {product.unit}</span>
                        </div>
                        <div className="w-32 flex items-center justify-center">
                          <input
                            type="number"
                            min="0"
                            step={product.unit === "kg" ? "0.001" : "1"}
                            value={currentVal}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value)
                              if (!isNaN(v) && v >= 0) {
                                setStockUpdates(prev => ({ ...prev, [product.id]: v }))
                              }
                            }}
                            className={`w-24 text-center px-2 py-1.5 rounded-xl border text-sm font-bold outline-none transition ${
                              changed
                                ? "border-orange-400 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 focus:border-orange-500"
                                : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:border-blue-500"
                            }`}
                          />
                        </div>
                        <div className="w-24 text-right">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{formatCurrency(product.salePrice)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* FAB guardar si hay cambios */}
      {changedCount > 0 && (
        <div className="fixed bottom-6 right-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 disabled:opacity-60 text-white rounded-2xl font-bold shadow-2xl shadow-green-500/40 transition active:scale-95"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Guardar {changedCount} cambio{changedCount !== 1 ? "s" : ""}
          </button>
        </div>
      )}
    </div>
  )
}
