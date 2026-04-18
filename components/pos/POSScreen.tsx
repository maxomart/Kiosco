"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { usePOSStore } from "@/store/posStore"
import { formatCurrency } from "@/lib/utils"
import {
  Search, Trash2, Plus, Minus, ShoppingCart,
  CreditCard, Banknote, Scan, X, ChevronDown,
  Tag, User, StickyNote, Zap, Lock, Unlock
} from "lucide-react"
import toast from "react-hot-toast"
import PaymentModal from "./PaymentModal"
import BarcodeScanner from "./BarcodeScanner"
import { cn } from "@/lib/utils"

interface Product {
  id: string
  name: string
  barcode?: string
  salePrice: number
  costPrice: number
  stock: number
  unit: string
  soldByWeight: boolean
  taxRate: "ZERO" | "REDUCED" | "STANDARD"
  categoryName?: string
}

export default function POSScreen() {
  const {
    items, subtotal, discountAmount, total, discount,
    addItem, removeItem, updateQuantity, updateItemDiscount,
    setDiscount, clearCart, setNote, note,
  } = usePOSStore()

  const [cajaStatus, setCajaStatus] = useState<"loading" | "open" | "closed">("loading")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Product[]>([])
  const [selectedIdx, setSelectedIdx] = useState(-1)
  const [searching, setSearching] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [showDiscount, setShowDiscount] = useState(false)
  const [showNote, setShowNote] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const searchTimeout = useRef<NodeJS.Timeout>()

  // Verificar si la caja está abierta al montar
  useEffect(() => {
    fetch("/api/caja")
      .then(r => r.json())
      .then(data => {
        setCajaStatus(data.session?.status === "OPEN" ? "open" : "closed")
      })
      .catch(() => setCajaStatus("closed"))
  }, [])

  // Focus en búsqueda al montar
  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  // Atajo de teclado: F2 = cobrar, F3 = limpiar, F4 = escáner
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "F2" && items.length > 0) { e.preventDefault(); setShowPayment(true) }
      if (e.key === "F3") { e.preventDefault(); clearCart() }
      if (e.key === "F4") { e.preventDefault(); setShowScanner(true) }
      if (e.key === "Escape") {
        setSearchQuery(""); setSearchResults([])
        searchRef.current?.focus()
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [items, clearCart])

  // Buscar productos
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query)
    setSelectedIdx(-1)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)

    if (!query.trim()) { setSearchResults([]); return }

    searchTimeout.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/productos?q=${encodeURIComponent(query)}&limit=8`)
        if (res.ok) {
          const data = await res.json()
          setSearchResults(data.products)
        }
      } catch {
        // Sin internet → usar cache offline
        const { searchProductsOffline } = await import("@/lib/offline/db")
        const offline = await searchProductsOffline(query)
        setSearchResults(offline as any)
      } finally {
        setSearching(false)
      }
    }, 200)
  }, [])

  // Agregar producto al carrito
  const handleAddProduct = (product: Product) => {
    if (product.stock <= 0 && !product.soldByWeight) {
      toast.error(`Sin stock: ${product.name}`)
      return
    }
    addItem({
      productId: product.id,
      name: product.name,
      barcode: product.barcode,
      price: product.salePrice,
      costPrice: product.costPrice,
      unit: product.unit,
      soldByWeight: product.soldByWeight,
      taxRate: product.taxRate,
    })
    setSearchQuery("")
    setSearchResults([])
    searchRef.current?.focus()
  }

  // Escanear código de barras
  const handleBarcode = async (barcode: string) => {
    setShowScanner(false)
    try {
      const res = await fetch(`/api/productos?barcode=${barcode}`)
      if (res.ok) {
        const data = await res.json()
        if (data.products?.[0]) handleAddProduct(data.products[0])
        else toast.error(`Producto no encontrado: ${barcode}`)
      }
    } catch {
      const { findByBarcodeOffline } = await import("@/lib/offline/db")
      const product = await findByBarcodeOffline(barcode)
      if (product) handleAddProduct(product as any)
      else toast.error(`Producto no encontrado: ${barcode}`)
    }
  }

  // Navegación con teclado en resultados de búsqueda
  const handleSearchKey = (e: React.KeyboardEvent) => {
    if (searchResults.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIdx(prev => Math.min(prev + 1, searchResults.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIdx(prev => Math.max(prev - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const idx = selectedIdx >= 0 ? selectedIdx : 0
      if (searchResults[idx]) handleAddProduct(searchResults[idx])
    }
  }

  // Pantalla de carga mientras verifica la caja
  if (cajaStatus === "loading") {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Pantalla bloqueada si la caja está cerrada
  if (cajaStatus === "closed") {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-50 dark:bg-gray-900 gap-6">
        <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
          <Lock size={40} className="text-red-500" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Caja cerrada</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">Para empezar a vender, primero abrí la caja.</p>
          <a href="/caja" className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-bold transition">
            <Unlock size={18} />
            Ir a abrir la caja
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* ===== PANEL IZQUIERDO: BÚSQUEDA ===== */}
      <div className="flex-1 flex flex-col p-4 min-w-0">

        {/* Barra de búsqueda */}
        <div className="relative mb-3">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
            {searching ? (
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Search size={20} />
            )}
          </div>
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onKeyDown={handleSearchKey}
            placeholder="Buscar producto por nombre, código... (Enter para agregar)"
            className="w-full pl-12 pr-12 py-4 text-lg bg-white dark:bg-gray-800 dark:text-white dark:border-gray-600 dark:placeholder-gray-400 rounded-2xl border-2 border-gray-200 focus:border-blue-500 outline-none transition shadow-sm"
            autoComplete="off"
          />
          <button
            onClick={() => setShowScanner(true)}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
            title="Escanear código (F4)"
          >
            <Scan size={22} />
          </button>
        </div>

        {/* Resultados de búsqueda */}
        {searchResults.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg mb-3 overflow-hidden animate-fadeIn">
            {searchResults.map((product, idx) => (
              <button
                key={product.id}
                onClick={() => handleAddProduct(product)}
                className={cn(
                  "w-full flex items-center gap-4 px-4 py-3 hover:bg-blue-50 dark:hover:bg-gray-700 transition text-left",
                  idx > 0 && "border-t border-gray-100 dark:border-gray-700",
                  idx === selectedIdx && "bg-blue-50 dark:bg-gray-700 border-l-2 border-l-blue-500"
                )}
              >
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <ShoppingCart size={18} className="text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 dark:text-gray-200 truncate">{product.name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {product.categoryName} · Stock: {product.stock} {product.unit}
                    {product.barcode && ` · ${product.barcode}`}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-blue-700 text-lg">{formatCurrency(product.salePrice)}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Atajos de teclado */}
        <div className="flex gap-2 text-xs text-gray-400 dark:text-gray-500 mb-3 flex-wrap">
          <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">F2 Cobrar</span>
          <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">F3 Limpiar</span>
          <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">F4 Escáner</span>
          <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">ESC Cancelar</span>
          <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">↑↓ Navegar</span>
        </div>

        {/* Placeholder cuando no hay búsqueda */}
        {!searchQuery && searchResults.length === 0 && items.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-300">
              <ShoppingCart size={80} className="mx-auto mb-4" />
              <p className="text-xl font-medium">Buscar un producto para empezar</p>
              <p className="text-sm mt-1">O escaneá el código de barras</p>
            </div>
          </div>
        )}
      </div>

      {/* ===== PANEL DERECHO: CARRITO ===== */}
      <div className="w-96 flex flex-col bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-xl">

        {/* Header del carrito */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart size={20} className="text-blue-600" />
            <h2 className="font-bold text-gray-800 dark:text-white">
              Carrito
              {items.length > 0 && (
                <span className="ml-2 text-sm bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                  {items.length}
                </span>
              )}
            </h2>
          </div>
          {items.length > 0 && (
            <button
              onClick={() => { if (confirm("¿Limpiar el carrito?")) clearCart() }}
              className="text-gray-400 hover:text-red-500 transition"
              title="Limpiar carrito (F3)"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Items del carrito */}
        <div className="flex-1 overflow-y-auto py-2">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-300 p-6">
              <ShoppingCart size={48} className="mb-3" />
              <p className="text-sm">El carrito está vacío</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.productId} className="px-4 py-3 border-b border-gray-50 dark:border-gray-700 group">
                <div className="flex items-start gap-2">
                  {/* Nombre */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm leading-tight truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {formatCurrency(item.price)} c/u
                      {item.discount > 0 && (
                        <span className="ml-1 text-green-600">(-{item.discount}%)</span>
                      )}
                    </p>
                  </div>

                  {/* Subtotal */}
                  <p className="font-bold text-gray-800 dark:text-gray-200 text-sm">
                    {formatCurrency(item.subtotal)}
                  </p>
                </div>

                {/* Controles de cantidad */}
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-xl overflow-hidden">
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      className="w-9 h-9 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                    >
                      <Minus size={14} />
                    </button>
                    <input
                      type="number"
                      min="0.001"
                      step={item.soldByWeight ? "0.001" : "1"}
                      value={item.soldByWeight ? item.quantity.toFixed(3) : item.quantity}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value)
                        if (!isNaN(v) && v > 0) updateQuantity(item.productId, v)
                      }}
                      className="w-12 text-center font-bold text-sm dark:text-white bg-transparent border-none outline-none focus:bg-blue-50 dark:focus:bg-gray-600 rounded"
                    />
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      className="w-9 h-9 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  <span className="text-xs text-gray-400">{item.unit}</span>

                  {/* Descuento por ítem */}
                  <button
                    onClick={() => {
                      const d = prompt("Descuento % para este ítem:", String(item.discount))
                      if (d !== null) updateItemDiscount(item.productId, Math.min(100, Math.max(0, Number(d) || 0)))
                    }}
                    className="ml-auto p-1.5 text-gray-300 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition"
                    title="Descuento por ítem"
                  >
                    <Tag size={14} />
                  </button>

                  {/* Eliminar */}
                  <button
                    onClick={() => removeItem(item.productId)}
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totales y acciones */}
        <div className="border-t border-gray-100 dark:border-gray-700 p-4 space-y-3">
          {/* Descuento global */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
            <span className="font-medium text-gray-700 dark:text-gray-300">{formatCurrency(subtotal)}</span>
          </div>

          {/* Descuento */}
          <button
            onClick={() => setShowDiscount(!showDiscount)}
            className="flex items-center gap-1 text-sm text-orange-500 hover:text-orange-600"
          >
            <Tag size={14} />
            {discount > 0 ? `Descuento: -${formatCurrency(discountAmount)} (${discount}%)` : "Agregar descuento"}
            <ChevronDown size={12} className={cn("transition", showDiscount && "rotate-180")} />
          </button>

          {showDiscount && (
            <div className="flex items-center gap-2 animate-fadeIn">
              <input
                type="number"
                min="0"
                max="100"
                value={discount}
                onChange={(e) => setDiscount(Math.min(100, Math.max(0, Number(e.target.value))))}
                className="w-20 px-3 py-1.5 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:border-orange-400 outline-none"
                placeholder="%"
              />
              <span className="text-gray-400 text-sm">% de descuento global</span>
            </div>
          )}

          {/* Nota */}
          <button
            onClick={() => setShowNote(!showNote)}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600"
          >
            <StickyNote size={14} />
            {note || "Agregar nota"}
          </button>
          {showNote && (
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm focus:border-blue-400 outline-none"
              placeholder="Nota de la venta..."
            />
          )}

          {/* Total */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
            <span className="text-lg font-bold text-gray-800 dark:text-white">TOTAL</span>
            <span className="text-2xl font-black text-blue-700">{formatCurrency(total)}</span>
          </div>

          {/* Botón Cobrar */}
          <button
            onClick={() => items.length > 0 && setShowPayment(true)}
            disabled={items.length === 0}
            className={cn(
              "w-full py-4 rounded-2xl font-black text-xl flex items-center justify-center gap-3 transition active:scale-95",
              items.length > 0
                ? "bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/30"
                : "bg-gray-100 text-gray-300 cursor-not-allowed"
            )}
          >
            <Zap size={24} />
            COBRAR (F2)
          </button>
        </div>
      </div>

      {/* Modales */}
      {showPayment && (
        <PaymentModal
          total={total}
          items={items}
          discount={discount}
          discountAmount={discountAmount}
          subtotal={subtotal}
          onClose={() => setShowPayment(false)}
          onSuccess={() => {
            setShowPayment(false)
            clearCart()
            toast.success("¡Venta registrada!")
            searchRef.current?.focus()
          }}
        />
      )}

      {showScanner && (
        <BarcodeScanner
          onScan={handleBarcode}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  )
}
