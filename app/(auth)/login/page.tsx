"use client"

import { useId, useState } from "react"
import Link from "next/link"
import { signIn } from "next-auth/react"
import toast from "react-hot-toast"
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react"

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
    <div className="w-full max-w-md">
      <div className="relative bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-7 sm:p-8 shadow-2xl shadow-black/50">
        {/* Centered icon */}
        <div className="flex justify-center mb-5">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.08), 0 10px 30px -10px rgba(0,0,0,0.8)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
            aria-hidden
          >
            <LogIn className="w-6 h-6 text-white" strokeWidth={2} />
          </div>
        </div>

        <div className="text-center mb-7">
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            Iniciar sesión
          </h1>
          <p className="text-sm text-gray-400 mt-1.5">
            Accedé a tu cuenta de RetailAR
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label
              htmlFor={emailId}
              className="block text-xs font-medium text-gray-300 mb-1.5"
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
              className={`w-full bg-black/40 border rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition focus:ring-2 focus:ring-white/20 focus:border-white/30 ${
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
              className="block text-xs font-medium text-gray-300 mb-1.5"
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
                className={`w-full bg-black/40 border rounded-lg px-3.5 pr-10 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition focus:ring-2 focus:ring-white/20 focus:border-white/30 ${
                  errors.password
                    ? "border-red-500/60"
                    : "border-white/10 hover:border-white/20"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-500 hover:text-gray-200 transition-colors"
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
                <span className="w-4 h-4 rounded border border-white/20 bg-black/40 peer-checked:bg-white peer-checked:border-white transition-colors" />
                <svg
                  className="absolute left-0.5 top-0.5 w-3 h-3 text-black opacity-0 peer-checked:opacity-100 pointer-events-none"
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
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-200 disabled:opacity-60 disabled:cursor-not-allowed text-black font-semibold rounded-lg py-2.5 text-sm transition-colors mt-1"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Ingresando…
              </>
            ) : (
              "Ingresar"
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-white/10 text-center">
          <p className="text-sm text-gray-500">
            ¿No tenés cuenta?{" "}
            <Link
              href="/signup"
              className="text-white hover:text-gray-200 font-medium transition-colors"
            >
              Registrate gratis
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
