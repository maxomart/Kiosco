"use client"

import { useEffect, useState } from "react"
import { X, Loader2, Check, Banknote, CreditCard, Smartphone, Wallet, QrCode, Printer } from "lucide-react"
import toast from "react-hot-toast"
import { usePOSStore } from "@/store/posStore"
import { formatCurrency, PAYMENT_METHODS, cn } from "@/lib/utils"
import { enqueueSale } from "@/lib/offline-store"

interface Props { onClose: () => void }

const METHOD_ICONS: Record<string, React.ReactNode> = {
  CASH: <Banknote size={16} />,
  DEBIT: <CreditCard size={16} />,
  CREDIT: <CreditCard size={16} />,
  TRANSFER: <Smartphone size={16} />,
  MERCADOPAGO: <span className="text-xs font-bold">MP</span>,
  UALA: <span className="text-xs font-bold">Ualá</span>,
  MODO: <span className="text-xs font-bold">MODO</span>,
  NARANJA_X: <span className="text-xs font-bold">NX</span>,
  CUENTA_DNI: <span className="text-xs font-bold">DNI</span>,
  CUENTA_CORRIENTE: <Wallet size={16} />,
}

// Add CUENTA_CORRIENTE as an extra payment method (utils.ts is shared, can't
// touch it here without breaking other users; we extend in-place at the UI layer).
const EXTRA_METHODS = [{ value: "CUENTA_CORRIENTE", label: "Cuenta corriente" }]
const ALL_METHODS = [...PAYMENT_METHODS, ...EXTRA_METHODS]

interface ClientLite {
  id: string
  name: string
  creditLimit: number
  currentBalance: number
}

