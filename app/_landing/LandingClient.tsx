"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion"
import { OrvexLogo } from "@/components/shared/OrvexLogo"
import {
  ArrowRight,
  CheckCircle,
  Search,
  Truck,
  AlertTriangle,
  PartyPopper,
  FileSpreadsheet,
  GitMerge,
  ImageIcon,
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
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 80])

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden relative landing-root selection:bg-violet-500/30 selection:text-white">
      <ColorBlobs />

      {/* Promo top strip */}
      {activePromo && (
        <Link
          href={professionalHref}
          className="fixed top-0 inset-x-0 z-[60] block bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500 text-black"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-9 flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold">
            <PartyPopper size={14} />
            <span>
              Promo activa: {mesesOdias(activePromo.daysGranted)} de {activePromo.planLabel} sin
              cargo · quedan {activePromo.remaining} cupos
            </span>
          </div>
        </Link>
      )}

      <Navbar
        promoActive={!!activePromo}
        promoCode={promoCode}
        freeHref={freeHref}
        professionalHref={professionalHref}
      />

      {/* ─────────── HERO — split asimétrico, sin centro, sin marketing
          fluff. La columna izquierda es una declaración cruda; la derecha
          muestra la app ya en acción para que se entienda en 2 segundos
          de qué se trata. ─────────── */}
      <section
        ref={heroRef}
        className={`relative ${activePromo ? "pt-28 sm:pt-32" : "pt-24 sm:pt-28"} pb-16 sm:pb-24 px-5 sm:px-6 overflow-hidden`}
      >
        <motion.div
          style={{ y: heroY }}
          className="relative max-w-6xl mx-auto grid md:grid-cols-12 gap-10 md:gap-12 items-center"
        >
          {/* LEFT — declaración */}
          <div className="md:col-span-6 lg:col-span-5">
            <div className="flex items-center gap-2 mb-6">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <span className="text-[11px] uppercase tracking-[0.2em] text-gray-400 font-medium">
                en vivo desde un kiosco de san telmo
              </span>
            </div>

            <RotatingHeadline />

            <p className="text-base sm:text-lg text-gray-400 mb-7 leading-relaxed max-w-md">
              Orvex es un sistema para kioscos, almacenes y comercios chicos
              argentinos. Sin papel, sin Excel del 2009.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-5">
              <Link
                href={activePromo ? professionalHref : freeHref}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white hover:bg-gray-100 text-black font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {activePromo
                  ? `Reclamar ${mesesOdias(activePromo.daysGranted)} gratis`
                  : "Empezar gratis"}{" "}
                <ArrowRight size={16} />
              </Link>
              <Link
                href="#dia"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-white font-semibold transition-colors"
              >
                Ver un día real
              </Link>
            </div>

            <p className="text-gray-500 text-xs sm:text-sm">
              Sin tarjeta · Probás 7 días los planes pagos · Cancelás cuando se te canta
            </p>
          </div>

          {/* RIGHT — la app, viva */}
          <div className="md:col-span-6 lg:col-span-7 relative">
            <HeroLiveScreen />
          </div>
        </motion.div>
      </section>

      {/* ─────────── DÍA EN EL KIOSCO ─────────── */}
      <section id="dia" className="relative py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <p className="inline-flex items-center gap-2 text-[10px] sm:text-xs uppercase tracking-[0.25em] text-violet-300/80 mb-3">
              <span className="h-px w-6 bg-violet-300/40" /> un día normal <span className="h-px w-6 bg-violet-300/40" />
            </p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
              <span className="block sm:inline">Esto pasa entre las 7 de la mañana</span>{" "}
              <span className="block sm:inline">y las once de la noche.</span>
            </h2>
            <p className="text-gray-400 mt-3 sm:mt-4 max-w-xl mx-auto text-sm sm:text-base">
              Cada momento es una pantalla real de la app. Si te enganchás con alguna, ya sabés para qué sirve.
            </p>
          </div>

          <div className="space-y-12 sm:space-y-20">
            {SCENES.map((s, i) => (
              <Scene key={s.time} scene={s} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ─────────── HONESTIDAD ─────────── */}
      <section className="relative py-20 sm:py-28 px-4 sm:px-6 border-y border-white/5 bg-black/40">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10 sm:mb-12">
            <p className="inline-flex items-center gap-2 text-[10px] sm:text-xs uppercase tracking-[0.25em] text-gray-500 mb-3">
              <span className="h-px w-6 bg-gray-700" /> sin verso <span className="h-px w-6 bg-gray-700" />
            </p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
              Lo que <span className="text-rose-300">no</span> te vamos a decir.
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {HONESTY.map((h, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                className={`rounded-2xl border p-5 sm:p-6 ${
                  h.kind === "no"
                    ? "border-rose-500/20 bg-rose-500/[0.04]"
                    : "border-emerald-500/20 bg-emerald-500/[0.04]"
                }`}
              >
                <p
                  className={`text-[10px] uppercase tracking-[0.25em] font-semibold mb-2 ${
                    h.kind === "no" ? "text-rose-300" : "text-emerald-300"
                  }`}
                >
                  {h.kind === "no" ? "no decimos" : "sí te garantizamos"}
                </p>
                <p className="text-white font-semibold leading-tight mb-2">{h.title}</p>
                <p className="text-gray-400 text-sm leading-relaxed">{h.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────── PRICING ─────────── */}
      <section id="pricing" className="relative py-20 sm:py-28 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <p className="inline-flex items-center gap-2 text-[10px] sm:text-xs uppercase tracking-[0.25em] text-violet-300/80 mb-3">
              <span className="h-px w-6 bg-violet-300/40" /> precios <span className="h-px w-6 bg-violet-300/40" />
            </p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-3">
              En pesos. Sin sustos.
            </h2>
            <p className="text-gray-400 text-sm sm:text-base max-w-xl mx-auto">
              Empezás gratis. Si crecés, cambiás de plan. Si no te sirve, te bajás cuando quieras.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((p, i) => (
              <PricingCard key={i} plan={p} index={i} />
            ))}
          </div>
          <p className="text-center text-gray-600 text-[11px] sm:text-xs mt-8">
            Cobramos por Mercado Pago en pesos · Tarjeta internacional vía Stripe · 20% de descuento
            si pagás anual
          </p>
        </div>
      </section>

      {/* ─────────── PREGUNTAS REALES ─────────── */}
      <section id="faq" className="relative py-20 sm:py-28 px-4 sm:px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="inline-flex items-center gap-2 text-[10px] sm:text-xs uppercase tracking-[0.25em] text-gray-500 mb-3">
              <span className="h-px w-6 bg-gray-700" /> nos preguntan <span className="h-px w-6 bg-gray-700" />
            </p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
              Lo que más nos consultan.
            </h2>
          </div>
          <div className="space-y-4">
            {QUESTIONS.map((q, i) => (
              <motion.details
                key={i}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04, duration: 0.4 }}
                className="group bg-white/[0.03] rounded-2xl border border-white/10 overflow-hidden open:border-white/25 hover:border-white/15 transition-colors"
              >
                <summary className="px-5 py-4 cursor-pointer text-white font-medium list-none flex items-center justify-between gap-3">
                  <span className="flex-1">{q.q}</span>
                  <span className="text-gray-500 group-open:rotate-45 transition-transform text-xl">+</span>
                </summary>
                <div className="px-5 pb-5 text-gray-400 text-sm leading-relaxed">{q.a}</div>
              </motion.details>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────── FINAL CTA ─────────── */}
      <section className="relative py-20 sm:py-28 px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative max-w-3xl mx-auto rounded-3xl overflow-hidden border border-white/10 bg-white/[0.02]"
        >
          <div className="relative px-6 sm:px-10 py-12 sm:py-16 text-center">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 tracking-tight">
              ¿Lo probás un rato?
            </h2>
            <p className="text-gray-400 text-sm sm:text-base mb-8 max-w-md mx-auto">
              Te lleva dos minutos crearte la cuenta. Si después no te convence, cerrás y listo —
              no te pedimos tarjeta para arrancar.
            </p>
            <Link
              href={activePromo ? professionalHref : freeHref}
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-white text-black font-semibold transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {activePromo
                ? `Reclamar ${mesesOdias(activePromo.daysGranted)} gratis`
                : "Crear mi cuenta"}{" "}
              <ArrowRight size={16} />
            </Link>
          </div>
        </motion.div>
      </section>

      <Footer />
    </div>
  )
}

/* ============================================================================
   ROTATING HEADLINE — el H1 cicla cada ~5s entre cuatro frases que
   muestran ángulos distintos del producto. La forma se mantiene (3
   líneas, las dos últimas con gradientes distintos) así no salta el
   layout. Pausa cuando la pestaña no está visible para no quemar batería.
   ========================================================================== */

const HEADLINE_PHRASES: [string, string, string][] = [
  ["Vos atendés.", "La app cuenta,", "suma y te avisa."],
  ["Vos vendés.", "La app cobra,", "cierra y archiva."],
  ["Vos pedís stock.", "La app sabe", "qué te falta."],
  ["Vos abrís el lunes.", "La app sabe", "qué hizo el sábado."],
]

function RotatingHeadline() {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    const tick = () => setIdx((i) => (i + 1) % HEADLINE_PHRASES.length)
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") tick()
    }, 5000)
    return () => window.clearInterval(id)
  }, [])

  const phrase = HEADLINE_PHRASES[idx]
  return (
    <h1 className="text-[2.6rem] leading-[0.98] sm:text-5xl lg:text-[3.7rem] font-bold tracking-tight mb-7 min-h-[10rem] sm:min-h-[12rem] lg:min-h-[14rem]">
      <AnimatePresence mode="wait">
        <motion.span
          key={idx}
          initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="block"
        >
          <span className="block">{phrase[0]}</span>
          <span className="block bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 bg-clip-text text-transparent">
            {phrase[1]}
          </span>
          <span className="block bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-300 bg-clip-text text-transparent">
            {phrase[2]}
          </span>
        </motion.span>
      </AnimatePresence>
    </h1>
  )
}

