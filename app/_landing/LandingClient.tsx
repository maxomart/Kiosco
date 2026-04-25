"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { motion, useInView, useMotionValue, useTransform, animate, useScroll } from "framer-motion"
import {
  ShoppingBag,
  Shield,
  Package,
  CreditCard,
  Users,
  BarChart3,
  CheckCircle,
  ArrowRight,
  Store,
  Smartphone,
  Sparkles,
  PartyPopper,
  Cpu,
} from "lucide-react"

interface PlanCard {
  plan: string
  price: number
  desc: string
  features: string[]
  cta: string
  href: string
  highlight: boolean
}

interface ActivePromoLite {
  code: string
  remaining: number
  maxUses: number
  daysGranted: number
  planLabel: string
}

interface Props {
  plans: PlanCard[]
  activePromo: ActivePromoLite | null
  freeHref: string
  professionalHref: string
  promoCode?: string
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
}

const fmtARS = (n: number) =>
  n === 0
    ? "Gratis"
    : new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 0,
      }).format(n)

function mesesOdias(n: number): string {
  if (n % 30 === 0 && n >= 30) {
    const m = n / 30
    return m === 1 ? "1 mes" : `${m} meses`
  }
  return n === 1 ? "1 día" : `${n} días`
}

export default function LandingClient({
  plans,
  activePromo,
  freeHref,
  professionalHref,
  promoCode,
}: Props) {
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] })
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 100])
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0])

  // Cursor spotlight on hero
  const [mouse, setMouse] = useState({ x: 50, y: 30 })
  const handleHeroMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setMouse({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    })
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden relative landing-root selection:bg-violet-500/30 selection:text-white">
      {/* Promo top strip */}
      {activePromo && (
        <Link
          href={professionalHref}
          className="fixed top-0 inset-x-0 z-[60] block bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500 text-black"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-9 flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold">
            <PartyPopper size={14} className="shrink-0" />
            <span className="truncate">
              Promo <span className="uppercase font-mono tracking-wide">{activePromo.code}</span> ·{" "}
              {mesesOdias(activePromo.daysGranted)} de {activePromo.planLabel} gratis ·{" "}
              quedan {activePromo.remaining}/{activePromo.maxUses} cupos
            </span>
            <ArrowRight size={14} className="shrink-0" />
          </div>
        </Link>
      )}

      {/* Navbar */}
      <Navbar
        promoActive={!!activePromo}
        promoCode={promoCode}
        freeHref={freeHref}
        professionalHref={professionalHref}
      />

      {/* ─────────── HERO ─────────── */}
      <section
        ref={heroRef}
        onMouseMove={handleHeroMove}
        className={`relative ${activePromo ? "pt-[10.5rem]" : "pt-36"} pb-24 px-6 overflow-hidden`}
        style={{
          // expose mouse coords for spotlight
          // @ts-expect-error -- CSS var
          "--mx": `${mouse.x}%`,
          "--my": `${mouse.y}%`,
        }}
      >
        {/* Aurora behind */}
        <div className="aurora-bg" aria-hidden />
        {/* Animated grid */}
        <div className="grid-pattern" aria-hidden />
        {/* Mouse spotlight */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(700px circle at var(--mx) var(--my), rgba(139,92,246,0.12), transparent 45%)",
          }}
          aria-hidden
        />

        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative max-w-5xl mx-auto text-center"
        >
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-gray-300 text-xs mb-7 backdrop-blur-md"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
            </span>
            <span className="shimmer-text font-medium">Sistema de gestión nativo Argentina</span>
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.08 } },
            }}
            className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.02]"
          >
            <motion.span variants={fadeUp} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} className="block">
              Manejá tu kiosco
            </motion.span>
            <motion.span
              variants={fadeUp}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="block bg-gradient-to-br from-white via-white to-gray-500 bg-clip-text text-transparent"
            >
              desde cualquier lugar.
            </motion.span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.7 }}
            className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            POS, inventario, caja, reportes y clientes. Todo en un solo lugar — pensado para
            comercios argentinos, con métodos de pago locales y precios en pesos.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.7 }}
            className="flex flex-col sm:flex-row gap-3 justify-center items-center"
          >
            <div className="cta-glow">
              <Link
                href={activePromo ? professionalHref : freeHref}
                className="relative inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-white hover:bg-gray-100 text-black font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-white/20"
              >
                {activePromo
                  ? `Reclamar ${mesesOdias(activePromo.daysGranted)} gratis`
                  : "Empezar gratis"}{" "}
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
            <Link
              href="#pricing"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white font-semibold transition-all hover:border-white/25 backdrop-blur"
            >
              Ver precios
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.85, duration: 0.6 }}
            className="text-gray-500 text-sm mt-5"
          >
            {activePromo
              ? `Promo activa · Quedan ${activePromo.remaining} de ${activePromo.maxUses} cupos · Sin tarjeta`
              : "Sin tarjeta · 7 días de prueba · Cancelás cuando quieras"}
          </motion.p>
        </motion.div>

        {/* Floating mock dashboard preview */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="relative max-w-5xl mx-auto mt-20 px-4"
        >
          <div className="relative rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-md p-1 shadow-[0_30px_80px_-20px_rgba(139,92,246,0.45)]">
            <div className="rounded-xl bg-[#0a0a14] overflow-hidden">
              <DashboardMock />
            </div>
          </div>
          {/* Underglow */}
          <div
            aria-hidden
            className="absolute inset-x-10 bottom-0 h-32 -z-10 blur-3xl opacity-60"
            style={{ background: "radial-gradient(closest-side, #8b5cf6, transparent 70%)" }}
          />
        </motion.div>
      </section>

      {/* ─────────── STATS ─────────── */}
      <section className="relative border-y border-white/5 bg-black/40 backdrop-blur-sm py-12">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <Counter to={500} suffix="+" label="Comercios activos" />
          <Counter to={1.2} suffix="M+" label="Ventas procesadas" decimals={1} />
          <Counter to={99.9} suffix="%" label="Uptime" decimals={1} />
          <Counter to={11} label="Métodos de pago" />
        </div>
      </section>

      {/* ─────────── MARQUEE ─────────── */}
      <Marquee />

      {/* ─────────── FEATURES (Bento) ─────────── */}
      <section id="features" className="relative py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            kicker="Funciones"
            title="Todo lo que tu negocio necesita"
            subtitle="Una sola herramienta reemplaza 5 sistemas diferentes"
          />
          <BentoGrid />
        </div>
      </section>

      {/* ─────────── USE CASES ─────────── */}
      <section className="relative py-24 px-6 border-y border-white/5 bg-black/40">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            kicker="Para todos"
            title="Para todo tipo de comercio"
            subtitle="Adaptado a la realidad de los negocios argentinos"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { emoji: "🏪", title: "Kioscos", desc: "Miles de productos chicos, alta rotación, ventas rápidas" },
              { emoji: "💊", title: "Farmacias", desc: "Inventario grande, clientes recurrentes, trazabilidad" },
              { emoji: "🥕", title: "Verdulerías", desc: "Precios por kg, productos variables, caja diaria" },
              { emoji: "🛒", title: "Minisúper", desc: "Múltiples categorías, empleados, control de stock" },
            ].map((u, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="spotlight-card p-6 rounded-2xl bg-white/[0.03] border border-white/10 text-center hover:border-white/30 transition-all"
              >
                <div className="text-4xl mb-3">{u.emoji}</div>
                <h3 className="font-semibold text-white mb-2">{u.title}</h3>
                <p className="text-gray-400 text-sm">{u.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────── PRICING ─────────── */}
      <section id="pricing" className="relative py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            kicker="Precios"
            title="Planes simples, sin sorpresas"
            subtitle="Empezá gratis. Crecé cuando lo necesites."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((p, i) => (
              <PricingCard key={i} plan={p} index={i} />
            ))}
          </div>
          <p className="text-center text-gray-500 text-xs mt-8">
            Pagos recurrentes en pesos por Mercado Pago · También aceptamos tarjeta internacional por
            Stripe · Ahorrás 20% pagando anual
          </p>
        </div>
      </section>

      {/* ─────────── FAQ ─────────── */}
      <section id="faq" className="relative py-24 px-6 border-t border-white/5">
        <div className="max-w-3xl mx-auto">
          <SectionHeading
            kicker="FAQ"
            title="Preguntas frecuentes"
            subtitle="Lo que más nos consultan los comerciantes"
            center
          />
          <div className="space-y-3">
            {FAQ_ITEMS.map((f, i) => (
              <motion.details
                key={i}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04, duration: 0.4 }}
                className="group bg-white/[0.03] rounded-xl border border-white/10 overflow-hidden open:border-white/30 hover:border-white/20 transition-colors"
              >
                <summary className="p-4 cursor-pointer text-white font-medium list-none flex items-center justify-between">
                  {f.q}
                  <span className="text-gray-500 group-open:rotate-45 transition-transform text-xl">+</span>
                </summary>
                <div className="px-4 pb-4 text-gray-400 text-sm leading-relaxed">{f.a}</div>
              </motion.details>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────── FINAL CTA ─────────── */}
      <section className="relative py-28 px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="conic-border max-w-4xl mx-auto"
        >
          <div className="relative rounded-[1.25rem] p-12 bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur overflow-hidden">
            <div
              className="absolute inset-0 pointer-events-none opacity-50"
              style={{
                backgroundImage:
                  "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
                backgroundSize: "18px 18px",
                maskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
              }}
            />
            <div className="relative text-center">
              <Sparkles className="w-8 h-8 text-violet-400 mx-auto mb-4 float-slow" />
              <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">Probalo gratis hoy</h2>
              <p className="text-gray-300 text-lg mb-8">
                Creás tu cuenta en 2 minutos. Sin tarjeta. Sin compromiso.
              </p>
              <div className="cta-glow inline-block">
                <Link
                  href={activePromo ? professionalHref : freeHref}
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white hover:bg-gray-100 text-black font-bold transition-all hover:scale-[1.03] active:scale-[0.98] shadow-2xl"
                >
                  {activePromo
                    ? `Reclamar ${mesesOdias(activePromo.daysGranted)} de ${activePromo.planLabel}`
                    : "Crear mi cuenta gratis"}{" "}
                  <ArrowRight size={18} />
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      <Footer />
    </div>
  )
}

