"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { CheckCircle, Zap, Crown, Building2, ArrowRight, ExternalLink, AlertCircle } from "lucide-react"
import { PLAN_LIMITS, PLAN_PRICES_USD, PLAN_LABELS } from "@/lib/utils"

interface Subscription {
  plan: string
  status: string
  currentPeriodEnd: string | null
  stripeCustomerId: string | null
}

const PLAN_FEATURES: Record<string, string[]> = {
  FREE: [
    "Hasta 50 productos",
    "Hasta 200 ventas/mes",
    "1 usuario",
    "Hasta 25 clientes · 3 categorías",
    "POS, caja y reportes básicos del día",
    "Asistente IA — 5 mensajes/día",
    "Historial de 7 días",
  ],
  STARTER: [
    "Hasta 500 productos",
    "Hasta 2.000 ventas/mes",
    "3 usuarios",
    "Clientes y categorías ilimitados",
    "Proveedores, gastos y cargas",
    "Reportes avanzados con gráficos",
    "WhatsApp — alertas de stock bajo",
    "Importar / exportar CSV",
    "Logo personalizado",
    "Asistente IA — 50 mensajes/día",
    "Historial de 90 días",
  ],
  PROFESSIONAL: [
    "Hasta 5.000 productos",
    "Ventas ilimitadas",
    "10 usuarios",
    "Programa de fidelidad (puntos)",
    "Multi-caja simultánea",
    "WhatsApp resumen diario",
    "Asistente IA — 500 mensajes/día",
    "Historial de 1 año",
    "Soporte prioritario por email",
  ],
  BUSINESS: [
    "Todo ilimitado",
    "Multi-tienda (varias sucursales)",
    "API access",
    "Asistente IA — 5.000 mensajes/día",
    "Historial ilimitado",
    "Soporte por WhatsApp directo",
  ],
}

const PLAN_ICONS: Record<string, React.ElementType> = {
  FREE: Zap,
  STARTER: Zap,
  PROFESSIONAL: Crown,
  BUSINESS: Building2,
}

const PLAN_COLORS: Record<string, string> = {
  FREE: "border-gray-700",
  STARTER: "border-blue-500",
  PROFESSIONAL: "border-purple-500",
  BUSINESS: "border-yellow-500",
}

const PLAN_BADGE_COLORS: Record<string, string> = {
  FREE: "bg-gray-700 text-gray-300",
  STARTER: "bg-blue-500/20 text-blue-400",
  PROFESSIONAL: "bg-purple-500/20 text-purple-400",
  BUSINESS: "bg-yellow-500/20 text-yellow-400",
}