/* ============================================================================
   HERO LIVE SCREEN — la app respirando. Una venta nueva aparece arriba
   cada ~3.5s, las viejas bajan y se pierden. Total y contador suben con
   cada venta. Mantiene la sensación de "esto está vivo" sin necesidad
   de copy explicando que la app funciona.
   ========================================================================== */

type LiveSale = { id: number; time: string; method: string; product: string; amount: number }

const LIVE_QUEUE: Omit<LiveSale, "id" | "time">[] = [
  { method: "MODO", product: "Coca 500 + alfajor", amount: 1800 },
  { method: "Efectivo", product: "Marlboro Box", amount: 2400 },
  { method: "MP QR", product: "Sándwich miga + agua", amount: 3650 },
  { method: "Débito", product: "Cargas SUBE", amount: 5000 },
  { method: "MODO", product: "Galletitas Oreo × 2", amount: 1900 },
  { method: "Efectivo", product: "Caramelos Sugus", amount: 350 },
  { method: "Naranja X", product: "Heladera completa", amount: 8200 },
  { method: "MP QR", product: "Cigarrillos + cerveza", amount: 4750 },
]

const METHOD_COLOR: Record<string, string> = {
  MODO: "text-amber-300",
  "MP QR": "text-sky-300",
  Efectivo: "text-emerald-300",
  Débito: "text-violet-300",
  "Naranja X": "text-orange-300",
}

