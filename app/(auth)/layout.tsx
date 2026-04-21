import type { Metadata } from "next"
import type { ReactNode } from "react"
import Link from "next/link"
import { ShoppingCart } from "lucide-react"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-black flex flex-col overflow-hidden">
      {/* Dot pattern overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          maskImage:
            "radial-gradient(ellipse 80% 60% at center, black 30%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 60% at center, black 30%, transparent 80%)",
        }}
        aria-hidden
      />
      {/* Subtle top glow */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[500px]"
        style={{
          background:
            "radial-gradient(900px 400px at 50% -10%, rgba(139,92,246,0.08), transparent 60%)",
        }}
        aria-hidden
      />

      <header className="relative flex items-center justify-center py-7">
        <Link
          href="/"
          className="flex items-center gap-2.5 group"
          aria-label="RetailAR home"
        >
          <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-lg shadow-black/50 group-hover:scale-105 transition-transform">
            <ShoppingCart className="w-5 h-5 text-black" strokeWidth={2.2} />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">
            Retail<span className="text-gray-400">AR</span>
          </span>
        </Link>
      </header>

      <main className="relative flex-1 flex items-start lg:items-center justify-center px-3 sm:px-4 py-4 sm:py-6">
        {children}
      </main>

      <footer className="relative py-6 text-center text-xs text-gray-600">
        &copy; {new Date().getFullYear()} RetailAR &mdash; Todos los derechos reservados.
      </footer>
    </div>
  )
}
