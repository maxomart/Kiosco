import Link from "next/link"
import type { Metadata } from "next"
import { SearchX, Home } from "lucide-react"

export const metadata: Metadata = {
  title: "Página no encontrada",
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <SearchX size={32} className="text-purple-300" aria-hidden="true" />
        </div>
        <p className="text-sm text-purple-300 font-semibold mb-2">ERROR 404</p>
        <h1 className="text-3xl font-bold mb-3">Página no encontrada</h1>
        <p className="text-gray-400 mb-8">
          La página que buscás no existe o fue movida.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition"
        >
          <Home size={18} aria-hidden="true" /> Ir al inicio
        </Link>
      </div>
    </div>
  )
}
