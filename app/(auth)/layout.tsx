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
      {/* Slow drifting color blobs — match the landing palette so users
          feel they stayed inside the same product. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div
          className="absolute rounded-full"
          style={{
            top: "10%", left: "10%",
            width: 520, height: 520,
            background: "radial-gradient(circle, rgba(59,130,246,0.28) 0%, transparent 65%)",
            filter: "blur(50px)",
            animation: "blob-drift 22s ease-in-out infinite",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            top: "55%", right: "5%",
            width: 600, height: 600,
            background: "radial-gradient(circle, rgba(139,92,246,0.32) 0%, transparent 65%)",
            filter: "blur(50px)",
            animation: "blob-drift 26s ease-in-out 1s infinite",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            bottom: "5%", left: "20%",
            width: 480, height: 480,
            background: "radial-gradient(circle, rgba(34,211,238,0.20) 0%, transparent 65%)",
            filter: "blur(50px)",
            animation: "blob-drift 28s ease-in-out 2s infinite",
          }}
        />
      </div>

      {/* Subtle dot grid layered on top of the blobs */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage:
            "radial-gradient(ellipse 80% 60% at center, black 30%, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 60% at center, black 30%, transparent 80%)",
        }}
        aria-hidden
      />

      <header className="relative flex items-center justify-center py-7 z-10">
        <Link
          href="/"
          className="flex items-center gap-2.5 group"
          aria-label="Orvex home"
        >
          <OrvexLogo size={36} className="group-hover:scale-105 transition-transform" />
          <span className="text-xl font-bold tracking-tight text-white">
            Orv<span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 bg-clip-text text-transparent">ex</span>
          </span>
        </Link>
      </header>

      <main className="relative flex-1 flex items-start lg:items-center justify-center px-3 sm:px-4 py-4 sm:py-6 z-10">
        {children}
      </main>

      <footer className="relative py-6 text-center text-xs text-gray-600 z-10">
        &copy; {new Date().getFullYear()} Orvex &mdash; Tu negocio, en control.
      </footer>
    </div>
  )
}
