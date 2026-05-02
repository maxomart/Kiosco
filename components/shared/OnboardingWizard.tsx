"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
  Package,
  DollarSign,
  Receipt,
  BarChart3,
  Image as ImageIcon,
  Check,
  Lock,
  Sparkles,
  ArrowRight,
  X,
  PartyPopper,
} from "lucide-react"

interface WizardState {
  completedAt: string | null
  steps: {
    product: boolean
    cash: boolean
    sale: boolean
    report: boolean
    logo: boolean
  }
  completedCount: number
  allDone: boolean
}

type StepKey = keyof WizardState["steps"]

interface StepDef {
  key: StepKey
  number: number
  title: string
  pitch: string
  cta: string
  href: string
  icon: typeof Package
  gradient: string
  iconBg: string
  iconColor: string
}

const STEPS: StepDef[] = [
  {
    key: "product",
    number: 1,
    title: "Cargá tu primer producto",
    pitch: "Empezá con uno solo — tipo Coca 500ml. Después podés importar todos juntos desde un Excel.",
    cta: "Cargar producto",
    href: "/inventario",
    icon: Package,
    gradient: "from-emerald-500/20 via-emerald-500/5 to-transparent",
    iconBg: "bg-emerald-500/20",
    iconColor: "text-emerald-400",
  },
  {
    key: "cash",
    number: 2,
    title: "Abrí tu primera caja",
    pitch: "Declará el dinero con el que arrancás la jornada. Lleva 5 segundos.",
    cta: "Abrir caja",
    href: "/caja",
    icon: DollarSign,
    gradient: "from-amber-500/20 via-amber-500/5 to-transparent",
    iconBg: "bg-amber-500/20",
    iconColor: "text-amber-400",
  },
  {
    key: "sale",
    number: 3,
    title: "Hacé una venta de prueba",
    pitch: "Vendé el producto que cargaste. Asi vas a ver lo rápido que es el POS de Orvex.",
    cta: "Ir al POS",
    href: "/pos",
    icon: Receipt,
    gradient: "from-rose-500/20 via-rose-500/5 to-transparent",
    iconBg: "bg-rose-500/20",
    iconColor: "text-rose-400",
  },
  {
    key: "report",
    number: 4,
    title: "Mirá el reporte",
    pitch: "Tu venta ya aparece en gráficos en tiempo real. Acá vas a vivir todos los días.",
    cta: "Ver reportes",
    href: "/reportes",
    icon: BarChart3,
    gradient: "from-sky-500/20 via-sky-500/5 to-transparent",
    iconBg: "bg-sky-500/20",
    iconColor: "text-sky-400",
  },
  {
    key: "logo",
    number: 5,
    title: "Subí tu logo",
    pitch: "Personalizá Orvex con el nombre y el logo de tu kiosco. Va a aparecer en los tickets.",
    cta: "Configurar marca",
    href: "/configuracion",
    icon: ImageIcon,
    gradient: "from-purple-500/20 via-purple-500/5 to-transparent",
    iconBg: "bg-purple-500/20",
    iconColor: "text-purple-400",
  },
]