function nowAR(offsetMin: number): string {
  const d = new Date(Date.now() - offsetMin * 60 * 1000)
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`
}

function HeroLiveScreen() {
  // Pre-fill with 5 historic-feeling sales so the panel never looks empty.
  const [sales, setSales] = useState<LiveSale[]>(() =>
    Array.from({ length: 5 }, (_, i) => {
      const tpl = LIVE_QUEUE[i % LIVE_QUEUE.length]
      return { id: i, time: nowAR((i + 1) * 7), ...tpl }
    })
  )
  const [counter, setCounter] = useState({ count: 23, total: 58420 })
  const idRef = useRef(100)
  const queueRef = useRef(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      const tpl = LIVE_QUEUE[queueRef.current % LIVE_QUEUE.length]
      queueRef.current += 1
      const newSale: LiveSale = {
        id: idRef.current++,
        time: nowAR(0),
        ...tpl,
      }
      setSales((prev) => [newSale, ...prev].slice(0, 5))
      setCounter((c) => ({ count: c.count + 1, total: c.total + tpl.amount }))
    }, 3500)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="relative">
      {/* underglow */}
      <div
        aria-hidden
        className="absolute inset-x-12 -bottom-8 h-32 -z-10 blur-3xl opacity-60"
        style={{ background: "radial-gradient(closest-side, #6366f1, transparent 70%)" }}
      />
      {/* Frame */}
      <div className="relative rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-1 backdrop-blur-md shadow-[0_30px_80px_-30px_rgba(99,102,241,0.5)]">
        <div className="rounded-xl bg-[#08080f] overflow-hidden">
          {/* Top bar */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/60" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400/60" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
            </div>
            <p className="text-[10px] text-gray-500 font-mono truncate">orvex.com / ventas / hoy</p>
            <span className="w-12" />
          </div>

          <div className="p-4 sm:p-5">
            {/* KPI strip */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="rounded-lg bg-white/[0.03] border border-white/5 p-2.5">
                <p className="text-[10px] text-gray-500 mb-0.5">Ventas hoy</p>
                <motion.p
                  key={counter.count}
                  initial={{ opacity: 0.6, y: -2 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="text-base font-bold tabular-nums text-violet-300"
                >
                  {counter.count}
                </motion.p>
              </div>
              <div className="rounded-lg bg-white/[0.03] border border-white/5 p-2.5">
                <p className="text-[10px] text-gray-500 mb-0.5">Ingresos</p>
                <motion.p
                  key={counter.total}
                  initial={{ opacity: 0.6, y: -2 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="text-base font-bold tabular-nums text-emerald-300"
                >
                  ${(counter.total / 1000).toFixed(1)}k
                </motion.p>
              </div>
              <div className="rounded-lg bg-white/[0.03] border border-white/5 p-2.5">
                <p className="text-[10px] text-gray-500 mb-0.5">Stock bajo</p>
                <p className="text-base font-bold tabular-nums text-amber-300">3</p>
              </div>
            </div>

            {/* Live sales feed */}
            <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500 mb-2">
              últimas operaciones
            </p>
            <div className="rounded-lg bg-white/[0.02] border border-white/5 overflow-hidden">
              <AnimatePresence initial={false}>
                {sales.map((s) => (
                  <motion.div
                    key={s.id}
                    layout
                    initial={{ opacity: 0, y: -16, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className="px-3 py-2.5 border-b border-white/5 last:border-b-0"
                  >
                    <div className="flex items-center justify-between gap-3 text-[11px]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-gray-500 tabular-nums shrink-0">{s.time}</span>
                        <span className="text-gray-300 truncate">{s.product}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-medium ${METHOD_COLOR[s.method] ?? "text-gray-400"}`}>
                          {s.method}
                        </span>
                        <span className="text-white tabular-nums font-semibold w-16 text-right">
                          ${s.amount.toLocaleString("es-AR")}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ============================================================================
   SCENES — el corazón del landing. Cada escena es un momento real del día
   con su pantalla. Si agregás una, mantené el mismo formato.
   ========================================================================== */

