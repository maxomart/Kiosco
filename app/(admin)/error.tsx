"use client"

import { useEffect } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[admin error]", error.message)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center bg-gray-900 border border-gray-800 rounded-2xl p-8">
        <div className="w-14 h-14 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <AlertTriangle size={28} className="text-red-400" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Error en panel admin</h2>
        <p className="text-gray-400 text-sm mb-5">
          {error.message || "Algo salió mal al cargar esta página."}
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold transition"
        >
          <RefreshCw size={16} aria-hidden="true" /> Reintentar
        </button>
      </div>
    </div>
  )
}