export function OnboardingWizard() {
  const [state, setState] = useState<WizardState | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/onboarding/wizard", { cache: "no-store" })
      if (res.ok) {
        const data: WizardState = await res.json()
        setState(data)
        // Position active to first incomplete
        const idx = STEPS.findIndex((s) => !data.steps[s.key])
        setActiveIndex(idx === -1 ? 4 : idx)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    // Re-check on focus — user comes back from another tab having done a step
    const onFocus = () => load()
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [load])

  const handleSkip = async () => {
    await fetch("/api/onboarding/wizard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "skip" }),
    })
    setState((prev) => (prev ? { ...prev, completedAt: new Date().toISOString() } : prev))
  }

  const handleFinish = async () => {
    await fetch("/api/onboarding/wizard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete" }),
    })
    setState((prev) => (prev ? { ...prev, completedAt: new Date().toISOString() } : prev))
  }

  const handleStepCta = async (step: StepDef) => {
    if (step.key === "report") {
      // Mark as seen optimistically
      await fetch("/api/onboarding/wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markReportsSeen" }),
      }).catch(() => {})
    }
  }

  if (loading || !state) return null
  if (state.completedAt) return null

  const activeStep = STEPS[activeIndex]
  const isStepUnlocked = (idx: number) => {
    if (idx === 0) return true
    return state.steps[STEPS[idx - 1].key]
  }
  const progressPct = (state.completedCount / 5) * 100

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 25 }}
          className="relative w-full max-w-3xl bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden my-8"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-white font-bold text-lg leading-tight">Bienvenido a Orvex</h2>
                <p className="text-xs text-gray-400">5 pasos para tener tu kiosco 100% listo</p>
              </div>
            </div>
            <button
              onClick={handleSkip}
              className="text-xs text-gray-500 hover:text-gray-200 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors flex items-center gap-1 flex-shrink-0"
              title="Podés volver desde el menú de configuración"
            >
              Saltar por ahora
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="px-6 pt-4 pb-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 uppercase tracking-wider font-bold">
                Progreso
              </span>
              <span className="text-xs text-gray-300 font-medium tabular-nums">
                {state.completedCount}/5 completados
              </span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-purple-500 to-purple-400"
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ type: "spring", stiffness: 100, damping: 20 }}
              />
            </div>
          </div>

          {/* Step indicators */}
          <div className="px-6 py-4 flex items-center justify-between gap-2">
            {STEPS.map((step, idx) => {
              const done = state.steps[step.key]
              const unlocked = isStepUnlocked(idx)
              const isActive = idx === activeIndex
              return (
                <button
                  key={step.key}
                  onClick={() => unlocked && setActiveIndex(idx)}
                  disabled={!unlocked}
                  className={`flex-1 flex flex-col items-center gap-1.5 py-2 rounded-lg transition-all ${
                    isActive ? "bg-white/5" : ""
                  } ${unlocked ? "cursor-pointer hover:bg-white/5" : "cursor-not-allowed opacity-50"}`}
                >
                  <div
                    className={`relative w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      done
                        ? "bg-emerald-500 text-white"
                        : isActive
                        ? "bg-purple-500 text-white ring-2 ring-purple-400/50 ring-offset-2 ring-offset-gray-950"
                        : unlocked
                        ? "bg-gray-800 text-gray-300"
                        : "bg-gray-900 text-gray-600"
                    }`}
                  >
                    {done ? <Check className="w-4 h-4" /> : !unlocked ? <Lock className="w-3.5 h-3.5" /> : step.number}
                  </div>
                  <span
                    className={`text-[10px] uppercase tracking-wider hidden sm:block ${
                      done ? "text-emerald-400" : isActive ? "text-purple-300" : "text-gray-500"
                    }`}
                  >
                    Paso {step.number}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Active step */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep.key}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className={`relative overflow-hidden bg-gradient-to-br ${activeStep.gradient}`}
            >
              <div className="px-6 py-8">
                <div className="flex items-start gap-4">
                  <div
                    className={`w-14 h-14 rounded-2xl ${activeStep.iconBg} flex items-center justify-center flex-shrink-0`}
                  >
                    <activeStep.icon className={`w-7 h-7 ${activeStep.iconColor}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-500 uppercase tracking-wider font-bold">
                        Paso {activeStep.number} de 5
                      </span>
                      {state.steps[activeStep.key] && (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                          ✓ Hecho
                        </span>
                      )}
                    </div>
                    <h3 className="text-2xl font-bold text-white leading-tight mb-2">
                      {activeStep.title}
                    </h3>
                    <p className="text-sm text-gray-300 leading-relaxed">
                      {activeStep.pitch}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-6">
                  {state.steps[activeStep.key] ? (
                    activeIndex < 4 ? (
                      <button
                        onClick={() => setActiveIndex(activeIndex + 1)}
                        className="bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-xl px-5 py-3 transition-colors flex items-center gap-2 shadow-lg shadow-purple-900/40"
                      >
                        Siguiente paso
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={handleFinish}
                        className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white text-sm font-semibold rounded-xl px-5 py-3 transition-all flex items-center gap-2 shadow-lg shadow-emerald-900/40"
                      >
                        <PartyPopper className="w-4 h-4" />
                        Terminar
                      </button>
                    )
                  ) : (
                    <Link
                      href={activeStep.href}
                      onClick={() => handleStepCta(activeStep)}
                      className="bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-xl px-5 py-3 transition-colors flex items-center gap-2 shadow-lg shadow-purple-900/40"
                    >
                      {activeStep.cta}
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  )}
                  {activeIndex > 0 && (
                    <button
                      onClick={() => setActiveIndex(activeIndex - 1)}
                      className="text-sm text-gray-400 hover:text-gray-200 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      Atrás
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* All-done celebration footer */}
          {state.allDone && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-6 py-4 border-t border-emerald-900/40 bg-gradient-to-r from-emerald-950/40 to-transparent flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2 min-w-0">
                <PartyPopper className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <p className="text-sm text-emerald-200 truncate">
                  ¡Listo! Tenés Orvex configurado.
                </p>
              </div>
              <button
                onClick={handleFinish}
                className="bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-semibold rounded-lg px-3 py-1.5 transition-colors flex-shrink-0"
              >
                Cerrar
              </button>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
