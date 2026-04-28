"use client"

import { useState, useEffect, useRef } from "react"
import dynamic from "next/dynamic"
import { motion, AnimatePresence } from "framer-motion"
import {
  X,
  Lock,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Check,
  Sparkles,
  Calendar,
  CircleSlash2,
} from "lucide-react"
import toast from "react-hot-toast"
import { formatCurrency } from "@/lib/utils"
import type { MPCustomCardFormHandle } from "@/components/billing/MPCustomCardForm"

// El form custom toca window (Secure Fields) — ssr off.
const MPCustomCardForm = dynamic(
  () => import("@/components/billing/MPCustomCardForm").then((m) => m.MPCustomCardForm),
  { ssr: false, loading: () => null }
) as any // forwardRef + dynamic — TS no infiere el ref bien sin esto

type PaidPlan = "STARTER" | "PROFESSIONAL" | "BUSINESS"

interface Props {
  open: boolean
  onClose: () => void
  plan: PaidPlan
  planLabel: string
  amount: number
  period: "monthly" | "annual"
  onSuccess: () => void
}

const PLAN_BENEFITS: Record<PaidPlan, string[]> = {
  STARTER: [
    "Hasta 500 productos",
    "Hasta 2.000 ventas/mes",
    "3 usuarios",
    "Clientes y categorías ilimitados",
    "Logo personalizado",
  ],
  PROFESSIONAL: [
    "Hasta 5.000 productos",
    "Ventas ilimitadas",
    "10 usuarios",
    "Programa de fidelidad (puntos)",
    "Multi-caja simultánea",
    "Asistente IA — 500 mensajes/día",
    "Historial de 1 año",
  ],
  BUSINESS: [
    "Todo ilimitado",
    "Multi-tienda (varias sucursales)",
    "API access",
    "Asistente IA — 5.000 mensajes/día",
    "Soporte por WhatsApp directo",
  ],
}

