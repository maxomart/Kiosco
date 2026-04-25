"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence, useInView, useMotionValue, useTransform, animate, useScroll } from "framer-motion"
import {
  ShoppingBag,
  Shield,
  Package,
  CreditCard,
  Users,
  BarChart3,
  CheckCircle,
  ArrowRight,
  Smartphone,
  Sparkles,
  PartyPopper,
  Cpu,
  QrCode,
  FileCheck2,
  Truck,
  TrendingDown,
  Building2,
  MessageCircle,
  FileSpreadsheet,
  Bot,
  Keyboard,
  Home,
  ShoppingCart,
  Receipt,
  DollarSign,
  Search,
  Store,
  Pill,
  Carrot,
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
      {/* Color blobs — soft, warm, commercial backdrop */}
      <ColorBlobs />

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
              "radial-gradient(700px circle at var(--mx) var(--my), rgba(251,146,60,0.14), transparent 45%)",
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
          <div className="relative rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-md p-1 shadow-[0_30px_80px_-20px_rgba(251,146,60,0.4)]">
            <div className="rounded-xl bg-[#0a0a14] overflow-hidden">
              <DashboardMock />
            </div>
          </div>
          {/* Underglow */}
          <div
            aria-hidden
            className="absolute inset-x-10 bottom-0 h-32 -z-10 blur-3xl opacity-60"
            style={{ background: "radial-gradient(closest-side, #fb923c, transparent 70%)" }}
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
              {
                icon: Store,
                title: "Kioscos",
                desc: "Miles de productos chicos, alta rotación, ventas rápidas",
                bg: "bg-violet-500/15",
                border: "border-violet-500/30",
                color: "text-violet-300",
              },
              {
                icon: Pill,
                title: "Farmacias",
                desc: "Inventario grande, clientes recurrentes, trazabilidad",
                bg: "bg-emerald-500/15",
                border: "border-emerald-500/30",
                color: "text-emerald-300",
              },
              {
                icon: Carrot,
                title: "Verdulerías",
                desc: "Precios por kg, productos variables, caja diaria",
                bg: "bg-orange-500/15",
                border: "border-orange-500/30",
                color: "text-orange-300",
              },
              {
                icon: ShoppingCart,
                title: "Minisúper",
                desc: "Múltiples categorías, empleados, control de stock",
                bg: "bg-sky-500/15",
                border: "border-sky-500/30",
                color: "text-sky-300",
              },
            ].map((u, i) => {
              const Icon = u.icon
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ delay: i * 0.08, duration: 0.5 }}
                  className="spotlight-card p-6 rounded-2xl bg-white/[0.03] border border-white/10 text-center hover:border-white/30 transition-all"
                >
                  <div
                    className={`w-14 h-14 rounded-2xl ${u.bg} border ${u.border} flex items-center justify-center mx-auto mb-4`}
                  >
                    <Icon size={26} className={u.color} />
                  </div>
                  <h3 className="font-semibold text-white mb-2">{u.title}</h3>
                  <p className="text-gray-400 text-sm">{u.desc}</p>
                </motion.div>
              )
            })}
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
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
          className="relative max-w-4xl mx-auto rounded-3xl overflow-hidden border border-violet-400/30 bg-gradient-to-br from-violet-500/10 via-fuchsia-500/5 to-transparent"
        >
          <div
            aria-hidden
            className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-60"
            style={{ background: "radial-gradient(circle, rgba(168,85,247,0.45), transparent 70%)", filter: "blur(40px)" }}
          />
          <div
            aria-hidden
            className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full opacity-50"
            style={{ background: "radial-gradient(circle, rgba(244,114,182,0.35), transparent 70%)", filter: "blur(40px)" }}
          />
          <div className="relative px-8 py-14 md:p-14 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/15 border border-violet-400/30 text-violet-200 text-xs mb-5">
              <Sparkles size={12} /> 7 días gratis · sin tarjeta
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
              Probalo en tu negocio hoy
            </h2>
            <p className="text-gray-300 text-lg mb-8 max-w-xl mx-auto">
              Creás tu cuenta en 2 minutos, cargás tus productos, empezás a vender. Sin instalar nada.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href={activePromo ? professionalHref : freeHref}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 text-white font-bold transition-all hover:scale-[1.03] active:scale-[0.98] shadow-2xl shadow-violet-500/40"
              >
                {activePromo
                  ? `Reclamar ${mesesOdias(activePromo.daysGranted)} de ${activePromo.planLabel}`
                  : "Crear mi cuenta gratis"}{" "}
                <ArrowRight size={18} />
              </Link>
              <Link
                href="#features"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold transition-colors"
              >
                Ver funciones
              </Link>
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

