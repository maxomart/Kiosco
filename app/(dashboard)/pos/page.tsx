"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { Search, Barcode, ShoppingCart, DollarSign, AlertTriangle, ArrowRight } from "lucide-react"
import toast from "react-hot-toast"
import { usePOSStore } from "@/store/posStore"
import { CartPanel } from "@/components/pos/CartPanel"
import { PaymentModal } from "@/components/pos/PaymentModal"
import { OfflineBanner } from "@/components/pos/OfflineBanner"
import { useDebounce } from "@/lib/hooks/useDebounce"
import { formatCurrency } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { cacheProducts, searchProducts as searchOffline } from "@/lib/offline-store"

interface Product {
  id: string; name: string; barcode: string | null; sku: string | null
  salePrice: number; costPrice: number; stock: number; minStock: number
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
  const { addToCart, cart, setCashSession } = usePOSStore()

  // ── Caja abierta? ─────────────────────────────────────────────────────
  // El POS sólo permite vender si hay una caja ABIERTA (regla del usuario).
  // Polleamos al cargar y cada 60s por si otro cajero la cierra desde otro
  // dispositivo. El backend igual valida en /api/ventas POST como segunda red.
  const [cashOpen, setCashOpen] = useState<{
    id: string
    openingBalance: number
    openedByMe: boolean
    sinceMinutes: number
  } | null>(null)
  const [cashLoading, setCashLoading] = useState(true)

  const checkCash = useCallback(async () => {
    try {
      const res = await fetch("/api/caja/sesion-actual", { cache: "no-store" })
      if (res.ok) {
        const d = await res.json()
        const s = d.session
        if (s) {
          const since = Math.floor((Date.now() - new Date(s.createdAt).getTime()) / 60000)
          setCashOpen({
            id: s.id,
            openingBalance: Number(s.openingBalance ?? 0),
            openedByMe: !!d.ownedByCurrentUser,
            sinceMinutes: since,
          })
          setCashSession(s.id)
        } else {
          setCashOpen(null)
          setCashSession(null)
        }
      }
    } finally {
      setCashLoading(false)
    }
  }, [setCashSession])

  useEffect(() => {
    checkCash()
    const t = setInterval(checkCash, 60000)
    return () => clearInterval(t)
  }, [checkCash])

  // Cache full product catalog on mount so search/scanner work offline.
  // Best-effort — if we're offline at first load the SW serves the
  // last response from /api/productos via runtime cache.
  useEffect(() => {
    fetch("/api/productos?limit=200")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.products) cacheProducts(d.products) })
      .catch(() => { /* offline first-load → fall back to whatever IDB has */ })
  }, [])

  // Search products — try API first, fall back to IDB on network error.
  useEffect(() => {
    if (!debouncedQuery.trim()) { setProducts([]); return }
    setLoading(true)
    fetch(`/api/productos/buscar?q=${encodeURIComponent(debouncedQuery)}&limit=30`)
      .then(r => {
        if (!r.ok) throw new Error("HTTP " + r.status)
        return r.json()
      })
      .then(d => setProducts(d.products ?? []))
      .catch(async () => {
        // Network/server error → offline fallback.
        try {
          const offline = await searchOffline(debouncedQuery, 30)
          setProducts(offline as any)
          if (offline.length === 0 && navigator.onLine === false) {
            toast("Buscando offline — sin resultados en caché", { icon: "📡" })
          }
        } catch {
          toast.error("Error buscando productos")
        }
      })
      .finally(() => setLoading(false))
  }, [debouncedQuery])

  // Barcode scanner (USB scanner sends chars rapidly then Enter)
  const handleBarcodeScan = useCallback(async (barcode: string) => {
    let p: Product | undefined
    try {
      const res = await fetch(`/api/productos/buscar?q=${encodeURIComponent(barcode)}&limit=1`)
      if (!res.ok) throw new Error("HTTP " + res.status)
      const data = await res.json()
      p = data.products?.[0]
    } catch {
      // Offline fallback — search the cached catalog by barcode/name/sku.
      const offline = await searchOffline(barcode, 1)
      p = offline[0] as any
    }
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
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
      <OfflineBanner />

      {/* Banner de caja — bloquea visualmente la venta cuando no hay caja abierta */}
      {!cashLoading && !cashOpen && (
        <div className="m-3 rounded-xl border border-amber-500/40 bg-amber-900/20 px-4 py-3 flex items-center gap-3 animate-in slide-in-from-top-2 duration-200">
          <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-200">No hay caja abierta</p>
            <p className="text-xs text-amber-300/80 mt-0.5">
              Antes de vender tenés que abrir la caja con el monto inicial. Cada venta queda asociada a una caja.
            </p>
          </div>
          <Link
            href="/caja"
            className="flex-shrink-0 inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-amber-950 text-sm font-semibold px-4 py-2 rounded-lg transition"
          >
            <DollarSign className="w-4 h-4" /> Abrir caja
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {!cashLoading && cashOpen && (
        <div className="mx-3 mt-3 flex items-center gap-2 text-xs text-emerald-300/80">
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
          Caja abierta hace {cashOpen.sinceMinutes < 60 ? `${cashOpen.sinceMinutes}min` : `${Math.floor(cashOpen.sinceMinutes / 60)}h`} ·
          inicio {formatCurrency(cashOpen.openingBalance)}
          {!cashOpen.openedByMe && <span className="text-amber-400">· abierta por otro cajero</span>}
        </div>
      )}

      <div className="flex flex-1 gap-4 overflow-hidden">
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
                      : p.stock <= p.minStock
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
                      p.stock <= p.minStock ? "bg-yellow-900/40 text-yellow-400" :
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
        <CartPanel
          onPay={() => {
            if (!cashOpen) {
              toast.error("Abrí la caja antes de cobrar")
              return
            }
            setShowPayment(true)
          }}
          payDisabled={!cashOpen}
          payDisabledReason={!cashOpen ? "Abrí la caja primero" : undefined}
        />
      </div>

      {showPayment && cashOpen && <PaymentModal onClose={() => setShowPayment(false)} />}
      </div>
    </div>
  )
}
