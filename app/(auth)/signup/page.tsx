"use client"

import { Suspense, useEffect, useId, useRef, useState } from "react"
import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import toast from "react-hot-toast"
import {
  Check,
  Eye,
  EyeOff,
  Loader2,
  Sparkles,
  UserPlus,
  Zap,
  Crown,
  Building2,
  PartyPopper,
} from "lucide-react"
import { BUSINESS_TYPES, PLAN_LABELS_AR, PLAN_PRICES_ARS } from "@/lib/utils"

const VALID_PLAN_PARAMS = ["STARTER", "PROFESSIONAL", "BUSINESS"] as const
type PlanParam = typeof VALID_PLAN_PARAMS[number]

const PLAN_ICON: Record<PlanParam, React.ElementType> = {
  STARTER: Zap,
  PROFESSIONAL: Crown,
  BUSINESS: Building2,
}

const PLAN_PITCH: Record<PlanParam, string> = {
  STARTER: "Kioscos chicos",
  PROFESSIONAL: "El más elegido",
  BUSINESS: "Cadenas",
}

const fmtARS = (n: number) =>
  n === 0
    ? "Gratis"
    : new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 0,
      }).format(n)

interface FormState {
  businessName: string
  businessType: string
  ownerName: string
  email: string
  phone: string
  password: string
  confirmPassword: string
}

interface FormErrors {
  businessName?: string
  businessType?: string
  ownerName?: string
  email?: string
  phone?: string
  password?: string
  confirmPassword?: string
}

const INITIAL: FormState = {
  businessName: "",
  businessType: "",
  ownerName: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
}

type PromoState =
  | { status: "idle" }
  | { status: "loading"; code: string }
  | {
      status: "valid"
      code: string
      planGranted: PlanParam
      daysGranted: number
      remaining: number
      maxUses: number
    }
  | { status: "exhausted"; code: string; planGranted: PlanParam; daysGranted: number; maxUses: number }
  | { status: "invalid"; code: string }

function pluralDias(n: number): string {
  if (n === 1) return "1 día"
  if (n % 30 === 0 && n >= 30) {
    const meses = n / 30
    return meses === 1 ? "1 mes" : `${meses} meses`
  }
  return `${n} días`
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-3xl h-[560px]" />}>
      <SignupForm />
    </Suspense>
  )
}

