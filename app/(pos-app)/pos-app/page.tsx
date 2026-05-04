"use client"

/**
 * POS standalone offline-first.
 *
 * Diferencia clave con /pos: este NO está dentro del (dashboard) layout,
 * así que NO depende de auth() server-side ni de queries a DB para
 * renderizar. Funciona 100% client-side y se hidrata desde IndexedDB.
 *
 * Auth: chequea /api/auth/session al montar (el SW lo cachea), si está
 * cacheada y vigente entra; sino redirige a /login.
 *
 * Datos:
 *   - Productos: IndexedDB (offline-store) refrescado al online
 *   - Carrito:   estado React local
 *   - Ventas:    encoladas en IndexedDB, sincronizan cuando vuelve red
 */

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Search,
  Camera,
  Plus,
  Minus,
  X,
  ShoppingCart,
  WifiOff,
  Wifi,
  CloudUpload,
  Loader2,
  ArrowLeft,
  Banknote,
  Trash2,
  Check,
} from "lucide-react"
import {
  cacheProducts,
  searchProducts as searchOffline,
  enqueueSale,
  type CachedProduct,
  type PendingSale,
} from "@/lib/offline-store"
import { flushQueue } from "@/lib/sync-queue"
import { getPendingSales } from "@/lib/offline-store"
import { CameraBarcodeScanner } from "@/components/pos/CameraBarcodeScanner"
import { formatCurrencyCompact } from "@/lib/utils"
import toast from "react-hot-toast"

interface CartItem {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  costPrice: number
  taxRate: string
  soldByWeight: boolean
}

const SESSION_CACHE_KEY = "orvex:pos-app:session"