type SceneData = {
  time: string
  kicker: string
  headline: string
  body: string
  note?: string
  mock: "apertura" | "venta" | "stockBajo" | "ia" | "duplicados" | "voucher" | "gasto" | "cierre" | "reportes"
}

const SCENES: SceneData[] = [
  {
    time: "07:30",
    kicker: "Llegaste",
    headline: "Abrís la caja con $5.000 de cambio.",
    body: "Anotás cuánto efectivo tenías en la mano. Si querés, agregás una nota. Listo, ya podés vender.",
    note: "Tu cajero/a también puede abrir la suya. Cada turno queda separado.",
    mock: "apertura",
  },
  {
    time: "08:42",
    kicker: "Primer cliente",
    headline: "Coca de 500, alfajor, paga con MODO.",
    body: "Buscás los productos por nombre o pasás el lector de barras. El stock baja solo. Cobrar tarda menos que sacar el cambio.",
    mock: "venta",
  },
  {
    time: "10:42",
    kicker: "Mientras vendés",
    headline: "Te avisa que te quedan 4 Marlboro Box.",
    body: "Vos no contás stock — la app lo hace por vos. Cuando algo está cerca de cortarse, te aparece arriba sin que lo busques.",
    note: "El umbral lo definís vos por producto.",
    mock: "stockBajo",
  },
  {
    time: "11:35",
    kicker: "Te llegó el Excel del proveedor",
    headline: "Lo arrastrás a la app y queda todo cargado.",
    body: "200 productos sin categoría en la planilla. La IA los lee, los separa por rubro y arma una lista lista para revisar. Si algo lo categorizó mal, lo corregís en un click.",
    note: "Después aprende de tus correcciones — la próxima vez se equivoca menos.",
    mock: "ia",
  },
  {
    time: "12:08",
    kicker: "Sin querer cargaste lo mismo dos veces",
    headline: "«Coca 500ml» y «Coca-Cola 500 ml» son el mismo producto.",
    body: "La IA revisa tu lista y te marca los repetidos — los que se llaman parecido, los que tienen el mismo código, los que vendiste el mismo día desde dos cuentas. Vos elegís cuál mantener; los otros se fusionan conservando el historial.",
    note: "También junta clientes duplicados que cargaste con apellidos distintos.",
    mock: "duplicados",
  },
  {
    time: "13:20",
    kicker: "Llegó el de Quilmes",
    headline: "Cargás la factura como gasto.",
    body: "Proveedor, monto, categoría. Tres campos. Queda imputado al margen del día — no es solo facturación bruta.",
    note: "A fin de mes ves cuánto te quedó de verdad.",
    mock: "gasto",
  },
  {
    time: "15:00",
    kicker: "Cargas virtuales",
    headline: "Le sacás foto al voucher y queda registrado.",
    body: "Pasaste una recarga de Personal por $1.000. La IA lee el comprobante: tipo, monto, número, comisión. No tipeás nada. Te queda imputado al efectivo del día.",
    note: "Funciona con vouchers de Personal, Claro, Movistar, Tuyo, SUBE y más.",
    mock: "voucher",
  },
  {
    time: "16:05",
    kicker: "Marta cierra su turno",
    headline: "Cuenta el efectivo. Coincide.",
    body: "Tu empleada cierra su sesión, no la tuya. Si faltó plata, queda registrado quién y cuándo. No sirve para acusar — sirve para tener claridad.",
    mock: "cierre",
  },
  {
    time: "Domingo",
    kicker: "Mientras tomás un mate",
    headline: "Vendiste 23% más que la semana pasada.",
    body: "Abrís reportes y ya está. Las cuentas las hace la app. Vos mirás el gráfico y decidís qué pedir el lunes.",
    note: "Si querés más detalle, le preguntás en español: «¿qué se vendió ayer?» y te responde.",
    mock: "reportes",
  },
]

/* ============================================================================
   HONESTIDAD
   ========================================================================== */

