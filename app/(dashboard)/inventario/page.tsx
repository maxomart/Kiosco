"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { Plus, Search, Edit2, Trash2, Upload, Download, Package, AlertTriangle, X, Tag, PackagePlus, Lock, Sparkles, Copy, Percent, Camera, GitMerge, MoreHorizontal } from "lucide-react"
import { formatCurrency, PLAN_LIMITS, type Plan } from "@/lib/utils"
import { hasFeature } from "@/lib/permissions"
import ProductModal from "@/components/inventario/ProductModal"
import ImportModal from "@/components/inventario/ImportModal"
import { CategoryManagerModal } from "@/components/inventario/CategoryManagerModal"
import { AIEnrichModal } from "@/components/inventario/AIEnrichModal"
import { BulkPriceModal } from "@/components/inventario/BulkPriceModal"
import { DuplicatesModal } from "@/components/inventario/DuplicatesModal"
import { BarcodeScannerModal } from "@/components/inventario/BarcodeScannerModal"
import { PageTip } from "@/components/shared/PageTip"
import { HelpTip } from "@/components/ui/HelpTip"
import { StockBulkModal } from "@/components/inventario/StockBulkModal"
import { useConfirm } from "@/components/shared/ConfirmDialog"
import toast from "react-hot-toast"

interface Product {
  id: string
  name: string
  barcode: string | null
  sku: string | null
  salePrice: number
  costPrice: number
  stock: number
  minStock: number
  soldByWeight: boolean
  active: boolean
  category: { id: string; name: string } | null
  supplier: { id: string; name: string } | null
}

interface Category { id: string; name: string }
interface Supplier { id: string; name: string }

