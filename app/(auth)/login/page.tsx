"use client"

import { useEffect, useId, useState } from "react"
import Link from "next/link"
import { signIn } from "next-auth/react"
import { motion } from "framer-motion"
import toast from "react-hot-toast"
import { Eye, EyeOff, Loader2, Sparkles, ArrowRight, Receipt, Package, TrendingUp } from "lucide-react"

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
   LOGIN PREVIEW — la columna izquierda. No es un slogan: es un vistazo a lo
   que el usuario está a punto de ver. Tres KPIs (que cuentan suavemente al
   montar) y un live feed de tres ventas que se autorefresca cada ~3.5 s
   para que la pantalla no se sienta congelada mientras el usuario tipea su
   contraseña.
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
  // Compact-ish: $71.3k vs $213.8k vs $1.2M for big numbers, plain otherwise.
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `$${(n / 1_000).toFixed(1)}k`
  return `$${n.toLocaleString("es-AR")}`
}

function LoginPreview() {
  // Three things change together every ~3.5s: a new row pushes into the feed
  // at the top, "Ventas hoy" bumps by 1, and "Ingresos" adds the sale amount.
  // That makes the panel feel like a real dashboard instead of a static
  // marketing image. We mark which KPI just changed so we can flash it
  // briefly (green pulse + slight scale) — the eye picks up the change
  // without needing a callout.
  const [feed, setFeed] = useState(() =>
    SAMPLE_SALES.slice(0, 3).map((s, i) => ({
      ...s,
      id: i,
      time: nowAR(i * 60),
    })),
  )
  const [ventas, setVentas] = useState(27)
  const [ingresos, setIngresos] = useState(71_300)
  const [stockBajo, setStockBajo] = useState(3)
  const [bumpKey, setBumpKey] = useState(0) // re-keying the KPIs triggers the flash anim

  useEffect(() => {
    let counter = SAMPLE_SALES.length
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return
      counter++
      const next = SAMPLE_SALES[counter % SAMPLE_SALES.length]
      setFeed((prev) => [{ ...next, id: counter, time: nowAR(0) }, ...prev.slice(0, 2)])
      setVentas((v) => v + 1)
      setIngresos((i) => i + next.amount)
      // Stock bajo drifts slowly: drop one occasionally so it feels alive
      // but doesn't grow forever. Bias toward 2-4.
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

  return (
    <div className="space-y-5 select-none">
      <div>
        <p className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-violet-300/80 mb-3">
          <span className="h-px w-6 bg-violet-300/40" /> tu negocio te espera
        </p>
        <h2 className="text-3xl xl:text-4xl font-bold tracking-tight text-white leading-[1.1] mb-3">
          Mientras tipeás,{" "}
          <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 bg-clip-text text-transparent">
            la app sigue trabajando.
          </span>
        </h2>
        <p className="text-sm text-gray-400 max-w-sm leading-relaxed">
          Esto es lo que está pasando ahora mismo en un Orvex real. Cuando entres,
          arriba vas a ver lo tuyo.
        </p>
      </div>

      {/* KPI row — three small chips. Values bump every time a new sale
          lands in the feed below. The motion.span keys on bumpKey so each
          tick triggers a tiny scale + glow flash on the number itself. */}
      <div className="grid grid-cols-3 gap-2">
        {[
          {
            icon: Receipt,
            label: "Ventas hoy",
            value: ventas.toString(),
            color: "text-violet-300",
            ringColor: "rgba(167,139,250,0.45)",
          },
          {
            icon: TrendingUp,
            label: "Ingresos",
            value: formatARS(ingresos),
            color: "text-emerald-300",
            ringColor: "rgba(110,231,183,0.45)",
          },
          {
            icon: Package,
            label: "Stock bajo",
            value: stockBajo.toString(),
            color: "text-amber-300",
            ringColor: "rgba(252,211,77,0.40)",
          },
        ].map(({ icon: Icon, label, value, color, ringColor }) => (
          <div key={label} className="relative rounded-xl bg-white/[0.03] border border-white/10 p-3 overflow-hidden">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon className="w-3 h-3 text-gray-500" />
              <p className="text-[10px] text-gray-500">{label}</p>
            </div>
            <motion.p
              key={`${label}-${bumpKey}-${value}`}
              initial={{ scale: 1, textShadow: `0 0 0 ${ringColor}` }}
              animate={{
                scale: [1.06, 1],
                textShadow: [
                  `0 0 16px ${ringColor}`,
                  `0 0 0 transparent`,
                ],
              }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className={`text-lg font-bold tabular-nums ${color}`}
            >
              {value}
            </motion.p>
          </div>
        ))}
      </div>

      {/* Live feed */}
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
