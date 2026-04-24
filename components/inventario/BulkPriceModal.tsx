"use client"

import { useState } from "react"
import { X, Percent, DollarSign, Loader2, TrendingUp, TrendingDown } from "lucide-react"
import toast from "react-hot-toast"
import { CurrencyInput } from "@/components/ui/CurrencyInput"

interface Product {
  id: string
  name: string
  costPrice: number
  salePrice: number
}

type Target = "sale" | "cost" | "both"
type Mode = "percent" | "fixed_add" | "fixed_set"

export function BulkPriceModal({
  open,
  selectedIds,
  products,
  onClose,
  onApplied,
}: {
  open: boolean
  selectedIds: string[]
  products: Product[]
  onClose: () => void
  onApplied: () => void
}) {
  const [target, setTarget] = useState<Target>("sale")
  const [mode, setMode] = useState<Mode>("percent")
  const [percent, setPercent] = useState<number>(10)
  const [fixedAmount, setFixedAmount] = useState<number>(0)
  const [direction, setDirection] = useState<"up" | "down">("up")
  const [applying, setApplying] = useState(false)

  if (!open) return null

  const selectedProducts = products.filter((p) => selectedIds.includes(p.id))

  // Compute new values for preview (first 10)
  const preview = selectedProducts.slice(0, 10).map((p) => {
    const currentSale = Number(p.salePrice)
    const currentCost = Number(p.costPrice)

    const compute = (current: number): number => {
      if (mode === "percent") {
        const mult = 1 + (direction === "up" ? percent : -percent) / 100
        return Math.max(0, current * mult)
      }
      if (mode === "fixed_add") {
        return Math.max(0, current + (direction === "up" ? fixedAmount : -fixedAmount))
      }
      return fixedAmount // fixed_set
    }

    const newSale = target === "cost" ? currentSale : compute(currentSale)
    const newCost = target === "sale" ? currentCost : compute(currentCost)

    return { id: p.id, name: p.name, currentSale, currentCost, newSale, newCost }
  })

  const apply = async () => {
    setApplying(true)
    const updates = selectedProducts.map((p) => {
      const row: { id: string; salePrice?: number; costPrice?: number } = { id: p.id }
      const compute = (current: number): number => {
        if (mode === "percent") {
          const mult = 1 + (direction === "up" ? percent : -percent) / 100
          return Math.round(Math.max(0, current * mult) * 100) / 100
        }
        if (mode === "fixed_add") {
          return Math.round(Math.max(0, current + (direction === "up" ? fixedAmount : -fixedAmount)) * 100) / 100
        }
        return Math.round(fixedAmount * 100) / 100
      }
      if (target === "sale" || target === "both") row.salePrice = compute(Number(p.salePrice))
      if (target === "cost" || target === "both") row.costPrice = compute(Number(p.costPrice))
      return row
    })

    try {
      const res = await fetch("/api/productos/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "SET", updates }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Error al ajustar precios")
        setApplying(false)
        return
      }
      toast.success(`${updates.length} productos actualizados`)
      onApplied()
      onClose()
    } catch {
      toast.error("Error de red")
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] shadow-2xl shadow-black/50 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-800 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-900/40 flex items-center justify-center">
              <Percent className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="font-bold text-gray-100">Ajustar precios en masa</h2>
              <p className="text-sm text-gray-400 mt-0.5">
                {selectedIds.length} producto{selectedIds.length !== 1 ? "s" : ""} seleccionado{selectedIds.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* What to change */}
          <div>
            <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold block mb-2">
              ¿Qué precio cambiar?
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { v: "sale", label: "Precio de venta", desc: "Lo que cobrás" },
                { v: "cost", label: "Precio de costo", desc: "Lo que pagás" },
                { v: "both", label: "Ambos", desc: "Venta + costo" },
              ].map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => setTarget(opt.v as Target)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    target === opt.v
                      ? "border-accent bg-accent-soft/40 text-accent"
                      : "border-gray-800 bg-gray-900/40 text-gray-300 hover:border-gray-700"
                  }`}
                >
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-[10px] opacity-70 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* How to change */}
          <div>
            <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold block mb-2">
              Tipo de ajuste
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { v: "percent", label: "% porcentaje" },
                { v: "fixed_add", label: "$ monto fijo" },
                { v: "fixed_set", label: "= precio nuevo" },
              ].map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => setMode(opt.v as Mode)}
                  className={`p-2 rounded-lg border text-center text-sm transition-colors ${
                    mode === opt.v
                      ? "border-accent bg-accent-soft/40 text-accent"
                      : "border-gray-800 bg-gray-900/40 text-gray-300 hover:border-gray-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Direction (only for percent/fixed_add) */}
          {mode !== "fixed_set" && (
            <div>
              <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold block mb-2">
                Dirección
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setDirection("up")}
                  className={`p-2 rounded-lg border flex items-center justify-center gap-1.5 text-sm transition-colors ${
                    direction === "up"
                      ? "border-emerald-500 bg-emerald-900/30 text-emerald-300"
                      : "border-gray-800 bg-gray-900/40 text-gray-300 hover:border-gray-700"
                  }`}
                >
                  <TrendingUp className="w-4 h-4" /> Aumentar
                </button>
                <button
                  onClick={() => setDirection("down")}
                  className={`p-2 rounded-lg border flex items-center justify-center gap-1.5 text-sm transition-colors ${
                    direction === "down"
                      ? "border-red-500 bg-red-900/30 text-red-300"
                      : "border-gray-800 bg-gray-900/40 text-gray-300 hover:border-gray-700"
                  }`}
                >
                  <TrendingDown className="w-4 h-4" /> Reducir
                </button>
              </div>
            </div>
          )}

          {/* Value input */}
          <div>
            <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold block mb-2">
              {mode === "percent" ? "Porcentaje" : mode === "fixed_add" ? "Monto" : "Precio nuevo"}
            </label>
            {mode === "percent" ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={percent}
                  onChange={(e) => setPercent(parseFloat(e.target.value) || 0)}
                  min="0"
                  step="0.1"
                  className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-2xl font-semibold text-right focus:outline-none focus:border-accent"
                />
                <span className="text-2xl text-gray-400">%</span>
              </div>
            ) : (
              <CurrencyInput
                value={fixedAmount}
                onValueChange={setFixedAmount}
                className="text-2xl font-semibold py-3.5"
              />
            )}
            {mode === "percent" && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {[5, 10, 15, 20, 25, 30].map((n) => (
                  <button
                    key={n}
                    onClick={() => setPercent(n)}
                    className="text-xs px-2 py-1 rounded bg-gray-800 hover:bg-accent-soft hover:text-accent text-gray-400"
                  >
                    {n}%
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Preview */}
          <div>
            <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold block mb-2">
              Vista previa (primeros 10)
            </label>
            <div className="border border-gray-800 rounded-lg overflow-hidden max-h-64 overflow-y-auto bg-gray-950/40">
              <table className="w-full text-xs">
                <thead className="bg-gray-900/80 sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left text-gray-500">Producto</th>
                    {(target === "cost" || target === "both") && (
                      <th className="px-2 py-1.5 text-right text-gray-500">Costo</th>
                    )}
                    {(target === "sale" || target === "both") && (
                      <th className="px-2 py-1.5 text-right text-gray-500">Venta</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {preview.map((row) => (
                    <tr key={row.id}>
                      <td className="px-2 py-1.5 text-gray-200 truncate max-w-[200px]">{row.name}</td>
                      {(target === "cost" || target === "both") && (
                        <td className="px-2 py-1.5 text-right">
                          <span className="text-gray-500 line-through">${row.currentCost.toFixed(0)}</span>
                          <span className="text-emerald-300 ml-1">→ ${row.newCost.toFixed(0)}</span>
                        </td>
                      )}
                      {(target === "sale" || target === "both") && (
                        <td className="px-2 py-1.5 text-right">
                          <span className="text-gray-500 line-through">${row.currentSale.toFixed(0)}</span>
                          <span className="text-emerald-300 ml-1">→ ${row.newSale.toFixed(0)}</span>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selectedProducts.length > 10 && (
              <p className="text-[10px] text-gray-500 mt-1">
                Y {selectedProducts.length - 10} producto{selectedProducts.length - 10 !== 1 ? "s" : ""} más…
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={applying}
            className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={apply}
            disabled={applying || selectedIds.length === 0 || (mode === "percent" && percent <= 0) || (mode !== "percent" && fixedAmount < 0)}
            className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-50 text-accent-foreground text-sm font-medium flex items-center gap-1.5"
          >
            {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
            Aplicar a {selectedIds.length} productos
          </button>
        </div>
      </div>
    </div>
  )
}
