"use client"

import { useState, useEffect, useRef } from "react"
import { X, Loader2, Sparkles, Users, BookOpen, Package, Image as ImageIcon, Upload, Trash2 } from "lucide-react"
import { HelpTip } from "@/components/ui/HelpTip"
import { resizeImage } from "@/lib/image"
import toast from "react-hot-toast"

interface Suggestion {
  name: string
  barcode: string | null
  category: string | null
  supplier: string | null
  suggestedSalePrice: number | null
  suggestedCostPrice: number | null
  tenantCount: number
  source: "comunidad" | "catalogo-argentino" | "catalogo-curado"
}

interface Product {
  id: string
  name: string
  barcode: string | null
  sku: string | null
  description?: string | null
  salePrice: number
  costPrice: number
  stock: number
  minStock: number
  soldByWeight: boolean
  active: boolean
  image?: string | null
  categoryId?: string | null
  supplierId?: string | null
  category: { id: string; name: string } | null
  supplier: { id: string; name: string } | null
}

interface Props {
  product: Product | null
  categories: { id: string; name: string }[]
  suppliers: { id: string; name: string }[]
  onClose: () => void
  onSaved: () => void
  /** If true, preload form from `product` but always create a new one on save. */
  duplicate?: boolean
  /** Pre-fills barcode on a brand-new product (e.g. from barcode scanner). */
  defaultBarcode?: string
}