export default function SuscripcionPage() {
  const [sub, setSub] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const searchParams = useSearchParams()
  const success = searchParams.get("success")
  const cancelled = searchParams.get("cancelled")

  useEffect(() => {
    fetch("/api/configuracion/suscripcion")
      .then(r => r.json())
      .then(d => { setSub(d.subscription); setLoading(false) })
  }, [])

  const handleUpgrade = async (plan: string) => {
    setUpgrading(plan)
    const res = await fetch("/api/stripe/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    })
    if (res.ok) {
      const { url } = await res.json()
      window.location.href = url
    } else {
      const d = await res.json()
      alert(d.error || "Error al crear sesión de pago")
      setUpgrading(null)
    }
  }

  const handlePortal = async () => {
    setPortalLoading(true)
    try {
      const res = await fetch("/api/stripe/customer-portal", { method: "POST" })
      if (res.ok) {
        const { url } = await res.json()
        window.location.href = url
      } else {
        const d = await res.json().catch(() => ({}))
        alert(d.error || "No se pudo abrir el portal de facturación")
      }
    } catch (e) {
      alert("Error de red al abrir el portal")
    } finally {
      setPortalLoading(false)
    }
  }

  const STATUS_LABELS: Record<string, string> = {
    ACTIVE: "Activo", TRIALING: "Prueba gratuita", PAST_DUE: "Pago vencido",
    CANCELLED: "Cancelado", FREE: "Plan gratuito",
  }

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Suscripción</h1>
        <p className="text-gray-400 text-sm mt-1">Gestioná tu plan y facturación</p>
      </div>

      {/* Alerts */}
      {success && (
        <div className="flex items-center gap-3 px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400">
          <CheckCircle size={18} />
          <span>¡Suscripción activada! Bienvenido a tu nuevo plan.</span>
        </div>
      )}
      {cancelled && (
        <div className="flex items-center gap-3 px-4 py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-400">
          <AlertCircle size={18} />
          <span>Proceso de pago cancelado. Tu plan actual no cambió.</span>
        </div>
      )}

      {/* Current plan */}
      {!loading && sub && (
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-gray-500 text-sm">Plan actual</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-2xl font-bold text-white">{PLAN_LABELS[sub.plan] || sub.plan}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs ${PLAN_BADGE_COLORS[sub.plan] || "bg-gray-700 text-gray-300"}`}>
                  {STATUS_LABELS[sub.status] || sub.status}
                </span>
              </div>
              {sub.currentPeriodEnd && (
                <p className="text-gray-500 text-xs mt-1">
                  Próxima renovación: {new Date(sub.currentPeriodEnd).toLocaleDateString("es-AR")}
                </p>
              )}
            </div>
            {sub.stripeCustomerId && (
              <button onClick={handlePortal} disabled={portalLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors disabled:opacity-50">
                <ExternalLink size={15} />
                {portalLoading ? "Cargando..." : "Gestionar facturación"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Plans grid */}
      <div>
        <h2 className="text-white font-semibold mb-4">Planes disponibles</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {(["FREE", "STARTER", "PROFESSIONAL", "BUSINESS"] as const).map(plan => {
            const Icon = PLAN_ICONS[plan]
            const isCurrent = sub?.plan === plan
            const price = PLAN_PRICES_USD[plan]
            const limits = PLAN_LIMITS[plan]
            const features = PLAN_FEATURES[plan]
            const isPopular = plan === "PROFESSIONAL"

            return (
              <div key={plan}
                className={`relative bg-gray-900 rounded-xl p-5 border-2 ${isCurrent ? PLAN_COLORS[plan] : "border-gray-800"} flex flex-col`}>
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-purple-600 rounded-full text-white text-xs font-bold">
                    MÁS POPULAR
                  </div>
                )}
                <div className="flex items-center gap-2 mb-3">
                  <Icon size={18} className={plan === "FREE" ? "text-gray-400" : plan === "STARTER" ? "text-blue-400" : plan === "PROFESSIONAL" ? "text-purple-400" : "text-yellow-400"} />
                  <span className="text-white font-semibold">{PLAN_LABELS[plan]}</span>
                </div>
                <div className="mb-4">
                  {price === 0 ? (
                    <span className="text-3xl font-bold text-white">Gratis</span>
                  ) : (
                    <>
                      <span className="text-3xl font-bold text-white">${price}</span>
                      <span className="text-gray-500 text-sm">/mes USD</span>
                    </>
                  )}
                </div>
                <ul className="space-y-2 mb-6 flex-1">
                  {features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <CheckCircle size={14} className="text-green-400 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <div className="w-full py-2.5 rounded-lg border border-gray-700 text-center text-gray-400 text-sm">
                    Plan actual
                  </div>
                ) : plan === "FREE" ? (
                  <div className="w-full py-2.5 rounded-lg border border-gray-800 text-center text-gray-600 text-sm">
                    Plan base
                  </div>
                ) : (
                  <button onClick={() => handleUpgrade(plan)} disabled={!!upgrading}
                    className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50
                      ${plan === "PROFESSIONAL" ? "bg-purple-600 hover:bg-purple-700 text-white" : "bg-gray-800 hover:bg-gray-700 text-gray-200"}`}>
                    {upgrading === plan ? "Redirigiendo..." : (
                      <><ArrowRight size={14} /> Suscribirse</>
                    )}
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <p className="text-gray-600 text-xs mt-3 text-center">
          Todos los planes incluyen 14 días de prueba gratuita. Pagos procesados por Stripe. Cancelá cuando quieras.
        </p>
      </div>
    </div>
  )
}
