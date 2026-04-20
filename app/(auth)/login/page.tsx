"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { signIn } from "next-auth/react"
import toast from "react-hot-toast"
import { Loader2, Mail, Lock, Eye, EyeOff } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: "", password: "" })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})

  function validate() {
    const next: typeof errors = {}
    if (!form.email) {
      next.email = "El email es requerido."
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      next.email = "Ingresá un email válido."
    }
    if (!form.password) {
      next.password = "La contraseña es requerida."
    } else if (form.password.length < 4) {
      next.password = "Mínimo 4 caracteres."
    }
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
        toast.error("Email o contraseña incorrectos. Verificá tus datos o creá una cuenta.")
      } else if (!result?.ok) {
        toast.error("No se pudo iniciar sesión. Intentá de nuevo.")
      } else {
        toast.success("Bienvenido de vuelta!")
        // Force a full reload so the new session cookie is picked up by
        // the server-rendered layouts. window.location avoids any stale
        // router cache that could keep us on /login.
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
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl shadow-black/40">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-white mb-1">Iniciar sesión</h1>
          <p className="text-sm text-gray-400">
            Ingresá a tu cuenta de RetailAR
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-300 mb-1.5"
            >
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => {
                  setForm((f) => ({ ...f, email: e.target.value }))
                  if (errors.email) setErrors((er) => ({ ...er, email: undefined }))
                }}
                placeholder="tu@email.com"
                className={`w-full bg-gray-950 border rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition focus:ring-2 focus:ring-purple-600/60 focus:border-purple-600 ${
                  errors.email
                    ? "border-red-500/70 focus:ring-red-500/40 focus:border-red-500"
                    : "border-gray-700 hover:border-gray-600"
                }`}
              />
            </div>
            {errors.email && (
              <p className="mt-1.5 text-xs text-red-400">{errors.email}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-300"
              >
                Contraseña
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => {
                  setForm((f) => ({ ...f, password: e.target.value }))
                  if (errors.password)
                    setErrors((er) => ({ ...er, password: undefined }))
                }}
                placeholder="••••••••"
                className={`w-full bg-gray-950 border rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition focus:ring-2 focus:ring-purple-600/60 focus:border-purple-600 ${
                  errors.password
                    ? "border-red-500/70 focus:ring-red-500/40 focus:border-red-500"
                    : "border-gray-700 hover:border-gray-600"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
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

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-2.5 text-sm transition-colors shadow-lg shadow-purple-900/30 mt-2"
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

        {/* Divider */}
        <div className="mt-6 pt-6 border-t border-gray-800 text-center">
          <p className="text-sm text-gray-500">
            ¿No tenés cuenta?{" "}
            <Link
              href="/signup"
              className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
            >
              Registrate gratis
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