export default function InventarioPage() {
  const searchParams = useSearchParams()
  const initialFilter = searchParams.get("filter")
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "out">(
    initialFilter === "lowstock" ? "low" : initialFilter === "outstock" ? "out" : "all"
  )
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<string[]>([])
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showStockBulk, setShowStockBulk] = useState(false)
  const [showCategories, setShowCategories] = useState(false)
  const [showAIEnrich, setShowAIEnrich] = useState(false)
  const [duplicateProduct, setDuplicateProduct] = useState<Product | null>(null)
  const [showBulkPrice, setShowBulkPrice] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [showDuplicates, setShowDuplicates] = useState(false)
  const [newFromBarcode, setNewFromBarcode] = useState<string | null>(null)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [plan, setPlan] = useState<Plan>("STARTER")
  const confirm = useConfirm()
  const PER_PAGE = 20

  const load = useCallback(async () => {
    setLoading(true)
    // API only supports `q` and `lowStock` server-side; for "out" we filter client-side
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PER_PAGE),
      ...(search && { q: search }),
      ...(categoryFilter && { categoryId: categoryFilter }),
      ...(stockFilter === "low" && { lowStock: "true" }),
    })
    const res = await fetch(`/api/productos?${params}`)
    if (res.ok) {
      const data = await res.json()
      const list: Product[] = data.products ?? []
      setProducts(stockFilter === "out" ? list.filter((p) => p.stock === 0) : list)
      setTotal(data.total ?? list.length)
    }
    setLoading(false)
  }, [page, search, categoryFilter, stockFilter])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch("/api/categorias").then(r => r.json()).then(d => setCategories(d.categories || []))
    fetch("/api/proveedores").then(r => r.json()).then(d => setSuppliers(d.suppliers || []))
    fetch("/api/configuracion/suscripcion")
      .then(r => r.json())
      .then(d => { if (d.subscription?.plan) setPlan(d.subscription.plan as Plan) })
      .catch(() => {})
  }, [])

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "¿Eliminar producto?",
      description: "Se quita del catálogo y ya no va a aparecer en el POS. Esta acción no se puede deshacer.",
      confirmText: "Eliminar",
      tone: "danger",
    })
    if (!ok) return
    setDeleting(id)
    await fetch(`/api/productos/${id}`, { method: "DELETE" })
    await load()
    setDeleting(null)
  }

  const handleBulkDelete = async () => {
    const ok = await confirm({
      title: `¿Eliminar ${selected.length} productos?`,
      description: "Se quitan del catálogo. Esta acción no se puede deshacer.",
      confirmText: "Eliminar todos",
      tone: "danger",
    })
    if (!ok) return
    await fetch("/api/productos/bulk", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selected }),
    })
    setSelected([])
    await load()
  }

  const handleExport = async () => {
    // Export current filtered list to CSV client-side (backend has no export endpoint)
    const res = await fetch(`/api/productos?limit=200`)
    if (!res.ok) return
    const data = await res.json()
    const rows = [
      ["nombre", "codigo_barras", "sku", "costo", "precio_venta", "stock", "stock_minimo", "categoria", "proveedor"],
      ...(data.products as Product[]).map(p => [
        p.name,
        p.barcode ?? "",
        p.sku ?? "",
        String(p.costPrice),
        String(p.salePrice),
        String(p.stock),
        String(p.minStock),
        p.category?.name ?? "",
        p.supplier?.name ?? "",
      ]),
    ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")
    const a = document.createElement("a")
    a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`
    a.download = "productos.csv"
    a.click()
  }

  const toggleSelect = (id: string) =>
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])

  const selectAll = () =>
    setSelected(selected.length === products.length ? [] : products.map(p => p.id))

  const totalPages = Math.ceil(total / PER_PAGE)
  const lowStockCount = products.filter(p => p.stock > 0 && p.stock <= p.minStock).length
  const outOfStockCount = products.filter(p => p.stock === 0).length

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Contextual tips */}
      {total === 0 ? (
        <PageTip id="inventory:first-time" tone="accent">
          <strong>¡Bienvenido!</strong> Para cargar productos rápido tenés 3 opciones:{" "}
          <strong>Escanear</strong> el código de barras con la cámara,{" "}
          <strong>Importar</strong> desde un CSV/Excel, o crear manualmente con <strong>Nuevo producto</strong>.
        </PageTip>
      ) : total > 20 ? (
        <PageTip id="inventory:pro-tips" tone="sky">
          <strong>Tips de productividad:</strong> seleccioná varios productos con los checkboxes para <strong>mover a una categoría</strong> o <strong>ajustar precios en masa</strong>. Usá <strong>Auto-organizar con IA</strong> si tenés muchos sin categoría.
        </PageTip>
      ) : null}

      {/* Header — title + actions wrap together so the action row owns its
          own line on mobile instead of squeezing next to the title */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white">Inventario</h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">{total} productos · {lowStockCount} stock bajo · {outOfStockCount} sin stock</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {/* Acciones secundarias — icon-only en mobile para no saturar el header.
              Tooltips mantienen la información para el usuario. */}
          <button
            onClick={() => setShowScanner(true)}
            className="flex items-center gap-2 px-2.5 sm:px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors"
            title="Escanear código de barras"
            aria-label="Escanear código de barras"
          >
            <Camera size={16} /> <span className="hidden sm:inline">Escanear</span>
          </button>

          <button
            onClick={() => setShowAIEnrich(true)}
            className="flex items-center gap-2 px-2.5 sm:px-3 py-2 rounded-lg bg-gradient-to-r from-accent/20 to-accent-soft text-accent border border-accent/40 hover:from-accent/30 text-sm font-medium transition-colors whitespace-nowrap"
            title="Auto-asignar categoría y proveedor a productos con IA"
            aria-label="Auto-organizar con IA"
          >
            <Sparkles size={16} /> <span className="hidden sm:inline">Auto-organizar IA</span>
          </button>

          {/* Más acciones: dropdown con Importar / Exportar / Stock masivo / Categorías / Duplicados */}
          <div className="relative">
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              onBlur={() => setTimeout(() => setShowMoreMenu(false), 150)}
              className="flex items-center gap-2 px-2.5 sm:px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors"
              title="Más acciones"
              aria-label="Más acciones"
            >
              <MoreHorizontal size={16} /> <span className="hidden sm:inline">Más</span>
            </button>
            {showMoreMenu && (
              <div className="absolute right-0 top-full mt-1 w-60 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-20">
                <button
                  onMouseDown={() => { setShowMoreMenu(false); setShowCategories(true) }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-800 text-left text-sm text-gray-200 transition-colors"
                >
                  <Tag size={14} className="text-sky-400" /> Gestionar categorías
                </button>
                <button
                  onMouseDown={() => { setShowMoreMenu(false); setShowImport(true) }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-800 text-left text-sm text-gray-200 transition-colors"
                >
                  <Upload size={14} className="text-emerald-400" /> Importar CSV / Excel
                </button>
                <button
                  onMouseDown={() => { setShowMoreMenu(false); handleExport() }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-800 text-left text-sm text-gray-200 transition-colors"
                >
                  <Download size={14} className="text-gray-400" /> Exportar CSV
                </button>
                {(() => {
                  const bulkUnlocked = hasFeature(plan, "feature:csv_import")
                  return (
                    <button
                      onMouseDown={() => {
                        setShowMoreMenu(false)
                        if (bulkUnlocked) setShowStockBulk(true)
                        else window.location.href = "/configuracion/suscripcion"
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-800 text-left text-sm text-gray-200 transition-colors"
                    >
                      <PackagePlus size={14} className="text-emerald-400" /> Editar stock en masa
                      {!bulkUnlocked && <Lock size={10} className="text-amber-400 ml-auto" />}
                    </button>
                  )
                })()}
                <button
                  onMouseDown={() => { setShowMoreMenu(false); setShowDuplicates(true) }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-800 text-left text-sm text-gray-200 transition-colors border-t border-gray-800"
                >
                  <GitMerge size={14} className="text-amber-400" /> Detectar duplicados
                </button>
              </div>
            )}
          </div>

          {/* Botón principal */}
          {(() => {
            const productLimit = PLAN_LIMITS[plan].products
            const isUnlimited = !isFinite(productLimit)
            const atLimit = !isUnlimited && total >= productLimit
            return (
              <button
                data-tour="inventario-add"
                onClick={() => { setEditProduct(null); setShowModal(true) }}
                disabled={atLimit}
                title={atLimit ? `Plan ${plan}: máximo ${productLimit} productos` : isUnlimited ? undefined : `${total} / ${productLimit} productos en plan ${plan}`}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-accent-foreground text-sm font-medium transition-colors whitespace-nowrap"
              >
                <Plus size={16} /> {atLimit ? "Límite" : (<><span className="sm:hidden">Nuevo</span><span className="hidden sm:inline">Nuevo Producto</span></>)}
              </button>
            )
          })()}
        </div>
      </div>

      {/* Stock alerts */}
      {(lowStockCount > 0 || outOfStockCount > 0) && (
        <div className="flex gap-3">
          {outOfStockCount > 0 && (
            <button onClick={() => setStockFilter("out")} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm hover:bg-red-500/20 transition-colors">
              <AlertTriangle size={15} /> {outOfStockCount} sin stock
            </button>
          )}
          {lowStockCount > 0 && (
            <button onClick={() => setStockFilter("low")} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm hover:bg-yellow-500/20 transition-colors">
              <AlertTriangle size={15} /> {lowStockCount} stock bajo
            </button>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar por nombre, código de barras, SKU..."
            className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
        </div>
        <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500">
          <option value="">Todas las categorías</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={stockFilter} onChange={e => { setStockFilter(e.target.value as any); setPage(1) }}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500">
          <option value="all">Todo el stock</option>
          <option value="low">Stock bajo</option>
          <option value="out">Sin stock</option>
        </select>
        {(search || categoryFilter || stockFilter !== "all") && (
          <button onClick={() => { setSearch(""); setCategoryFilter(""); setStockFilter("all"); setPage(1) }}
            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm transition-colors">
            <X size={14} /> Limpiar
          </button>
        )}
      </div>

      {/* Discoverability hint: only shows when many products are uncategorized AND nothing selected */}
      {selected.length === 0 && products.length > 5 && products.filter(p => !p.category).length >= Math.max(3, Math.floor(products.length / 2)) && (
        <div className="bg-gradient-to-r from-accent-soft/40 to-accent-soft/10 border border-accent/30 rounded-lg px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
              <Tag className="w-4 h-4 text-accent" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-white font-medium">
                Tenés {products.filter(p => !p.category).length} producto{products.filter(p => !p.category).length !== 1 ? "s" : ""} sin categoría
              </p>
              <p className="text-xs text-gray-400">
                💡 Tildá varios productos con el checkbox de la izquierda para moverlos de golpe a una categoría.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              const ids = products.filter(p => !p.category).map(p => p.id)
              setSelected(ids)
            }}
            className="text-xs px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-accent-foreground font-medium whitespace-nowrap"
          >
            Seleccionar sin categoría
          </button>
        </div>
      )}

      {/* Bulk actions */}
      {selected.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-purple-600/10 border border-purple-500/30 rounded-lg flex-wrap">
          <span className="text-purple-300 text-sm font-medium">
            {selected.length} seleccionado{selected.length !== 1 ? "s" : ""}
          </span>

          {/* Assign category */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400">Mover a:</span>
            <select
              value=""
              onChange={async (e) => {
                const value = e.target.value
                if (!value) return
                const categoryId = value === "__none__" ? null : value
                const catName = categoryId
                  ? categories.find(c => c.id === categoryId)?.name ?? "categoría"
                  : "Sin categoría"
                const res = await fetch("/api/productos/bulk-category", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ productIds: selected, categoryId }),
                })
                if (res.ok) {
                  const data = await res.json()
                  toast.success(`${data.updated} productos movidos a ${catName}`)
                  setSelected([])
                  load()
                } else {
                  const data = await res.json()
                  toast.error(data.error || "Error al mover productos")
                }
              }}
              className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-purple-500"
            >
              <option value="">— Elegí categoría —</option>
              <option value="__none__">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setShowBulkPrice(true)}
            className="flex items-center gap-1 text-accent hover:text-accent-hover text-sm transition-colors"
            title="Ajustar precios en masa"
          >
            <Percent size={14} /> Ajustar precios
          </button>
          <button onClick={handleBulkDelete} className="text-red-400 hover:text-red-300 text-sm transition-colors">
            Eliminar seleccionados
          </button>
          <button onClick={() => setSelected([])} className="text-gray-400 hover:text-gray-300 text-sm ml-auto transition-colors">
            Cancelar
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="p-4 text-left">
                  <input type="checkbox" checked={selected.length === products.length && products.length > 0}
                    onChange={selectAll} className="rounded border-gray-600 bg-gray-700 text-purple-600" />
                </th>
                <th className="p-4 text-left text-gray-400 font-medium">Producto</th>
                <th className="p-4 text-left text-gray-400 font-medium">Código</th>
                <th className="p-4 text-left text-gray-400 font-medium">Categoría</th>
                <th className="p-4 text-right text-gray-400 font-medium">Costo</th>
                <th className="p-4 text-right text-gray-400 font-medium">Precio</th>
                <th className="p-4 text-right text-gray-400 font-medium">Margen</th>
                <th className="p-4 text-right text-gray-400 font-medium">Stock</th>
                <th className="p-4 text-center text-gray-400 font-medium">Estado</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-800/50">
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} className="p-4"><div className="h-4 bg-gray-800 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center">
                    {search || categoryFilter ? (
                      <div className="text-gray-500">
                        <Package size={40} className="mx-auto mb-3 opacity-30" />
                        <p>Ningún producto coincide con los filtros</p>
                        <button
                          onClick={() => { setSearch(""); setCategoryFilter(""); setStockFilter("all") }}
                          className="mt-2 text-accent hover:underline text-sm"
                        >
                          Limpiar filtros
                        </button>
                      </div>
                    ) : (
                      <div className="max-w-md mx-auto">
                        <div className="w-16 h-16 rounded-2xl bg-accent-soft flex items-center justify-center mx-auto mb-4">
                          <Package size={32} className="text-accent" />
                        </div>
                        <h3 className="text-lg font-semibold text-white mb-2">Empecemos cargando tus productos</h3>
                        <p className="text-sm text-gray-400 mb-5">
                          Elegí la forma más rápida según tu situación:
                        </p>
                        <div className="grid grid-cols-1 gap-2 text-left">
                          <button
                            onClick={() => setShowScanner(true)}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
                          >
                            <Camera size={18} className="text-sky-400 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white">Escanear código de barras</p>
                              <p className="text-[11px] text-gray-500">Con la cámara del celu o lector USB</p>
                            </div>
                          </button>
                          <button
                            onClick={() => setShowImport(true)}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
                          >
                            <Upload size={18} className="text-emerald-400 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white">Importar desde CSV / Excel</p>
                              <p className="text-[11px] text-gray-500">Cargá muchos productos de una planilla</p>
                            </div>
                          </button>
                          <button
                            onClick={() => { setEditProduct(null); setShowModal(true) }}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
                          >
                            <Plus size={18} className="text-amber-400 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white">Cargar manualmente</p>
                              <p className="text-[11px] text-gray-500">Uno por uno, completando el formulario</p>
                            </div>
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ) : products.map(p => {
                const margin = p.costPrice > 0 ? ((p.salePrice - p.costPrice) / p.costPrice * 100) : 0
                const stockStatus = p.stock === 0 ? "out" : p.stock <= p.minStock ? "low" : "ok"
                return (
                  <tr key={p.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="p-4">
                      <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggleSelect(p.id)}
                        className="rounded border-gray-600 bg-gray-700 text-purple-600" />
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-white">{p.name}</div>
                      {p.supplier && <div className="text-xs text-gray-500 mt-0.5">{p.supplier.name}</div>}
                    </td>
                    <td className="p-4 text-gray-400 font-mono text-xs">{p.barcode || p.sku || "—"}</td>
                    <td className="p-4">
                      {p.category ? (
                        <span className="px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 text-xs">{p.category.name}</span>
                      ) : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="p-4 text-right text-gray-300">{formatCurrency(p.costPrice)}</td>
                    <td className="p-4 text-right font-medium text-white">{formatCurrency(p.salePrice)}</td>
                    <td className="p-4 text-right">
                      <span className={margin >= 20 ? "text-green-400" : margin >= 10 ? "text-yellow-400" : "text-red-400"}>
                        {margin.toFixed(1)}%
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <span className={stockStatus === "out" ? "text-red-400 font-bold" : stockStatus === "low" ? "text-yellow-400 font-medium" : "text-green-400"}>
                        {p.stock}{p.soldByWeight ? " kg" : ""}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${p.active ? "bg-green-500/10 text-green-400" : "bg-gray-700 text-gray-500"}`}>
                        {p.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setEditProduct(p); setShowModal(true) }}
                          className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                          title="Editar">
                          <Edit2 size={15} />
                        </button>
                        <button onClick={() => { setDuplicateProduct(p) }}
                          className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-accent transition-colors"
                          title="Duplicar producto">
                          <Copy size={15} />
                        </button>
                        <button onClick={() => handleDelete(p.id)} disabled={deleting === p.id}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
                          title="Eliminar">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <span className="text-sm text-gray-500">
              Mostrando {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} de {total}
            </span>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                Anterior
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = page <= 3 ? i + 1 : page >= totalPages - 2 ? totalPages - 4 + i : page - 2 + i
                return p > 0 && p <= totalPages ? (
                  <button key={p} onClick={() => setPage(p)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${p === page ? "bg-purple-600 text-white" : "bg-gray-800 hover:bg-gray-700 text-gray-300"}`}>
                    {p}
                  </button>
                ) : null
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <ProductModal
          product={editProduct}
          categories={categories}
          suppliers={suppliers}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}
      {duplicateProduct && (
        <ProductModal
          product={duplicateProduct as any}
          categories={categories}
          suppliers={suppliers}
          duplicate
          onClose={() => setDuplicateProduct(null)}
          onSaved={() => { setDuplicateProduct(null); load() }}
        />
      )}
      {showImport && (
        <ImportModal onClose={() => setShowImport(false)} onDone={() => { setShowImport(false); load() }} />
      )}

      {showStockBulk && (
        <StockBulkModal onClose={() => setShowStockBulk(false)} onDone={() => { setShowStockBulk(false); load() }} />
      )}

      <CategoryManagerModal
        open={showCategories}
        onClose={() => setShowCategories(false)}
        onChanged={() => load()}
      />

      <AIEnrichModal
        open={showAIEnrich}
        onClose={() => setShowAIEnrich(false)}
        onApplied={() => load()}
      />

      <BulkPriceModal
        open={showBulkPrice}
        selectedIds={selected}
        products={products as any}
        onClose={() => setShowBulkPrice(false)}
        onApplied={() => { setSelected([]); load() }}
      />

      <DuplicatesModal
        open={showDuplicates}
        onClose={() => setShowDuplicates(false)}
        onApplied={() => load()}
      />

      <BarcodeScannerModal
        open={showScanner}
        onClose={() => setShowScanner(false)}
        onCreateProduct={(barcode) => {
          setShowScanner(false)
          setNewFromBarcode(barcode)
        }}
        onEditProduct={(product) => {
          setShowScanner(false)
          setEditProduct(product as any)
          setShowModal(true)
        }}
      />

      {newFromBarcode !== null && (
        <ProductModal
          product={null}
          defaultBarcode={newFromBarcode}
          categories={categories}
          suppliers={suppliers}
          onClose={() => setNewFromBarcode(null)}
          onSaved={() => { setNewFromBarcode(null); load() }}
        />
      )}
    </div>
  )
}