function ColorBlobs() {
  // Soft, slow-moving color blobs — give the dark canvas a warm, commercial
  // feel without going space-y. Five fixed positions, each blob drifts and
  // pulses on its own loop.
  const blobs = [
    { x: "8%",  y: "12%", size: 540, color: "rgba(251, 146, 60, 0.22)",  d: 18 }, // naranja durazno
    { x: "78%", y: "8%",  size: 520, color: "rgba(168, 85, 247, 0.22)",  d: 22 }, // violeta
    { x: "65%", y: "42%", size: 600, color: "rgba(34, 197, 94, 0.16)",   d: 20 }, // verde menta
    { x: "12%", y: "65%", size: 560, color: "rgba(251, 191, 36, 0.18)",  d: 24 }, // amarillo cálido
    { x: "70%", y: "85%", size: 580, color: "rgba(192, 132, 252, 0.20)", d: 19 }, // lavanda
  ]
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden>
      {blobs.map((b, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: b.x,
            top: b.y,
            width: `${b.size}px`,
            height: `${b.size}px`,
            transform: "translate(-50%, -50%)",
            background: `radial-gradient(circle, ${b.color} 0%, transparent 65%)`,
            filter: "blur(40px)",
            animation: `blob-drift ${b.d}s ease-in-out ${i * 0.7}s infinite`,
          }}
        />
      ))}
      {/* Subtle dotted noise overlay — a tiny bit of texture so the dark
          canvas does not feel empty */}
      <div
        className="absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
    </div>
  )
}

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
            <span className="absolute inset-0 rounded-lg bg-violet-500 opacity-0 group-hover:opacity-40 blur-md transition-opacity" />
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
  // tailwind utility classes — written out so the JIT picks them up
  iconBg: string
  iconBorder: string
  iconText: string
  glow: string
}

