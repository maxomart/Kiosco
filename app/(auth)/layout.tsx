import type { Metadata } from "next"
import type { ReactNode } from "react"
import Link from "next/link"
import { ShoppingCart } from "lucide-react"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-center py-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 group"
          aria-label="RetailAR home"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-900/40 group-hover:shadow-purple-800/60 transition-shadow">
            <ShoppingCart className="w-5 h-5 text-white" strokeWidth={2.2} />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">
            Retail<span className="text-purple-400">AR</span>
          </span>
        </Link>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs text-gray-600">
        &copy; {new Date().getFullYear()} RetailAR &mdash; Todos los derechos reservados.
      </footer>
    </div>
  )
}
