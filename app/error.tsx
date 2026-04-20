"use client"

import { useEffect } from "react"
import { AlertTriangle, RefreshCw, Home } from "lucide-react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[error boundary]", error.message)
  }, [error])

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <AlertTriangle size={32} className="text-red-400" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold mb-3">Algo salió mal</h1>
        <p className="text-gray-400 mb-6">
          No pudimos procesar tu pedido. Intentá de nuevo o volvé al inicio.
        </p>
        {error.digest && (
          <p className="text-xs text-gray-600 font-mono mb-6">ID: {error.digest}</p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 rounded-xl font-semibold transition"
          >
            <RefreshCw size={16} aria-hidden="true" /> Reintentar
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl font-semibold transition"
          >
            <Home size={16} aria-hidden="true" /> Ir al inicio
          </a>
        </div>
      </div>
    </div>
  )
}
