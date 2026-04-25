"use client"

import { useId, useState } from "react"
import Link from "next/link"
import { signIn } from "next-auth/react"
import { motion } from "framer-motion"
import toast from "react-hot-toast"
import { Eye, EyeOff, Loader2, Sparkles, ArrowRight } from "lucide-react"

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
      className="w-full max-w-md"
    >
      {/* Outer glow that bleeds out from under the card */}
      <div className="relative">
        <div
          aria-hidden
          className="absolute -inset-px rounded-2xl opacity-60 blur-xl"
          style={{
            background:
              "linear-gradient(135deg, rgba(59,130,246,0.35), rgba(139,92,246,0.35))",
          }}
        />

        <div className="relative bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-2xl p-7 sm:p-9 shadow-2xl shadow-black/60 overflow-hidden">
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

            <div className="flex items-center justify-between pt-1">
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
