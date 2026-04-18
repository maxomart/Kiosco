"use client"

import { useState, useMemo } from "react"
import { formatCurrency, isLowStock, getStockColor } from "@/lib/utils"
import {
  Search, Plus, Filter, Download, AlertTriangle,
  Edit, Trash2, Package, ChevronUp, ChevronDown, Eye
} from "lucide-react"
import { cn } from "@/lib/utils"
import toast from "react-hot-toast"
import ProductModal from "./ProductModal"
import ImportModal from "./ImportModal"

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
  imageUrl?: string
  category?: { id: string; name: string; color?: string }
  supplier?: { id: string; name: string }
}

interface Category { id: string; name: string; color?: string }
interface Supplier { id: string; name: string }

interface Props {
  initialProducts: Product[]
  categories: Category[]
  suppliers: Supplier[]
}

type SortKey = "name" | "stock" | "salePrice" | "costPrice"

export default function InventarioClient({ initialProducts, categories, suppliers }: Props) {
  const [products, setProducts] = useState(initialProducts)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [lowStockFilter, setLowStockFilter] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>("name")
  const [sortAsc, setSortAsc] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [showDeleteAll, setShowDeleteAll] = useState(false)

  // Filtrar y ordenar
  const filtered = useMemo(() => {
    let result = products.filter((p) => {
      const q = search.toLowerCase()
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.barcode?.includes(q) ||
        p.sku?.toLowerCase().includes(q)
      const matchCat = !categoryFilter || p.category?.id === categoryFilter
      const matchLow = !lowStockFilter || isLowStock(p.stock, p.minStock)
      return matchSearch && matchCat && matchLow
    })

    result.sort((a, b) => {
      const va = a[sortKey] ?? 0
      const vb = b[sortKey] ?? 0
      const cmp = typeof va === "string" ? va.localeCompare(vb as string) : (va as number) - (vb as number)
      return sortAsc ? cmp : -cmp
    })

    return result
  }, [products, search, categoryFilter, lowStockFilter, sortKey, sortAsc])

  const lowStockCount = products.filter(p => isLowStock(p.stock, p.minStock)).length

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(true) }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar "${name}"? Esta acción no se puede deshacer.`)) return
    try {
      const res = await fetch(`/api/productos/${id}`, { method: "DELETE" })
      if (res.ok) {
        setProducts(prev => prev.filter(p => p.id !== id))
        toast.success("Producto eliminado")
      } else {
        toast.error("No se pudo eliminar el producto")
      }
    } catch {
      toast.error("Error de conexión")
    }
  }

  const handleDeleteAll = async () => {
    try {
      const res = await fetch("/api/productos/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "BORRAR TODO", mode: "soft" }),
      })
      if (res.ok) {
        setProducts([])
        setShowDeleteAll(false)
        toast.success("Todos los productos fueron eliminados")
      } else {
        const err = await res.json()
        toast.error(err.error ?? "Error al borrar todos los productos")
      }
    } catch {
      toast.error("Error de conexión")
    }
  }

  const handleSave = (product: Product) => {
    setProducts(prev => {
      const exists = prev.find(p => p.id === product.id)
      if (exists) return prev.map(p => p.id === product.id ? product : p)
      return [product, ...prev]
    })
    setShowModal(false)
    setEditingProduct(null)
  }

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.error("No hay productos para exportar")
      return
    }
    const headers = [
      "Nombre", "Código", "SKU", "Categoría", "Proveedor",
      "Stock", "Stock mínimo", "Unidad",
      "Precio costo", "Precio venta", "Ganancia %",
    ]
    const esc = (v: any) => {
      const s = v === undefined || v === null ? "" : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const rows = filtered.map(p => [
      p.name, p.barcode ?? "", p.sku ?? "",
      p.category?.name ?? "", p.supplier?.name ?? "",
      p.stock, p.minStock, p.unit,
      p.costPrice, p.salePrice, p.profitPercent.toFixed(1),
    ].map(esc).join(","))
    const csv = "\uFEFF" + [headers.join(","), ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `inventario-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success(`${filtered.length} productos exportados`)
  }

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col ? (sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : null

  return (
    <div className="p-6 dark:bg-gray-900 dark:text-white min-h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Inventario</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
            {products.length} productos
            {lowStockCount > 0 && (
              <span className="ml-2 text-orange-600 font-medium">
                · {lowStockCount} con stock bajo
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition text-sm font-medium"
          >
            <Download size={16} />
            Exportar
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition text-sm font-medium"
          >
            <Filter size={16} />
            Importar CSV
          </button>
          <button
            onClick={() => setShowDeleteAll(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl transition text-sm font-medium"
          >
            <Trash2 size={16} />
            Borrar todo
          </button>
          <button
            onClick={() => { setEditingProduct(null); setShowModal(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition text-sm font-bold"
          >
            <Plus size={16} />
            Nuevo producto
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, código o SKU..."
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:border-blue-500 transition text-sm dark:text-white dark:placeholder-gray-500"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:border-blue-500 transition text-sm text-gray-700 dark:text-white"
        >
          <option value="">Todas las categorías</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <button
          onClick={() => setLowStockFilter(!lowStockFilter)}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition",
            lowStockFilter
              ? "bg-orange-500 border-orange-500 text-white"
              : "bg-white border-gray-200 text-gray-600 hover:border-orange-300"
          )}
        >
          <AlertTriangle size={16} />
          Stock bajo
          {lowStockCount > 0 && !lowStockFilter && (
            <span className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
              {lowStockCount}
            </span>
          )}
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 text-left border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wide">
                  <button onClick={() => handleSort("name")} className="flex items-center gap-1 hover:text-gray-800 dark:hover:text-white">
                    Producto <SortIcon col="name" />
                  </button>
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wide">
                  Categoría
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wide">
                  <button onClick={() => handleSort("stock")} className="flex items-center gap-1 hover:text-gray-800 dark:hover:text-white">
                    Stock <SortIcon col="stock" />
                  </button>
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wide">
                  <button onClick={() => handleSort("costPrice")} className="flex items-center gap-1 hover:text-gray-800 dark:hover:text-white">
                    Costo <SortIcon col="costPrice" />
                  </button>
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wide">
                  <button onClick={() => handleSort("salePrice")} className="flex items-center gap-1 hover:text-gray-800 dark:hover:text-white">
                    Precio Venta <SortIcon col="salePrice" />
                  </button>
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wide">
                  Ganancia
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wide">
                  Proveedor
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-gray-400 dark:text-gray-500">
                    <Package size={48} className="mx-auto mb-3 opacity-40" />
                    <p>No se encontraron productos</p>
                  </td>
                </tr>
              ) : (
                filtered.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700 transition group">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{product.name}</p>
                        {product.barcode && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">{product.barcode}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {product.category && (
                        <span
                          className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: product.category.color || "#6b7280" }}
                        >
                          {product.category.name}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {isLowStock(product.stock, product.minStock) && (
                          <AlertTriangle size={14} className="text-orange-500 flex-shrink-0" />
                        )}
                        <span className={cn("font-bold text-sm", getStockColor(product.stock, product.minStock, product.idealStock))}>
                          {product.stock} {product.unit}
                        </span>
                        <span className="text-xs text-gray-400">(min: {product.minStock})</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                      {formatCurrency(product.costPrice)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-gray-800 dark:text-gray-200 text-sm">
                        {formatCurrency(product.salePrice)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "text-sm font-semibold",
                        product.profitPercent >= 30 ? "text-green-600" : product.profitPercent >= 15 ? "text-yellow-600" : "text-red-600"
                      )}>
                        {product.profitPercent.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {product.supplier?.name ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => { setEditingProduct(product); setShowModal(true) }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Editar"
                        >
                          <Edit size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(product.id, product.name)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Eliminar"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal crear/editar producto */}
      {showModal && (
        <ProductModal
          product={editingProduct}
          categories={categories}
          suppliers={suppliers}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingProduct(null) }}
        />
      )}

      {/* Modal importar CSV */}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onSuccess={() => {
            // Recargar productos desde la API
            fetch("/api/productos?limit=500")
              .then(r => r.json())
              .then(data => setProducts(data.products ?? data))
              .catch(() => {})
          }}
        />
      )}

      {/* Modal confirmar borrar todos */}
      {showDeleteAll && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/75 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                <Trash2 size={22} className="text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800 dark:text-white">¿Borrar todos los productos?</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{products.length} productos en total</p>
              </div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-5">
              <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                Esta acción desactivará todos los productos del inventario. Los productos con ventas registradas serán marcados como inactivos (no se eliminarán permanentemente). No se puede revertir fácilmente.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteAll(false)}
                className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl transition text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteAll}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl transition text-sm font-bold flex items-center justify-center gap-2"
              >
                <Trash2 size={15} />
                Sí, borrar todo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