export default function ProductModal({ product, categories, suppliers, onClose, onSaved, duplicate = false, defaultBarcode }: Props) {
  const [form, setForm] = useState({
    name: "", barcode: defaultBarcode ?? "", sku: "", description: "", salePrice: "", costPrice: "",
    stock: "", minStock: "5", soldByWeight: false, active: true, categoryId: "", supplierId: "",
  })
  const [image, setImage] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // ─── Autocomplete por catálogo de la comunidad ───────────────────────
  // Mientras el user tipea el nombre, debouncemos 300ms y consultamos
  // /api/productos/sugerencias. Si hay matches mostramos un dropdown
  // con N kioscos que tienen ese producto + precio mediano sugerido.
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autocompleteRef = useRef<HTMLDivElement>(null)
  // Usamos un ref para el suggestion activo durante el mousedown para
  // que el handler del click no compita con el blur del input.
  const justSelectedRef = useRef(false)

  useEffect(() => {
    // No buscamos cuando estamos editando un producto existente — sería
    // ruido. Solo en alta nueva (incluyendo duplicate).
    if (product && !duplicate) return
    if (form.name.trim().length < 3) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    // Si acabamos de aplicar una sugerencia, evitamos el re-fetch que
    // dispararía el setForm de applySuggestion (sino reabre el dropdown).
    if (justSelectedRef.current) {
      justSelectedRef.current = false
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        setLoadingSuggestions(true)
        const res = await fetch(`/api/productos/sugerencias?q=${encodeURIComponent(form.name.trim())}`)
        if (res.ok) {
          const d = await res.json()
          setSuggestions(d.suggestions ?? [])
          setShowSuggestions((d.suggestions ?? []).length > 0)
        }
      } catch { /* silencioso */ }
      finally { setLoadingSuggestions(false) }
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [form.name, product, duplicate])

  // Click fuera del componente cierra el dropdown. Más confiable que
  // onBlur porque no compite con el click del propio dropdown.
  useEffect(() => {
    if (!showSuggestions) return
    const onDocClick = (e: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [showSuggestions])

  const applySuggestion = (s: Suggestion) => {
    justSelectedRef.current = true
    setForm(f => ({
      ...f,
      name: s.name,
      barcode: s.barcode ?? f.barcode,
      salePrice: s.suggestedSalePrice ? String(s.suggestedSalePrice) : f.salePrice,
      costPrice: s.suggestedCostPrice ? String(s.suggestedCostPrice) : f.costPrice,
      // Categoría + proveedor: solo aplicamos si match con uno existente
      // del tenant (sino habría que crearlos, eso queda fuera del scope acá).
      categoryId: s.category
        ? (categories.find(c => c.name.toLowerCase() === s.category!.toLowerCase())?.id ?? f.categoryId)
        : f.categoryId,
      supplierId: s.supplier
        ? (suppliers.find(sp => sp.name.toLowerCase() === s.supplier!.toLowerCase())?.id ?? f.supplierId)
        : f.supplierId,
    }))
    setSuggestions([])
    setShowSuggestions(false)
  }

  useEffect(() => {
    if (product) {
      setForm({
        name: duplicate ? `${product.name} (copia)` : product.name,
        barcode: duplicate ? "" : (product.barcode || ""),  // barcode must be unique — blank for duplicates
        sku: duplicate ? "" : (product.sku || ""),           // sku unique too
        description: product.description || "",
        salePrice: String(product.salePrice),
        costPrice: String(product.costPrice),
        stock: duplicate ? "0" : String(product.stock),      // duplicated starts at 0 stock
        minStock: String(product.minStock),
        soldByWeight: product.soldByWeight ?? false,
        active: product.active,
        categoryId: product.category?.id || product.categoryId || "",
        supplierId: product.supplier?.id || product.supplierId || "",
      })
      setImage(product.image ?? null)
    }
  }, [product, duplicate])

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("El archivo tiene que ser una imagen.")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen es muy grande (máx 5 MB).")
      return
    }
    setUploadingImage(true)
    try {
      // 400px ≈ 25-50 KB en JPEG calidad 0.75. El POS la muestra ~200x200,
      // así que 400 es más que suficiente para que se vea bien.
      const dataUrl = await resizeImage(file, 400, 0.75)
      setImage(dataUrl)
    } catch (err) {
      console.error("[product-image]", err)
      toast.error("No se pudo procesar la imagen. Probá con otra.")
    } finally {
      setUploadingImage(false)
    }
  }

  const set = (key: string, val: string | boolean) =>
    setForm(f => ({ ...f, [key]: val }))

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = "Nombre requerido"
    if (!form.salePrice || isNaN(parseFloat(form.salePrice)) || parseFloat(form.salePrice) < 0) e.salePrice = "Precio inválido"
    if (form.costPrice && isNaN(parseFloat(form.costPrice))) e.costPrice = "Costo inválido"
    if (form.stock && isNaN(parseFloat(form.stock))) e.stock = "Stock inválido"
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
      salePrice: parseFloat(form.salePrice),
      costPrice: parseFloat(form.costPrice || "0"),
      stock: parseFloat(form.stock || "0"),
      minStock: parseFloat(form.minStock || "5"),
      soldByWeight: form.soldByWeight,
      active: form.active,
      image: image,
      categoryId: form.categoryId || null,
      supplierId: form.supplierId || null,
    }
    // duplicate mode → always POST (new product). edit mode → PUT with id.
    const isEdit = product && !duplicate
    const res = await fetch(isEdit ? `/api/productos/${product!.id}` : "/api/productos", {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (res.ok) { onSaved() }
    else {
      const d = await res.json().catch(() => ({}))
      if (d.error) setErrors({ _global: d.error })
    }
    setSaving(false)
  }

  const margin = form.salePrice && form.costPrice && parseFloat(form.costPrice) > 0
    ? ((parseFloat(form.salePrice) - parseFloat(form.costPrice)) / parseFloat(form.costPrice) * 100).toFixed(1)
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
          <h2 className="text-white font-semibold text-lg">
            {duplicate ? "Duplicar producto" : product ? "Editar producto" : "Nuevo producto"}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {errors._global && (
            <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{errors._global}</div>
          )}

          {/* Name + autocomplete por catálogo de la comunidad */}
          <div className="relative" ref={autocompleteRef}>
            <label className="block text-sm text-gray-400 mb-1.5">
              Nombre *
              {loadingSuggestions && <Loader2 size={11} className="inline ml-2 text-gray-500 animate-spin" />}
            </label>
            <input
              value={form.name}
              onChange={e => set("name", e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              autoComplete="off"
              className={`w-full px-3 py-2.5 bg-gray-800 border rounded-lg text-white text-sm focus:outline-none focus:border-purple-500 ${errors.name ? "border-red-500" : "border-gray-700"}`}
            />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}

            {/* Dropdown de sugerencias del catálogo agregado */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-20 left-0 right-0 mt-1 rounded-lg border border-gray-700 bg-gray-950 shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
                <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 bg-gray-900 border-b border-gray-800 flex items-center gap-1.5">
                  <Sparkles size={10} className="text-accent" />
                  Sugerencias del catálogo de Orvex
                </div>
                {suggestions.map((s, i) => (
                  <button
                    key={`${s.barcode ?? s.name}-${i}`}
                    type="button"
                    onClick={() => applySuggestion(s)}
                    className="w-full px-3 py-2.5 hover:bg-gray-800 transition-colors text-left flex items-start gap-2 border-b border-gray-800 last:border-0"
                  >
                    <div className={`shrink-0 mt-0.5 ${
                      s.source === "comunidad"
                        ? "text-emerald-400"
                        : s.source === "catalogo-argentino"
                        ? "text-amber-400"
                        : "text-blue-400"
                    }`}>
                      {s.source === "comunidad"
                        ? <Users size={13} />
                        : s.source === "catalogo-argentino"
                        ? <Package size={13} />
                        : <BookOpen size={13} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm text-white font-medium truncate">{s.name}</p>
                        {s.suggestedSalePrice !== null && (
                          <span className="text-xs text-emerald-300 tabular-nums shrink-0">
                            ~${s.suggestedSalePrice.toLocaleString("es-AR")}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                        {s.source === "comunidad"
                          ? `${s.tenantCount} kioscos lo tienen`
                          : s.source === "catalogo-argentino"
                          ? "Catálogo Orvex · precio orientativo"
                          : "Catálogo de marcas argentinas"}
                        {s.category && ` · ${s.category}`}
                        {s.supplier && ` · ${s.supplier}`}
                      </p>
                    </div>
                  </button>
                ))}
                <div className="px-3 py-2 text-[10px] text-gray-600 bg-gray-900/50 border-t border-gray-800">
                  Los precios son medianas entre kioscos. Ajustalo a tu costo real.
                </div>
              </div>
            )}
          </div>

          {/* Imagen del producto */}
          <div>
            <label className="flex items-center gap-1.5 text-sm text-gray-400 mb-1.5">
              Imagen
              <HelpTip
                text="Foto del producto. En el POS se muestra grande tipo menú, ideal para fiambrería, comidas o cualquier kiosco con catálogo visual."
                example="Sacale una foto desde el celu o subí la del fabricante. Se redimensiona automático a 400px."
              />
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
                e.currentTarget.value = ""
              }}
            />
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={image}
                    alt="Preview"
                    className="w-20 h-20 rounded-xl border border-gray-700 bg-gray-800 object-cover"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-700 bg-gray-800/40 flex items-center justify-center">
                    <ImageIcon size={22} className="text-gray-600" />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-xs text-gray-200 disabled:opacity-50"
                >
                  {uploadingImage ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  {image ? "Cambiar" : "Subir foto"}
                </button>
                {image && (
                  <button
                    type="button"
                    onClick={() => setImage(null)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 size={12} />
                    Quitar
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Barcode + SKU */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-sm text-gray-400 mb-1.5">
                Código de barras
                <HelpTip
                  text="El número que trae cada producto en su empaque. Sirve para escanear rápido en el POS."
                  example="Mayoría de productos: 13 dígitos (EAN-13). Podés escanear con la cámara desde el botón Escanear."
                />
              </label>
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
                <input type="number" value={form.salePrice} onChange={e => set("salePrice", e.target.value)}
                  min="0" step="0.01" placeholder="0.00"
                  className={`w-full pl-7 pr-3 py-2.5 bg-gray-800 border rounded-lg text-white text-sm focus:outline-none focus:border-purple-500 ${errors.salePrice ? "border-red-500" : "border-gray-700"}`} />
              </div>
              {errors.salePrice && <p className="text-red-400 text-xs mt-1">{errors.salePrice}</p>}
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-sm text-gray-400 mb-1.5">
                Costo
                <HelpTip
                  text="Lo que te sale comprarlo al proveedor. Se usa para calcular tu ganancia y el margen."
                  example="Si lo comprás a $1.000 y lo vendés a $1.500, tu margen es 33%."
                />
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

          {/* Stock + MinStock + soldByWeight */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">
                Stock {form.soldByWeight ? "(kg)" : ""}
              </label>
              <input type="number" value={form.stock} onChange={e => set("stock", e.target.value)}
                min="0" step={form.soldByWeight ? "0.001" : "1"}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500" />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-sm text-gray-400 mb-1.5">
                Stock mínimo {form.soldByWeight ? "(kg)" : ""}
                <HelpTip
                  text="Cuando el stock llega a este número, aparece como 'stock bajo' en el dashboard para que repongas."
                  example="Para una Coca 500ml que vendés 5 por día, poné 10-15 de mínimo."
                />
              </label>
              <input type="number" value={form.minStock} onChange={e => set("minStock", e.target.value)}
                min="0" step={form.soldByWeight ? "0.001" : "1"}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500" />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-sm text-gray-400 mb-1.5">
                Por peso
                <HelpTip
                  text="Activá esto para productos que se venden por kilo o gramo (fiambres, verduras)."
                  example="Al activarlo, en el POS vas a poder ingresar el peso en vez de cantidad."
                />
              </label>
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <div onClick={() => set("soldByWeight", !form.soldByWeight)}
                  className={`w-9 h-5 rounded-full transition-colors relative ${form.soldByWeight ? "bg-purple-600" : "bg-gray-700"}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.soldByWeight ? "left-4" : "left-0.5"}`} />
                </div>
                <span className="text-xs text-gray-400">{form.soldByWeight ? "Sí (kg)" : "No (un.)"}</span>
              </label>
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