function formatARS(n: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

export default function PosAppPage() {
  const router = useRouter()
  const [authStatus, setAuthStatus] = useState<"checking" | "ok" | "redirecting">("checking")
  const [businessName, setBusinessName] = useState<string | null>(null)
  const [products, setProducts] = useState<CachedProduct[]>([])
  const [query, setQuery] = useState("")
  const [cart, setCart] = useState<CartItem[]>([])
  const [showScanner, setShowScanner] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [cashReceived, setCashReceived] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true)
  const [pendingCount, setPendingCount] = useState(0)
  const [success, setSuccess] = useState<{ total: number; offline: boolean } | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // ─── Auth: chequear sesión (cacheada o live) ───
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // Primero intentamos cache local (rápido y funciona offline)
        const cached = localStorage.getItem(SESSION_CACHE_KEY)
        if (cached) {
          const data = JSON.parse(cached)
          if (data?.user?.id && Date.now() - data._cachedAt < 7 * 24 * 60 * 60 * 1000) {
            // Sesión cacheada y < 7 días → entrar
            setBusinessName(data.user.tenantName ?? null)
            setAuthStatus("ok")
            // Refresh en background
            void refreshSession()
            return
          }
        }
        // No cache → fetch live
        await refreshSession()
      } catch {
        if (!cancelled) {
          setAuthStatus("redirecting")
          router.push("/login")
        }
      }
    })()
    return () => { cancelled = true }
  }, [router])

  const refreshSession = async () => {
    try {
      const r = await fetch("/api/auth/session", { cache: "no-store" })
      if (!r.ok) {
        if (navigator.onLine) {
          setAuthStatus("redirecting")
          router.push("/login")
        }
        return
      }
      const data = await r.json()
      if (!data?.user?.id) {
        if (navigator.onLine) {
          setAuthStatus("redirecting")
          router.push("/login")
        }
        return
      }
      // Cachear con tenantName si está
      const cached = { ...data, _cachedAt: Date.now() }
      try { localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(cached)) } catch {}
      setBusinessName(data.user.tenantName ?? data.user.businessName ?? null)
      setAuthStatus("ok")
    } catch {
      // offline + sin cache → redirige
      if (navigator.onLine) {
        setAuthStatus("redirecting")
        router.push("/login")
      }
    }
  }

  // ─── Catálogo: cargar de IndexedDB + refrescar online ───
  useEffect(() => {
    if (authStatus !== "ok") return

    // Cargar de IndexedDB primero (instant, offline OK)
    void searchOffline("", 500).then((cached) => {
      if (cached.length > 0) setProducts(cached)
    })

    // Refrescar de la red en background
    void (async () => {
      try {
        const r = await fetch("/api/productos?activo=true", { cache: "no-store" })
        if (!r.ok) return
        const data = await r.json()
        const list: CachedProduct[] = (data.productos ?? data.products ?? []).map((p: any) => ({
          id: p.id,
          name: p.name,
          barcode: p.barcode ?? null,
          sku: p.sku ?? null,
          salePrice: Number(p.salePrice ?? 0),
          costPrice: Number(p.costPrice ?? 0),
          stock: Number(p.stock ?? 0),
          minStock: Number(p.minStock ?? 0),
          soldByWeight: !!p.soldByWeight,
          taxRate: p.taxRate,
          category: p.category ?? null,
        }))
        if (list.length > 0) {
          setProducts(list)
          await cacheProducts(list)
        }
      } catch {
        // offline u error de red → seguimos con cache
      }
    })()
  }, [authStatus])

  // ─── Online/offline + cola pendiente ───
  useEffect(() => {
    const updateOnline = () => setIsOnline(navigator.onLine)
    window.addEventListener("online", updateOnline)
    window.addEventListener("offline", updateOnline)

    const refreshPending = async () => {
      const list = await getPendingSales()
      setPendingCount(list.length)
    }
    refreshPending()
    const interval = setInterval(refreshPending, 5000)

    return () => {
      window.removeEventListener("online", updateOnline)
      window.removeEventListener("offline", updateOnline)
      clearInterval(interval)
    }
  }, [])

  // Auto-flush cuando vuelve la conexión
  useEffect(() => {
    if (!isOnline) return
    void flushQueue().then((res) => {
      if (res.ok > 0) toast.success(`${res.ok} venta(s) sincronizada(s)`)
    })
  }, [isOnline])

  // Auto-focus search
  useEffect(() => {
    if (authStatus === "ok") searchRef.current?.focus()
  }, [authStatus])

  // ─── Búsqueda + filtros ───
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return products.slice(0, 60)
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.barcode?.includes(q) ||
          p.sku?.toLowerCase().includes(q),
      )
      .slice(0, 60)
  }, [products, query])

  // ─── Carrito ───
  const addToCart = (p: CachedProduct) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === p.id)
      if (existing) {
        return prev.map((c) =>
          c.productId === p.id ? { ...c, quantity: c.quantity + 1 } : c,
        )
      }
      return [
        ...prev,
        {
          productId: p.id,
          productName: p.name,
          quantity: 1,
          unitPrice: p.salePrice,
          costPrice: p.costPrice,
          taxRate: p.taxRate ?? "STANDARD",
          soldByWeight: p.soldByWeight,
        },
      ]
    })
    setQuery("")
    searchRef.current?.focus()
  }

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c.productId === id ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0),
    )
  }

  const removeItem = (id: string) => {
    setCart((prev) => prev.filter((c) => c.productId !== id))
  }

  const clearCart = () => setCart([])

  const subtotal = cart.reduce((s, c) => s + c.unitPrice * c.quantity, 0)
  const total = subtotal // sin descuentos en esta versión simplificada

  // ─── Barcode scan ───
  const handleScanBarcode = (code: string) => {
    setShowScanner(false)
    const found = products.find((p) => p.barcode === code || p.sku === code)
    if (found) {
      addToCart(found)
      if (navigator.vibrate) navigator.vibrate(60)
    } else {
      toast.error(`No encontré el producto con código ${code}`)
    }
  }

  // ─── Submit venta ───
  const submitSale = async (paymentMethod: "CASH" | "TRANSFER" | "CARD") => {
    if (cart.length === 0) return
    setSubmitting(true)

    const payload = {
      items: cart.map((c) => ({
        productId: c.productId,
        productName: c.productName,
        quantity: c.quantity,
        unitPrice: c.unitPrice,
        costPrice: c.costPrice,
        discount: 0,
        subtotal: c.unitPrice * c.quantity,
        taxRate: c.taxRate,
        soldByWeight: c.soldByWeight,
      })),
      subtotal,
      discountAmount: 0,
      discountPercent: 0,
      taxAmount: 0,
      total,
      paymentMethod,
      cashReceived: paymentMethod === "CASH" && cashReceived ? Number(cashReceived) : null,
      change: paymentMethod === "CASH" && cashReceived ? Math.max(0, Number(cashReceived) - total) : null,
    }

    // Si offline → encolar inmediatamente
    if (!navigator.onLine) {
      await enqueueSale(payload)
      window.dispatchEvent(new Event("orvex:offline-sale-enqueued"))
      setSubmitting(false)
      setSuccess({ total, offline: true })
      clearCart()
      setShowCheckout(false)
      setCashReceived("")
      return
    }

    // Si online, intentar POST
    try {
      const r = await fetch("/api/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        // 503 o error → encolar
        if (r.status === 503 || r.status >= 500) {
          await enqueueSale(payload)
          window.dispatchEvent(new Event("orvex:offline-sale-enqueued"))
          setSuccess({ total, offline: true })
        } else {
          const data = await r.json().catch(() => ({}))
          toast.error(data.error ?? "Error al cobrar")
        }
        return
      }
      // OK → success
      setSuccess({ total, offline: false })
      clearCart()
      setShowCheckout(false)
      setCashReceived("")
    } catch {
      // network error → encolar
      await enqueueSale(payload)
      window.dispatchEvent(new Event("orvex:offline-sale-enqueued"))
      setSuccess({ total, offline: true })
      clearCart()
      setShowCheckout(false)
      setCashReceived("")
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Render ───
  if (authStatus === "checking") {
    return (
      <div className="h-screen flex items-center justify-center text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }
  if (authStatus === "redirecting") {
    return (
      <div className="h-screen flex items-center justify-center text-gray-500">
        Redirigiendo…
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900/60 backdrop-blur">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/inicio"
            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-800"
            aria-label="Volver"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="min-w-0">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-bold leading-none">POS Offline</p>
            <p className="text-sm text-white font-semibold truncate">
              {businessName ?? "Orvex"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 inline-flex items-center gap-1">
              <CloudUpload size={10} />
              {pendingCount} pend.
            </span>
          )}
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
              isOnline
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
            }`}
          >
            {isOnline ? <Wifi size={10} /> : <WifiOff size={10} />}
            {isOnline ? "Online" : "Offline"}
          </span>
        </div>
      </header>

      {/* Body: search + grid + cart */}
      <div className="flex-1 flex overflow-hidden">
        {/* Productos */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="p-3 border-b border-gray-800 flex items-center gap-2">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && filtered.length > 0) addToCart(filtered[0])
                  if (e.key === "Escape") setQuery("")
                }}
                placeholder="Buscar producto, código, SKU…"
                className="w-full bg-gray-900 border border-gray-700 hover:border-gray-600 focus:border-purple-500 rounded-lg pl-9 pr-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>
            <button
              onClick={() => setShowScanner(true)}
              className="p-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300"
              title="Escanear con la cámara"
            >
              <Camera size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {filtered.length === 0 ? (
              <p className="text-center text-gray-500 italic mt-8 text-sm">
                {query
                  ? "Sin resultados"
                  : products.length === 0
                  ? "Cargando catálogo…"
                  : "Empezá a tipear para buscar"}
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {filtered.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="text-left bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-purple-700 rounded-lg p-3 transition-colors"
                  >
                    <p className="text-sm text-white font-medium line-clamp-2 leading-tight min-h-[2.5em]">
                      {p.name}
                    </p>
                    <p className="text-base text-purple-300 font-bold mt-1 tabular-nums">
                      {formatARS(p.salePrice)}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      Stock: {p.stock}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Cart */}
        <div className="w-80 border-l border-gray-800 bg-gray-900/40 flex flex-col flex-shrink-0 hidden md:flex">
          <CartView
            cart={cart}
            total={total}
            onUpdateQty={updateQty}
            onRemove={removeItem}
            onClear={clearCart}
            onCheckout={() => setShowCheckout(true)}
          />
        </div>
      </div>

      {/* Mobile: barra inferior con total + cobrar */}
      {cart.length > 0 && (
        <div className="md:hidden border-t border-gray-800 bg-gray-900 p-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Total ({cart.reduce((s, c) => s + c.quantity, 0)} ítems)</p>
            <p className="text-2xl font-bold text-white tabular-nums">{formatARS(total)}</p>
          </div>
          <button
            onClick={() => setShowCheckout(true)}
            className="px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center gap-2"
          >
            <ShoppingCart size={16} />
            Cobrar
          </button>
        </div>
      )}

      {/* Modals */}
      {showScanner && (
        <CameraBarcodeScanner
          onScan={handleScanBarcode}
          onClose={() => setShowScanner(false)}
        />
      )}

      {showCheckout && (
        <CheckoutModal
          total={total}
          cashReceived={cashReceived}
          setCashReceived={setCashReceived}
          submitting={submitting}
          onClose={() => setShowCheckout(false)}
          onSubmit={submitSale}
          isOnline={isOnline}
        />
      )}

      {success && (
        <SuccessModal
          total={success.total}
          offline={success.offline}
          onClose={() => setSuccess(null)}
        />
      )}
    </div>
  )
}

function CartView({
  cart,
  total,
  onUpdateQty,
  onRemove,
  onClear,
  onCheckout,
}: {
  cart: CartItem[]
  total: number
  onUpdateQty: (id: string, delta: number) => void
  onRemove: (id: string) => void
  onClear: () => void
  onCheckout: () => void
}) {
  return (
    <>
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-sm text-white font-bold">Carrito</h2>
        {cart.length > 0 && (
          <button
            onClick={onClear}
            className="text-xs text-gray-500 hover:text-red-400"
          >
            Vaciar
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {cart.length === 0 ? (
          <p className="text-center text-gray-500 italic text-sm mt-8">
            El carrito está vacío
          </p>
        ) : (
          cart.map((c) => (
            <div
              key={c.productId}
              className="bg-gray-800/40 border border-gray-800 rounded-lg p-2.5"
            >
              <div className="flex justify-between gap-2 mb-1">
                <p className="text-sm text-white font-medium line-clamp-1 flex-1">{c.productName}</p>
                <button
                  onClick={() => onRemove(c.productId)}
                  className="text-gray-500 hover:text-red-400 flex-shrink-0"
                  aria-label="Quitar"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onUpdateQty(c.productId, -1)}
                    className="w-6 h-6 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 flex items-center justify-center"
                  >
                    <Minus size={11} />
                  </button>
                  <span className="text-xs text-white w-7 text-center tabular-nums">
                    {c.quantity}
                  </span>
                  <button
                    onClick={() => onUpdateQty(c.productId, 1)}
                    className="w-6 h-6 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 flex items-center justify-center"
                  >
                    <Plus size={11} />
                  </button>
                </div>
                <p className="text-xs text-gray-300 tabular-nums">
                  {formatARS(c.unitPrice * c.quantity)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
      {cart.length > 0 && (
        <div className="border-t border-gray-800 p-4 space-y-3 bg-gray-900/60">
          <div className="flex justify-between text-base">
            <span className="text-gray-400">Total</span>
            <span className="text-white font-bold tabular-nums">{formatARS(total)}</span>
          </div>
          <button
            onClick={onCheckout}
            className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center justify-center gap-2"
          >
            <ShoppingCart size={16} />
            Cobrar {formatARS(total)}
          </button>
        </div>
      )}
    </>
  )
}

function CheckoutModal({
  total,
  cashReceived,
  setCashReceived,
  submitting,
  onClose,
  onSubmit,
  isOnline,
}: {
  total: number
  cashReceived: string
  setCashReceived: (s: string) => void
  submitting: boolean
  onClose: () => void
  onSubmit: (m: "CASH" | "TRANSFER" | "CARD") => void
  isOnline: boolean
}) {
  const [method, setMethod] = useState<"CASH" | "TRANSFER" | "CARD">("CASH")
  const change =
    method === "CASH" && cashReceived ? Math.max(0, Number(cashReceived) - total) : 0

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-white font-bold">Cobrar {formatARS(total)}</h2>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 space-y-4">
          {!isOnline && (
            <div className="bg-amber-950/40 border border-amber-700/40 rounded-lg p-3 text-xs text-amber-200 flex items-center gap-2">
              <WifiOff size={12} />
              Sin internet — la venta se va a guardar y sincronizar después.
            </div>
          )}

          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-2">Método</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "CASH" as const, label: "Efectivo", icon: <Banknote size={14} /> },
                { value: "TRANSFER" as const, label: "Transfer", icon: "💸" },
                { value: "CARD" as const, label: "Tarjeta", icon: "💳" },
              ].map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMethod(m.value)}
                  className={`py-2.5 rounded-lg text-xs font-medium border transition-colors flex flex-col items-center gap-1 ${
                    method === m.value
                      ? "bg-purple-600 border-purple-500 text-white"
                      : "bg-gray-800 border-gray-700 text-gray-400 hover:text-white"
                  }`}
                >
                  <span>{m.icon}</span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {method === "CASH" && (
            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-2">
                Efectivo recibido
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value.replace(/\D/g, ""))}
                placeholder={String(total)}
                autoFocus
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-lg font-semibold text-white focus:outline-none focus:border-purple-500 text-right tabular-nums"
              />
              {change > 0 && (
                <p className="text-sm text-emerald-400 mt-2 text-right">
                  Vuelto: <strong>{formatARS(change)}</strong>
                </p>
              )}
            </div>
          )}

          <button
            onClick={() => onSubmit(method)}
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {submitting ? "Cobrando..." : "Confirmar cobro"}
          </button>
        </div>
      </div>
    </div>
  )
}

function SuccessModal({
  total,
  offline,
  onClose,
}: {
  total: number
  offline: boolean
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-emerald-700/40 rounded-2xl w-full max-w-sm p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-500 mx-auto mb-3 flex items-center justify-center">
          <Check className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-xl font-bold text-white mb-1">¡Venta hecha!</h2>
        <p className="text-2xl font-bold text-emerald-400 mb-1 tabular-nums">{formatARS(total)}</p>
        <p className="text-xs text-gray-400 mb-5">
          {offline
            ? "Guardada offline. Se sincroniza solita cuando vuelva el internet."
            : "Sincronizada en el servidor"}
        </p>
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold"
        >
          Otra venta
        </button>
      </div>
    </div>
  )
}
