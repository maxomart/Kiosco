"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  CheckCircle2,
  Circle,
  ChevronRight,
  X,
  Store,
  Tag,
  Package,
  Truck,
  DollarSign,
  Receipt,
  Sparkles,
  ArrowRight,
} from "lucide-react"

interface OnboardingStatus {
  dismissed: boolean
  steps: {
    business: boolean
    categories: boolean
    products: boolean
    suppliers: boolean
    cashOpened: boolean
    firstSale: boolean
  }
  completedCount: number
  totalSteps: number
  progress: number
  allDone: boolean
}

interface StepDef {
  key: keyof OnboardingStatus["steps"]
  title: string
  description: string
  cta: string
  href: string
  icon: typeof Store
  color: string
  bg: string
}

const STEPS: StepDef[] = [
  {
    key: "business",
    title: "Configurá tu negocio",
    description: "Nombre, logo, tipo de local y tus datos fiscales.",
    cta: "Configurar",
    href: "/configuracion",
    icon: Store,
    color: "text-purple-400",
    bg: "bg-purple-900/30",
  },
  {
    key: "categories",
    title: "Creá tus categorías",
    description: "Bebidas, Golosinas, Limpieza… para agrupar tus productos.",
    cta: "Crear categorías",
    href: "/inventario",
    icon: Tag,
    color: "text-sky-400",
    bg: "bg-sky-900/30",
  },
  {
    key: "products",
    title: "Cargá tus productos",
    description: "Uno por uno o importá todo junto desde un archivo CSV.",
    cta: "Agregar productos",
    href: "/inventario",
    icon: Package,
    color: "text-emerald-400",
    bg: "bg-emerald-900/30",
  },
  {
    key: "suppliers",
    title: "Registrá un proveedor",
    description: "Para después poder cargar compras rápido con foto del remito.",
    cta: "Agregar proveedor",
    href: "/cargas",
    icon: Truck,
    color: "text-amber-400",
    bg: "bg-amber-900/30",
  },
  {
    key: "cashOpened",
    title: "Abrí tu primera caja",
    description: "Arrancá la jornada declarando el dinero con el que empezás.",
    cta: "Abrir caja",
    href: "/caja",
    icon: DollarSign,
    color: "text-orange-400",
    bg: "bg-orange-900/30",
  },
  {
    key: "firstSale",
    title: "Hacé tu primera venta",
    description: "Ya está todo listo — ¡vendé algo desde el POS!",
    cta: "Ir al POS",
    href: "/pos",
    icon: Receipt,
    color: "text-rose-400",
    bg: "bg-rose-900/30",
  },
]

export function OnboardingChecklist() {
  const [status, setStatus] = useState<OnboardingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)

  const load = async () => {
    try {
      const res = await fetch("/api/onboarding/status")
      if (res.ok) setStatus(await res.json())
    } catch {
      // silently ignore — checklist is non-critical
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleDismiss = async () => {
    try {
      await fetch("/api/onboarding/dismiss", { method: "POST" })
      setStatus((prev) => (prev ? { ...prev, dismissed: true } : prev))
    } catch {
      // ignore
    }
  }

  if (loading || !status) return null
  if (status.dismissed) return null
  if (status.allDone) {
    // Show a congratulation card that auto-dismisses on dismiss click
    return (
      <div className="bg-gradient-to-br from-emerald-900/40 to-emerald-950/40 border border-emerald-700/40 rounded-xl p-5 mb-6 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-gray-100 font-semibold">¡Terminaste la configuración!</h3>
            <p className="text-sm text-gray-400 mt-0.5">
              Ya tenés todo listo para gestionar tu negocio. Podés cerrar esta tarjeta.
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="p-2 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-white/5 flex-shrink-0"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  const nextStep = STEPS.find((s) => !status.steps[s.key])

  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-900/50 border border-accent/30 rounded-xl overflow-hidden mb-6 shadow-lg shadow-black/20">
      {/* Header */}
      <div className="p-5 border-b border-gray-800 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-accent-soft flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-gray-100 font-semibold">Primeros pasos</h3>
              <span className="text-xs text-accent bg-accent-soft border border-accent/30 rounded-full px-2 py-0.5">
                {status.completedCount}/{status.totalSteps}
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-0.5">
              Completá estos pasos para tener tu kiosco 100% funcional
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1 rounded"
          >
            {collapsed ? "Ver pasos" : "Minimizar"}
          </button>
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded text-gray-500 hover:text-gray-200 hover:bg-white/5"
            aria-label="Cerrar"
            title="Ocultar esta guía (podés reactivarla desde configuración)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-5 pt-4">
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent to-accent/70 transition-all duration-500"
            style={{ width: `${status.progress}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      {!collapsed && (
        <div className="p-5 space-y-2">
          {STEPS.map((step) => {
            const done = status.steps[step.key]
            const Icon = step.icon
            const isNext = !done && step.key === nextStep?.key

            return (
              <div
                key={step.key}
                className={`flex items-center gap-3 rounded-lg p-3 border transition-colors ${
                  done
                    ? "border-emerald-700/30 bg-emerald-950/20"
                    : isNext
                    ? "border-accent/40 bg-accent-soft/30"
                    : "border-gray-800 bg-gray-900/50"
                }`}
              >
                {/* Check/circle */}
                <div className="flex-shrink-0">
                  {done ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-600" />
                  )}
                </div>

                {/* Icon */}
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    done ? "bg-emerald-900/30" : step.bg
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${done ? "text-emerald-400" : step.color}`}
                  />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium ${
                      done ? "text-gray-400 line-through" : "text-gray-100"
                    }`}
                  >
                    {step.title}
                  </p>
                  {!done && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {step.description}
                    </p>
                  )}
                </div>

                {/* CTA */}
                {!done && (
                  <Link
                    href={step.href}
                    className={`flex-shrink-0 text-xs font-medium rounded-lg px-3 py-1.5 transition-colors flex items-center gap-1 ${
                      isNext
                        ? "bg-accent hover:bg-accent-hover text-accent-foreground"
                        : "bg-gray-800 hover:bg-gray-700 text-gray-200"
                    }`}
                  >
                    {step.cta}
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