const FEATURES: FeatureItem[] = [
  {
    icon: ShoppingBag,
    title: "POS rápido",
    desc: "Escaneá códigos de barras y cobrás en segundos.",
    iconBg: "bg-violet-500/15",
    iconBorder: "border-violet-500/30",
    iconText: "text-violet-300",
    glow: "rgba(139, 92, 246, 0.32)",
  },
  {
    icon: Package,
    title: "Inventario en tiempo real",
    desc: "Stock se actualiza con cada venta. Alertas de stock bajo. Importá tu Excel en 30 segundos.",
    iconBg: "bg-cyan-500/15",
    iconBorder: "border-cyan-500/30",
    iconText: "text-cyan-300",
    glow: "rgba(6, 182, 212, 0.28)",
  },
  {
    icon: BarChart3,
    title: "Reportes con IA",
    desc: "Análisis en lenguaje natural. Margen, top productos, comparación con mes pasado.",
    iconBg: "bg-emerald-500/15",
    iconBorder: "border-emerald-500/30",
    iconText: "text-emerald-300",
    glow: "rgba(16, 185, 129, 0.28)",
  },
  {
    icon: CreditCard,
    title: "Caja con auditoría",
    desc: "Apertura, cierre, diferencias. Todo registrado por turno y empleado.",
    iconBg: "bg-amber-500/15",
    iconBorder: "border-amber-500/30",
    iconText: "text-amber-300",
    glow: "rgba(245, 158, 11, 0.28)",
  },
  {
    icon: Users,
    title: "Clientes + fidelidad",
    desc: "Base integrada. Programa de puntos. Historial por cliente.",
    iconBg: "bg-pink-500/15",
    iconBorder: "border-pink-500/30",
    iconText: "text-pink-300",
    glow: "rgba(236, 72, 153, 0.28)",
  },
  {
    icon: QrCode,
    title: "Cobrar con QR de MP",
    desc: "Tu QR de Mercado Pago integrado al POS. El cliente escanea, vos confirmás.",
    iconBg: "bg-sky-500/15",
    iconBorder: "border-sky-500/30",
    iconText: "text-sky-300",
    glow: "rgba(14, 165, 233, 0.28)",
  },
  {
    icon: FileCheck2,
    title: "Facturación AFIP",
    desc: "Emití facturas A/B/C con CAE en segundos, desde el mismo POS.",
    iconBg: "bg-orange-500/15",
    iconBorder: "border-orange-500/30",
    iconText: "text-orange-300",
    glow: "rgba(249, 115, 22, 0.28)",
  },
  {
    icon: TrendingDown,
    title: "Gastos y proveedores",
    desc: "Registrá egresos por proveedor. Margen real, no sólo facturación bruta.",
    iconBg: "bg-rose-500/15",
    iconBorder: "border-rose-500/30",
    iconText: "text-rose-300",
    glow: "rgba(244, 63, 94, 0.28)",
  },
  {
    icon: Truck,
    title: "Cargas virtuales",
    desc: "Vendé saldo de celular, transporte, gift cards. Pagos al instante.",
    iconBg: "bg-teal-500/15",
    iconBorder: "border-teal-500/30",
    iconText: "text-teal-300",
    glow: "rgba(20, 184, 166, 0.28)",
  },
  {
    icon: Building2,
    title: "Multi-tienda",
    desc: "Gestioná varias sucursales desde la misma cuenta. Reportes consolidados.",
    iconBg: "bg-indigo-500/15",
    iconBorder: "border-indigo-500/30",
    iconText: "text-indigo-300",
    glow: "rgba(99, 102, 241, 0.28)",
  },
  {
    icon: Bot,
    title: "Asistente de IA",
    desc: "Preguntá en español: «¿qué se vendió ayer?», «top productos del mes». Responde al toque.",
    iconBg: "bg-fuchsia-500/15",
    iconBorder: "border-fuchsia-500/30",
    iconText: "text-fuchsia-300",
    glow: "rgba(217, 70, 239, 0.28)",
  },
  {
    icon: MessageCircle,
    title: "Alertas por email",
    desc: "Resumen diario, semanal, mensual + alertas de stock bajo a tu inbox.",
    iconBg: "bg-lime-500/15",
    iconBorder: "border-lime-500/30",
    iconText: "text-lime-300",
    glow: "rgba(132, 204, 22, 0.28)",
  },
  {
    icon: Shield,
    title: "Multi-usuario seguro",
    desc: "Cada empleado con su cuenta y permisos. Auditoría completa.",
    iconBg: "bg-blue-500/15",
    iconBorder: "border-blue-500/30",
    iconText: "text-blue-300",
    glow: "rgba(59, 130, 246, 0.28)",
  },
  {
    icon: Smartphone,
    title: "Funciona en todo",
    desc: "Celular, tablet, notebook, PC. Sin instalar nada.",
    iconBg: "bg-purple-500/15",
    iconBorder: "border-purple-500/30",
    iconText: "text-purple-300",
    glow: "rgba(168, 85, 247, 0.28)",
  },
  {
    icon: FileSpreadsheet,
    title: "Importar / exportar Excel",
    desc: "Subí tu lista de productos en CSV o Excel. Exportá ventas, stock, clientes.",
    iconBg: "bg-green-500/15",
    iconBorder: "border-green-500/30",
    iconText: "text-green-300",
    glow: "rgba(34, 197, 94, 0.28)",
  },
  {
    icon: Keyboard,
    title: "Atajos de teclado",
    desc: "F1 buscar producto, F2 cobrar, F3 cliente. Configurable.",
    iconBg: "bg-yellow-500/15",
    iconBorder: "border-yellow-500/30",
    iconText: "text-yellow-300",
    glow: "rgba(234, 179, 8, 0.28)",
  },
]

function BentoGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
        <div
          className={`w-11 h-11 rounded-xl ${feature.iconBg} border ${feature.iconBorder} flex items-center justify-center mb-4 transition-transform group-hover:scale-110`}
        >
          <Icon size={20} className={feature.iconText} />
        </div>
        <h3 className="font-semibold text-white mb-2">{feature.title}</h3>
        <p className="text-gray-400 text-sm leading-relaxed">{feature.desc}</p>
      </div>
    </motion.div>
  )
}

