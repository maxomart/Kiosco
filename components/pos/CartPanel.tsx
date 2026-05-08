"use client"

import { Minus, Plus, Trash2, ShoppingCart, User, ChevronRight, Scale } from "lucide-react"
import { usePOSStore } from "@/store/posStore"
import { formatCurrency, cn } from "@/lib/utils"
import { useState } from "react"
import { WeightInputModal } from "@/components/pos/WeightInputModal"

interface Props {
  onPay: () => void
  /** When true, the Cobrar button is disabled (e.g., no open cash session) */
  payDisabled?: boolean
  /** Tooltip / explanation when disabled */
  payDisabledReason?: string
}

export function CartPanel({ onPay, payDisabled = false, payDisabledReason }: Props) {
  const { cart, removeFromCart, updateQuantity, updateDiscount, setGlobalDiscount,
    discount, subtotal, discountAmount, total } = usePOSStore()
  const [editingDiscount, setEditingDiscount] = useState<string | null>(null)
  const [editingWeight, setEditingWeight] = useState<string | null>(null)
  const [editingQty, setEditingQty] = useState<string | null>(null)
  const editingItem = editingWeight ? cart.find((i) => i.productId === editingWeight) : null

  return (
    <div className="flex flex-col h-full bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <ShoppingCart size={16} className="text-purple-400" />
          <span className="font-semibold text-sm text-gray-100">Carrito</span>
          {cart.length > 0 && (
            <span className="bg-purple-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
              {cart.length}
            </span>
          )}
        </div>
        <button className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 transition">
          <User size={13} />
          <span>Cliente</span>
          <ChevronRight size={12} />
        </button>
      </div>

      {/* Items — cada item ocupa 2 líneas: nombre arriba, qty + precio abajo.
          Más respiro visual y el precio queda en su propia esquina, no
          peleando con los controles de cantidad. */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 min-h-0">
        {cart.length === 0 ? (
          <div className="text-center py-12 text-gray-600">
            <ShoppingCart size={36} className="mx-auto mb-2 opacity-20" />
            <p className="text-sm">Carrito vacío</p>
            <p className="text-[11px] mt-1 text-gray-700">Buscá o escaneá para empezar</p>
          </div>
        ) : (
          cart.map(item => (
            <div key={item.productId} className="bg-gray-800/60 hover:bg-gray-800 border border-gray-800 rounded-xl px-3 py-2.5 transition">
              {/* Línea 1: nombre + tachito */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-sm font-medium text-gray-100 flex-1 leading-snug">{item.productName}</p>
                <button onClick={() => removeFromCart(item.productId)}
                  className="w-7 h-7 -mr-1 -mt-0.5 rounded-lg flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition flex-shrink-0"
                  aria-label="Quitar del carrito">
                  <Trash2 size={13} />
                </button>
              </div>
              {/* Línea 2: qty controls + descuento + precio */}
              <div className="flex items-center justify-between gap-2">
                {item.soldByWeight ? (
                  <button
                    onClick={() => setEditingWeight(item.productId)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-200 transition"
                    aria-label="Editar peso"
                  >
                    <Scale className="w-3.5 h-3.5" />
                    <span className="text-sm font-semibold tabular-nums">{item.quantity.toFixed(3)} kg</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      className="w-7 h-7 rounded-lg bg-gray-700 hover:bg-gray-600 active:scale-95 flex items-center justify-center transition"
                      aria-label="Disminuir cantidad">
                      <Minus className="w-3 h-3" />
                    </button>
                    {editingQty === item.productId ? (
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={item.stock || undefined}
                        defaultValue={item.quantity}
                        autoFocus
                        onFocus={(e) => e.target.select()}
                        onBlur={(e) => {
                          const n = parseInt(e.target.value || "0", 10)
                          if (n > 0) updateQuantity(item.productId, Math.min(n, item.stock || n))
                          setEditingQty(null)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur()
                          if (e.key === "Escape") setEditingQty(null)
                        }}
                        className="w-11 h-7 text-sm font-semibold text-center tabular-nums bg-gray-700 border border-purple-500 rounded-lg text-white focus:outline-none"
                      />
                    ) : (
                      <button
                        onClick={() => setEditingQty(item.productId)}
                        className="text-sm font-semibold w-9 h-7 text-center tabular-nums hover:bg-gray-700 rounded-lg transition text-gray-100"
                        aria-label="Editar cantidad"
                        title="Click para tipear cantidad"
                      >
                        {item.quantity}
                      </button>
                    )}
                    <button onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      disabled={item.quantity >= item.stock}
                      className="w-7 h-7 rounded-lg bg-gray-700 hover:bg-gray-600 active:scale-95 disabled:opacity-40 flex items-center justify-center transition"
                      aria-label="Aumentar cantidad">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  {editingDiscount === item.productId ? (
                    <input
                      type="number" min={0} max={100}
                      defaultValue={item.discount === 0 ? "" : item.discount}
                      placeholder="0"
                      className="w-12 text-xs bg-gray-700 rounded px-1.5 py-1 text-center"
                      onFocus={e => e.target.select()}
                      onBlur={e => { updateDiscount(item.productId, Math.min(100, Math.max(0, Number(e.target.value)))); setEditingDiscount(null) }}
                      onKeyDown={e => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                      autoFocus
                    />
                  ) : (
                    <button onClick={() => setEditingDiscount(item.productId)}
                      className={cn("text-[10px] px-1.5 py-0.5 rounded transition uppercase tracking-wider",
                        item.discount > 0 ? "bg-emerald-900/40 text-emerald-300 font-bold" : "text-gray-600 hover:text-gray-400"
                      )}>
                      {item.discount > 0 ? `-${item.discount}%` : "%"}
                    </button>
                  )}
                  <span className="text-base font-bold text-gray-50 tabular-nums">{formatCurrency(item.subtotal)}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Totals + Pay — anchored at the bottom, big and unmissable. */}
      <div className="border-t border-gray-800 p-4 flex-shrink-0 space-y-2.5 bg-gray-900/50">
        {discountAmount() > 0 && (
          <div className="flex justify-between text-xs text-gray-400">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatCurrency(subtotal())}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Descuento global</span>
          <div className="flex items-center gap-1.5">
            <input
              type="number" min={0} max={100}
              value={discount === 0 ? "" : discount}
              placeholder="0"
              onFocus={e => e.target.select()}
              onChange={e => setGlobalDiscount(Math.min(100, Math.max(0, Number(e.target.value))))}
              className="w-12 bg-gray-800 border border-gray-700 rounded-md px-1.5 py-0.5 text-xs text-center text-gray-300 focus:outline-none focus:border-purple-500"
            />
            <span className="text-xs text-gray-500">%</span>
            {discountAmount() > 0 && <span className="text-emerald-400 text-xs font-medium tabular-nums">-{formatCurrency(discountAmount())}</span>}
          </div>
        </div>
        <div className="flex items-end justify-between pt-2 border-t border-gray-800">
          <span className="text-sm text-gray-400 uppercase tracking-wider font-medium">Total</span>
          <span className="text-3xl font-black text-white tabular-nums leading-none">{formatCurrency(total())}</span>
        </div>
        <button
          onClick={onPay}
          disabled={cart.length === 0 || payDisabled}
          title={payDisabledReason}
          className="w-full bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-accent-foreground font-bold py-4 rounded-xl transition-all active:scale-[0.98] text-base mt-1 relative shadow-lg shadow-accent/20"
        >
          {payDisabled ? (payDisabledReason ?? "No disponible") : (cart.length > 0 ? "Cobrar" : "Cobrar")}
          {!payDisabled && cart.length > 0 && (
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden md:inline-flex bg-black/30 border border-white/20 rounded px-1.5 py-0.5 font-mono text-[10px] text-accent-foreground/80">
              F5
            </kbd>
          )}
        </button>
      </div>

      {editingItem && (
        <WeightInputModal
          productName={editingItem.productName}
          pricePerKg={editingItem.unitPrice}
          stockKg={editingItem.stock}
          initialKg={editingItem.quantity}
          onConfirm={(kg) => {
            updateQuantity(editingItem.productId, kg)
            setEditingWeight(null)
          }}
          onClose={() => setEditingWeight(null)}
        />
      )}
    </div>
  )
}
