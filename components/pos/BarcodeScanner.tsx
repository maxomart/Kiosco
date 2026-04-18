"use client"

import { useState, useEffect, useRef } from "react"
import { X, Scan, Keyboard } from "lucide-react"

interface BarcodeScannerProps {
  onScan: (barcode: string) => void
  onClose: () => void
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const [manualCode, setManualCode] = useState("")
  const [mode, setMode] = useState<"camera" | "manual">("manual")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Auto-focus para escáner USB (el escáner actúa como teclado)
    inputRef.current?.focus()
  }, [])

  // Detectar entrada del escáner USB (entrada rápida + Enter)
  useEffect(() => {
    let buffer = ""
    let timer: NodeJS.Timeout

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && buffer.length > 3) {
        onScan(buffer)
        buffer = ""
        return
      }
      if (e.key.length === 1) {
        buffer += e.key
        clearTimeout(timer)
        timer = setTimeout(() => { buffer = "" }, 100)
      }
    }

    window.addEventListener("keydown", handleKeydown)
    return () => {
      window.removeEventListener("keydown", handleKeydown)
      clearTimeout(timer)
    }
  }, [onScan])

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (manualCode.trim()) {
      onScan(manualCode.trim())
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm animate-fadeIn">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Scan size={20} className="text-blue-600" />
            <h2 className="font-bold text-gray-800">Escanear código</h2>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Indicador de escáner USB */}
          <div className="bg-blue-50 rounded-2xl p-5 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Scan size={32} className="text-blue-600" />
            </div>
            <p className="font-semibold text-gray-800">Escáner USB activo</p>
            <p className="text-sm text-gray-500 mt-1">
              Apuntá el escáner al código de barras del producto
            </p>
          </div>

          {/* Separador */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400">o ingresar manualmente</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* Ingreso manual */}
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Código de barras..."
              className="flex-1 px-4 py-3 border-2 border-gray-200 focus:border-blue-500 rounded-xl outline-none transition"
              autoComplete="off"
            />
            <button
              type="submit"
              className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition"
            >
              OK
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