const HONESTY: { kind: "no" | "yes"; title: string; body: string }[] = [
  {
    kind: "no",
    title: "«+500 comercios usándolo»",
    body: "Recién arrancamos en 2026. Si te decimos un número falso, después tenemos que sostenerlo. Mejor venimos limpios.",
  },
  {
    kind: "no",
    title: "«Aumentás un 50% tus ventas»",
    body: "Eso depende de tu negocio, no nuestro. Te damos las herramientas — vender, vendés vos.",
  },
  {
    kind: "no",
    title: "«Soporte 24/7 mundial»",
    body: "Somos un equipo chico. Soporte por mail y WhatsApp en horario comercial argentino. Te respondemos rápido pero no a las 4 AM.",
  },
  {
    kind: "no",
    title: "«Cambiamos tu negocio»",
    body: "El negocio lo cambiás vos. Nosotros sacamos el quilombo de cuadernos, calculadora y planillas — para que tengas tiempo de cambiarlo.",
  },
  {
    kind: "yes",
    title: "Precios estables",
    body: "Ajustamos cada 6 meses con la inflación. No te subimos el plan de un día para el otro.",
  },
  {
    kind: "yes",
    title: "Tus datos, tuyos",
    body: "Exportás todo a CSV cuando quieras. Si te vas, te llevás todo. Sin candados.",
  },
]

/* ============================================================================
   QUESTIONS
   ========================================================================== */

const QUESTIONS = [
  {
    q: "¿Necesito instalar algo?",
    a: "Nada. Funciona en cualquier navegador (Chrome, Safari, Firefox). En el celular se siente como una app nativa porque la podés instalar desde el navegador, pero no pasás por una tienda.",
  },
  {
    q: "¿Y si se corta internet?",
    a: "El POS guarda las ventas localmente y las sube cuando volvés a tener señal. Si se corta media hora, no perdés nada. Si te quedás sin internet todo el día, ahí ya tenés un problema más grande que el software.",
  },
  {
    q: "¿Tengo que pasar mis productos uno por uno?",
    a: "Podés, pero es lento. Subís un Excel o CSV con todo y se carga en 30 segundos. Te damos la plantilla. Si tenés un sistema viejo que exporta, casi siempre se puede importar.",
  },
  {
    q: "¿Puedo cobrar con QR de Mercado Pago?",
    a: "Sí, conectás tu cuenta de MP y el QR queda integrado al POS. El cliente escanea, vos confirmás. Disponible desde el plan Profesional.",
  },
  {
    q: "¿Cuánto sale realmente?",
    a: "Plan Gratis para arrancar. Plan Básico empieza en $7.900 ARS/mes para un kiosco común. Profesional ($12.900) si tenés varios cajeros o querés IA. Negocio ($24.900) si tenés multi-tienda. Todo está más abajo y en /pricing con el detalle completo.",
  },
  {
    q: "¿Y si no me sirve y quiero irme?",
    a: "Cancelás desde tu cuenta, sin llamar a nadie. Exportás tus datos a CSV. Te bajás al plan gratis o cerrás la cuenta. Sin permanencia, sin cargos por cancelar.",
  },
]

/* ============================================================================
   Subcomponents
   ========================================================================== */

function Scene({ scene, index }: { scene: SceneData; index: number }) {
  // Alternate sides on desktop so the page has rhythm. On mobile everything
  // stacks anyway (text on top, mock below).
  const reversed = index % 2 === 1

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className={`grid md:grid-cols-12 gap-6 md:gap-10 items-center ${
        reversed ? "" : ""
      }`}
    >
      {/* Text */}
      <div
        className={`md:col-span-5 ${reversed ? "md:col-start-8" : "md:col-start-1"} ${
          reversed ? "md:row-start-1" : ""
        }`}
      >
        <div className="flex items-baseline gap-3 mb-3">
          <span className="font-mono text-2xl sm:text-3xl font-bold text-white tabular-nums">
            {scene.time}
          </span>
          <span className="text-[10px] uppercase tracking-[0.25em] text-violet-300/70">
            {scene.kicker}
          </span>
        </div>
        <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-white leading-tight mb-3">
          {scene.headline}
        </h3>
        <p className="text-gray-400 text-sm sm:text-base leading-relaxed">{scene.body}</p>
        {scene.note && (
          <p className="mt-3 text-[13px] text-gray-500 italic border-l-2 border-white/10 pl-3">
            {scene.note}
          </p>
        )}
      </div>
      {/* Mock */}
      <div
        className={`md:col-span-6 ${reversed ? "md:col-start-1 md:row-start-1" : "md:col-start-7"}`}
      >
        <SceneMock scene={scene.mock} />
      </div>
    </motion.div>
  )
}

function SceneMockShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-1 backdrop-blur-md shadow-[0_30px_80px_-30px_rgba(99,102,241,0.4)]">
      <div className="relative rounded-xl bg-[#08080f] overflow-hidden p-4 sm:p-5">{children}</div>
      {/* Soft underglow */}
      <div
        aria-hidden
        className="absolute inset-x-8 -bottom-4 h-16 -z-10 blur-3xl opacity-50"
        style={{ background: "radial-gradient(closest-side, #6366f1, transparent 70%)" }}
      />
    </div>
  )
}

