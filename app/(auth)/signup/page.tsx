"use client"

import { Suspense, useId, useState } from "react"
import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import toast from "react-hot-toast"
import { Eye, EyeOff, Loader2, Sparkles, UserPlus } from "lucide-react"
import { BUSINESS_TYPES, PLAN_LABELS_AR } from "@/lib/utils"

const VALID_PLAN_PARAMS = ["FREE", "STARTER", "PROFESSIONAL", "BUSINESS"] as const
type PlanParam = typeof VALID_PLAN_PARAMS[number]

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
  return (
    <Suspense fallback={<div className="w-full max-w-lg h-[560px]" />}>
      <SignupForm />
    </Suspense>
  )
}

function SignupForm() {
  const searchParams = useSearchParams()
  const planParamRaw = searchParams.get("plan")?.toUpperCase() ?? ""
  const selectedPlan: PlanParam = (VALID_PLAN_PARAMS as readonly string[]).includes(planParamRaw)
    ? (planParamRaw as PlanParam)
    : "FREE"
  const isPaid = selectedPlan !== "FREE"

  const idBusinessName = useId()
  const idBusinessType = useId()
  const idOwnerName = useId()
  const idEmail = useId()
  const idPassword = useId()
  const idConfirmPassword = useId()

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
    if (!form.businessName.trim()) next.businessName = "Requerido."
    else if (form.businessName.trim().length < 2) next.businessName = "Mínimo 2 caracteres."
    if (!form.businessType) next.businessType = "Seleccioná el tipo."
    if (!form.ownerName.trim()) next.ownerName = "Requerido."
    else if (form.ownerName.trim().length < 2) next.ownerName = "Mínimo 2 caracteres."
    if (!form.email) next.email = "Requerido."
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      next.email = "Ingresá un email válido."
    if (!form.password) next.password = "Requerido."
    else if (form.password.length < 8) next.password = "Mínimo 8 caracteres."
    if (!form.confirmPassword) next.confirmPassword = "Confirmá tu contraseña."
    else if (form.password !== form.confirmPassword)
      next.confirmPassword = "Las contraseñas no coinciden."
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const email = form.email.trim().toLowerCase()
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: form.businessName.trim(),
          businessType: form.businessType,
          ownerName: form.ownerName.trim(),
          email,
          password: form.password,
          plan: selectedPlan,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409) {
          setErrors({ email: "Este email ya está registrado." })
        } else if (data?.errors) {
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
      const result = await signIn("credentials", {
        email,
        password: form.password,
        redirect: false,
      })
      if (result?.ok) {
        toast.success("¡Cuenta creada! Bienvenido.")
        window.location.href = "/inicio"
      } else {
        toast.success("Cuenta creada. Iniciá sesión.")
        window.location.href = "/login"
      }
    } catch {
      toast.error("Ocurrió un error. Intentá de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  const inputBase =
    "w-full bg-black/40 border rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition focus:ring-2 focus:ring-white/20 focus:border-white/30"
  const inputOk = "border-white/10 hover:border-white/20"
  const inputErr = "border-red-500/60"

  return (
    <div className="w-full max-w-lg">
      <div className="mb-4 flex items-center gap-2.5 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5">
        <Sparkles className="w-4 h-4 text-white shrink-0" />
        <p className="text-xs text-gray-300">
          {isPaid ? (
            <>
              Plan <span className="font-semibold text-white">{PLAN_LABELS_AR[selectedPlan]}</span> ·
              <span className="font-semibold text-white"> 14 días gratis</span> sin tarjeta.
              Después elegís si seguís o cancelás.
            </>
          ) : (
            <>
              <span className="font-semibold text-white">Plan Gratis</span> — sin costo, sin tarjeta.
              Podés mejorar cuando quieras.
            </>
          )}
        </p>
      </div>

      <div className="relative bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-7 sm:p-8 shadow-2xl shadow-black/50">
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
            <UserPlus className="w-6 h-6 text-white" strokeWidth={2} />
          </div>
        </div>

        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            Crear cuenta
          </h1>
          <p className="text-sm text-gray-400 mt-1.5">
            Empezá a gestionar tu negocio hoy
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label
                htmlFor={idBusinessName}
                className="block text-xs font-medium text-gray-300 mb-1.5"
              >
                Nombre del negocio
              </label>
              <input
                id={idBusinessName}
                type="text"
                autoComplete="organization"
                placeholder="Kiosco El Sol"
                value={form.businessName}
                onChange={set("businessName")}
                className={`${inputBase} ${errors.businessName ? inputErr : inputOk}`}
              />
              {errors.businessName && (
                <p className="mt-1 text-[11px] text-red-400">{errors.businessName}</p>
              )}
            </div>

            <div>
              <label
                htmlFor={idBusinessType}
                className="block text-xs font-medium text-gray-300 mb-1.5"
              >
                Tipo de negocio
              </label>
              <select
                id={idBusinessType}
                value={form.businessType}
                onChange={set("businessType")}
                className={`${inputBase} ${errors.businessType ? inputErr : inputOk} ${
                  !form.businessType ? "text-gray-500" : ""
                } cursor-pointer`}
              >
                <option value="" disabled>
                  Seleccioná…
                </option>
                {BUSINESS_TYPES.map((bt) => (
                  <option key={bt.value} value={bt.value} className="bg-gray-950 text-white">
                    {bt.label}
                  </option>
                ))}
              </select>
              {errors.businessType && (
                <p className="mt-1 text-[11px] text-red-400">{errors.businessType}</p>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor={idOwnerName}
              className="block text-xs font-medium text-gray-300 mb-1.5"
            >
              Tu nombre
            </label>
            <input
              id={idOwnerName}
              type="text"
              autoComplete="name"
              placeholder="Juan García"
              value={form.ownerName}
              onChange={set("ownerName")}
              className={`${inputBase} ${errors.ownerName ? inputErr : inputOk}`}
            />
            {errors.ownerName && (
              <p className="mt-1 text-[11px] text-red-400">{errors.ownerName}</p>
            )}
          </div>

          <div>
            <label
              htmlFor={idEmail}
              className="block text-xs font-medium text-gray-300 mb-1.5"
            >
              Email
            </label>
            <input
              id={idEmail}
              type="email"
              autoComplete="email"
              placeholder="tu@email.com"
              value={form.email}
              onChange={set("email")}
              className={`${inputBase} ${errors.email ? inputErr : inputOk}`}
            />
            {errors.email && (
              <p className="mt-1 text-[11px] text-red-400">{errors.email}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label
                htmlFor={idPassword}
                className="block text-xs font-medium text-gray-300 mb-1.5"
              >
                Contraseña
              </label>
              <div className="relative">
                <input
                  id={idPassword}
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Mín. 8 caracteres"
                  value={form.password}
                  onChange={set("password")}
                  className={`${inputBase} pr-10 ${errors.password ? inputErr : inputOk}`}
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
                <p className="mt-1 text-[11px] text-red-400">{errors.password}</p>
              )}
            </div>

            <div>
              <label
                htmlFor={idConfirmPassword}
                className="block text-xs font-medium text-gray-300 mb-1.5"
              >
                Confirmar
              </label>
              <div className="relative">
                <input
                  id={idConfirmPassword}
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Repetí la contraseña"
                  value={form.confirmPassword}
                  onChange={set("confirmPassword")}
                  className={`${inputBase} pr-10 ${errors.confirmPassword ? inputErr : inputOk}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-500 hover:text-gray-200 transition-colors"
                  aria-label={showConfirm ? "Ocultar" : "Mostrar"}
                >
                  {showConfirm ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-[11px] text-red-400">{errors.confirmPassword}</p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-200 disabled:opacity-60 disabled:cursor-not-allowed text-black font-semibold rounded-lg py-2.5 text-sm transition-colors mt-2"
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

          <p className="text-[11px] text-center text-gray-600 leading-relaxed">
            Al registrarte aceptás nuestros{" "}
            <Link href="/terms" className="text-gray-500 hover:text-gray-300 underline underline-offset-2">
              Términos
            </Link>{" "}
            y{" "}
            <Link href="/privacy" className="text-gray-500 hover:text-gray-300 underline underline-offset-2">
              Política de privacidad
            </Link>
            .
          </p>
        </form>

        <div className="mt-5 pt-5 border-t border-white/10 text-center">
          <p className="text-sm text-gray-500">
            ¿Ya tenés cuenta?{" "}
            <Link
              href="/login"
              className="text-white hover:text-gray-200 font-medium transition-colors"
            >
              Iniciá sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