export function MPCardModal({ open, onClose, plan, planLabel, amount, period, onSuccess }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [missingKey, setMissingKey] = useState(false)
  const [success, setSuccess] = useState(false)
  // Cada error genera un attempt nuevo → re-mount del form para que el SDK
  // genere un card_token fresco (cada token es single-use).
  const [attemptId, setAttemptId] = useState(0)
  // Tracking de cuándo el form se montó y cargó el SDK — el botón "Pagar"
  // queda deshabilitado hasta entonces (sin esto, si el user clickea
  // antes de que el chunk dinámico cargue, formRef.current es null).
  const [formReady, setFormReady] = useState(false)

  const formRef = useRef<MPCustomCardFormHandle | null>(null)
  const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY ?? ""

  useEffect(() => {
    if (!open) {
      setError(null)
      setSubmitting(false)
      setSuccess(false)
      setAttemptId(0)
      setFormReady(false)
      return
    }
    setMissingKey(!publicKey)
  }, [open, publicKey])

  // formReady se resetea al re-mount tras error (key cambia)
  useEffect(() => { setFormReady(false) }, [attemptId])

  // Bloquear scroll del body mientras está abierto
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = prev }
  }, [open])

  // Esc para cerrar
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting && !success) onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose, submitting, success])

  const handlePay = async () => {
    if (!formRef.current) {
      setError("El formulario aún no está listo. Esperá un segundo.")
      return
    }
    setSubmitting(true)
    setError(null)

    // 1. Generar token vía Secure Fields
    const tokenResult = await formRef.current.submit()
    if ("error" in tokenResult) {
      setError(tokenResult.error)
      setSubmitting(false)
      return
    }

    // 2. POST al backend (sin cambios respecto al flow actual)
    try {
      console.log("[MP] POST /api/billing/mp/subscribe-with-card...")
      const res = await fetch("/api/billing/mp/subscribe-with-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          period,
          cardTokenId: tokenResult.cardTokenId,
          payerEmail: tokenResult.payerEmail,
          paymentMethodId: tokenResult.paymentMethodId,
        }),
        signal: AbortSignal.timeout(35_000),
      })
      console.log("[MP] backend responded:", res.status)
      const data = await res.json()
      if (!res.ok) {
        console.error("[MP] backend error", { status: res.status, error: data.error, detail: data.detail })
        // Re-mount del form → token fresco para el próximo intento
        setAttemptId((n) => n + 1)
        setError(data.error ?? "No se pudo procesar el pago")
        toast.error(data.error ?? "Error al cobrar")
        setSubmitting(false)
        return
      }
      setSuccess(true)
      toast.success("¡Suscripción activada!")
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 1800)
    } catch (err: any) {
      console.error("[MP] backend fetch failed", err)
      const msg = err?.name === "TimeoutError" || err?.name === "AbortError"
        ? "El cobro tardó demasiado. Si tu tarjeta fue cobrada, refrescá la página."
        : "Error de red. Probá de nuevo."
      setAttemptId((n) => n + 1)
      setError(msg)
      setSubmitting(false)
    }
  }

  const benefits = PLAN_BENEFITS[plan]

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={() => !submitting && !success && onClose()}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            className="relative bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-4xl max-h-[94vh] overflow-hidden flex flex-col shadow-2xl shadow-purple-950/40"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: "spring", damping: 26, stiffness: 280 }}
          >
            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              disabled={submitting || success}
              className="absolute top-5 right-5 z-10 w-9 h-9 rounded-full bg-gray-900/80 hover:bg-gray-800 border border-gray-800 text-gray-400 hover:text-white flex items-center justify-center transition-colors disabled:opacity-30"
              aria-label="Cerrar"
            >
              <X size={16} />
            </button>

            {/* Success overlay */}
            <AnimatePresence>
              {success && (
                <motion.div
                  className="absolute inset-0 z-20 bg-gray-950/95 backdrop-blur-sm flex flex-col items-center justify-center gap-5"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div
                    className="w-24 h-24 rounded-full bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-center"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 16, stiffness: 280, delay: 0.1 }}
                  >
                    <Check className="w-12 h-12 text-emerald-400" strokeWidth={3} />
                  </motion.div>
                  <motion.div
                    className="text-center space-y-1"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <h3 className="text-2xl font-bold text-white">¡Listo!</h3>
                    <p className="text-sm text-gray-400">Ya estás en el plan {planLabel}</p>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex-1 overflow-y-auto">
              <div className="grid md:grid-cols-[320px_1fr] gap-0 min-h-full">
                {/* ───── COLUMNA IZQUIERDA ───── */}
                <aside className="bg-gradient-to-br from-purple-950/50 via-gray-900 to-gray-950 p-7 md:p-8 border-b md:border-b-0 md:border-r border-gray-800/80 relative overflow-hidden">
                  <div className="absolute -top-24 -right-24 w-56 h-56 bg-purple-600/25 blur-3xl rounded-full pointer-events-none" />
                  <div className="absolute -bottom-32 -left-16 w-56 h-56 bg-violet-600/15 blur-3xl rounded-full pointer-events-none" />

                  <div className="relative space-y-6">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-200 text-[10px] font-bold uppercase tracking-[0.12em]">
                      <Sparkles size={11} /> Plan {planLabel}
                    </div>

                    <div>
                      <p className="text-4xl font-bold text-white tracking-tight tabular-nums">
                        {formatCurrency(amount)}
                      </p>
                      <p className="text-xs text-gray-400 mt-2">
                        {period === "annual" ? "Por año" : "Por mes"} · Pesos argentinos
                      </p>
                    </div>

                    <div className="space-y-2.5 pt-3 border-t border-purple-900/30">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-gray-500 font-bold mb-3">
                        Qué incluye
                      </p>
                      {benefits.map((b, i) => (
                        <motion.div
                          key={b}
                          className="flex items-start gap-2.5"
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 + i * 0.04 }}
                        >
                          <div className="w-4 h-4 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Check size={9} className="text-emerald-400" strokeWidth={3.5} />
                          </div>
                          <span className="text-[13px] text-gray-200 leading-snug">{b}</span>
                        </motion.div>
                      ))}
                    </div>

                    <div className="pt-4 border-t border-purple-900/30 space-y-2.5">
                      <TrustItem icon={Calendar} text={`Renovación ${period === "annual" ? "anual" : "mensual"} automática`} />
                      <TrustItem icon={CircleSlash2} text="Cancelable cuando quieras" />
                      <TrustItem icon={ShieldCheck} text="Procesado por Mercado Pago" />
                    </div>
                  </div>
                </aside>

                {/* ───── COLUMNA DERECHA ───── */}
                <main className="p-6 sm:p-8 md:p-10 flex flex-col">
                  <header className="mb-6 pb-6 border-b border-gray-800/80">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-gray-500 font-bold mb-2">
                      Paso final
                    </p>
                    <h2 className="text-2xl font-bold text-white mb-3 tracking-tight">
                      Información de pago
                    </h2>
                    <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-purple-950/30 border border-purple-900/40">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center flex-shrink-0">
                        <Lock size={14} className="text-purple-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-purple-100 font-medium leading-snug">
                          Hoy se cobra <span className="font-bold text-white">{formatCurrency(amount)}</span>
                        </p>
                        <p className="text-[11px] text-purple-300/70 mt-0.5">
                          Próximo cobro automático: {nextBillingLabel(period)}
                        </p>
                      </div>
                    </div>
                  </header>

                  {/* Banners */}
                  <AnimatePresence>
                    {missingKey && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="bg-amber-950/40 border border-amber-800/40 rounded-xl p-4 flex gap-3 text-sm mb-4"
                      >
                        <AlertCircle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                        <p className="text-amber-200">
                          Falta la <strong>NEXT_PUBLIC_MP_PUBLIC_KEY</strong> en Railway.
                        </p>
                      </motion.div>
                    )}

                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, x: 0 }}
                        animate={{ opacity: 1, y: 0, x: [0, -5, 5, -3, 3, 0] }}
                        exit={{ opacity: 0 }}
                        transition={{ x: { duration: 0.4 } }}
                        className="bg-red-950/40 border border-red-800/40 rounded-xl p-4 flex gap-3 text-sm mb-4"
                      >
                        <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-red-200 font-medium">No se pudo procesar el pago</p>
                          <p className="text-red-300/80 text-xs mt-0.5">{error}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Form custom */}
                  {!missingKey && publicKey && (
                    <div className="flex-1">
                      <MPCustomCardForm
                        ref={formRef}
                        key={attemptId}
                        amount={amount}
                        publicKey={publicKey}
                        onTokenError={(msg: string) => setError(msg)}
                        onReady={() => setFormReady(true)}
                      />
                    </div>
                  )}

                  {/* Botón Pagar — separado del form con margen claro.
                      Hardcodeamos purple para que matchee con el resto del
                      modal (que también usa purple-* hardcoded) y no varíe
                      con el themeColor del tenant. */}
                  {!missingKey && (
                    <motion.button
                      type="button"
                      onClick={handlePay}
                      disabled={submitting || success || !formReady}
                      whileTap={{ scale: 0.985 }}
                      className="mt-7 w-full py-4 px-5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-base flex items-center justify-center gap-2.5 shadow-lg shadow-purple-900/40 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {submitting ? (
                        <>
                          <Loader2 size={18} className="animate-spin" /> Procesando pago...
                        </>
                      ) : !formReady ? (
                        <>
                          <Loader2 size={18} className="animate-spin" /> Cargando formulario...
                        </>
                      ) : (
                        <>
                          <Lock size={16} /> Pagar {formatCurrency(amount)} ahora
                        </>
                      )}
                    </motion.button>
                  )}

                  {/* Footer trust */}
                  <div className="mt-5 pt-4 border-t border-gray-800/60 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <Lock size={11} /> Encriptado SSL
                    </div>
                    <div className="w-1 h-1 rounded-full bg-gray-700" />
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck size={11} /> PCI DSS
                    </div>
                    <div className="w-1 h-1 rounded-full bg-gray-700" />
                    <div>Tu tarjeta nunca toca Orvex</div>
                  </div>
                </main>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function TrustItem({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex items-center gap-2.5 text-xs text-gray-300">
      <Icon size={13} className="text-purple-300/70 flex-shrink-0" />
      <span>{text}</span>
    </div>
  )
}

function nextBillingLabel(period: "monthly" | "annual"): string {
  const d = new Date()
  if (period === "annual") d.setFullYear(d.getFullYear() + 1)
  else d.setMonth(d.getMonth() + 1)
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })
}
