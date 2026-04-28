"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { initMercadoPago } from "@mercadopago/sdk-react"
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
  CreditCard,
} from "lucide-react"
import toast from "react-hot-toast"
import { formatCurrency } from "@/lib/utils"

// SSR-off para el Brick — el SDK toca window al inicializar.
const CardPayment = dynamic(
  () => import("@mercadopago/sdk-react").then((m) => m.CardPayment),
  { ssr: false, loading: () => null }
)

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

let sdkInitialized = false

export function MPCardModal({ open, onClose, plan, planLabel, amount, period, onSuccess }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sdkReady, setSdkReady] = useState(false)
  const [missingKey, setMissingKey] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!open) {
      // Reset al cerrar
      setError(null)
      setSubmitting(false)
      setSuccess(false)
      return
    }
    const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY
    if (!publicKey) {
      setMissingKey(true)
      return
    }
    setMissingKey(false)
    if (!sdkInitialized) {
      try {
        initMercadoPago(publicKey, { locale: "es-AR" })
        sdkInitialized = true
      } catch (e) {
        console.error("[MP] initMercadoPago failed", e)
        setError("No se pudo inicializar Mercado Pago. Refrescá la página.")
        return
      }
    }
    setSdkReady(true)
  }, [open])

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
      if (e.key === "Escape" && !submitting) onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose, submitting])

  const handleSubmit = async (formData: any) => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/billing/mp/subscribe-with-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          period,
          cardTokenId: formData.token,
          payerEmail: formData.payer?.email,
          paymentMethodId: formData.payment_method_id,
          issuerId: formData.issuer_id,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "No se pudo procesar el pago")
        toast.error(data.error ?? "Error al cobrar")
        setSubmitting(false)
        return
      }
      // Éxito: animar success state, después cerrar
      setSuccess(true)
      toast.success("¡Suscripción activada!")
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 1800)
    } catch (err) {
      setError("Error de red. Probá de nuevo.")
      setSubmitting(false)
    }
  }

  const benefits = PLAN_BENEFITS[plan]

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/75 backdrop-blur-md"
            onClick={() => !submitting && !success && onClose()}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal */}
          <motion.div
            className="relative bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl shadow-purple-950/50"
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
              className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-gray-900/80 hover:bg-gray-800 border border-gray-800 text-gray-400 hover:text-white flex items-center justify-center transition-colors disabled:opacity-30"
              aria-label="Cerrar"
            >
              <X size={16} />
            </button>

            {/* Success overlay */}
            <AnimatePresence>
              {success && (
                <motion.div
                  className="absolute inset-0 z-20 bg-gray-950/95 backdrop-blur-sm flex flex-col items-center justify-center gap-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div
                    className="w-20 h-20 rounded-full bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-center"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 16, stiffness: 280, delay: 0.1 }}
                  >
                    <Check className="w-10 h-10 text-emerald-400" strokeWidth={3} />
                  </motion.div>
                  <motion.div
                    className="text-center"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <h3 className="text-xl font-bold text-white mb-1">¡Listo!</h3>
                    <p className="text-sm text-gray-400">Ya estás en el plan {planLabel}</p>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex-1 overflow-y-auto">
              <div className="grid md:grid-cols-[280px_1fr] gap-0">
                {/* ───── COLUMNA IZQUIERDA ───── */}
                <aside className="bg-gradient-to-br from-purple-950/40 via-gray-900 to-gray-950 p-6 border-b md:border-b-0 md:border-r border-gray-800/80 relative overflow-hidden">
                  {/* Glow decorativo */}
                  <div className="absolute -top-20 -right-20 w-48 h-48 bg-purple-600/20 blur-3xl rounded-full pointer-events-none" />

                  <div className="relative space-y-5">
                    {/* Plan badge */}
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-[10px] font-semibold uppercase tracking-wider">
                      <Sparkles size={10} /> Plan {planLabel}
                    </div>

                    {/* Precio */}
                    <div>
                      <p className="text-3xl md:text-4xl font-bold text-white tracking-tight tabular-nums">
                        {formatCurrency(amount)}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {period === "annual" ? "por año" : "por mes"} · ARS
                      </p>
                    </div>

                    {/* Features */}
                    <div className="space-y-2 pt-2">
                      <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">Incluye</p>
                      {benefits.map((b) => (
                        <div key={b} className="flex items-start gap-2">
                          <Check size={13} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                          <span className="text-xs text-gray-300 leading-snug">{b}</span>
                        </div>
                      ))}
                    </div>

                    {/* Trust */}
                    <div className="pt-3 border-t border-gray-800/60 space-y-2">
                      <TrustItem icon={Calendar} text={`Renueva ${period === "annual" ? "cada año" : "cada mes"}`} />
                      <TrustItem icon={CircleSlash2} text="Cancelable cuando quieras" />
                      <TrustItem icon={ShieldCheck} text="Procesado por Mercado Pago" />
                    </div>
                  </div>
                </aside>

                {/* ───── COLUMNA DERECHA ───── */}
                <main className="p-6 flex flex-col">
                  <header className="mb-4">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <CreditCard size={18} className="text-accent" />
                      Datos de la tarjeta
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">
                      Cobramos hoy y el primer cobro automático es {period === "annual" ? "el próximo año" : "el próximo mes"}.
                    </p>
                  </header>

                  {/* Banners */}
                  <AnimatePresence>
                    {missingKey && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="bg-amber-950/40 border border-amber-800/40 rounded-lg p-3 flex gap-2 text-xs mb-3"
                      >
                        <AlertCircle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                        <p className="text-amber-200">
                          Falta la <strong>NEXT_PUBLIC_MP_PUBLIC_KEY</strong> en Railway. Agregala y redeployá.
                        </p>
                      </motion.div>
                    )}

                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, x: 0 }}
                        animate={{ opacity: 1, y: 0, x: [0, -4, 4, -2, 2, 0] }}
                        exit={{ opacity: 0 }}
                        transition={{ x: { duration: 0.4 } }}
                        className="bg-red-950/40 border border-red-800/40 rounded-lg p-3 flex gap-2 text-xs mb-3"
                      >
                        <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-red-200">{error}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Brick */}
                  {!missingKey && (
                    <div className="mp-card-form-wrapper relative flex-1 min-h-[420px]">
                      {!sdkReady ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 gap-3">
                          <Loader2 size={20} className="animate-spin text-accent" />
                          <p className="text-xs">Cargando formulario seguro...</p>
                        </div>
                      ) : (
                        <CardPayment
                          key={`${plan}-${amount}-${period}`}
                          initialization={{ amount }}
                          customization={{
                            visual: {
                              style: {
                                theme: "dark",
                                customVariables: {
                                  // Colores principales — matchear con accent de Orvex
                                  baseColor: "#8b5cf6",
                                  baseColorFirstVariant: "#7c3aed",
                                  baseColorSecondVariant: "#a78bfa",
                                  // Fondos
                                  formBackgroundColor: "transparent",
                                  inputBackgroundColor: "#0f1116",
                                  // Texto
                                  textPrimaryColor: "#f9fafb",
                                  textSecondaryColor: "#9ca3af",
                                  // Bordes
                                  inputBorderWidth: "1px",
                                  inputFocusedBorderColor: "#8b5cf6",
                                  inputFocusedBorderWidth: "2px",
                                  borderRadiusSmall: "8px",
                                  borderRadiusMedium: "10px",
                                  borderRadiusLarge: "12px",
                                  borderRadiusFull: "9999px",
                                  formInputsBorderRadius: "10px",
                                  // Espaciado
                                  formPadding: "0px",
                                  inputVerticalPadding: "12px",
                                  inputHorizontalPadding: "14px",
                                  // Tipografía
                                  fontSizeMedium: "14px",
                                  // Estados
                                  errorColor: "#f87171",
                                  successColor: "#34d399",
                                  // Botón
                                  buttonTextColor: "#ffffff",
                                  outlinePrimaryColor: "#8b5cf6",
                                },
                              },
                              hideFormTitle: true,
                              hidePaymentButton: false,
                            },
                            paymentMethods: { maxInstallments: 1 },
                          }}
                          onSubmit={handleSubmit}
                          onError={(err) => {
                            console.error("[MP brick error]", err)
                            const msg =
                              (err as any)?.message ??
                              (err as any)?.cause?.[0]?.description ??
                              "Hubo un problema con el formulario de tarjeta."
                            setError(msg)
                          }}
                        />
                      )}
                      {submitting && (
                        <div className="absolute inset-0 bg-gray-950/70 backdrop-blur-sm flex items-center justify-center rounded-xl">
                          <div className="flex flex-col items-center gap-3">
                            <Loader2 size={28} className="animate-spin text-accent" />
                            <p className="text-sm text-gray-300">Procesando con Mercado Pago…</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Footer trust */}
                  <div className="mt-4 pt-4 border-t border-gray-800/60 flex items-center justify-center gap-4 text-[10px] text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <Lock size={11} /> Encriptado SSL
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
    <div className="flex items-center gap-2 text-[11px] text-gray-400">
      <Icon size={12} className="text-gray-500 flex-shrink-0" />
      <span>{text}</span>
    </div>
  )
}