/* ============================================================================
   Subcomponents
   ========================================================================== */

function Navbar({
  promoActive,
  promoCode,
  freeHref,
  professionalHref,
}: {
  promoActive: boolean
  promoCode?: string
  freeHref: string
  professionalHref: string
}) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 8)
    handler()
    window.addEventListener("scroll", handler, { passive: true })
    return () => window.removeEventListener("scroll", handler)
  }, [])

  return (
    <nav
      className={`fixed ${promoActive ? "top-9" : "top-0"} left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-black/70 backdrop-blur-xl border-b border-white/10"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href={promoCode ? `/?promo=${promoCode}` : "/"} className="flex items-center gap-2 group">
          <div className="relative w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center transition-transform group-hover:scale-110 group-hover:rotate-3">
            <ShoppingBag size={16} />
            <span className="absolute inset-0 rounded-lg bg-violet-500 opacity-0 group-hover:opacity-30 blur-md transition-opacity" />
          </div>
          <span className="font-bold text-lg tracking-tight">Orvex</span>
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
          <a href="#features" className="hover:text-white transition-colors relative group">
            Funciones
            <span className="absolute -bottom-1 left-0 w-0 h-px bg-white group-hover:w-full transition-all" />
          </a>
          <a href="#pricing" className="hover:text-white transition-colors relative group">
            Precios
            <span className="absolute -bottom-1 left-0 w-0 h-px bg-white group-hover:w-full transition-all" />
          </a>
          <a href="#faq" className="hover:text-white transition-colors relative group">
            FAQ
            <span className="absolute -bottom-1 left-0 w-0 h-px bg-white group-hover:w-full transition-all" />
          </a>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-gray-300 hover:text-white transition-colors">
            Ingresar
          </Link>
          <Link
            href={promoActive ? professionalHref : freeHref}
            className="px-4 py-2 rounded-lg bg-white hover:bg-gray-100 text-black text-sm font-semibold transition-all hover:scale-105"
          >
            {promoActive ? "Reclamar promo" : "Empezar gratis"}
          </Link>
        </div>
      </div>
    </nav>
  )
}

function Counter({
  to,
  suffix = "",
  decimals = 0,
  label,
}: {
  to: number
  suffix?: string
  decimals?: number
  label: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: "-50px" })
  const value = useMotionValue(0)
  const [display, setDisplay] = useState("0")

  useEffect(() => {
    if (!inView) return
    const controls = animate(value, to, {
      duration: 1.6,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v: number) => setDisplay(v.toFixed(decimals)),
    })
    return controls.stop
  }, [inView, to, decimals, value])

  return (
    <div ref={ref}>
      <p className="text-3xl md:text-4xl font-bold text-white tracking-tight tabular-nums">
        {display}
        {suffix}
      </p>
      <p className="text-gray-500 text-sm mt-1">{label}</p>
    </div>
  )
}

function Marquee() {
  const items = [
    "Mercado Pago",
    "MODO",
    "Ualá",
    "Cuenta DNI",
    "Naranja X",
    "AFIP",
    "Stripe",
    "WhatsApp",
    "Resend",
    "QR dinámico",
  ]
  return (
    <section className="relative py-10 border-b border-white/5 overflow-hidden">
      <p className="text-center text-xs uppercase tracking-[0.3em] text-gray-600 mb-6">
        Integrado con
      </p>
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-black to-transparent z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-black to-transparent z-10" />
        <div className="flex marquee-track gap-12 whitespace-nowrap">
          {[...items, ...items].map((it, i) => (
            <span
              key={i}
              className="text-gray-400 text-lg font-medium tracking-tight flex items-center gap-2"
            >
              <Cpu size={16} className="text-violet-400/70" /> {it}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

function SectionHeading({
  kicker,
  title,
  subtitle,
  center,
}: {
  kicker?: string
  title: string
  subtitle?: string
  center?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6 }}
      className={`mb-14 ${center ? "text-center" : "text-center"}`}
    >
      {kicker && (
        <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-violet-300 mb-3">
          <span className="h-px w-6 bg-violet-300/50" /> {kicker} <span className="h-px w-6 bg-violet-300/50" />
        </p>
      )}
      <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">{title}</h2>
      {subtitle && <p className="text-gray-400 text-lg">{subtitle}</p>}
    </motion.div>
  )
}

interface FeatureItem {
  icon: typeof ShoppingBag
  title: string
  desc: string
  span?: string
  glow: string
}

const FEATURES: FeatureItem[] = [
  {
    icon: ShoppingBag,
    title: "POS rápido",
    desc: "Escaneá códigos de barras, buscá productos en milisegundos. Efectivo, MP, MODO, Ualá, tarjetas.",
    span: "md:col-span-2 md:row-span-2",
    glow: "rgba(139, 92, 246, 0.35)",
  },
  {
    icon: Package,
    title: "Inventario automático",
    desc: "Stock en tiempo real. Alertas de stock bajo. Importá tu Excel en 30 segundos.",
    glow: "rgba(6, 182, 212, 0.3)",
  },
  {
    icon: BarChart3,
    title: "Reportes con IA",
    desc: "Ganancia neta, márgenes, top ventas. Análisis automático en lenguaje natural.",
    glow: "rgba(16, 185, 129, 0.3)",
  },
  {
    icon: CreditCard,
    title: "Caja con auditoría",
    desc: "Apertura, cierre, diferencias. Todo registrado.",
    glow: "rgba(245, 158, 11, 0.3)",
  },
  {
    icon: Users,
    title: "Clientes + fidelidad",
    desc: "Base integrada. Programa de puntos. Historial por cliente.",
    glow: "rgba(236, 72, 153, 0.3)",
  },
  {
    icon: Shield,
    title: "Multi-usuario seguro",
    desc: "Permisos por rol, auditoría completa.",
    glow: "rgba(59, 130, 246, 0.3)",
  },
  {
    icon: Smartphone,
    title: "Funciona en todo",
    desc: "Celular, tablet, notebook. Sin instalar nada.",
    glow: "rgba(217, 70, 239, 0.3)",
  },
  {
    icon: Store,
    title: "Pensado para Argentina",
    desc: "Pesos argentinos, CUIT, métodos locales.",
    glow: "rgba(14, 165, 233, 0.3)",
  },
]

function BentoGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 auto-rows-[180px] gap-4">
      {FEATURES.map((f, i) => (
        <BentoCard key={i} feature={f} index={i} />
      ))}
    </div>
  )
}

function BentoCard({ feature, index }: { feature: FeatureItem; index: number }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current
    if (!card) return
    const rect = card.getBoundingClientRect()
    card.style.setProperty("--mx", `${((e.clientX - rect.left) / rect.width) * 100}%`)
    card.style.setProperty("--my", `${((e.clientY - rect.top) / rect.height) * 100}%`)
  }
  const Icon = feature.icon
  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMove}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.04 }}
      className={`spotlight-card group relative p-6 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/30 backdrop-blur transition-all overflow-hidden ${feature.span ?? ""}`}
    >
      <div
        aria-hidden
        className="absolute -top-1/2 -right-1/2 w-full h-full rounded-full blur-3xl opacity-60"
        style={{
          background: `radial-gradient(circle, ${feature.glow} 0%, transparent 70%)`,
        }}
      />
      <div className="relative h-full flex flex-col">
        <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 group-hover:bg-white group-hover:text-black transition-colors">
          <Icon size={20} />
        </div>
        <h3 className="font-semibold text-white mb-2">{feature.title}</h3>
        <p className="text-gray-400 text-sm leading-relaxed">{feature.desc}</p>
      </div>
    </motion.div>
  )
}

function PricingCard({
  plan,
  index,
}: {
  plan: PlanCard
  index: number
}) {
  const inner = (
    <div className="relative h-full flex flex-col p-6 rounded-2xl bg-[rgb(8,8,14)]">
      {plan.highlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white text-black text-[10px] font-bold tracking-wider z-10">
          MÁS POPULAR
        </div>
      )}
      <h3 className="font-semibold text-white">{plan.plan}</h3>
      <p className="text-gray-500 text-sm mt-1">{plan.desc}</p>
      <div className="my-5">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold tracking-tight tabular-nums">{fmtARS(plan.price)}</span>
          {plan.price > 0 && <span className="text-gray-500 text-sm">/mes</span>}
        </div>
        {plan.price > 0 && <p className="text-[11px] text-gray-600 mt-1">IVA incluido</p>}
      </div>
      <ul className="space-y-2 mb-6 flex-1">
        {plan.features.map((f, j) => (
          <li key={j} className="flex items-start gap-2 text-sm text-gray-300">
            <CheckCircle size={14} className="text-violet-300 mt-0.5 shrink-0" />
            {f}
          </li>
        ))}
      </ul>
      <Link
        href={plan.href}
        className={`block text-center py-2.5 rounded-lg font-semibold text-sm transition-all hover:scale-[1.02] ${
          plan.highlight
            ? "bg-white hover:bg-gray-100 text-black"
            : "bg-white/5 hover:bg-white/10 border border-white/10 text-white"
        }`}
      >
        {plan.cta}
      </Link>
    </div>
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.06 }}
      whileHover={{ y: -4 }}
      className={plan.highlight ? "conic-border" : ""}
    >
      {plan.highlight ? (
        inner
      ) : (
        <div className="h-full rounded-2xl border border-white/10 bg-white/[0.03] hover:border-white/30 transition-colors">
          {inner}
        </div>
      )}
    </motion.div>
  )
}

function DashboardMock() {
  return (
    <div className="grid grid-cols-12 gap-px bg-white/5">
      {/* Sidebar */}
      <div className="col-span-2 bg-[#0a0a14] p-4 hidden md:block">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-6 h-6 rounded bg-white text-black flex items-center justify-center">
            <ShoppingBag size={12} />
          </div>
          <span className="text-xs font-bold">Orvex</span>
        </div>
        <div className="space-y-1.5">
          {["Inicio", "POS", "Inventario", "Ventas", "Reportes", "Caja"].map((s, i) => (
            <div
              key={i}
              className={`text-xs px-2 py-1.5 rounded ${
                i === 4 ? "bg-white/10 text-white" : "text-gray-500"
              }`}
            >
              {s}
            </div>
          ))}
        </div>
      </div>
      {/* Main */}
      <div className="col-span-12 md:col-span-10 bg-[#06060c] p-6 min-h-[300px]">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xs text-gray-500">Reportes · últimos 30 días</p>
            <p className="text-lg font-semibold">Hoy ganaste $42.180</p>
          </div>
          <div className="flex gap-2">
            <span className="text-[10px] px-2 py-1 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              +18% vs mes anterior
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-5">
          {[
            { label: "Ventas", value: "127" },
            { label: "Ingresos", value: "$284k" },
            { label: "Margen", value: "32%" },
            { label: "Ticket prom.", value: "$2.235" },
          ].map((k, i) => (
            <div key={i} className="rounded-lg bg-white/[0.03] border border-white/5 p-3">
              <p className="text-[10px] text-gray-500">{k.label}</p>
              <p className="text-base font-bold text-white tabular-nums">{k.value}</p>
            </div>
          ))}
        </div>

        {/* Fake chart */}
        <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3 h-28 flex items-end gap-1">
          {[40, 55, 35, 70, 45, 60, 80, 65, 50, 75, 90, 70, 85, 95].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t bg-gradient-to-t from-violet-500/40 to-violet-500/80"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

const FAQ_ITEMS = [
  {
    q: "¿Necesito instalar algo?",
    a: "No. Orvex funciona 100% en el navegador. Entrás con tu usuario desde cualquier dispositivo con internet.",
  },
  {
    q: "¿Qué pasa si no tengo internet?",
    a: "Necesitás internet para sincronizar las ventas. Tenemos modo offline parcial en el POS que guarda las ventas localmente y las sube cuando volvés a tener conexión.",
  },
  {
    q: "¿Puedo importar mis productos existentes?",
    a: "Sí, desde un CSV o Excel. Te damos una plantilla descargable. Importación masiva disponible desde el plan Básico.",
  },
  {
    q: "¿Cómo cobro por Mercado Pago?",
    a: "Integramos con todas las plataformas argentinas. Podés registrar ventas por MP, MODO, Ualá, Cuenta DNI, Naranja X y más. Además, desde el plan Profesional podés cobrar con QR de MP directo desde el POS.",
  },
  {
    q: "¿Qué pasa con mis datos si cancelo?",
    a: "Podés exportar toda tu información en cualquier momento. Guardamos tus datos 30 días después de la cancelación por si querés volver.",
  },
  {
    q: "¿Hay permanencia mínima?",
    a: "Ninguna. Cancelás cuando quieras, sin penalidad. Los pagos son mensuales o anuales (con 20% de descuento).",
  },
]

function Footer() {
  return (
    <footer className="relative border-t border-white/5 py-10 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-white text-black flex items-center justify-center">
            <ShoppingBag size={12} />
          </div>
          <span>Orvex © {new Date().getFullYear()}</span>
        </div>
        <div className="flex items-center gap-6">
          <a href="#pricing" className="hover:text-white transition-colors">
            Precios
          </a>
          <Link href="/login" className="hover:text-white transition-colors">
            Ingresar
          </Link>
          <a href="mailto:soporte@cobraorvex.com" className="hover:text-white transition-colors">
            Soporte
          </a>
        </div>
      </div>
    </footer>
  )
}
