"use client"

import { useState, useEffect } from "react"
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
  const [brickReady, setBrickReady] = useState(false)
  const [missingKey, setMissingKey] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!open) {
      setError(null)
      setSubmitting(false)
      setSuccess(false)
      setBrickReady(false)
      return
    }
    const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY
    if (!publicKey) {
      setMissingKey(true)
      return
    }
    setMissingKey(false)
    // Import dinámico — sólo cliente, evita que el SDK toque window
    // durante SSR (causa raíz del React #418 hydration mismatch).
    import("@mercadopago/sdk-react")
      .then(({ initMercadoPago }) => {
        if (!sdkInitialized) {
          initMercadoPago(publicKey, { locale: "es-AR" })
          sdkInitialized = true
        }
        setSdkReady(true)
      })
      .catch((e) => {
        console.error("[MP] initMercadoPago failed", e)
        setError("No se pudo inicializar Mercado Pago. Refrescá la página.")
      })
  }, [open])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = prev }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting && !success) onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose, submitting, success])

  // Cleanup explícito del Brick MP cuando el modal se cierra Y al desmontarse
  // el componente. Sin esto, el SDK queda con refs DOM viejas y al re-abrir
  // tira "Failed to execute removeChild on Node" + React error #418.
  useEffect(() => {
    const cleanup = () => {
      const controller = (typeof window !== "undefined"
        ? (window as any).cardPaymentBrickController
        : null)
      if (controller && typeof controller.unmount === "function") {
        try { controller.unmount() } catch { /* ignore */ }
      }
    }
    if (!open) cleanup()
    return cleanup
  }, [open])

  const handleSubmit = async (formData: any) => {
    setSubmitting(true)
    setError(null)
    try {
      console.log("[MP] POST /api/billing/mp/subscribe-with-card...")
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
        // Timeout 30s para no colgar el botón eternamente si MP/backend tarda
        signal: AbortSignal.timeout(30_000),
      })
      console.log("[MP] backend responded:", res.status)
      const data = await res.json()
      if (!res.ok) {
        console.error("[MP] backend error", { status: res.status, error: data.error, detail: data.detail })
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
                  {/* Glow decorativo */}
                  <div className="absolute -top-24 -right-24 w-56 h-56 bg-purple-600/25 blur-3xl rounded-full pointer-events-none" />
                  <div className="absolute -bottom-32 -left-16 w-56 h-56 bg-violet-600/15 blur-3xl rounded-full pointer-events-none" />

                  <div className="relative space-y-6">
                    {/* Plan badge */}
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-200 text-[10px] font-bold uppercase tracking-[0.12em]">
                      <Sparkles size={11} /> Plan {planLabel}
                    </div>

                    {/* Precio */}
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <p className="text-4xl font-bold text-white tracking-tight tabular-nums">
                          {formatCurrency(amount)}
                        </p>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        {period === "annual" ? "Por año" : "Por mes"} · Pesos argentinos
                      </p>
                    </div>

                    {/* Features */}
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

                    {/* Trust */}
                    <div className="pt-4 border-t border-purple-900/30 space-y-2.5">
                      <TrustItem icon={Calendar} text={`Renovación ${period === "annual" ? "anual" : "mensual"} automática`} />
                      <TrustItem icon={CircleSlash2} text="Cancelable cuando quieras" />
                      <TrustItem icon={ShieldCheck} text="Procesado por Mercado Pago" />
                    </div>
                  </div>
                </aside>

                {/* ───── COLUMNA DERECHA ───── */}
                <main className="p-6 sm:p-8 md:p-10 flex flex-col">
                  {/* Header con resumen del cobro */}
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

                    {/* Tarjetas aceptadas */}
                    <div className="flex items-center gap-3 mt-5">
                      <span className="text-[10px] uppercase tracking-[0.12em] text-gray-500 font-bold">
                        Aceptamos
                      </span>
                      <div className="flex items-center gap-1.5">
                        <CardBadge>VISA</CardBadge>
                        <CardBadge>MC</CardBadge>
                        <CardBadge>AMEX</CardBadge>
                        <CardBadge>NARANJA</CardBadge>
                        <CardBadge>+</CardBadge>
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
                          Falta la <strong>NEXT_PUBLIC_MP_PUBLIC_KEY</strong> en Railway. Agregala y redeployá.
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

                  {/* Brick */}
                  {!missingKey && (
                    <div className="mp-card-form-wrapper relative flex-1 min-h-[460px]">
                      {!sdkReady ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 gap-3">
                          <Loader2 size={22} className="animate-spin text-accent" />
                          <p className="text-sm">Cargando formulario seguro...</p>
                        </div>
                      ) : (
                        <CardPayment
                          // Sólo re-mount si cambia el plan — re-mount excesivo
                          // genera el error "removeChild" del SDK MP.
                          key={plan}
                          initialization={{ amount }}
                          customization={{
                            visual: {
                              style: {
                                theme: "dark",
                                // Sólo variables válidas del SDK MP. Las que no
                                // existen (inputFocusedBorderColor, fontWeightRegular,
                                // formInputsBorderRadius, textPrimaryColor, etc) las
                                // eliminé porque tiraban warnings y no aplicaban.
                                customVariables: {
                                  // Colores principales
                                  baseColor: "#8b5cf6",
                                  baseColorFirstVariant: "#7c3aed",
                                  baseColorSecondVariant: "#a78bfa",
                                  // Fondos
                                  formBackgroundColor: "transparent",
                                  inputBackgroundColor: "#0d0f15",
                                  // Bordes (NOTA: MP no expone color de focus —
                                  // sólo width. El color hereda de baseColor)
                                  inputBorderWidth: "1px",
                                  inputFocusedBorderWidth: "2px",
                                  borderRadiusSmall: "10px",
                                  borderRadiusMedium: "12px",
                                  borderRadiusLarge: "14px",
                                  borderRadiusFull: "9999px",
                                  // Espaciado
                                  formPadding: "0px",
                                  inputVerticalPadding: "18px",
                                  inputHorizontalPadding: "18px",
                                  // Tipografía
                                  fontSizeExtraSmall: "12px",
                                  fontSizeSmall: "14px",
                                  fontSizeMedium: "16px",
                                  fontSizeLarge: "17px",
                                  fontWeightSemiBold: "700",
                                  formInputsTextTransform: "none",
                                  // Estados
                                  errorColor: "#f87171",
                                  successColor: "#34d399",
                                  // Botón (aunque está oculto, MP lee estos
                                  // valores para otros componentes internos)
                                  outlinePrimaryColor: "#8b5cf6",
                                  outlineSecondaryColor: "#7c3aed",
                                  buttonTextColor: "#ffffff",
                                },
                              },
                              // Botón nativo del Brick visible. hidePaymentButton:true
                              // tira "postMessage origin mismatch" en el SDK actual
                              // y getFormData() nunca devuelve → timeout. El botón
                              // nativo va pegado al último input pero al menos cobra.
                              hideFormTitle: true,
                              hidePaymentButton: false,
                            },
                            paymentMethods: { maxInstallments: 1 },
                          }}
                          onSubmit={handleSubmit}
                          onReady={() => setBrickReady(true)}
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
                        <div className="absolute inset-0 bg-gray-950/85 backdrop-blur-sm flex items-center justify-center rounded-xl z-10">
                          <div className="flex flex-col items-center gap-3">
                            <Loader2 size={32} className="animate-spin text-accent" />
                            <p className="text-sm text-gray-300 font-medium">Procesando pago...</p>
                            <p className="text-xs text-gray-500">No cierres esta ventana</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Footer trust */}
                  <div className="mt-6 pt-5 border-t border-gray-800/60 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] text-gray-500">
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

function CardBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center min-w-[36px] h-6 px-1.5 rounded bg-gray-800/80 border border-gray-700/80 text-[9px] font-bold text-gray-400 tracking-wider">
      {children}
    </span>
  )
}

function nextBillingLabel(period: "monthly" | "annual"): string {
  const d = new Date()
  if (period === "annual") d.setFullYear(d.getFullYear() + 1)
  else d.setMonth(d.getMonth() + 1)
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })
}