function SceneMock({ scene }: { scene: SceneData["mock"] }) {
  switch (scene) {
    case "apertura":
      return <MockApertura />
    case "venta":
      return <MockVenta />
    case "stockBajo":
      return <MockStockBajo />
    case "ia":
      return <MockIA />
    case "duplicados":
      return <MockDuplicados />
    case "voucher":
      return <MockVoucher />
    case "gasto":
      return <MockGasto />
    case "cierre":
      return <MockCierre />
    case "reportes":
      return <MockReportes />
  }
}

/* ============================================================================
   Mocks individuales — datos creíbles, no genéricos
   ========================================================================== */

function MockHeader({ kicker, title, badge, badgeTone = "emerald" }: {
  kicker: string
  title: string
  badge?: string
  badgeTone?: "emerald" | "amber" | "violet" | "rose"
}) {
  const toneMap = {
    emerald: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    violet: "bg-violet-500/10 text-violet-300 border-violet-500/20",
    rose: "bg-rose-500/10 text-rose-300 border-rose-500/20",
  }
  return (
    <div className="flex items-start justify-between mb-4 gap-3">
      <div className="min-w-0">
        <p className="text-[10px] text-gray-500 truncate">{kicker}</p>
        <p className="text-base md:text-lg font-semibold truncate">{title}</p>
      </div>
      {badge && (
        <span className={`shrink-0 text-[10px] px-2 py-1 rounded border whitespace-nowrap ${toneMap[badgeTone]}`}>
          {badge}
        </span>
      )}
    </div>
  )
}

function MockApertura() {
  return (
    <SceneMockShell>
      <MockHeader kicker="Caja · sesión nueva" title="Apertura del día" badge="07:30" badgeTone="violet" />
      <div className="space-y-2.5">
        <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3">
          <p className="text-[10px] text-gray-500 mb-1">Efectivo inicial</p>
          <p className="text-2xl font-bold tabular-nums text-white">$5.000</p>
        </div>
        <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3">
          <p className="text-[10px] text-gray-500 mb-1">Nota (opcional)</p>
          <p className="text-[11px] text-gray-400 italic">Cambio del cierre de ayer</p>
        </div>
        <button className="w-full py-2.5 rounded-lg bg-emerald-500 text-emerald-950 text-xs font-bold pointer-events-none">
          Abrir caja
        </button>
      </div>
    </SceneMockShell>
  )
}

function MockVenta() {
  const items = [
    { name: "Coca Cola 500ml", qty: 1, price: 950 },
    { name: "Alfajor Jorgito triple", qty: 1, price: 850 },
  ]
  const total = items.reduce((s, i) => s + i.qty * i.price, 0)
  return (
    <SceneMockShell>
      <MockHeader kicker="POS · venta en curso" title="2 productos" badge="MODO listo" badgeTone="violet" />
      <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3 mb-3">
        <div className="flex items-center gap-2 mb-2.5">
          <Search size={12} className="text-gray-500" />
          <span className="text-[11px] text-gray-500">Buscar o escanear código...</span>
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
    </SceneMockShell>
  )
}

function MockStockBajo() {
  const products = [
    { name: "Marlboro Box 20", stock: 4, min: 12, status: "critical" as const },
    { name: "Coca Cola 500ml", stock: 6, min: 12, status: "low" as const },
    { name: "Alfajor Jorgito", stock: 3, min: 10, status: "critical" as const },
  ]
  return (
    <SceneMockShell>
      <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 mb-3">
        <AlertTriangle size={14} className="text-amber-300 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-amber-200">Stock bajo en 3 productos</p>
          <p className="text-[11px] text-amber-200/70">Reabastecé antes del finde — son top ventas.</p>
        </div>
      </div>
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
              <p className="text-[10px] text-gray-500">Mínimo recomendado: {p.min}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-gray-300 tabular-nums">{p.stock}</span>
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded border ${
                  p.status === "critical"
                    ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                    : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                }`}
              >
                {p.status === "critical" ? "Crítico" : "Bajo"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </SceneMockShell>
  )
}

function MockIA() {
  // Show a CSV file dropped in + the AI's grouping result. No magic-wand
  // icons — just the raw output the user actually sees.
  const groups = [
    { name: "Bebidas", count: 47, color: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
    { name: "Cigarrillos", count: 23, color: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
    { name: "Galletitas y snacks", count: 38, color: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
    { name: "Lácteos", count: 12, color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
    { name: "Limpieza", count: 9, color: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
    { name: "Sin clasificar", count: 6, color: "bg-gray-500/15 text-gray-300 border-gray-500/30" },
  ]
  const total = groups.reduce((s, g) => s + g.count, 0)
  return (
    <SceneMockShell>
      <MockHeader
        kicker="Inventario · importación"
        title={`${total} productos detectados`}
        badge="135 categorizados"
        badgeTone="emerald"
      />
      {/* File drop indicator */}
      <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.02] p-3 mb-3 flex items-center gap-3">
        <FileSpreadsheet className="w-5 h-5 text-emerald-300 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-gray-200 truncate font-medium">lista-proveedor-abril.xlsx</p>
          <p className="text-[10px] text-gray-500">200 filas · listo en 8s</p>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
          OK
        </span>
      </div>
      {/* AI-detected groups */}
      <div className="space-y-1.5">
        {groups.map((g, i) => (
          <div
            key={i}
            className="flex items-center justify-between text-[11px] rounded-lg bg-white/[0.03] border border-white/5 p-2.5"
          >
            <span className="text-gray-200">{g.name}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded border tabular-nums ${g.color}`}>
              {g.count}
            </span>
          </div>
        ))}
      </div>
    </SceneMockShell>
  )
}