function PricingCard({ plan, index }: { plan: PlanCard; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.06 }}
      whileHover={{ y: -4 }}
      className={`relative h-full rounded-2xl border transition-colors ${
        plan.highlight
          ? "border-violet-400/60 bg-gradient-to-b from-violet-500/[0.10] to-transparent shadow-[0_20px_60px_-20px_rgba(168,85,247,0.55)]"
          : "border-white/10 bg-white/[0.03] hover:border-white/25"
      }`}
    >
      <div className="relative h-full flex flex-col p-6">
        {plan.highlight && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-[10px] font-bold tracking-wider shadow-lg shadow-violet-500/40">
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
              <CheckCircle
                size={14}
                className={`mt-0.5 shrink-0 ${plan.highlight ? "text-violet-300" : "text-emerald-300"}`}
              />
              {f}
            </li>
          ))}
        </ul>
        <Link
          href={plan.href}
          className={`block text-center py-2.5 rounded-lg font-semibold text-sm transition-all hover:scale-[1.02] ${
            plan.highlight
              ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 text-white shadow-lg shadow-violet-500/30"
              : "bg-white/5 hover:bg-white/10 border border-white/10 text-white"
          }`}
        >
          {plan.cta}
        </Link>
      </div>
    </motion.div>
  )
}

type MockTab = "inicio" | "pos" | "inventario" | "ventas" | "reportes" | "caja"

const MOCK_TABS: { id: MockTab; label: string; icon: typeof Home }[] = [
  { id: "inicio", label: "Inicio", icon: Home },
  { id: "pos", label: "POS", icon: ShoppingCart },
  { id: "inventario", label: "Inventario", icon: Package },
  { id: "ventas", label: "Ventas", icon: Receipt },
  { id: "reportes", label: "Reportes", icon: BarChart3 },
  { id: "caja", label: "Caja", icon: DollarSign },
]

const TABS_ORDER: MockTab[] = ["reportes", "pos", "inventario", "ventas", "caja", "inicio"]