function SignupForm() {
  const searchParams = useSearchParams()
  const planParamRaw = searchParams.get("plan")?.toUpperCase() ?? ""
  const initialPlan: PlanParam = (VALID_PLAN_PARAMS as readonly string[]).includes(planParamRaw)
    ? (planParamRaw as PlanParam)
    : "STARTER"
  const promoParamRaw = searchParams.get("promo")?.trim().toLowerCase() ?? ""

  const [selectedPlan, setSelectedPlan] = useState<PlanParam>(initialPlan)
  const [promo, setPromo] = useState<PromoState>(
    promoParamRaw ? { status: "loading", code: promoParamRaw } : { status: "idle" }
  )
  // Track whether the user manually changed plan after promo loaded so we
  // don't keep overriding their choice on re-render.
  const userOverrodePromoPlan = useRef(false)

  // Validate promo on mount (only runs if there's a ?promo= param).
  useEffect(() => {
    if (!promoParamRaw) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/promo/${encodeURIComponent(promoParamRaw)}`, {
          cache: "no-store",
        })
        if (!res.ok) {
          if (!cancelled) setPromo({ status: "invalid", code: promoParamRaw })
          return
        }
        const data = await res.json()
        if (cancelled) return
        if (data.valid) {
          const plan = data.planGranted as PlanParam
          setPromo({
            status: "valid",
            code: data.code,
            planGranted: plan,
            daysGranted: data.daysGranted,
            remaining: data.remaining,
            maxUses: data.maxUses,
          })
          if (!userOverrodePromoPlan.current) {
            setSelectedPlan(plan)
          }
        } else if (data.reason === "exhausted") {
          setPromo({
            status: "exhausted",
            code: data.code ?? promoParamRaw,
            planGranted: (data.planGranted as PlanParam) ?? "PROFESSIONAL",
            daysGranted: data.daysGranted ?? 0,
            maxUses: data.maxUses ?? 0,
          })
        } else {
          setPromo({ status: "invalid", code: promoParamRaw })
        }
      } catch {
        if (!cancelled) setPromo({ status: "invalid", code: promoParamRaw })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [promoParamRaw])

  const promoActive = promo.status === "valid"

  const idBusinessName = useId()
  const idBusinessType = useId()
  const idOwnerName = useId()
  const idEmail = useId()
  const idPhone = useId()
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

  function selectPlan(plan: PlanParam) {
    setSelectedPlan(plan)
    if (promo.status === "valid" && plan !== promo.planGranted) {
      userOverrodePromoPlan.current = true
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
    if (!form.phone.trim()) next.phone = "Requerido."
    else if (!/^\+?[0-9\s-]{7,20}$/.test(form.phone.trim()))
      next.phone = "Formato inválido. Ej: +5491112345678"
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

      // Only send promoCode if user didn't override the plan pre-selected by the promo.
      // Otherwise the backend would override their chosen plan with the promo plan.
      const shouldApplyPromo = promo.status === "valid" && !userOverrodePromoPlan.current
      const payload: Record<string, unknown> = {
        businessName: form.businessName.trim(),
        businessType: form.businessType,
        ownerName: form.ownerName.trim(),
        email,
        phone: form.phone.trim(),
        password: form.password,
        plan: selectedPlan,
      }
      if (shouldApplyPromo) payload.promoCode = promo.code

      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409 && data?.code === "PROMO_UNAVAILABLE") {
          // Someone took the last slot between page load and submit.
          // Mark promo as exhausted and ask the user to retry without promo.
          toast.error(
            data.message ??
              "Se agotó la promo mientras completabas el formulario. Probá de nuevo sin el código."
          )
          setPromo((prev) =>
            prev.status === "valid"
              ? {
                  status: "exhausted",
                  code: prev.code,
                  planGranted: prev.planGranted,
                  daysGranted: prev.daysGranted,
                  maxUses: prev.maxUses,
                }
              : prev
          )
          return
        }
        if (res.status === 409) {
          // Server sends specific message — detect whether it's email or phone
          const message = String(data?.message ?? "").toLowerCase()
          if (message.includes("celular") || message.includes("teléfono") || message.includes("telefono")) {
            setErrors({ phone: data.message })
          } else if (message.includes("email")) {
            setErrors({ email: data.message })
          } else {
            toast.error(data?.message ?? "Ya existe una cuenta con estos datos.")
          }
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
        if (data.promoApplied) {
          toast.success(
            `¡Cuenta creada! Tenés ${pluralDias(data.promoApplied.days)} de ${PLAN_LABELS_AR[data.promoApplied.plan as PlanParam]} gratis.`
          )
        } else {
          toast.success("¡Cuenta creada! Bienvenido.")
        }
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

  const submitLabel = (() => {
    if (loading) return "Creando cuenta…"
    if (promoActive && !userOverrodePromoPlan.current && promo.status === "valid") {
      return `Reclamar ${pluralDias(promo.daysGranted)} gratis de ${PLAN_LABELS_AR[promo.planGranted]}`
    }
    return `Empezar prueba de 7 días (${PLAN_LABELS_AR[selectedPlan]})`
  })()

  return (
    <div className="w-full max-w-3xl">
      {/* Promo banner */}
      {promo.status !== "idle" && <PromoBanner promo={promo} />}

      {/* Plan picker */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-3 px-1">
          <Sparkles className="w-4 h-4 text-white/80" />
          <p className="text-xs sm:text-sm text-gray-300">
            {promoActive && !userOverrodePromoPlan.current ? (
              <span className="text-white">Plan aplicado por la promo — podés cambiarlo si querés</span>
            ) : (
              <>Elegí tu plan · <span className="text-white">7 días gratis sin tarjeta</span></>
            )}
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
          {VALID_PLAN_PARAMS.map((plan) => {
            const Icon = PLAN_ICON[plan]
            const isSelected = selectedPlan === plan
            const isPopular = plan === "PROFESSIONAL"
            const isPromoPlan =
              promo.status === "valid" && plan === promo.planGranted && !userOverrodePromoPlan.current
            const price = PLAN_PRICES_ARS[plan]
            return (
              <button
                key={plan}
                type="button"
                onClick={() => selectPlan(plan)}
                aria-pressed={isSelected}
                className={`relative text-left rounded-xl p-3 sm:p-3.5 transition-all ${
                  isSelected
                    ? "bg-white/[0.08] border-white/40 ring-1 ring-white/30"
                    : "bg-white/[0.03] border-white/10 hover:bg-white/[0.05] hover:border-white/20"
                } border backdrop-blur`}
              >
                {isPromoPlan && (
                  <span className="absolute -top-2 right-2 px-1.5 py-0.5 rounded-full bg-emerald-400 text-black text-[9px] font-bold tracking-wider">
                    PROMO
                  </span>
                )}
                {isPopular && !isSelected && !isPromoPlan && (
                  <span className="absolute -top-2 right-2 px-1.5 py-0.5 rounded-full bg-white/90 text-black text-[9px] font-bold tracking-wider">
                    POPULAR
                  </span>
                )}
                {isSelected && !isPromoPlan && (
                  <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-white text-black flex items-center justify-center">
                    <Check className="w-2.5 h-2.5" strokeWidth={3} />
                  </span>
                )}
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-white" : "text-gray-400"}`} />
                  <span className={`text-xs sm:text-sm font-semibold ${isSelected ? "text-white" : "text-gray-200"}`}>
                    {PLAN_LABELS_AR[plan]}
                  </span>
                </div>
                <div className="text-base sm:text-lg font-bold text-white tabular-nums">
                  {isPromoPlan ? (
                    <span className="text-emerald-300">Gratis</span>
                  ) : (
                    <>
                      {fmtARS(price)}
                      {price > 0 && <span className="text-[10px] sm:text-xs font-normal text-gray-500">/mes</span>}
                    </>
                  )}
                </div>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">
                  {isPromoPlan && promo.status === "valid"
                    ? `${pluralDias(promo.daysGranted)} sin cargo`
                    : PLAN_PITCH[plan]}
                </p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Form card */}
      <div className="relative bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-5 sm:p-7 lg:p-8 shadow-2xl shadow-black/50">
        <div className="flex justify-center mb-4 sm:mb-5">
          <div
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.08), 0 10px 30px -10px rgba(0,0,0,0.8)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
            aria-hidden
          >
            <UserPlus className="w-5 h-5 sm:w-6 sm:h-6 text-white" strokeWidth={2} />
          </div>
        </div>

        <div className="text-center mb-5 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
            Crear cuenta
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 mt-1 sm:mt-1.5">
            {promoActive && !userOverrodePromoPlan.current && promo.status === "valid"
              ? `Plan ${PLAN_LABELS_AR[promo.planGranted]} · ${pluralDias(promo.daysGranted)} gratis por la promo`
              : `Plan ${PLAN_LABELS_AR[selectedPlan]} · 7 días gratis`}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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

            <div>
              <label
                htmlFor={idPhone}
                className="block text-xs font-medium text-gray-300 mb-1.5"
              >
                Celular
              </label>
              <input
                id={idPhone}
                type="tel"
                autoComplete="tel"
                placeholder="+549 11 1234-5678"
                value={form.phone}
                onChange={set("phone")}
                className={`${inputBase} ${errors.phone ? inputErr : inputOk}`}
              />
              {errors.phone && (
                <p className="mt-1 text-[11px] text-red-400">{errors.phone}</p>
              )}
            </div>
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
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {submitLabel}
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

