"use client"

import { useEffect, useRef, useState } from "react"
import { X, Scale } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

interface Props {
  productName: string
  pricePerKg: number
  /** Stock in kg (already in stock units = kg). Optional — when undefined no max check. */
  stockKg?: number
  /** Initial weight in kg (when editing an existing cart line). */
  initialKg?: number
  onConfirm: (kg: number) => void
  onClose: () => void
}

const QUICK = [0.25, 0.5, 1, 2]

/**
 * Modal para ingresar peso al agregar un producto vendido por kg.
 * Acepta hasta 3 decimales (gramo).
 */
export function WeightInputModal({
  productName,
  pricePerKg,
  stockKg,
  initialKg,
  onConfirm,
  onClose,
}: Props) {
  const [value, setValue] = useState<string>(initialKg ? initialKg.toString() : "")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 30)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  const kg = Number(value.replace(",", "."))
  const total = isFinite(kg) && kg > 0 ? kg * pricePerKg : 0
  const overStock = stockKg !== undefined && kg > stockKg

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isFinite(kg) || kg <= 0) return
    if (overStock) return
    onConfirm(Math.round(kg * 1000) / 1000)
  }

  const setQuick = (n: number) => setValue(n.toString())

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-800 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Scale className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="font-bold text-gray-100">Pesar {productName}</h2>
              <p className="text-xs text-gray-400 mt-0.5">{formatCurrency(pricePerKg)} por kg</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold block mb-2">
              Peso
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                inputMode="decimal"
                value={value}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9.,]/g, "")
                  setValue(raw)
                }}
                placeholder="0.000"
                className="w-full px-4 py-4 bg-gray-800 border border-gray-700 rounded-lg text-white text-3xl font-bold tabular-nums text-center focus:outline-none focus:border-purple-500"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg text-gray-500 font-medium">kg</span>
            </div>
            {stockKg !== undefined && (
              <p className={`text-[11px] mt-1.5 ${overStock ? "text-red-400" : "text-gray-500"}`}>
                Disponible: {stockKg.toFixed(3)} kg{overStock ? " — supera el stock" : ""}
              </p>
            )}
          </div>

          {/* Quick weights */}
          <div className="grid grid-cols-4 gap-2">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setQuick(q)}
                className="py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-200"
              >
                {q < 1 ? `${q * 1000} g` : `${q} kg`}
              </button>
            ))}
          </div>

          {/* Total */}
          <div className="bg-gray-800/50 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
            <span className="text-sm text-gray-400">Total</span>
            <span className="text-2xl font-bold text-purple-400 tabular-nums">{formatCurrency(total)}</span>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-3 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!isFinite(kg) || kg <= 0 || overStock}
              className="flex-1 px-3 py-3 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold"
            >
              Agregar al carrito
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