function MockDuplicados() {
  const pairs = [
    { a: "Coca 500ml", b: "Coca-Cola 500 ml", reason: "Nombre similar · mismo precio", confidence: 96 },
    { a: "Marlboro Box", b: "Marlboro Box 20", reason: "Nombre + barcode parcial", confidence: 88 },
    { a: "Galletitas Oreo", b: "Oreo Original 118g", reason: "Misma categoría · misma marca", confidence: 74 },
  ]
  return (
    <SceneMockShell>
      <MockHeader
        kicker="Inventario · revisión"
        title="3 posibles duplicados"
        badge="IA"
        badgeTone="violet"
      />
      <div className="space-y-2">
        {pairs.map((p, i) => (
          <div key={i} className="rounded-lg bg-white/[0.03] border border-white/5 p-3">
            <div className="flex items-center gap-2 mb-2">
              <GitMerge className="w-3.5 h-3.5 text-violet-300 shrink-0" />
              <span className="text-[10px] uppercase tracking-wider text-violet-300/70">
                {p.confidence}% match · {p.reason}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-gray-200 truncate flex-1">{p.a}</span>
              <span className="text-gray-500 text-[10px] shrink-0">≈</span>
              <span className="text-gray-200 truncate flex-1 text-right">{p.b}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <button className="flex-1 text-[10px] font-semibold py-1 rounded bg-violet-500/15 text-violet-200 border border-violet-500/30 pointer-events-none">
                Fusionar
              </button>
              <button className="flex-1 text-[10px] py-1 rounded bg-white/[0.03] text-gray-400 border border-white/5 pointer-events-none">
                Son distintos
              </button>
            </div>
          </div>
        ))}
      </div>
    </SceneMockShell>
  )
}

function MockVoucher() {
  // Simulated camera/photo + extracted fields. The "loaded" state with a
  // placeholder photo conveys "you snapped a pic" without needing a real
  // image asset.
  return (
    <SceneMockShell>
      <MockHeader
        kicker="Cargas · nueva carga"
        title="Voucher leído"
        badge="lectura: 1.2s"
        badgeTone="emerald"
      />
      {/* Fake photo card */}
      <div className="relative rounded-lg overflow-hidden border border-white/10 mb-3 bg-gradient-to-br from-gray-800 via-gray-900 to-black aspect-[16/7] flex items-center justify-center">
        <div className="absolute inset-0 opacity-40 bg-[linear-gradient(135deg,transparent_45%,rgba(255,255,255,0.06)_50%,transparent_55%)]" />
        <ImageIcon className="w-8 h-8 text-white/30" />
        <div className="absolute bottom-2 left-2 text-[9px] uppercase tracking-wider text-white/40 font-mono">
          IMG_4581.jpg · 2.1MB
        </div>
        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-[9px] text-emerald-200 font-semibold">PROCESADO</span>
        </div>
      </div>
      {/* Extracted fields */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Tipo", value: "Personal", strong: true },
          { label: "Monto", value: "$1.000", strong: true },
          { label: "Número", value: "1163445567", mono: true },
          { label: "Comisión", value: "$30" },
        ].map((f, i) => (
          <div key={i} className="rounded-lg bg-white/[0.03] border border-white/5 p-2.5">
            <p className="text-[10px] text-gray-500 mb-0.5">{f.label}</p>
            <p
              className={`text-[12px] tabular-nums ${
                f.strong ? "font-bold text-white" : "text-gray-200"
              } ${f.mono ? "font-mono" : ""}`}
            >
              {f.value}
            </p>
          </div>
        ))}
      </div>
    </SceneMockShell>
  )
}

function MockGasto() {
  return (
    <SceneMockShell>
      <MockHeader kicker="Gastos · nuevo egreso" title="Cargar factura" badge="Quilmes" badgeTone="rose" />
      <div className="space-y-2">
        <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3">
          <p className="text-[10px] text-gray-500 mb-1">Proveedor</p>
          <div className="flex items-center gap-2">
            <Truck size={12} className="text-rose-300" />
            <span className="text-[12px] text-gray-200">Quilmes Industrial</span>
          </div>
        </div>
        <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3">
          <p className="text-[10px] text-gray-500 mb-1">Monto</p>
          <p className="text-xl font-bold tabular-nums text-white">$87.500</p>
        </div>
        <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3">
          <p className="text-[10px] text-gray-500 mb-1">Categoría</p>
          <span className="inline-block text-[10px] px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">
            Bebidas
          </span>
        </div>
      </div>
    </SceneMockShell>
  )
}

