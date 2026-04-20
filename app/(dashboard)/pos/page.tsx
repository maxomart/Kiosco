"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Search, Barcode, ShoppingCart } from "lucide-react"
import toast from "react-hot-toast"
import { usePOSStore } from "@/store/posStore"
import { CartPanel } from "@/components/pos/CartPanel"
import { PaymentModal } from "@/components/pos/PaymentModal"
import { useDebounce } from "@/lib/hooks/useDebounce"
import { formatCurrency } from "@/lib/utils"
import { cn } from "@/lib/utils"

interface Product {
  id: string; name: string; barcode: string | null; sku: string | null
  salePrice: number; costPrice: number; stock: number
  soldByWeight: boolean; taxRate?: string
  category?: { name: string } | null
}

export default function POSPage() {
  const [query, setQuery] = useState("")
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [barcodeBuffer, setBarcodeBuffer] = useState("")
  const [lastKeyTime, setLastKeyTime] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)
  const debouncedQuery = useDebounce(query, 280)
  const { addToCart, cart } = usePOSStore()

  // Search products
  useEffect(() => {
    if (!debouncedQuery.trim()) { setProducts([]); return }
    setLoading(true)
    fetch(`/api/productos/buscar?q=${encodeURIComponent(debouncedQuery)}&limit=30`)
      .then(r => r.json())
      .then(d => setProducts(d.products ?? []))
      .catch(() => toast.error("Error buscando productos"))
      .finally(() => setLoading(false))
  }, [debouncedQuery])

  // Barcode scanner (USB scanner sends chars rapidly then Enter)
  const handleBarcodeScan = useCallback(async (barcode: string) => {
    const res = await fetch(`/api/productos/buscar?q=${encodeURIComponent(barcode)}&limit=1`)
    const data = await res.json()
    const p: Product | undefined = data.products?.[0]
    if (!p) { toast.error(`Código no encontrado: ${barcode}`); return }
    if (p.stock <= 0 && !p.soldByWeight) { toast.error(`Sin stock: ${p.name}`); return }
    addToCart({ productId: p.id, productName: p.name, barcode: p.barcode, unitPrice: p.salePrice, costPrice: p.costPrice, stock: p.stock, taxRate: "STANDARD", soldByWeight: p.soldByWeight })
    toast.success(`${p.name} agregado`, { duration: 1200, icon: "🛒" })
  }, [addToCart])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const now = Date.now()
      if (document.activeElement === searchRef.current) return
      if (e.key === "Enter" && barcodeBuffer.length >= 4) {
        handleBarcodeScan(barcodeBuffer.trim())
        setBarcodeBuffer("")
      } else if (e.key.length === 1 && now - lastKeyTime < 80) {
        setBarcodeBuffer(prev => prev + e.key)
      } else if (e.key.length === 1) {
        setBarcodeBuffer(e.key)
      }
      setLastKeyTime(now)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [barcodeBuffer, lastKeyTime, handleBarcodeScan])

  const handleAddProduct = (p: Product) => {
    if (p.stock <= 0 && !p.soldByWeight) { toast.error(`Sin stock: ${p.name}`); return }
    addToCart({ productId: p.id, productName: p.name, barcode: p.barcode, unitPrice: p.salePrice, costPrice: p.costPrice, stock: p.stock, taxRate: "STANDARD", soldByWeight: p.soldByWeight })
    setQuery("")
    setProducts([])
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4 overflow-hidden">
      {/* LEFT: Search + Products */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Search bar */}
        <div className="relative mb-4">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            ref={searchRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por nombre, código o barcode..."
            className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-gray-500">
            <Barcode size={14} />
            <span className="hidden sm:inline">Scanner listo</span>
          </div>
        </div>

        {/* Products grid */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : products.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {products.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleAddProduct(p)}
                  className={cn(
                    "bg-gray-800 hover:bg-gray-700 border rounded-xl p-3 text-left transition-all active:scale-95",
                    p.stock <= 0 && !p.soldByWeight
                      ? "border-red-900/50 opacity-60 cursor-not-allowed"
                      : p.stock <= p.stock && p.stock < 5
                      ? "border-yellow-700/50 hover:border-yellow-600"
                      : "border-gray-700 hover:border-purple-600"
                  )}
                  disabled={p.stock <= 0 && !p.soldByWeight}
                >
                  <p className="text-sm font-medium text-gray-100 line-clamp-2 mb-1">{p.name}</p>
                  {p.category && <p className="text-xs text-gray-500 mb-2">{p.category.name}</p>}
                  <div className="flex items-center justify-between">
                    <span className="text-purple-400 font-bold text-sm">{formatCurrency(p.salePrice)}</span>
                    <span className={cn("text-xs px-1.5 py-0.5 rounded-md",
                      p.stock <= 0 ? "bg-red-900/40 text-red-400" :
                      p.stock < 5 ? "bg-yellow-900/40 text-yellow-400" :
                      "bg-gray-700 text-gray-400"
                    )}>
                      {p.soldByWeight ? "x kg" : `x${p.stock}`}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : query ? (
            <div className="text-center py-16 text-gray-500">
              <Search size={40} className="mx-auto mb-3 opacity-30" />
              <p>Sin resultados para <span className="text-gray-400">"{query}"</span></p>
            </div>
          ) : (
            <div className="text-center py-20 text-gray-600">
              <ShoppingCart size={48} className="mx-auto mb-3 opacity-20" />
              <p className="text-lg">Buscá un producto o pasá el scanner</p>
              <p className="text-sm mt-1">El scanner USB funciona automáticamente</p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Cart */}
      <div className="w-80 xl:w-96 flex-shrink-0 flex flex-col">
        <CartPanel onPay={() => setShowPayment(true)} />
      </div>

      {showPayment && <PaymentModal onClose={() => setShowPayment(false)} />}
    </div>
  )
}