export function PaymentModal({ onClose }: Props) {
  const { cart, discount, subtotal, discountAmount, total, clearCart, selectedClientId, cashSessionId } = usePOSStore()
  const [method, setMethod] = useState("CASH")
  const [cashReceived, setCashReceived] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<{ saleId: string; number: number | string; total: number; change: number; method: string; offline?: boolean } | null>(null)

  // MP state
  const [mpQrUrl, setMpQrUrl] = useState<string | null>(null)
  const [mpInitPoint, setMpInitPoint] = useState<string | null>(null)
  const [mpRef, setMpRef] = useState<string | null>(null)
  const [mpStatus, setMpStatus] = useState<"idle" | "pending" | "approved" | "rejected">("idle")

  // Client (for cuenta corriente validations)
  const [client, setClient] = useState<ClientLite | null>(null)

  const totalAmount = total()
  const change = method === "CASH" && cashReceived ? Math.max(0, Number(cashReceived) - totalAmount) : 0

  // Load selected client when CC method picked (and on mount when present)
  useEffect(() => {
    if (!selectedClientId) { setClient(null); return }
    fetch(`/api/clientes`)
      .then((r) => r.json())
      .then((d) => {
        const c = (d.clients ?? []).find((x: any) => x.id === selectedClientId)
        if (c) setClient({
          id: c.id, name: c.name,
          creditLimit: Number(c.creditLimit ?? 0),
          currentBalance: Number(c.currentBalance ?? 0),
        })
      })
      .catch(() => {})
  }, [selectedClientId])

  // Poll MP status when pending
  useEffect(() => {
    if (mpStatus !== "pending" || !mpRef) return
    const t = setInterval(async () => {
      try {
        const r = await fetch(`/api/mercadopago/status/${encodeURIComponent(mpRef)}?ref=${encodeURIComponent(mpRef)}`)
        const d = await r.json()
        if (d.status === "approved") {
          setMpStatus("approved")
          toast.success("Pago confirmado por Mercado Pago")
          // auto-confirm sale
          handleConfirmSale()
        } else if (d.status === "rejected" || d.status === "cancelled") {
          setMpStatus("rejected")
          toast.error("Pago rechazado")
        }
      } catch {}
    }, 3000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mpStatus, mpRef])

  const ccAvailable = client && client.creditLimit > 0
    ? Math.max(0, client.creditLimit - client.currentBalance)
    : null

  const ccBlocked = method === "CUENTA_CORRIENTE" && (
    !selectedClientId ||
    (client && client.creditLimit > 0 && client.currentBalance + totalAmount > client.creditLimit)
  )

  const startMpPayment = async () => {
    if (cart.length === 0) return
    setLoading(true)
    try {
      const ref = `pos-${Date.now()}`
      const res = await fetch("/api/mercadopago/preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((i) => ({
            title: i.productName,
            quantity: Math.max(1, Math.floor(Number(i.quantity) || 1)),
            unit_price: Number(i.unitPrice) || 0,
          })),
          externalReference: ref,
        }),
      })
      const d = await res.json()
      if (!res.ok) {
        toast.error(d?.error ?? "No se pudo crear el QR")
        return
      }
      setMpRef(ref)
      setMpQrUrl(d.qrUrl)
      setMpInitPoint(d.initPoint)
      setMpStatus("pending")
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmSale = async () => {
    setLoading(true)
    try {
      const payload = {
        items: cart.map(i => ({
          productId: i.productId,
          productName: i.productName,
          quantity: Math.max(1, Math.floor(Number(i.quantity) || 1)),
          unitPrice: Number(i.unitPrice) || 0,
          costPrice: Number(i.costPrice) || 0,
          discount: Number(i.discount) || 0,
          subtotal: Number(i.subtotal) || 0,
          taxRate: (i.taxRate as string) || "STANDARD",
          soldByWeight: !!i.soldByWeight,
        })),
        subtotal: Number(subtotal()) || 0,
        discountAmount: Number(discountAmount()) || 0,
        discountPercent: Number(discount) || 0,
        taxAmount: 0,
        total: Number(totalAmount) || 0,
        paymentMethod: method,
        cashReceived: method === "CASH" && cashReceived ? Number(cashReceived) : null,
        change: method === "CASH" && cashReceived ? Number(change) : null,
        clientId: selectedClientId ?? null,
        cashSessionId: cashSessionId ?? null,
        notes: mpRef ? `MP ref: ${mpRef}` : null,
      }

      // Offline-first short-circuit: if the browser knows we're offline,
      // skip the fetch and queue right away.
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        await queueOffline(payload)
        return
      }

      try {
        const res = await fetch("/api/ventas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) {
          // Server error / 503 from SW → if we're now offline, fall back
          // to the queue. Otherwise surface the validation error.
          if (res.status === 503 || (typeof navigator !== "undefined" && !navigator.onLine)) {
            await queueOffline(payload)
            return
          }
          const detail = data?.details?.fieldErrors
            ? Object.entries(data.details.fieldErrors).map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`).join(" | ")
            : data?.error ?? "Error al procesar la venta"
          toast.error(detail)
          return
        }
        setSuccess({
          saleId: data.sale.id,
          number: data.sale.number,
          total: totalAmount,
          change: method === "CASH" && cashReceived ? change : 0,
          method,
        })
        clearCart()
      } catch (e) {
        // Network error → queue offline.
        console.warn("[PaymentModal] network error, queuing offline", e)
        await queueOffline(payload)
      }
    } catch (e) {
      console.error("[PaymentModal] error", e)
      toast.error("Error inesperado")
    } finally {
      setLoading(false)
    }
  }

  // Queue a sale to IndexedDB and show success state with offline flag.
  const queueOffline = async (payload: any) => {
    try {
      const localId = await enqueueSale(payload)
      // Notify any mounted useOfflineSync() consumers to refresh count.
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("retailar:offline-sale-enqueued"))
      }
      setSuccess({
        saleId: localId,
        number: "OFFLINE-" + localId.slice(0, 4).toUpperCase(),
        total: totalAmount,
        change: method === "CASH" && cashReceived ? change : 0,
        method,
        offline: true,
      })
      clearCart()
    } catch (err) {
      console.error("[PaymentModal] enqueueSale failed", err)
      toast.error("No se pudo guardar la venta offline")
    }
  }

  const handlePay = async () => {
    if (method === "CUENTA_CORRIENTE") {
      if (!selectedClientId) { toast.error("Seleccioná un cliente para vender a cuenta"); return }
      if (ccBlocked) { toast.error("Excede el límite de crédito del cliente"); return }
      await handleConfirmSale()
      return
    }
    if (method === "MERCADOPAGO") {
      if (!mpQrUrl) {
        await startMpPayment()
        return
      }
      // Manual confirm fallback
      await handleConfirmSale()
      return
    }
    await handleConfirmSale()
  }

  const printTicket = () => {
    if (!success) return
    window.open(`/api/ventas/${success.saleId}/ticket`, "_blank")
  }

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-green-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-100 mb-1">
            {success.offline ? "Venta guardada offline" : "¡Venta registrada!"}
          </h2>
          <p className="text-gray-400 mb-1">Venta #{success.number}</p>
          <p className="text-2xl font-bold text-accent mb-2">{formatCurrency(success.total)}</p>
          {success.offline && (
            <div className="bg-amber-900/30 border border-amber-800 rounded-lg p-2 mb-4 text-xs text-amber-200">
              Se sincronizará automáticamente cuando vuelva la conexión.
            </div>
          )}
          {success.method === "CASH" && success.change > 0 && (
            <div className="bg-green-900/20 border border-green-800 rounded-xl p-3 mb-4">
              <p className="text-sm text-gray-400">Vuelto</p>
              <p className="text-2xl font-bold text-green-400">{formatCurrency(success.change)}</p>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={printTicket} disabled={!!success.offline}
              title={success.offline ? "El ticket se podrá imprimir luego de sincronizar" : "Imprimir ticket"}
              className="flex-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-gray-100 font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2">
              <Printer size={16} /> Imprimir ticket
            </button>
            <button onClick={onClose} className="flex-1 bg-accent hover:bg-accent-hover text-accent-foreground font-semibold py-3 rounded-xl transition">
              Nueva venta
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="font-bold text-gray-100">Cobrar</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition"><X size={20} /></button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Método de pago</p>
            <div className="grid grid-cols-3 gap-2">
              {ALL_METHODS.map(m => (
                <button
                  key={m.value}
                  onClick={() => { setMethod(m.value); setMpQrUrl(null); setMpStatus("idle"); setMpRef(null) }}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-xs font-medium transition",
                    method === m.value
                      ? "bg-purple-600 border-purple-500 text-white"
                      : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500"
                  )}
                >
                  {METHOD_ICONS[m.value] ?? <Smartphone size={14} />}
                  <span className="leading-tight text-center">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {method === "CASH" && (
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide block mb-2">Efectivo recibido</label>
              <input
                type="number" step="0.01" min={totalAmount}
                value={cashReceived}
                onChange={e => setCashReceived(e.target.value)}
                placeholder={formatCurrency(totalAmount)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-lg font-semibold text-gray-100 focus:outline-none focus:border-purple-500 text-right"
                autoFocus
              />
              {change > 0 && (
                <div className="flex justify-between items-center mt-2 px-1">
                  <span className="text-sm text-gray-400">Vuelto:</span>
                  <span className="text-lg font-bold text-green-400">{formatCurrency(change)}</span>
                </div>
              )}
            </div>
          )}

          {method === "CUENTA_CORRIENTE" && (
            <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-3 space-y-1.5 text-sm">
              {!selectedClientId ? (
                <p className="text-orange-300">⚠️ Seleccioná un cliente desde el carrito para vender a cuenta.</p>
              ) : !client ? (
                <p className="text-gray-400">Cargando datos del cliente...</p>
              ) : (
                <>
                  <div className="flex justify-between text-gray-200"><span>Cliente</span><span className="font-medium">{client.name}</span></div>
                  <div className="flex justify-between text-gray-400"><span>Saldo actual</span><span>{formatCurrency(client.currentBalance)}</span></div>
                  {client.creditLimit > 0 && (
                    <>
                      <div className="flex justify-between text-gray-400"><span>Límite</span><span>{formatCurrency(client.creditLimit)}</span></div>
                      <div className="flex justify-between text-green-400"><span>Disponible</span><span>{formatCurrency(ccAvailable ?? 0)}</span></div>
                    </>
                  )}
                  <div className="flex justify-between text-orange-300 border-t border-gray-700 pt-1.5 mt-1.5">
                    <span>Nuevo saldo</span><span className="font-semibold">{formatCurrency(client.currentBalance + totalAmount)}</span>
                  </div>
                  {ccBlocked && (
                    <p className="text-red-400 text-xs pt-1">Excede el límite de crédito.</p>
                  )}
                </>
              )}
            </div>
          )}

          {method === "MERCADOPAGO" && (
            <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-3 text-center">
              {!mpQrUrl ? (
                <button onClick={startMpPayment} disabled={loading}
                  className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2">
                  <QrCode size={16} /> {loading ? "Generando..." : "Generar QR de Mercado Pago"}
                </button>
              ) : (
                <div className="space-y-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mpQrUrl} alt="QR MP" className="mx-auto rounded-lg bg-white p-2" width={200} height={200} />
                  <p className="text-xs text-gray-400">El cliente escanea con la app de Mercado Pago.</p>
                  {mpStatus === "pending" && (
                    <p className="text-xs text-blue-300 flex items-center justify-center gap-1.5">
                      <Loader2 size={12} className="animate-spin" /> Esperando pago...
                    </p>
                  )}
                  {mpStatus === "approved" && (
                    <p className="text-xs text-green-400">Pago confirmado ✓</p>
                  )}
                  {mpStatus === "rejected" && (
                    <p className="text-xs text-red-400">Pago rechazado.</p>
                  )}
                  {mpInitPoint && (
                    <a href={mpInitPoint} target="_blank" rel="noreferrer" className="text-xs text-purple-400 hover:underline block">
                      Abrir en Mercado Pago
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="bg-gray-800 rounded-xl p-4 space-y-1">
            <div className="flex justify-between text-sm text-gray-400">
              <span>Subtotal</span><span>{formatCurrency(subtotal())}</span>
            </div>
            {discountAmount() > 0 && (
              <div className="flex justify-between text-sm text-green-400">
                <span>Descuento {discount}%</span><span>-{formatCurrency(discountAmount())}</span>
              </div>
            )}
            <div className="flex justify-between text-xl font-bold text-gray-100 border-t border-gray-700 pt-2 mt-2">
              <span>Total</span><span className="text-purple-400">{formatCurrency(totalAmount)}</span>
            </div>
          </div>
        </div>

        <div className="p-5 pt-0 flex gap-3">
          <button onClick={onClose} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-3 rounded-xl transition">
            Cancelar
          </button>
          <button
            onClick={handlePay}
            disabled={
              loading ||
              (method === "CASH" && cashReceived !== "" && Number(cashReceived) < totalAmount) ||
              (method === "CUENTA_CORRIENTE" && !!ccBlocked)
            }
            className="flex-2 flex-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 size={16} className="animate-spin" /> Procesando...</>
              : method === "MERCADOPAGO" && mpStatus === "pending"
                ? "Ya cobré, confirmar venta"
                : `Confirmar ${formatCurrency(totalAmount)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