function MockCierre() {
  return (
    <SceneMockShell>
      <MockHeader kicker="Caja · cierre de turno" title="Marta · 16:05" badge="Sin diferencia" badgeTone="emerald" />
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
          Esperado <span className="tabular-nums font-semibold">$24.150</span> · Contado{" "}
          <span className="tabular-nums font-semibold">$24.150</span> · Diferencia{" "}
          <span className="tabular-nums font-semibold">$0</span>
        </p>
      </div>
    </SceneMockShell>
  )
}

function MockReportes() {
  return (
    <SceneMockShell>
      <MockHeader kicker="Reportes · semana" title="Semana cerrada" badge="+23% vs anterior" badgeTone="emerald" />
      <div className="grid grid-cols-2 gap-2 mb-3">
        {[
          { label: "Ingresos", value: "$1.284k" },
          { label: "Ventas", value: "287" },
          { label: "Margen", value: "32%" },
          { label: "Ticket prom.", value: "$4.475" },
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
            className="flex-1 rounded-t bg-gradient-to-t from-blue-500/50 to-violet-400/90"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </SceneMockShell>
  )
}

/* ============================================================================
   Background, Navbar, PricingCard, Footer
   ========================================================================== */

function ColorBlobs() {
  const blobs = [
    { x: "82%", y: "15%", size: 620, color: "rgba(139, 92, 246, 0.32)", d: 18 },
    { x: "8%", y: "20%", size: 540, color: "rgba(59, 130, 246, 0.26)", d: 22 },
    { x: "85%", y: "55%", size: 600, color: "rgba(168, 85, 247, 0.28)", d: 20 },
    { x: "15%", y: "75%", size: 560, color: "rgba(34, 211, 238, 0.20)", d: 24 },
    { x: "55%", y: "90%", size: 520, color: "rgba(99, 102, 241, 0.24)", d: 19 },
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
      <div
        className="absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)",
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
        <Link href={promoCode ? `/?promo=${promoCode}` : "/"} className="flex items-center gap-2 group min-w-0">
          <OrvexLogo size={28} gradientId="nav-logo-grad" />
          <span className="font-bold text-base sm:text-lg tracking-tight truncate">Orvex</span>
        </Link>
        <div className="hidden md:flex items-center gap-7 text-sm text-gray-400">
          <a href="#dia" className="hover:text-white transition-colors">Cómo funciona</a>
          <a href="#pricing" className="hover:text-white transition-colors">Precios</a>
          <a href="#faq" className="hover:text-white transition-colors">Preguntas</a>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <Link href="/login" className="text-sm text-gray-300 hover:text-white transition-colors px-2 py-1.5">
            Ingresar
          </Link>
          <Link
            href={promoActive ? professionalHref : freeHref}
            className="px-3 sm:px-4 py-2 rounded-lg bg-white hover:bg-gray-100 text-black text-sm font-semibold transition-all hover:scale-105 whitespace-nowrap"
          >
            {promoActive ? "Reclamar promo" : "Empezar gratis"}
          </Link>
        </div>
      </div>
    </nav>
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
          ? "border-blue-400/60 bg-gradient-to-b from-blue-500/[0.10] to-transparent shadow-[0_20px_60px_-20px_rgba(99,102,241,0.6)]"
          : "border-white/10 bg-white/[0.03] hover:border-white/25"
      }`}
    >
      <div className="relative h-full flex flex-col p-6">
        {plan.highlight && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-blue-500 to-violet-500 text-white text-[10px] font-bold tracking-wider shadow-lg shadow-blue-500/40 whitespace-nowrap">
            EL QUE MÁS ELIGEN
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
                className={`mt-0.5 shrink-0 ${plan.highlight ? "text-blue-300" : "text-emerald-300"}`}
              />
              {f}
            </li>
          ))}
        </ul>
        <Link
          href={plan.href}
          className={`block text-center py-2.5 rounded-lg font-semibold text-sm transition-all hover:scale-[1.02] ${
            plan.highlight
              ? "bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-400 hover:to-violet-400 text-white shadow-lg shadow-blue-500/30"
              : "bg-white/5 hover:bg-white/10 border border-white/10 text-white"
          }`}
        >
          {plan.cta}
        </Link>
      </div>
    </motion.div>
  )
}

function Footer() {
  return (
    <footer className="relative border-t border-white/5 py-10 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <OrvexLogo size={22} gradientId="footer-logo-grad" />
          <span>Orvex © {new Date().getFullYear()} · Hecho en Argentina</span>
        </div>
        <div className="flex items-center gap-5 sm:gap-6">
          <a href="#pricing" className="hover:text-white transition-colors">Precios</a>
          <Link href="/login" className="hover:text-white transition-colors">Ingresar</Link>
          <a href="mailto:cobraorvex@gmail.com" className="hover:text-white transition-colors">Soporte</a>
        </div>
      </div>
    </footer>
  )
}
