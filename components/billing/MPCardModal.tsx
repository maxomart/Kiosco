"use client"

import { useState, useEffect } from "react"
import { initMercadoPago, CardPayment } from "@mercadopago/sdk-react"
import { X, Lock, AlertCircle, Loader2 } from "lucide-react"
import toast from "react-hot-toast"
import { formatCurrency } from "@/lib/utils"

interface Props {
  open: boolean
  onClose: () => void
  plan: "STARTER" | "PROFESSIONAL" | "BUSINESS"
  planLabel: string
  amount: number
  period: "monthly" | "annual"
  onSuccess: () => void
}

let sdkInitialized = false

export function MPCardModal({ open, onClose, plan, planLabel, amount, period, onSuccess }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sdkReady, setSdkReady] = useState(false)

  useEffect(() => {
    if (!open) return
    const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY
    if (!publicKey) {
      setError("Falta NEXT_PUBLIC_MP_PUBLIC_KEY en el servidor.")
      return
    }
    if (!sdkInitialized) {
      initMercadoPago(publicKey, { locale: "es-AR" })
      sdkInitialized = true
    }
    setSdkReady(true)
  }, [open])

  if (!open) return null

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
      toast.success("¡Suscripción activada! Tu tarjeta queda guardada para los próximos cobros.")
      onSuccess()
      onClose()
    } catch (err) {
      setError("Error de red. Probá de nuevo.")
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-white">Suscribirme a {planLabel}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {formatCurrency(amount)} · {period === "annual" ? "anual" : "por mes"} · débito automático
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 disabled:opacity-50"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div className="bg-emerald-950/40 border border-emerald-800/40 rounded-lg p-3 flex gap-2 text-xs">
            <Lock size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
            <p className="text-emerald-200/90 leading-relaxed">
              Tu tarjeta se guarda <strong>en Mercado Pago</strong>, no en Orvex. Cobramos automático cada{" "}
              {period === "annual" ? "año" : "mes"} y podés cancelar cuando quieras.
            </p>
          </div>

          {error && (
            <div className="bg-red-950/40 border border-red-800/40 rounded-lg p-3 flex gap-2 text-xs">
              <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-200">{error}</p>
            </div>
          )}

          {!sdkReady ? (
            <div className="flex items-center justify-center py-12 text-gray-400 gap-2 text-sm">
              <Loader2 size={16} className="animate-spin" /> Cargando formulario seguro...
            </div>
          ) : (
            <div className="mp-card-form-wrapper">
              <CardPayment
                initialization={{ amount, payer: { email: "" } }}
                customization={{
                  visual: {
                    style: {
                      theme: "dark",
                      customVariables: {
                        baseColor: "#a855f7",
                        formBackgroundColor: "#111827",
                        textPrimaryColor: "#f9fafb",
                        textSecondaryColor: "#9ca3af",
                        borderRadiusMedium: "10px",
                        inputBorderWidth: "1px",
                        inputFocusedBorderColor: "#a855f7",
                      },
                    },
                    hideFormTitle: true,
                    hidePaymentButton: false,
                  },
                  paymentMethods: { maxInstallments: 1 }, // suscripción = 1 cuota
                }}
                onSubmit={handleSubmit}
                onError={(err) => {
                  console.error("[MP brick error]", err)
                  setError("Hubo un problema con el formulario de tarjeta.")
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
