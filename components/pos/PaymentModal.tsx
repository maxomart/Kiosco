"use client"

import { useState } from "react"
import { formatCurrency, PAYMENT_METHOD_LABELS, PAYMENT_METHOD_COLORS } from "@/lib/utils"
import { X, Check, Loader2, Banknote, CreditCard, Smartphone, ArrowLeftRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CartItem, PaymentMethod } from "@/store/posStore"
import toast from "react-hot-toast"

interface PaymentModalProps {
  total: number
  subtotal: number
  discountAmount: number
  discount: number
  items: CartItem[]
  onClose: () => void
  onSuccess: () => void
}

type PaymentMethodKey = Exclude<PaymentMethod, "MIXED">

const PAYMENT_METHODS: { key: PaymentMethodKey; icon: React.ElementType; color: string }[] = [
  { key: "CASH", icon: Banknote, color: "bg-green-500" },
  { key: "DEBIT", icon: CreditCard, color: "bg-blue-500" },
  { key: "CREDIT", icon: CreditCard, color: "bg-purple-500" },
  { key: "TRANSFER", icon: ArrowLeftRight, color: "bg-indigo-500" },
  { key: "MERCADOPAGO", icon: Smartphone, color: "bg-sky-500" },
  { key: "UALA", icon: Smartphone, color: "bg-emerald-500" },
  { key: "MODO", icon: Smartphone, color: "bg-orange-500" },
]

export default function PaymentModal({
  total, subtotal, discountAmount, discount, items, onClose, onSuccess
}: PaymentModalProps) {
  const [method, setMethod] = useState<PaymentMethodKey>("CASH")
  const [cashReceived, setCashReceived] = useState("")
  const [loading, setLoading] = useState(false)

  const cash = parseFloat(cashReceived) || 0
  const change = method === "CASH" ? Math.max(0, cash - total) : 0

  // Valores rápidos de efectivo
  const quickCash = [500, 1000, 2000, 5000, 10000].filter(v => v >= total)
  if (quickCash.length === 0) quickCash.push(Math.ceil(total / 100) * 100)

  const handleConfirm = async () => {
    if (method === "CASH" && cash < total) {
      toast.error("El monto recibido es menor al total")
      return
    }

    setLoading(true)
    try {
      const saleData = {
        items: items.map(i => ({
          productId: i.productId,
          productName: i.name,
          quantity: i.quantity,
          unitPrice: i.price,
          costPrice: i.costPrice,
          discount: i.discount,
          subtotal: i.subtotal,
          taxRate: i.taxRate,
        })),
        subtotal,
        discountAmount,
        discountPercent: discount,
        total,
        paymentMethod: method,
        cashReceived: method === "CASH" ? cash : undefined,
        change: method === "CASH" ? change : undefined,
      }

      const res = await fetch("/api/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(saleData),
      })

      if (!res.ok) throw new Error("Error al guardar la venta")

      onSuccess()
    } catch (err) {
      // Modo offline
      try {
        const { saveOfflineSale } = await import("@/lib/offline/db")
        await saveOfflineSale({
          id: crypto.randomUUID(),
          items: items.map(i => ({
            productId: i.productId,
            productName: i.name,
            quantity: i.quantity,
            unitPrice: i.price,
            costPrice: i.costPrice,
            discount: i.discount,
            subtotal: i.subtotal,
          })),
          subtotal,
          discountAmount,
          total,
          paymentMethod: method,
          cashReceived: method === "CASH" ? cash : undefined,
          change: method === "CASH" ? change : undefined,
          userId: "offline",
          createdAt: new Date().toISOString(),
          synced: false,
        })
        toast("Venta guardada offline. Se sincronizará al conectarse.", { icon: "📴" })
        onSuccess()
      } catch {
        toast.error("Error al guardar la venta")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg animate-fadeIn">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">Cobrar venta</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 transition"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Total */}
          <div className="bg-blue-50 dark:bg-gray-700 rounded-2xl p-5 text-center">
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">Total a cobrar</p>
            <p className="text-4xl font-black text-blue-700">{formatCurrency(total)}</p>
            {discount > 0 && (
              <p className="text-green-600 text-sm mt-1">
                Descuento aplicado: -{formatCurrency(discountAmount)} ({discount}%)
              </p>
            )}
          </div>

          {/* Formas de pago */}
          <div>
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">Forma de pago</p>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map(({ key, icon: Icon, color }) => (
                <button
                  key={key}
                  onClick={() => setMethod(key)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl border-2 transition active:scale-95",
                    method === key
                      ? "border-blue-500 bg-blue-50 dark:bg-gray-700"
                      : "border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 bg-white dark:bg-gray-700"
                  )}
                >
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", color)}>
                    <Icon size={16} className="text-white" />
                  </div>
                  <span className={cn(
                    "text-xs font-medium",
                    method === key ? "text-blue-700" : "text-gray-600 dark:text-gray-300"
                  )}>
                    {PAYMENT_METHOD_LABELS[key]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Efectivo: campo de monto recibido */}
          {method === "CASH" && (
            <div className="animate-fadeIn">
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">Monto recibido</p>
              <input
                type="number"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                className="w-full px-4 py-3 text-2xl font-bold border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-blue-500 rounded-2xl outline-none transition text-right"
                placeholder={formatCurrency(total).replace("$", "")}
                autoFocus
              />

              {/* Valores rápidos */}
              <div className="flex gap-2 mt-2 flex-wrap">
                <span className="text-xs text-gray-400 self-center">Exacto:</span>
                {quickCash.map(v => (
                  <button
                    key={v}
                    onClick={() => setCashReceived(String(v))}
                    className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 hover:text-blue-700 rounded-xl text-sm font-medium transition"
                  >
                    ${v.toLocaleString("es-AR")}
                  </button>
                ))}
              </div>

              {/* Vuelto */}
              {cash >= total && (
                <div className="mt-3 bg-green-50 dark:bg-green-900/30 rounded-2xl px-4 py-3 flex items-center justify-between animate-fadeIn">
                  <span className="text-green-700 dark:text-green-400 font-semibold">Vuelto</span>
                  <span className="text-2xl font-black text-green-600 dark:text-green-400">{formatCurrency(change)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Botones */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold rounded-2xl transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || (method === "CASH" && cash < total)}
            className={cn(
              "flex-1 py-4 font-black text-white rounded-2xl flex items-center justify-center gap-2 text-lg transition active:scale-95",
              method === "CASH" && cash >= total
                ? "bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/30"
                : method !== "CASH"
                ? "bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/30"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            )}
          >
            {loading ? (
              <Loader2 className="animate-spin" size={22} />
            ) : (
              <>
                <Check size={22} />
                CONFIRMAR
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
