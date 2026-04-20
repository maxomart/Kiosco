"use client"

import { useState } from "react"
import { X, Loader2, Check, Banknote, CreditCard, Smartphone } from "lucide-react"
import toast from "react-hot-toast"
import { usePOSStore } from "@/store/posStore"
import { formatCurrency, PAYMENT_METHODS, cn } from "@/lib/utils"

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
}

export function PaymentModal({ onClose }: Props) {
  const { cart, discount, subtotal, discountAmount, total, clearCart, selectedClientId, cashSessionId } = usePOSStore()
  const [method, setMethod] = useState("CASH")
  const [cashReceived, setCashReceived] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<{ number: number } | null>(null)

  const totalAmount = total()
  const change = method === "CASH" && cashReceived ? Math.max(0, Number(cashReceived) - totalAmount) : 0

  const handlePay = async () => {
    setLoading(true)
    try {
      // Coerce every numeric field with Number(...) — Prisma Decimal values
      // can serialize as strings through the products API and would silently
      // fail Zod validation otherwise.
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
      }

      const res = await fetch("/api/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        // Surface the actual validation error so the user knows what failed.
        const detail = data?.details?.fieldErrors
          ? Object.entries(data.details.fieldErrors)
              .map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`)
              .join(" | ")
          : data?.error ?? "Error al procesar la venta"
        console.error("[PaymentModal] sale failed", { payload, data })
        toast.error(detail)
        return
      }

      setSuccess({ number: data.sale.number })
      clearCart()
    } catch (e) {
      console.error("[PaymentModal] network error", e)
      toast.error("Error de conexión")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-green-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-100 mb-1">¡Venta registrada!</h2>
          <p className="text-gray-400 mb-1">Venta #{success.number}</p>
          <p className="text-2xl font-bold text-purple-400 mb-6">{formatCurrency(totalAmount)}</p>
          {method === "CASH" && change > 0 && (
            <div className="bg-green-900/20 border border-green-800 rounded-xl p-3 mb-4">
              <p className="text-sm text-gray-400">Vuelto</p>
              <p className="text-2xl font-bold text-green-400">{formatCurrency(change)}</p>
            </div>
          )}
          <button onClick={onClose} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-3 rounded-xl transition">
            Nueva venta
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="font-bold text-gray-100">Cobrar</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition"><X size={20} /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Payment methods */}
          <div>
            <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Método de pago</p>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map(m => (
                <button
                  key={m.value}
                  onClick={() => setMethod(m.value)}
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

          {/* Cash received */}
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

          {/* Total */}
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

        {/* Actions */}
        <div className="p-5 pt-0 flex gap-3">
          <button onClick={onClose} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium py-3 rounded-xl transition">
            Cancelar
          </button>
          <button
            onClick={handlePay}
            disabled={loading || (method === "CASH" && cashReceived !== "" && Number(cashReceived) < totalAmount)}
            className="flex-2 flex-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 size={16} className="animate-spin" /> Procesando...</> : `Confirmar ${formatCurrency(totalAmount)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