function DashboardMock() {
  const [tab, setTab] = useState<MockTab>("reportes")
  const [autoplay, setAutoplay] = useState(true)

  // Cycle through every tab while autoplay is on. Click on any tab pauses
  // the cycle so visitors can read at their own pace.
  useEffect(() => {
    if (!autoplay) return
    const id = window.setInterval(() => {
      setTab((current) => {
        const idx = TABS_ORDER.indexOf(current)
        return TABS_ORDER[(idx + 1) % TABS_ORDER.length]
      })
    }, 3200)
    return () => window.clearInterval(id)
  }, [autoplay])

  const handleTabClick = (id: MockTab) => {
    setAutoplay(false)
    setTab(id)
  }

  return (
    <div className="grid grid-cols-12 gap-px bg-white/5 min-h-[360px]">
      {/* Sidebar */}
      <div className="col-span-3 md:col-span-2 bg-[#0a0a14] p-3 md:p-4">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-6 h-6 rounded bg-white text-black flex items-center justify-center">
            <ShoppingBag size={12} />
          </div>
          <span className="text-xs font-bold hidden md:inline">Orvex</span>
        </div>
        <div className="space-y-1">
          {MOCK_TABS.map((t) => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handleTabClick(t.id)}
                className={`relative w-full flex items-center gap-2 text-[11px] px-2 py-1.5 rounded transition-all overflow-hidden ${
                  active
                    ? "bg-violet-500/15 text-violet-200 border border-violet-500/30"
                    : "text-gray-500 hover:text-gray-200 hover:bg-white/5 border border-transparent"
                }`}
              >
                <Icon size={12} className="shrink-0" />
                <span className="truncate hidden md:inline">{t.label}</span>
                {active && autoplay && (
                  <motion.span
                    key={`bar-${t.id}`}
                    aria-hidden
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 3.2, ease: "linear" }}
                    style={{ transformOrigin: "left" }}
                    className="absolute left-0 bottom-0 h-px w-full bg-gradient-to-r from-violet-400 to-fuchsia-400"
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Main */}
      <div className="col-span-9 md:col-span-10 bg-[#06060c] p-5 md:p-6 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {tab === "inicio" && <MockInicio />}
            {tab === "pos" && <MockPos />}
            {tab === "inventario" && <MockInventario />}
            {tab === "ventas" && <MockVentas />}
            {tab === "reportes" && <MockReportes />}
            {tab === "caja" && <MockCaja />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

function MockHeader({
  kicker,
  title,
  badge,
  badgeTone = "emerald",
}: {
  kicker: string
  title: string
  badge?: string
  badgeTone?: "emerald" | "amber" | "violet"
}) {
  const toneMap = {
    emerald: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    violet: "bg-violet-500/10 text-violet-300 border-violet-500/20",
  }
  return (
    <div className="flex items-start justify-between mb-4 gap-3">
      <div className="min-w-0">
        <p className="text-[10px] text-gray-500 truncate">{kicker}</p>
        <p className="text-base md:text-lg font-semibold truncate">{title}</p>
      </div>
      {badge && (
        <span
          className={`shrink-0 text-[10px] px-2 py-1 rounded border whitespace-nowrap ${toneMap[badgeTone]}`}
        >
          {badge}
        </span>
      )}
    </div>
  )
}

function MockInicio() {
  return (
    <>
      <MockHeader
        kicker="Inicio · resumen del día"
        title="¡Buen día! Ya van 23 ventas"
        badge="Caja abierta"
        badgeTone="emerald"
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        {[
          { label: "Ventas hoy", value: "23", color: "text-violet-300" },
          { label: "Ingresos", value: "$58.4k", color: "text-emerald-300" },
          { label: "En caja", value: "$24.1k", color: "text-amber-300" },
          { label: "Stock bajo", value: "3", color: "text-rose-300" },
        ].map((k, i) => (
          <div key={i} className="rounded-lg bg-white/[0.03] border border-white/5 p-2.5">
            <p className="text-[10px] text-gray-500">{k.label}</p>
            <p className={`text-base font-bold tabular-nums ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg bg-gradient-to-br from-violet-500/10 to-fuchsia-500/5 border border-violet-500/20 p-3">
        <div className="flex items-start gap-2">
          <Sparkles size={14} className="text-violet-300 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-violet-200">Tip del día</p>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Coca 500ml lleva 4 días con stock crítico. Reabastecé antes del finde — es tu top
              ventas.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

function MockPos() {
  const items = [
    { name: "Coca Cola 500ml", qty: 2, price: 950 },
    { name: "Sándwich miga jamón", qty: 1, price: 1800 },
    { name: "Marlboro Box 20", qty: 1, price: 2400 },
  ]
  const total = items.reduce((s, i) => s + i.qty * i.price, 0)
  return (
    <>
      <MockHeader kicker="POS · venta en curso" title="Cobrá rápido" badge="3 productos" badgeTone="violet" />
      <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3 mb-3">
        <div className="flex items-center gap-2 mb-2.5">
          <Search size={12} className="text-gray-500" />
          <span className="text-[11px] text-gray-500">Buscar producto o escanear...</span>
        </div>
        <div className="space-y-1.5">
          {items.map((it, i) => (
            <div key={i} className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-5 h-5 rounded bg-violet-500/15 text-violet-300 flex items-center justify-center text-[10px] font-bold">
                  {it.qty}
                </span>
                <span className="text-gray-200 truncate">{it.name}</span>
              </div>
              <span className="text-gray-300 tabular-nums shrink-0 ml-2">
                ${(it.qty * it.price).toLocaleString("es-AR")}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] text-gray-500">Total</p>
          <p className="text-2xl font-bold tabular-nums text-white">
            ${total.toLocaleString("es-AR")}
          </p>
        </div>
        <button className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-400 to-orange-400 text-black text-xs font-bold shadow-lg shadow-amber-500/30 pointer-events-none">
          Cobrar (F2)
        </button>
      </div>
    </>
  )
}

function MockInventario() {
  const products = [
    { name: "Coca Cola 500ml", stock: 4, min: 12, status: "low" as const },
    { name: "Galletitas Oreo", stock: 28, min: 10, status: "ok" as const },
    { name: "Marlboro Box 20", stock: 1, min: 6, status: "critical" as const },
    { name: "Agua Villavicencio 1.5L", stock: 18, min: 8, status: "ok" as const },
  ]
  return (
    <>
      <MockHeader
        kicker="Inventario · 487 productos"
        title="Stock en tiempo real"
        badge="3 críticos"
        badgeTone="amber"
      />
      <div className="rounded-lg bg-white/[0.03] border border-white/5 overflow-hidden">
        {products.map((p, i) => (
          <div
            key={i}
            className={`flex items-center justify-between p-2.5 text-[11px] ${
              i < products.length - 1 ? "border-b border-white/5" : ""
            }`}
          >
            <div className="min-w-0">
              <p className="text-gray-200 truncate">{p.name}</p>
              <p className="text-[10px] text-gray-500">Mínimo: {p.min}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-gray-300 tabular-nums">{p.stock}</span>
              {p.status === "critical" && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">
                  Crítico
                </span>
              )}
              {p.status === "low" && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Bajo
                </span>
              )}
              {p.status === "ok" && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  OK
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function MockVentas() {
  const sales = [
    { time: "14:32", method: "MP QR", amount: 4150 },
    { time: "14:18", method: "Efectivo", amount: 2400 },
    { time: "14:05", method: "Débito", amount: 8900 },
    { time: "13:51", method: "MODO", amount: 1750 },
    { time: "13:42", method: "Efectivo", amount: 3300 },
  ]
  const methodColor: Record<string, string> = {
    "MP QR": "text-sky-300",
    Efectivo: "text-emerald-300",
    Débito: "text-violet-300",
    MODO: "text-amber-300",
  }
  return (
    <>
      <MockHeader kicker="Ventas · hoy" title="Últimas operaciones" badge="23 ventas" badgeTone="violet" />
      <div className="rounded-lg bg-white/[0.03] border border-white/5 overflow-hidden">
        {sales.map((s, i) => (
          <div
            key={i}
            className={`flex items-center justify-between p-2.5 text-[11px] ${
              i < sales.length - 1 ? "border-b border-white/5" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-gray-500 tabular-nums">{s.time}</span>
              <span className={`font-medium ${methodColor[s.method] ?? "text-gray-300"}`}>
                {s.method}
              </span>
            </div>
            <span className="text-white tabular-nums font-semibold">
              ${s.amount.toLocaleString("es-AR")}
            </span>
          </div>
        ))}
      </div>
    </>
  )
}

function MockReportes() {
  return (
    <>
      <MockHeader
        kicker="Reportes · últimos 30 días"
        title="Hoy ganaste $42.180"
        badge="+18% vs mes anterior"
        badgeTone="emerald"
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        {[
          { label: "Ventas", value: "127" },
          { label: "Ingresos", value: "$284k" },
          { label: "Margen", value: "32%" },
          { label: "Ticket prom.", value: "$2.235" },
        ].map((k, i) => (
          <div key={i} className="rounded-lg bg-white/[0.03] border border-white/5 p-2.5">
            <p className="text-[10px] text-gray-500">{k.label}</p>
            <p className="text-base font-bold text-white tabular-nums">{k.value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3 h-24 flex items-end gap-1">
        {[40, 55, 35, 70, 45, 60, 80, 65, 50, 75, 90, 70, 85, 95].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-gradient-to-t from-emerald-500/50 to-emerald-400/90"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </>
  )
}

function MockCaja() {
  return (
    <>
      <MockHeader
        kicker="Caja · turno tarde"
        title="Sesión abierta hace 3h 24m"
        badge="Sin diferencias"
        badgeTone="emerald"
      />
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { label: "Efectivo", value: "$24.150", color: "text-emerald-300" },
          { label: "Digital", value: "$58.480", color: "text-violet-300" },
          { label: "Total", value: "$82.630", color: "text-white" },
        ].map((k, i) => (
          <div key={i} className="rounded-lg bg-white/[0.03] border border-white/5 p-2.5">
            <p className="text-[10px] text-gray-500">{k.label}</p>
            <p className={`text-base font-bold tabular-nums ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3 flex items-center gap-2">
        <CheckCircle size={14} className="text-emerald-300 shrink-0" />
        <p className="text-[11px] text-emerald-200">
          Esperado: <span className="tabular-nums font-semibold">$24.150</span> · Contado:{" "}
          <span className="tabular-nums font-semibold">$24.150</span> · Diferencia:{" "}
          <span className="tabular-nums font-semibold">$0</span>
        </p>
      </div>
    </>
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
