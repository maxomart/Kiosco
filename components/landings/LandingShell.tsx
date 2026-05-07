import Link from "next/link"
import { OrvexLogo } from "@/components/shared/OrvexLogo"
import { Check, ArrowRight, Sparkles } from "lucide-react"

/**
 * Layout reusado por las landings por keyword. Cada landing tiene su
 * propio H1, copy, imágenes — pero el header / footer / CTA box son
 * iguales para mantener consistencia y reducir mantenimiento.
 *
 * El children es el contenido SEO específico de la landing (~800-1500
 * palabras con headings semánticos H2/H3, listas, CTAs, FAQs).
 */

interface Props {
  /** Título corto que aparece en el header (no es el H1 de la página). */
  pillLabel: string
  /** H1 — la frase que rankea en Google. */
  title: string
  /** Subtítulo que va inmediato debajo del H1. */
  subtitle: string
  /** Bullets visuales arriba del CTA principal. */
  highlights: string[]
  /** El cuerpo SEO de la landing — secciones, listas, FAQs. */
  children: React.ReactNode
}

export function LandingShell({ pillLabel, title, subtitle, highlights, children }: Props) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-950 to-black text-white">
      {/* Header */}
      <header className="border-b border-white/5 sticky top-0 z-40 bg-gray-950/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 min-w-0">
            <OrvexLogo size={28} className="flex-shrink-0" gradientId="landing-nav-logo" />
            <span className="font-bold text-base">Orvex</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <Link href="/pricing" className="hidden sm:inline text-sm text-gray-400 hover:text-white">
              Precios
            </Link>
            <Link href="/login" className="hidden sm:inline text-sm text-gray-400 hover:text-white">
              Ingresar
            </Link>
            <Link
              href="/signup"
              className="px-3 sm:px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-violet-500 text-white text-sm font-medium whitespace-nowrap"
            >
              Empezar gratis
            </Link>
          </div>
        </div>
      </header>

      {/* Hero — H1 + subtítulo + highlights + CTA */}
      <section className="relative pt-12 sm:pt-20 pb-12 sm:pb-16 px-4 sm:px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-900/20 via-transparent to-blue-900/15 pointer-events-none" />
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-300 text-xs font-medium mb-6">
            <Sparkles size={12} />
            {pillLabel}
          </div>
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight mb-4 sm:mb-5 leading-[1.1]">
            {title}
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-7">
            {subtitle}
          </p>
          {highlights.length > 0 && (
            <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-gray-300 mb-8 max-w-3xl mx-auto">
              {highlights.map((h, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  <Check size={14} className="text-emerald-400 flex-shrink-0" />
                  {h}
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-white text-black font-semibold transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Empezar gratis
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10"
            >
              Ver planes y precios
            </Link>
          </div>
          <p className="text-xs text-gray-600 mt-4">
            Sin tarjeta · Plan Gratis permanente · Plan Básico desde $9.999 ARS/mes
          </p>
        </div>
      </section>

      {/* Contenido SEO específico de la landing */}
      <article className="max-w-3xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24 article-prose">
        {children}
      </article>

      {/* CTA final + footer */}
      <section className="px-4 sm:px-6 pb-16 sm:pb-20">
        <div className="max-w-3xl mx-auto bg-gradient-to-br from-violet-900/40 to-blue-900/30 rounded-3xl p-6 sm:p-10 text-center border border-violet-700/30">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black mb-3 tracking-tight">
            ¿Listo para empezar?
          </h2>
          <p className="text-gray-300 mb-6 text-sm sm:text-base max-w-xl mx-auto">
            Creá tu cuenta gratis en 2 minutos. Sin tarjeta. Si te sirve, pasás a un plan pago. Si no, lo dejás.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-white text-black font-semibold transition-transform hover:scale-[1.02]"
          >
            Empezar gratis <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-gray-900 py-8 text-center text-sm text-gray-600">
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mb-3">
          <Link href="/" className="hover:text-gray-400">Inicio</Link>
          <Link href="/pricing" className="hover:text-gray-400">Precios</Link>
          <Link href="/blog" className="hover:text-gray-400">Blog</Link>
          <Link href="/descargar" className="hover:text-gray-400">Descargar</Link>
        </div>
        <p>&copy; {new Date().getFullYear()} Orvex — POS, inventario y reportes para comercios argentinos</p>
      </footer>
    </main>
  )
}
