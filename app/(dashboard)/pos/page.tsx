"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { Search, Barcode, ShoppingCart, DollarSign, AlertTriangle, ArrowRight, Package, Keyboard, X } from "lucide-react"
import { useShortcuts, useShortcutKey } from "@/hooks/useShortcuts"
import { ShortcutsHelpModal } from "@/components/shared/ShortcutsHelpModal"
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
  categoryId?: string | null
}

interface Category {
  id: string
  name: string
}

export default function POSPage() {
  const [query, setQuery] = useState("")
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  // Doble Enter en search → cobrar (sin tener que presionar el atajo)
  const lastEnterRef = useRef<number>(0)
  // Barcode-scanner buffer en refs (no state) para evitar re-renders en cada
  // keystroke — esos re-renders re-montaban useShortcuts y trababan los atajos.
  const barcodeBufRef = useRef<string>("")
  const lastKeyTimeRef = useRef<number>(0)
  const debouncedQuery = useDebounce(query, 280)
  const { addToCart, cart, setCashSession, clearCart, total } = usePOSStore()
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  // Auto-close cart drawer when payment modal opens (so user sees the modal cleanly)
  const searchShortcutKey = useShortcutKey("pos:search")
  const chargeShortcutKey = useShortcutKey("pos:charge")
  const helpShortcutKey = useShortcutKey("global:help")

  // Initial catalog: loaded once on mount so the grid is never empty. Users
  // can click straight from the catalog without searching — much faster for
  // kiosks with few-dozen SKUs.
  const [initialCatalog, setInitialCatalog] = useState<Product[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)

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

  // Auto-focus search bar al entrar al POS — el usuario quiere empezar a tipear
  // / escanear sin tocar el mouse. Lo hacemos en un microtask para esperar a que
  // el input esté en el DOM.
  useEffect(() => {
    const id = window.setTimeout(() => searchRef.current?.focus(), 80)
    return () => window.clearTimeout(id)
  }, [])

  // Cache full product catalog on mount so search/scanner work offline.
  // Also used to populate the grid before any search: users see products
  // straight away instead of an empty "Buscá un producto" placeholder.
  useEffect(() => {
    fetch("/api/productos?limit=200")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.products) {
          cacheProducts(d.products)
          setInitialCatalog(d.products)
        }
      })
      .catch(() => { /* offline first-load → fall back to whatever IDB has */ })
      .finally(() => setCatalogLoading(false))
  }, [])

  // Categories for the quick-filter pill bar.
  useEffect(() => {
    fetch("/api/categorias")
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        const list = d?.categories ?? d ?? []
        if (Array.isArray(list)) setCategories(list.filter((c: any) => c.active !== false))
      })
      .catch(() => {})
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
    // Stock guard: if already at max in cart, don't increment past it.
    const inCart = cart.find((i) => i.productId === p!.id)
    const currentQty = inCart?.quantity ?? 0
    if (!p.soldByWeight && currentQty + 1 > p.stock) {
      toast.error(`Stock máximo de ${p.name}: ${p.stock} unidades`)
      return
    }
    addToCart({ productId: p.id, productName: p.name, barcode: p.barcode, unitPrice: p.salePrice, costPrice: p.costPrice, stock: p.stock, taxRate: "STANDARD", soldByWeight: p.soldByWeight })
    toast.success(`${p.name} agregado`, { duration: 1200, icon: "🛒" })
    // Re-focus search para que el siguiente escaneo entre directo
    requestAnimationFrame(() => searchRef.current?.focus())
  }, [addToCart, cart])

  // Barcode-scanner detector. Listener montado una sola vez — usa refs para no
  // disparar re-renders en cada tecla (lo que trababa los atajos del POS).
  // handleBarcodeScan se lee desde una ref para tener siempre la última versión.
  const handleBarcodeScanRef = useRef(handleBarcodeScan)
  useEffect(() => { handleBarcodeScanRef.current = handleBarcodeScan }, [handleBarcodeScan])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // No interferir con tipeo manual ni con atajos (F1-F12, etc).
      if (document.activeElement === searchRef.current) return
      if (e.key.length !== 1 && e.key !== "Enter") return
      const now = Date.now()
      if (e.key === "Enter" && barcodeBufRef.current.length >= 4) {
        handleBarcodeScanRef.current(barcodeBufRef.current.trim())
        barcodeBufRef.current = ""
      } else if (e.key.length === 1 && now - lastKeyTimeRef.current < 80) {
        barcodeBufRef.current += e.key
      } else if (e.key.length === 1) {
        barcodeBufRef.current = e.key
      }
      lastKeyTimeRef.current = now
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  const handleAddProduct = (p: Product) => {
    if (p.stock <= 0 && !p.soldByWeight) { toast.error(`Sin stock: ${p.name}`); return }
    // Stock guard: don't let the user click past available stock.
    const inCart = cart.find((i) => i.productId === p.id)
    const currentQty = inCart?.quantity ?? 0
    if (!p.soldByWeight && currentQty + 1 > p.stock) {
      toast.error(`Stock máximo de ${p.name}: ${p.stock} unidades`)
      return
    }
    addToCart({ productId: p.id, productName: p.name, barcode: p.barcode, unitPrice: p.salePrice, costPrice: p.costPrice, stock: p.stock, taxRate: "STANDARD", soldByWeight: p.soldByWeight })
    setQuery("")
    setProducts([])
    // Re-focus inmediato para que el siguiente producto se cargue sin tocar mouse
    requestAnimationFrame(() => searchRef.current?.focus())
  }

  // Grid data: search results when the user types, otherwise the initial
  // catalog filtered by the active category pill.
  const isSearching = debouncedQuery.trim().length > 0
  const visibleProducts: Product[] = isSearching
    ? products
    : (activeCategoryId
        ? initialCatalog.filter((p) => p.categoryId === activeCategoryId)
        : initialCatalog)

  // Wire up configurable keyboard shortcuts
  useShortcuts({
    "pos:search": () => searchRef.current?.focus(),
    "pos:charge": () => {
      if (cart.length === 0) { toast.error("El carrito está vacío"); return }
      if (!cashOpen) { toast.error("Abrí la caja primero"); return }
      setShowPayment(true)
    },
    "pos:clear": () => {
      if (cart.length === 0) return
      if (confirm("¿Vaciar el carrito?")) clearCart()
    },
    "pos:focusFirst": () => {
      const first = visibleProducts[0]
      if (first) handleAddProduct(first)
    },
    "global:help": () => setShowShortcutsHelp(true),
    "global:escape": () => {
      if (showShortcutsHelp) setShowShortcutsHelp(false)
      else if (showPayment) setShowPayment(false)
    },
  })

  return (
    // Negative margins counter the dashboard layout's `p-4 lg:p-6` wrapper
    // so the POS can use the full viewport height. This matters because the
    // cart footer (Cobrar button) must stay visible without scrolling.
    <div className="flex flex-col -m-4 lg:-m-6 h-[calc(100vh-4rem)] overflow-hidden">
      <OfflineBanner />

      {/* Banner de caja — compacto para no empujar el carrito/cobrar fuera de la vista */}
      {!cashLoading && !cashOpen && (
        <div className="mx-3 mt-3 rounded-lg border border-amber-500/40 bg-amber-900/20 px-3 py-2 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <p className="flex-1 min-w-0 text-xs text-amber-200">
            <span className="font-semibold">Caja cerrada.</span>{" "}
            <span className="text-amber-300/80">Abrila antes de cobrar.</span>
          </p>
          <Link
            href="/caja"
            className="flex-shrink-0 inline-flex items-center gap-1 bg-amber-500 hover:bg-amber-400 text-amber-950 text-xs font-semibold px-2.5 py-1 rounded-md transition"
          >
            <DollarSign className="w-3 h-3" /> Abrir caja
          </Link>
        </div>
      )}

      {!cashLoading && cashOpen && (
        <div className="mx-3 mt-2 flex items-center gap-2 text-[11px] text-emerald-300/80">
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
          Caja abierta hace {cashOpen.sinceMinutes < 60 ? `${cashOpen.sinceMinutes}min` : `${Math.floor(cashOpen.sinceMinutes / 60)}h`} ·
          inicio {formatCurrency(cashOpen.openingBalance)}
          {!cashOpen.openedByMe && <span className="text-amber-400">· abierta por otro cajero</span>}
        </div>
      )}

      <div className="flex flex-1 gap-3 overflow-hidden px-3 pt-2 pb-3 min-h-0">
      {/* LEFT: Search + Products. Pad-bottom on mobile so the floating cart bar doesn't cover the last row. */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden pb-16 lg:pb-0">
        {/* Search bar */}
        <div data-tour="pos-search" className="relative mb-2 flex-shrink-0">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            ref={searchRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                const now = Date.now()
                // Doble Enter (<700ms entre golpes) → cobrar al toque.
                // Funciona tanto con query vacío (después de agregar) como
                // con query escrito si no hay resultado para agregar.
                if (now - lastEnterRef.current < 700) {
                  lastEnterRef.current = 0
                  if (cart.length === 0) { toast.error("El carrito está vacío"); return }
                  if (!cashOpen) { toast.error("Abrí la caja primero"); return }
                  setShowPayment(true)
                  return
                }
                lastEnterRef.current = now
                // Single Enter: agrega el primer resultado si hay alguno
                // visible (no solo cuando hay 1 — eso lo hacía menos útil).
                if (isSearching && visibleProducts.length > 0) {
                  handleAddProduct(visibleProducts[0])
                }
              }
              if (e.key === "Escape") {
                setQuery("")
                lastEnterRef.current = 0
              }
            }}
            placeholder="Buscar por nombre, código o barcode..."
            className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-28 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 text-xs text-gray-500">
            <kbd className="hidden md:inline-flex bg-gray-900 border border-gray-700 rounded px-1.5 py-0.5 font-mono text-[10px]">
              {searchShortcutKey}
            </kbd>
            <Barcode size={13} />
            <button
              onClick={() => setShowShortcutsHelp(true)}
              className="hidden lg:flex items-center gap-1 text-gray-500 hover:text-accent transition-colors"
              title={`Ayuda de atajos (${helpShortcutKey})`}
            >
              <Keyboard size={13} />
              <kbd className="bg-gray-900 border border-gray-700 rounded px-1.5 py-0.5 font-mono text-[10px]">
                {helpShortcutKey}
              </kbd>
            </button>
          </div>
        </div>

        {/* Category pills (hidden while searching, no point filtering twice) */}
        {!isSearching && categories.length > 0 && (
          <div className="flex-shrink-0 mb-2 flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
            <button
              type="button"
              onClick={() => setActiveCategoryId(null)}
              className={cn(
                "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
                activeCategoryId === null
                  ? "bg-purple-600 border-purple-500 text-white"
                  : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600"
              )}
            >
              Todos
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCategoryId(c.id)}
                className={cn(
                  "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
                  activeCategoryId === c.id
                    ? "bg-purple-600 border-purple-500 text-white"
                    : "bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600"
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* Products grid */}
        <div className="flex-1 overflow-y-auto min-h-0 pr-1">
          {(loading || (catalogLoading && !isSearching)) ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : visibleProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {visibleProducts.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleAddProduct(p)}
                  className={cn(
                    "bg-gray-800 hover:bg-gray-700 border rounded-xl p-2.5 text-left transition-all active:scale-95",
                    p.stock <= 0 && !p.soldByWeight
                      ? "border-red-900/50 opacity-60 cursor-not-allowed"
                      : p.stock <= p.minStock
                      ? "border-yellow-700/50 hover:border-yellow-600"
                      : "border-gray-700 hover:border-purple-600"
                  )}
                  disabled={p.stock <= 0 && !p.soldByWeight}
                >
                  <p className="text-xs font-medium text-gray-100 line-clamp-2 mb-1 leading-tight">{p.name}</p>
                  {p.category && <p className="text-[10px] text-gray-500 mb-1.5 truncate">{p.category.name}</p>}
                  <div className="flex items-center justify-between">
                    <span className="text-purple-400 font-bold text-xs">{formatCurrency(p.salePrice)}</span>
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-md",
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
          ) : isSearching ? (
            <div className="text-center py-16 text-gray-500">
              <Search size={40} className="mx-auto mb-3 opacity-30" />
              <p>Sin resultados para <span className="text-gray-400">"{query}"</span></p>
            </div>
          ) : (
            // Empty catalog → show something useful instead of the ghost icon.
            <div className="text-center py-16 text-gray-500">
              <Package size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Todavía no cargaste productos</p>
              <Link
                href="/inventario"
                className="inline-flex items-center gap-1 mt-3 text-xs text-purple-400 hover:text-purple-300"
              >
                Ir a inventario <ArrowRight size={12} />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Cart — desktop sidebar (lg+). h-full so Cobrar button never scrolls off. */}
      <div className="hidden lg:block w-72 xl:w-80 flex-shrink-0 h-full">
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

      {/* MOBILE: Floating cart summary bar — fixed at bottom, opens drawer on tap */}
      <button
        type="button"
        onClick={() => setCartOpen(true)}
        className={cn(
          "lg:hidden fixed bottom-0 inset-x-0 z-40 px-3 pb-3 pt-2 bg-gradient-to-t from-gray-950 via-gray-950/95 to-gray-950/0",
          "transition-transform duration-200",
          cartOpen && "translate-y-full"
        )}
        aria-label="Abrir carrito"
      >
        <div className="flex items-center justify-between gap-3 bg-accent text-accent-foreground rounded-xl px-4 py-3 shadow-2xl shadow-accent/30 active:scale-[0.98] transition-transform">
          <div className="flex items-center gap-2 min-w-0">
            <div className="relative flex-shrink-0">
              <ShoppingCart className="w-5 h-5" />
              {cart.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {cart.length}
                </span>
              )}
            </div>
            <span className="font-semibold text-sm truncate">
              {cart.length === 0 ? "Carrito vacío" : `${cart.length} ${cart.length === 1 ? "producto" : "productos"}`}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="font-bold text-sm tabular-nums">{formatCurrency(total())}</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </button>

      {/* MOBILE: Cart drawer (slides up from bottom) */}
      {cartOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={() => setCartOpen(false)}
          aria-hidden
        />
      )}
      <div
        className={cn(
          "lg:hidden fixed inset-x-0 bottom-0 z-50 max-h-[88vh] h-[88vh] transform transition-transform duration-300 ease-out",
          cartOpen ? "translate-y-0" : "translate-y-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Carrito de compra"
      >
        <div className="relative h-full">
          {/* Close button */}
          <button
            type="button"
            onClick={() => setCartOpen(false)}
            className="absolute -top-12 right-3 w-10 h-10 rounded-full bg-gray-900/90 backdrop-blur-sm border border-gray-700 flex items-center justify-center text-gray-300 hover:text-white"
            aria-label="Cerrar carrito"
          >
            <X className="w-5 h-5" />
          </button>
          <CartPanel
            onPay={() => {
              if (!cashOpen) {
                toast.error("Abrí la caja antes de cobrar")
                return
              }
              setCartOpen(false)
              setShowPayment(true)
            }}
            payDisabled={!cashOpen}
            payDisabledReason={!cashOpen ? "Abrí la caja primero" : undefined}
          />
        </div>
      </div>

      {showPayment && cashOpen && <PaymentModal onClose={() => setShowPayment(false)} />}

      <ShortcutsHelpModal
        open={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
      />
      </div>
    </div>
  )
}
