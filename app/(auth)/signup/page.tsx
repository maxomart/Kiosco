"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import toast from "react-hot-toast"
import {
  Loader2,
  Building2,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react"
import { BUSINESS_TYPES } from "@/lib/utils"

interface FormState {
  businessName: string
  businessType: string
  ownerName: string
  email: string
  password: string
  confirmPassword: string
}

interface FormErrors {
  businessName?: string
  businessType?: string
  ownerName?: string
  email?: string
  password?: string
  confirmPassword?: string
}

const INITIAL: FormState = {
  businessName: "",
  businessType: "",
  ownerName: "",
  email: "",
  password: "",
  confirmPassword: "",
}

export default function SignupPage() {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(INITIAL)
  const [errors, setErrors] = useState<FormErrors>({})
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }))
      if (errors[field]) setErrors((er) => ({ ...er, [field]: undefined }))
    }
  }

  function validate(): boolean {
    const next: FormErrors = {}

    if (!form.businessName.trim()) {
      next.businessName = "El nombre del negocio es requerido."
    } else if (form.businessName.trim().length < 2) {
      next.businessName = "Mínimo 2 caracteres."
    }

    if (!form.businessType) {
      next.businessType = "Seleccioná el tipo de negocio."
    }

    if (!form.ownerName.trim()) {
      next.ownerName = "Tu nombre es requerido."
    } else if (form.ownerName.trim().length < 2) {
      next.ownerName = "Mínimo 2 caracteres."
    }

    if (!form.email) {
      next.email = "El email es requerido."
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      next.email = "Ingresá un email válido."
    }

    if (!form.password) {
      next.password = "La contraseña es requerida."
    } else if (form.password.length < 8) {
      next.password = "Mínimo 8 caracteres."
    }

    if (!form.confirmPassword) {
      next.confirmPassword = "Confirmá tu contraseña."
    } else if (form.password !== form.confirmPassword) {
      next.confirmPassword = "Las contraseñas no coinciden."
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: form.businessName.trim(),
          businessType: form.businessType,
          ownerName: form.ownerName.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 409) {
          setErrors({ email: "Este email ya está registrado." })
        } else if (data?.errors) {
          // Zod field errors
          const fieldErrors: FormErrors = {}
          for (const err of data.errors as { path: string[]; message: string }[]) {
            const field = err.path[0] as keyof FormErrors
            if (field) fieldErrors[field] = err.message
          }
          setErrors(fieldErrors)
        } else {
          toast.error(data?.message ?? "Error al registrarse. Intentá de nuevo.")
        }
        return
      }

      toast.success("¡Cuenta creada! Ya podés iniciar sesión.")
      router.push("/login")
    } catch {
      toast.error("Ocurrió un error. Intentá de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-lg">
      {/* Trial banner */}
      <div className="mb-5 flex items-center gap-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 py-3">
        <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
        <p className="text-sm text-indigo-300">
          <span className="font-semibold">30 días gratis</span> &mdash; sin tarjeta de
          crédito. Cancelá cuando quieras.
        </p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl shadow-black/40">
        {/* Header */}
        <div className="mb-7 text-center">
          <h1 className="text-2xl font-bold text-white mb-1">Crear cuenta</h1>
          <p className="text-sm text-gray-400">
            Empezá a gestionar tu negocio hoy
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Business Name */}
          <div>
            <label
              htmlFor="businessName"
              className="block text-sm font-medium text-gray-300 mb-1.5"
            >
              Nombre del negocio
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              <input
                id="businessName"
                type="text"
                autoComplete="organization"
                value={form.businessName}
                onChange={set("businessName")}
                placeholder="Ej: Kiosco El Sol"
                className={`w-full bg-gray-950 border rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition focus:ring-2 focus:ring-purple-600/60 focus:border-purple-600 ${
                  errors.businessName
                    ? "border-red-500/70 focus:ring-red-500/40 focus:border-red-500"
                    : "border-gray-700 hover:border-gray-600"
                }`}
              />
            </div>
            {errors.businessName && (
              <p className="mt-1.5 text-xs text-red-400">{errors.businessName}</p>
            )}
          </div>

          {/* Business Type */}
          <div>
            <label
              htmlFor="businessType"
              className="block text-sm font-medium text-gray-300 mb-1.5"
            >
              Tipo de negocio
            </label>
            <select
              id="businessType"
              value={form.businessType}
              onChange={set("businessType")}
              className={`w-full bg-gray-950 border rounded-xl px-4 py-2.5 text-sm text-white outline-none transition appearance-none cursor-pointer focus:ring-2 focus:ring-purple-600/60 focus:border-purple-600 ${
                errors.businessType
                  ? "border-red-500/70 focus:ring-red-500/40 focus:border-red-500"
                  : "border-gray-700 hover:border-gray-600"
              } ${!form.businessType ? "text-gray-600" : ""}`}
            >
              <option value="" disabled className="text-gray-600">
                Seleccioná una opción…
              </option>
              {BUSINESS_TYPES.map((bt) => (
                <option key={bt.value} value={bt.value} className="text-white bg-gray-900">
                  {bt.label}
                </option>
              ))}
            </select>
            {errors.businessType && (
              <p className="mt-1.5 text-xs text-red-400">{errors.businessType}</p>
            )}
          </div>

          {/* Owner Name */}
          <div>
            <label
              htmlFor="ownerName"
              className="block text-sm font-medium text-gray-300 mb-1.5"
            >
              Tu nombre
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              <input
                id="ownerName"
                type="text"
                autoComplete="name"
                value={form.ownerName}
                onChange={set("ownerName")}
                placeholder="Juan García"
                className={`w-full bg-gray-950 border rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition focus:ring-2 focus:ring-purple-600/60 focus:border-purple-600 ${
                  errors.ownerName
                    ? "border-red-500/70 focus:ring-red-500/40 focus:border-red-500"
                    : "border-gray-700 hover:border-gray-600"
                }`}
              />
            </div>
            {errors.ownerName && (
              <p className="mt-1.5 text-xs text-red-400">{errors.ownerName}</p>
            )}
          </div>

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
                onChange={set("email")}
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
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-300 mb-1.5"
            >
              Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={form.password}
                onChange={set("password")}
                placeholder="Mínimo 8 caracteres"
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
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1.5 text-xs text-red-400">{errors.password}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-300 mb-1.5"
            >
              Confirmar contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              <input
                id="confirmPassword"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={set("confirmPassword")}
                placeholder="Repetí tu contraseña"
                className={`w-full bg-gray-950 border rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition focus:ring-2 focus:ring-purple-600/60 focus:border-purple-600 ${
                  errors.confirmPassword
                    ? "border-red-500/70 focus:ring-red-500/40 focus:border-red-500"
                    : "border-gray-700 hover:border-gray-600"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                aria-label={showConfirm ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="mt-1.5 text-xs text-red-400">{errors.confirmPassword}</p>
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
                Creando cuenta…
              </>
            ) : (
              "Crear cuenta gratis"
            )}
          </button>

          <p className="text-xs text-center text-gray-600 leading-relaxed">
            Al registrarte aceptás nuestros{" "}
            <Link href="/terms" className="text-gray-500 hover:text-gray-400 underline underline-offset-2">
              Términos de servicio
            </Link>{" "}
            y{" "}
            <Link href="/privacy" className="text-gray-500 hover:text-gray-400 underline underline-offset-2">
              Política de privacidad
            </Link>
            .
          </p>
        </form>

        {/* Divider */}
        <div className="mt-6 pt-6 border-t border-gray-800 text-center">
          <p className="text-sm text-gray-500">
            ¿Ya tenés cuenta?{" "}
            <Link
              href="/login"
              className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
            >
              Iniciá sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