function PromoBanner({ promo }: { promo: PromoState }) {
  if (promo.status === "idle") return null

  if (promo.status === "loading") {
    return (
      <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 flex items-center gap-2 text-xs text-gray-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Validando código promocional…
      </div>
    )
  }

  if (promo.status === "invalid") {
    return (
      <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-gray-400">
        El código <span className="font-mono text-gray-300">{promo.code}</span> no es válido o ya venció.
        Podés registrarte normalmente y probar la app gratis.
      </div>
    )
  }

  if (promo.status === "exhausted") {
    return (
      <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200">
        <span className="font-semibold">Se agotaron los cupos de la promo.</span> Te saludamos, ¡muchas gracias por el interés!
        Podés registrarte igual y aprovechar los 14 días de prueba.
      </div>
    )
  }

  // valid
  const pct = Math.round(((promo.maxUses - promo.remaining) / promo.maxUses) * 100)
  return (
    <div className="mb-4 rounded-xl border border-emerald-400/30 bg-gradient-to-br from-emerald-400/15 via-emerald-500/5 to-transparent p-4">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-9 h-9 rounded-full bg-emerald-400/20 border border-emerald-400/40 flex items-center justify-center">
          <PartyPopper className="w-4 h-4 text-emerald-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-emerald-100">
            Promo <span className="font-mono uppercase tracking-wide">{promo.code}</span> activa
          </p>
          <p className="text-xs text-emerald-100/80 mt-0.5">
            {pluralDias(promo.daysGranted)} de{" "}
            <span className="font-semibold">{PLAN_LABELS_AR[promo.planGranted]}</span> gratis · sin tarjeta, sin compromiso.
          </p>
          <div className="mt-2.5">
            <div className="flex items-center justify-between text-[11px] text-emerald-100/80 mb-1">
              <span>
                Quedan <span className="font-semibold text-emerald-200">{promo.remaining}</span> de {promo.maxUses} cupos
              </span>
              <span className="tabular-nums">{pct}% reclamado</span>
            </div>
            <div className="h-1.5 rounded-full bg-emerald-950/50 overflow-hidden">
              <div
                className="h-full bg-emerald-400 transition-all"
                style={{ width: `${Math.min(100, Math.max(3, pct))}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
