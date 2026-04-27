"use client"

import { useEffect, useId, useRef, useState } from "react"
import Link from "next/link"
import { signIn } from "next-auth/react"
import { AnimatePresence, motion } from "framer-motion"
import toast from "react-hot-toast"
import {
  Eye,
  EyeOff,
  Loader2,
  Sparkles,
  ArrowRight,
  Receipt,
  Package,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react"

export default function LoginPage() {
  const emailId = useId()
  const passwordId = useId()
  const rememberId = useId()

  const [form, setForm] = useState({ email: "", password: "" })
  const [remember, setRemember] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})

  function validate() {
    const next: typeof errors = {}
    if (!form.email) next.email = "El email es requerido."
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      next.email = "Ingresá un email válido."
    if (!form.password) next.password = "La contraseña es requerida."
    else if (form.password.length < 4) next.password = "Mínimo 4 caracteres."
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const result = await signIn("credentials", {
        email: form.email.trim().toLowerCase(),
        password: form.password,
        redirect: false,
      })
      if (result?.error) {
        toast.error("Email o contraseña incorrectos.")
      } else if (!result?.ok) {
        toast.error("No se pudo iniciar sesión. Intentá de nuevo.")
      } else {
        toast.success("¡Bienvenido!")
        window.location.href = "/inicio"
      }
    } catch {
      toast.error("Ocurrió un error. Intentá de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-5xl grid lg:grid-cols-2 gap-8 lg:gap-14 items-center"
    >
      {/* LEFT — Product preview, only on lg+. Mobile keeps the form full
          width because side-by-side at 375px would squeeze both. */}
      <div className="hidden lg:block">
        <LoginPreview />
      </div>

      {/* RIGHT — Login card */}
      <div className="relative w-full max-w-md mx-auto lg:mx-0">
        <div
          aria-hidden
          className="absolute -inset-px rounded-2xl opacity-60 blur-xl"
          style={{
            background:
              "linear-gradient(135deg, rgba(59,130,246,0.35), rgba(139,92,246,0.35))",
          }}
        />

        <div className="relative bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-2xl p-5 sm:p-9 shadow-2xl shadow-black/60 overflow-hidden">
          {/* Inner subtle gradient sheen on top edge */}
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)",
            }}
          />

          <div className="text-center mb-7">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/30 text-blue-200 text-[11px] mb-4">
              <Sparkles className="w-3 h-3" /> Bienvenido de vuelta
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              Iniciar sesión
            </h1>
            <p className="text-sm text-gray-400 mt-2">
              Accedé a tu cuenta y seguí gestionando tu negocio.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label
                htmlFor={emailId}
                className="block text-[11px] uppercase tracking-wider font-medium text-gray-400 mb-1.5"
              >
                Email
              </label>
              <input
                id={emailId}
                type="email"
                autoComplete="email"
                placeholder="tu@email.com"
                value={form.email}
                onChange={(e) => {
                  setForm((f) => ({ ...f, email: e.target.value }))
                  if (errors.email) setErrors((er) => ({ ...er, email: undefined }))
                }}
                className={`w-full bg-black/40 border rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 outline-none transition focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/60 ${
                  errors.email
                    ? "border-red-500/60"
                    : "border-white/10 hover:border-white/20"
                }`}
              />
              {errors.email && (
                <p className="mt-1.5 text-xs text-red-400">{errors.email}</p>
              )}
            </div>

            <div>
              <label
                htmlFor={passwordId}
                className="block text-[11px] uppercase tracking-wider font-medium text-gray-400 mb-1.5"
              >
                Contraseña
              </label>
              <div className="relative">
                <input
                  id={passwordId}
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, password: e.target.value }))
                    if (errors.password)
                      setErrors((er) => ({ ...er, password: undefined }))
                  }}
                  className={`w-full bg-black/40 border rounded-xl px-4 pr-11 py-3 text-sm text-white placeholder-gray-600 outline-none transition focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/60 ${
                    errors.password
                      ? "border-red-500/60"
                      : "border-white/10 hover:border-white/20"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-500 hover:text-blue-300 transition-colors"
                  aria-label={showPassword ? "Ocultar" : "Mostrar"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs text-red-400">{errors.password}</p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-1">
              <label
                htmlFor={rememberId}
                className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none"
              >
                <span className="relative inline-flex items-center">
                  <input
                    id={rememberId}
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="peer sr-only"
                  />
                  <span className="w-4 h-4 rounded border border-white/20 bg-black/40 peer-checked:bg-gradient-to-br peer-checked:from-blue-500 peer-checked:to-violet-500 peer-checked:border-blue-400 transition-colors" />
                  <svg
                    className="absolute left-0.5 top-0.5 w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                Recordarme
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-blue-300 hover:text-blue-200 transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-400 hover:to-violet-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 text-sm transition-all shadow-lg shadow-blue-500/30 hover:scale-[1.01] active:scale-[0.99] mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Ingresando…
                </>
              ) : (
                <>
                  Ingresar
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-7 pt-5 border-t border-white/10 text-center">
            <p className="text-sm text-gray-400">
              ¿No tenés cuenta?{" "}
              <Link
                href="/signup"
                className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent font-semibold hover:from-blue-300 hover:to-violet-300 transition-colors"
              >
                Registrate gratis
              </Link>
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

/* ============================================================================
   LOGIN PREVIEW — la columna izquierda del login. Es un carrusel: cada ~9s
   cambia entre cuatro paneles distintos del producto (live feed, alerta de
   stock, asistente IA, reporte semanal) para que el usuario que está
   tipeando vea de qué se trata desde cuatro ángulos. Cada panel maneja su
   propia animación interna. El carrusel se pausa cuando la pestaña no está
   visible.
   ========================================================================== */

const SAMPLE_SALES = [
  { label: "Coca 500 + alfajor", method: "MODO", color: "text-amber-300", amount: 1800 },
  { label: "Cargas SUBE", method: "Débito", color: "text-violet-300", amount: 5000 },
  { label: "Sándwich miga + agua", method: "MP QR", color: "text-sky-300", amount: 3650 },
  { label: "Marlboro Box", method: "Efectivo", color: "text-emerald-300", amount: 2400 },
  { label: "Galletitas Oreo × 2", method: "MODO", color: "text-amber-300", amount: 1900 },
  { label: "Caramelos Sugus", method: "Efectivo", color: "text-emerald-300", amount: 350 },
]

function nowAR(offsetSec = 0): string {
  const d = new Date(Date.now() - offsetSec * 1000)
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })
}

function formatARS(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `$${(n / 1_000).toFixed(1)}k`
  return `$${n.toLocaleString("es-AR")}`
}

const PREVIEW_PANELS = [
  { id: "live", kicker: "lo de hoy", title: "Mientras tipeás,", titleAccent: "la app sigue trabajando." },
  { id: "stock", kicker: "te ahorra una llamada", title: "Te avisa", titleAccent: "antes de que se corte." },
  { id: "chat", kicker: "preguntás, te responde", title: "Tu negocio,", titleAccent: "explicado en castellano." },
  { id: "report", kicker: "el lunes a la mañana", title: "Sabés", titleAccent: "qué pasó mientras dormías." },
] as const

const PANEL_INTERVAL_MS = 9000

function LoginPreview() {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return
      setIdx((i) => (i + 1) % PREVIEW_PANELS.length)
    }, PANEL_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [])
  const panel = PREVIEW_PANELS[idx]

  return (
    <div className="space-y-5 select-none">
      {/* Heading rotates with the panel so the copy fits whatever scene is
          on screen below. Same fade transition as the body so they swap as
          one unit. */}
      <div className="min-h-[152px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={panel.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            style={{ willChange: "transform, opacity" }}
          >
            <p className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-violet-300/80 mb-3">
              <span className="h-px w-6 bg-violet-300/40" /> {panel.kicker}
            </p>
            <h2 className="text-3xl xl:text-4xl font-bold tracking-tight text-white leading-[1.1]">
              {panel.title}{" "}
              <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 bg-clip-text text-transparent">
                {panel.titleAccent}
              </span>
            </h2>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Body — each panel in its own subtree so internal state (timers,
          intervals) gets torn down on switch and the next panel mounts
          fresh. Min height is the tallest panel so the form on the right
          doesn't shift when scenes swap. */}
      <div className="relative min-h-[340px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={panel.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{ willChange: "transform, opacity" }}
          >
            {panel.id === "live" && <PanelLive />}
            {panel.id === "stock" && <PanelStock />}
            {panel.id === "chat" && <PanelChat />}
            {panel.id === "report" && <PanelReport />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Pagination dots so the user knows there are more panels coming */}
      <div className="flex items-center gap-1.5 pt-1">
        {PREVIEW_PANELS.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setIdx(i)}
            aria-label={`Ver panel ${i + 1}`}
            className="h-1 rounded-full transition-all"
            style={{
              width: i === idx ? 24 : 6,
              background: i === idx ? "rgba(167,139,250,0.85)" : "rgba(255,255,255,0.15)",
            }}
          />
        ))}
      </div>
    </div>
  )
}

/* -------- Panel 1: Live feed + KPIs ---------- */
function PanelLive() {
  const [feed, setFeed] = useState(() =>
    SAMPLE_SALES.slice(0, 3).map((s, i) => ({ ...s, id: i, time: nowAR(i * 60) })),
  )
  const [ventas, setVentas] = useState(27)
  const [ingresos, setIngresos] = useState(71_300)
  const [stockBajo, setStockBajo] = useState(3)
  const [bumpKey, setBumpKey] = useState(0)

  useEffect(() => {
    let counter = SAMPLE_SALES.length
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return
      counter++
      const next = SAMPLE_SALES[counter % SAMPLE_SALES.length]
      setFeed((prev) => [{ ...next, id: counter, time: nowAR(0) }, ...prev.slice(0, 2)])
      setVentas((v) => v + 1)
      setIngresos((i) => i + next.amount)
      setStockBajo((s) => {
        const r = Math.random()
        if (r < 0.15 && s > 1) return s - 1
        if (r > 0.92 && s < 6) return s + 1
        return s
      })
      setBumpKey((k) => k + 1)
    }, 3500)
    return () => window.clearInterval(id)
  }, [])

  const kpis = [
    { icon: Receipt, label: "Ventas hoy", value: ventas.toString(), color: "text-violet-300", ringColor: "rgba(167,139,250,0.45)" },
    { icon: TrendingUp, label: "Ingresos", value: formatARS(ingresos), color: "text-emerald-300", ringColor: "rgba(110,231,183,0.45)" },
    { icon: Package, label: "Stock bajo", value: stockBajo.toString(), color: "text-amber-300", ringColor: "rgba(252,211,77,0.40)" },
  ]

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {kpis.map(({ icon: Icon, label, value, color, ringColor }) => (
          <div key={label} className="relative rounded-xl bg-white/[0.03] border border-white/10 p-3 overflow-hidden">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon className="w-3 h-3 text-gray-500" />
              <p className="text-[10px] text-gray-500">{label}</p>
            </div>
            <motion.p
              key={`${label}-${bumpKey}-${value}`}
              initial={{ scale: 1, textShadow: `0 0 0 ${ringColor}` }}
              animate={{ scale: [1.06, 1], textShadow: [`0 0 16px ${ringColor}`, `0 0 0 transparent`] }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className={`text-lg font-bold tabular-nums ${color}`}
            >
              {value}
            </motion.p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between">
          <p className="text-xs text-gray-400 font-medium">Últimas operaciones</p>
          <span className="flex items-center gap-1.5 text-[10px] text-emerald-300">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
            </span>
            en vivo
          </span>
        </div>
        <ul className="divide-y divide-white/5">
          {feed.map((row, i) => (
            <motion.li
              key={row.id}
              layout
              initial={i === 0 ? { opacity: 0, y: -10 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-3 px-4 py-2.5 text-[12px]"
            >
              <span className="text-gray-500 tabular-nums w-10">{row.time}</span>
              <span className="text-gray-200 flex-1 truncate">{row.label}</span>
              <span className={`${row.color} font-medium whitespace-nowrap`}>{row.method}</span>
              <span className="text-white tabular-nums font-semibold w-16 text-right">
                ${row.amount.toLocaleString("es-AR")}
              </span>
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/* -------- Panel 2: Low-stock alert ---------- */
function PanelStock() {
  // Stock counts decrement slightly while the panel is on screen so the user
  // sees real-time-ish movement. They never reach 0 — the panel rotates away
  // first.
  const [items, setItems] = useState([
    { name: "Marlboro Box 20", stock: 4, min: 12, status: "critical" as const },
    { name: "Coca Cola 500ml", stock: 6, min: 12, status: "low" as const },
    { name: "Alfajor Jorgito triple", stock: 3, min: 10, status: "critical" as const },
    { name: "Agua Villavicencio 1.5L", stock: 18, min: 8, status: "ok" as const },
  ])
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return
      setItems((arr) => {
        const next = [...arr]
        const i = Math.floor(Math.random() * next.length)
        if (next[i].stock > 1) next[i] = { ...next[i], stock: next[i].stock - 1 }
        return next
      })
    }, 2500)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="space-y-3">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45 }}
        className="flex items-start gap-3 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3.5"
      >
        <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-4 h-4 text-amber-200" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-100">Stock bajo · 3 productos</p>
          <p className="text-xs text-amber-200/70 mt-0.5">
            Reabastecé antes del finde — son tu top de ventas.
          </p>
        </div>
      </motion.div>
      <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
        <ul className="divide-y divide-white/5">
          {items.map((p) => (
            <li key={p.name} className="flex items-center justify-between px-4 py-2.5 text-[12px]">
              <div className="min-w-0 flex-1">
                <p className="text-gray-100 truncate">{p.name}</p>
                <p className="text-[10px] text-gray-500">Mínimo: {p.min}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <motion.span
                  key={`${p.name}-${p.stock}`}
                  initial={{ scale: 1.15 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="text-gray-200 tabular-nums font-medium"
                >
                  {p.stock}
                </motion.span>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded border whitespace-nowrap font-semibold ${
                    p.status === "critical"
                      ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                      : p.status === "low"
                        ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                        : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                  }`}
                >
                  {p.status === "critical" ? "Crítico" : p.status === "low" ? "Bajo" : "OK"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/* -------- Panel 3: AI assistant typing chat ---------- */
function PanelChat() {
  const QUESTION = "¿Cuánto vendí ayer?"
  const ANSWER = [
    { l: "Ayer", v: "$84.250 · 41 ventas" },
    { l: "Top 1", v: "Coca 500 ml · 28 u." },
    { l: "Margen", v: "31% (vs 28% mes ant.)" },
  ]
  const [typed, setTyped] = useState("")
  const [revealed, setRevealed] = useState(0)
  const cancelled = useRef(false)

  useEffect(() => {
    cancelled.current = false
    let timer: number | null = null
    const run = async () => {
      // type the question
      for (let i = 0; i < QUESTION.length; i++) {
        if (cancelled.current) return
        await new Promise<void>((r) => (timer = window.setTimeout(r, 55)))
        setTyped(QUESTION.slice(0, i + 1))
      }
      await new Promise<void>((r) => (timer = window.setTimeout(r, 600)))
      for (let i = 1; i <= ANSWER.length; i++) {
        if (cancelled.current) return
        setRevealed(i)
        await new Promise<void>((r) => (timer = window.setTimeout(r, 350)))
      }
    }
    run()
    return () => {
      cancelled.current = true
      if (timer) window.clearTimeout(timer)
    }
  }, [])

  const cursor = typed.length < QUESTION.length

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/[0.05] to-fuchsia-500/[0.02] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-[0.2em] bg-violet-500/15 border border-violet-400/40 text-violet-200">
          <span className="text-fuchsia-300">✦</span> ia
        </span>
        <p className="text-xs text-gray-400">Asistente · pregunta libre</p>
      </div>
      {/* User bubble */}
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-blue-500/15 border border-blue-400/25 px-3 py-2 text-[12px] text-blue-50 leading-snug">
          {typed || "\u00A0"}
          {cursor && <span className="inline-block w-[2px] h-3.5 bg-blue-200 align-[-2px] ml-0.5 animate-pulse" />}
        </div>
      </div>
      {/* Assistant bubble */}
      <div className="flex justify-start">
        <div className="max-w-[88%] rounded-2xl rounded-bl-md bg-white/[0.04] border border-violet-400/20 px-3 py-2.5 text-[12px] leading-snug w-full">
          {revealed === 0 ? (
            <div className="flex items-center gap-1.5 text-violet-200/70 text-[11px]">
              <span className="w-1 h-1 rounded-full bg-violet-300 animate-pulse" />
              <span className="w-1 h-1 rounded-full bg-violet-300 animate-pulse" style={{ animationDelay: "150ms" }} />
              <span className="w-1 h-1 rounded-full bg-violet-300 animate-pulse" style={{ animationDelay: "300ms" }} />
              pensando
            </div>
          ) : (
            <ul className="space-y-1.5">
              {ANSWER.slice(0, revealed).map((row, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="text-gray-400">{row.l}</span>
                  <span className="text-white font-medium tabular-nums">{row.v}</span>
                </motion.li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

/* -------- Panel 4: Weekly report with growing bars ---------- */
function PanelReport() {
  // Bars grow from 0 to their target on mount — when the panel rotates back
  // in, the bars animate again because the entire subtree remounts.
  const data = [40, 55, 35, 70, 45, 60, 80, 65, 50, 75, 90, 70, 85, 95]
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Reportes · semana</p>
          <p className="text-base font-semibold text-white mt-0.5">Cerraste con +23%</p>
        </div>
        <span className="text-[10px] px-2 py-1 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 whitespace-nowrap font-semibold">
          vs semana anterior
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Ingresos", value: "$1.284k" },
          { label: "Ventas", value: "287" },
          { label: "Margen", value: "32%" },
          { label: "Ticket prom.", value: "$4.475" },
        ].map((k) => (
          <div key={k.label} className="rounded-lg bg-white/[0.03] border border-white/10 p-2.5">
            <p className="text-[10px] text-gray-500">{k.label}</p>
            <p className="text-base font-bold text-white tabular-nums">{k.value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl bg-white/[0.02] border border-white/10 p-3 h-24 flex items-end gap-1">
        {data.map((h, i) => (
          <motion.div
            key={i}
            initial={{ height: 0 }}
            animate={{ height: `${h}%` }}
            transition={{ duration: 0.7, delay: i * 0.025, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 rounded-t bg-gradient-to-t from-blue-500/50 to-violet-400/90"
            style={{ willChange: "height" }}
          />
        ))}
      </div>
      {/* Tiny IA brief */}
      <div className="flex items-start gap-2 rounded-lg bg-violet-500/[0.06] border border-violet-400/20 p-2.5">
        <CheckCircle2 className="w-3.5 h-3.5 text-violet-300 shrink-0 mt-0.5" />
        <p className="text-[11px] text-violet-100/85 leading-snug">
          La IA detectó que el martes vendiste 40% más por la promo de Coca + alfajor.
        </p>
      </div>
    </div>
  )
}
