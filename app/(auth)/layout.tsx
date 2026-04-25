import type { Metadata } from "next"
import type { ReactNode } from "react"
import Link from "next/link"
import { OrvexLogo } from "@/components/shared/OrvexLogo"

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
      {/* Subtle top glow — blue→violet to match the brand */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[500px]"
        style={{
          background:
            "radial-gradient(900px 400px at 50% -10%, rgba(99,102,241,0.16), transparent 60%)",
        }}
        aria-hidden
      />

      <header className="relative flex items-center justify-center py-7">
        <Link
          href="/"
          className="flex items-center gap-2.5 group"
          aria-label="Orvex home"
        >
          <OrvexLogo size={36} className="group-hover:scale-105 transition-transform" gradientId="auth-logo-grad" />
          <span className="text-xl font-bold tracking-tight text-white">
            Orv<span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">ex</span>
          </span>
        </Link>
      </header>

      <main className="relative flex-1 flex items-start lg:items-center justify-center px-3 sm:px-4 py-4 sm:py-6">
        {children}
      </main>

      <footer className="relative py-6 text-center text-xs text-gray-600">
        &copy; {new Date().getFullYear()} Orvex &mdash; Todos los derechos reservados.
      </footer>
    </div>
  )
}
