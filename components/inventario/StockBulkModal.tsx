"use client"

/**
 * Quick stock editor — replaces the old "upload Excel to update stock" flow.
 *
 * UX: pick a category → grid of products with editable stock per row.
 * Shows current stock, has +/− buttons, and a typeable input. Tracks edits
 * locally, shows a diff badge, and commits everything in one batch on save.
 *
 * For >50 products at once or an Excel from a proveedor, the import flow
 * still exists. This modal is for "voy a contar el stock del estante" type
 * workflows — typed and tap.
 */

import { useState, useEffect, useMemo, useCallback } from "react"
import {
  X, Search, Save, Loader2, Plus, Minus, RotateCcw, PackagePlus,
  CheckCircle, Filter, AlertCircle,
} from "lucide-react"
import toast from "react-hot-toast"
import { formatCurrency } from "@/lib/utils"

interface Props {
  onClose: () => void
  onDone: () => void
}

interface Product {
  id: string
  name: string
  barcode: string | null
  sku: string | null
  stock: number
  costPrice: number
  salePrice: number
  category: { id: string; name: string } | null
}

interface Category {
  id: string
  name: string
}

type EditMode = "ABSOLUTE" | "DELTA"  // ABSOLUTE = type new total; DELTA = type +/-

export function StockBulkModal({ onClose, onDone }: Props) {
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryId, setCategoryId] = useState<string>("__all__")
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [editMode, setEditMode] = useState<EditMode>("ABSOLUTE")
  const [edits, setEdits] = useState<Record<string, number>>({}) // productId → newStock (absolute)
  const [deltas, setDeltas] = useState<Record<string, number>>({}) // productId → delta (signed)
  const [saving, setSaving] = useState(false)
  const [reference, setReference] = useState("")

  // Load categories + initial product list (all categories)
  useEffect(() => {
    fetch("/api/categorias").then((r) => r.json()).then((d) => {
      setCategories(d.categories ?? [])
    }).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: "200" })
      if (categoryId && categoryId !== "__all__") params.set("categoryId", categoryId)
      const res = await fetch(`/api/productos?${params}`)
      if (res.ok) {
        const d = await res.json()
        setProducts(
          (d.products ?? []).map((p: any) => ({
            ...p,
            stock: Number(p.stock ?? 0),
            costPrice: Number(p.costPrice ?? 0),
            salePrice: Number(p.salePrice ?? 0),
          })),
        )
      }
    } finally {
      setLoading(false)
    }
  }, [categoryId])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    if (!search.trim()) return products
    const s = search.toLowerCase().trim()
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(s) ||
        (p.barcode ?? "").includes(s) ||
        (p.sku ?? "").toLowerCase().includes(s),
    )
  }, [products, search])

  const editedCount = useMemo(() => {
    let n = 0
    if (editMode === "ABSOLUTE") {
      for (const p of products) {
        if (edits[p.id] !== undefined && edits[p.id] !== p.stock) n++
      }
    } else {
      for (const id in deltas) {
        if (deltas[id] !== 0) n++
      }
    }
    return n
  }, [edits, deltas, products, editMode])

  const setStockAbsolute = (id: string, value: number) => {
    setEdits((e) => ({ ...e, [id]: Math.max(0, Math.floor(value)) }))
  }
  const adjustDelta = (id: string, by: number) => {
    setDeltas((d) => ({ ...d, [id]: (d[id] ?? 0) + by }))
  }
  const setDelta = (id: string, value: number) => {
    setDeltas((d) => ({ ...d, [id]: Math.floor(value) }))
  }

  const reset = () => {
    setEdits({})
    setDeltas({})
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      let updates: { id: string; stock: number }[]
      let mode: "SET" | "ADD"

      if (editMode === "ABSOLUTE") {
        mode = "SET"
        updates = products
          .filter((p) => edits[p.id] !== undefined && edits[p.id] !== p.stock)
          .map((p) => ({ id: p.id, stock: edits[p.id] }))
      } else {
        mode = "ADD"
        updates = Object.entries(deltas)
          .filter(([_, d]) => d !== 0)
          .map(([id, d]) => ({ id, stock: d }))
      }

      if (updates.length === 0) {
        toast("Nada para guardar", { icon: "ℹ️" })
        return
      }

      const payload: Record<string, unknown> = { mode, updates }
      const ref = reference.trim()
      if (ref) payload.reference = ref
      const res = await fetch("/api/productos/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.detail) console.error("[bulk stock]", data.detail)
        toast.error(data.error ?? "Error al guardar")
        return
      }
      toast.success(`${data.updated} producto${data.updated === 1 ? "" : "s"} actualizado${data.updated === 1 ? "" : "s"}`)
      onDone()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-4xl max-h-[95vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center flex-shrink-0">
              <PackagePlus className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-white font-semibold truncate">Editar stock rápido</h2>
              <p className="text-xs text-gray-500 truncate">
                Filtrá por categoría y editá las cantidades. Guardás todo de una.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition flex-shrink-0" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        {/* Filters bar */}
        <div className="px-5 py-3 border-b border-gray-800 bg-gray-900/60 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar producto, código o SKU..."
                className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-accent transition"
              />
            </div>
            <div className="relative">
              <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-8 py-2 text-sm text-gray-100 focus:outline-none focus:border-accent transition appearance-none cursor-pointer"
              >
                <option value="__all__">Todas las categorías</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Mode toggle */}
          <div className="flex flex-wrap gap-2 items-center text-xs">
            <span className="text-gray-500 hidden sm:inline">Modo:</span>
            <button
              onClick={() => setEditMode("ABSOLUTE")}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-medium transition ${
                editMode === "ABSOLUTE" ? "bg-sky-600 text-white" : "bg-gray-800 text-gray-400 hover:text-gray-200"
              }`}
              title="Tipear el stock total nuevo (ej: 'tengo 24')"
            >
              ✏️ Conteo total
            </button>
            <button
              onClick={() => setEditMode("DELTA")}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-medium transition ${
                editMode === "DELTA" ? "bg-emerald-600 text-white" : "bg-gray-800 text-gray-400 hover:text-gray-200"
              }`}
              title="Sumar/restar al stock actual (ej: '+12 que llegaron')"
            >
              ➕ Sumar/restar
            </button>
            <span className="ml-auto text-gray-500 text-[11px] sm:text-xs">{filtered.length} productos</span>
          </div>
        </div>

        {/* Products grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">
              {products.length === 0
                ? "No hay productos en esta categoría todavía."
                : "Ningún producto coincide con tu búsqueda."}
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((p) => {
                const newStock = editMode === "ABSOLUTE"
                  ? (edits[p.id] !== undefined ? edits[p.id] : p.stock)
                  : p.stock + (deltas[p.id] ?? 0)
                const delta = newStock - p.stock
                const isEdited = delta !== 0

                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-2 sm:gap-3 p-2 rounded-xl transition ${
                      isEdited ? "bg-emerald-900/15 border border-emerald-700/30" : "hover:bg-gray-800/40 border border-transparent"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-100 truncate">{p.name}</p>
                      <p className="text-[10px] sm:text-[11px] text-gray-500 truncate font-mono">
                        <span className="sm:hidden">Stock: <span className={p.stock <= 0 ? "text-red-400" : "text-gray-400"}>{p.stock}</span> · </span>
                        {p.barcode || p.sku || "Sin código"}
                        {p.category?.name && <span className="text-gray-600 hidden sm:inline"> · {p.category.name}</span>}
                        <span className="text-gray-600 hidden sm:inline"> · {formatCurrency(p.salePrice)}</span>
                      </p>
                    </div>

                    {/* Current stock indicator (desktop only) */}
                    <div className="hidden sm:flex flex-col items-end text-right">
                      <span className="text-[10px] text-gray-500 uppercase tracking-wide">Actual</span>
                      <span className={`text-sm font-mono ${p.stock <= 0 ? "text-red-400" : "text-gray-300"}`}>{p.stock}</span>
                    </div>

                    {/* Editor */}
                    <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                      <button
                        onClick={() => editMode === "ABSOLUTE" ? setStockAbsolute(p.id, newStock - 1) : adjustDelta(p.id, -1)}
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 flex items-center justify-center transition"
                        aria-label="Restar 1"
                      >
                        <Minus size={13} />
                      </button>
                      <input
                        type="number"
                        value={editMode === "ABSOLUTE" ? newStock : (deltas[p.id] ?? 0)}
                        onChange={(e) => {
                          const v = parseInt(e.target.value || "0", 10)
                          if (isNaN(v)) return
                          editMode === "ABSOLUTE" ? setStockAbsolute(p.id, v) : setDelta(p.id, v)
                        }}
                        className={`w-12 sm:w-16 text-center bg-gray-800 border rounded-lg px-1 py-1.5 text-sm font-mono focus:outline-none transition ${
                          isEdited ? "border-emerald-600 text-emerald-300" : "border-gray-700 text-gray-200 focus:border-accent"
                        }`}
                      />
                      <button
                        onClick={() => editMode === "ABSOLUTE" ? setStockAbsolute(p.id, newStock + 1) : adjustDelta(p.id, 1)}
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 flex items-center justify-center transition"
                        aria-label="Sumar 1"
                      >
                        <Plus size={13} />
                      </button>
                    </div>

                    {/* Diff badge */}
                    <div className="w-8 sm:w-12 text-right text-xs font-mono flex-shrink-0">
                      {isEdited ? (
                        <span className={delta > 0 ? "text-emerald-400" : "text-amber-400"}>
                          {delta > 0 ? "+" : ""}{delta}
                        </span>
                      ) : (
                        <span className="text-gray-700">—</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer with summary + save */}
        <div className="border-t border-gray-800 p-3 sm:p-4 space-y-3">
          {editedCount > 0 && (
            <div className="flex items-center gap-2 sm:gap-3">
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Etiqueta (opcional, ej: 'Conteo 20/04')"
                className="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-accent"
              />
              <button
                onClick={reset}
                className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1 rounded transition flex items-center gap-1 flex-shrink-0"
                title="Descartar cambios"
              >
                <RotateCcw size={12} /> <span className="hidden sm:inline">Descartar</span>
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex-1 text-xs sm:text-sm min-w-0">
              {editedCount > 0 ? (
                <span className="text-emerald-300 flex items-center gap-1.5 truncate">
                  <CheckCircle size={14} className="flex-shrink-0" />
                  <span className="truncate"><strong>{editedCount}</strong> con cambios</span>
                </span>
              ) : (
                <span className="text-gray-500 truncate">Editá la cantidad arriba</span>
              )}
            </div>
            <button
              onClick={onClose}
              className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs sm:text-sm font-medium transition flex-shrink-0"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || editedCount === 0}
              className="px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-accent-foreground text-xs sm:text-sm font-semibold transition flex items-center gap-2 flex-shrink-0"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span>{saving ? "Guardando..." : `Guardar${editedCount > 0 ? ` (${editedCount})` : ""}`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
