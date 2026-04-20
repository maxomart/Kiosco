"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { CheckCircle, Zap, Crown, Building2, ArrowRight, ArrowDown, ExternalLink, AlertCircle, CreditCard, Sparkles } from "lucide-react"
import NumberFlow from "@number-flow/react"
import { motion } from "framer-motion"
import toast from "react-hot-toast"
import { BillingToggle, type BillingPeriod } from "@/components/shared/BillingToggle"
import { useConfirm } from "@/components/shared/ConfirmDialog"

function ArrowDownIcon() {
  return <ArrowDown size={12} />
}
import {
  PLAN_LIMITS,
  PLAN_PRICES_ARS,
  PLAN_LABELS_AR,
  PLAN_LABELS,
  formatCurrency,
} from "@/lib/utils"

// Precio anual = mensual × 12 × (1 - descuento). Mostramos el /mes efectivo.
const ANNUAL_DISCOUNT = 0.2

interface Subscription {
  plan: string
  status: string
  currentPeriodEnd: string | null
  stripeCustomerId: string | null
  mpPreapprovalId: string | null
  mpStatus: string | null
  paymentProvider: string | null
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
  const [cancelling, setCancelling] = useState(false)
  const [period, setPeriod] = useState<BillingPeriod>("monthly")
  const confirm = useConfirm()
  const searchParams = useSearchParams()
  const success = searchParams.get("success")
  const cancelled = searchParams.get("cancelled")
  const mpResult = searchParams.get("mp")

  useEffect(() => {
    fetch("/api/configuracion/suscripcion")
      .then(r => r.json())
      .then(d => { setSub(d.subscription); setLoading(false) })
  }, [])

  const handleUpgradeMP = async (plan: string) => {
    setUpgrading(`mp:${plan}`)
    try {
      const res = await fetch("/api/billing/mp/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, period }),
      })
      if (res.ok) {
        const { initPoint } = await res.json()
        window.location.href = initPoint
      } else {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || "Error al iniciar pago con Mercado Pago")
        setUpgrading(null)
      }
    } catch {
      toast.error("Error de red al contactar Mercado Pago")
      setUpgrading(null)
    }
  }

  const handleUpgradeStripe = async (plan: string) => {
    setUpgrading(`stripe:${plan}`)
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
      toast.error(d.error || "Error al crear sesión de pago")
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
        toast.error(d.error || "No se pudo abrir el portal de facturación")
      }
    } catch {
      toast.error("Error de red al abrir el portal")
    } finally {
      setPortalLoading(false)
    }
  }

  const handleCancelMP = async () => {
    const ok = await confirm({
      title: "¿Cancelar suscripción?",
      description:
        "Cancelás la renovación automática en Mercado Pago. Tu plan vuelve a Gratis al finalizar el período actual pagado.",
      confirmText: "Sí, cancelar",
      cancelText: "Volver",
      tone: "danger",
    })
    if (!ok) return
    setCancelling(true)
    try {
      const res = await fetch("/api/billing/mp/cancel", { method: "POST" })
      if (res.ok) {
        const data = await fetch("/api/configuracion/suscripcion").then(r => r.json())
        setSub(data.subscription)
        toast.success("Suscripción cancelada en Mercado Pago.")
      } else {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || "No se pudo cancelar")
      }
    } catch {
      toast.error("Error de red al cancelar")
    } finally {
      setCancelling(false)
    }
  }

  const STATUS_LABELS: Record<string, string> = {
    ACTIVE: "Activo", TRIALING: "Prueba gratuita", PAST_DUE: "Pago vencido",
    CANCELLED: "Cancelado", FREE: "Plan gratuito",
  }

  const isMP = sub?.paymentProvider === "mercadopago"

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
      {mpResult === "success" && (
        <div className="flex items-center gap-3 px-4 py-3 bg-sky-500/10 border border-sky-500/30 rounded-xl text-sky-400">
          <CheckCircle size={18} />
          <span>Volviste de Mercado Pago. La activación puede tardar unos segundos en confirmarse.</span>
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
                <span className="text-2xl font-bold text-white">{PLAN_LABELS_AR[sub.plan as keyof typeof PLAN_LABELS_AR] ?? sub.plan}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs ${PLAN_BADGE_COLORS[sub.plan] || "bg-gray-700 text-gray-300"}`}>
                  {STATUS_LABELS[sub.status] || sub.status}
                </span>
                {isMP && (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-sky-500/20 text-sky-300">
                    Suscrito vía Mercado Pago
                  </span>
                )}
                {sub.paymentProvider === "stripe" && (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-500/20 text-indigo-300">
                    Suscrito vía Stripe
                  </span>
                )}
              </div>
              {sub.currentPeriodEnd && (
                <p className="text-gray-500 text-xs mt-1">
                  Próxima renovación: {new Date(sub.currentPeriodEnd).toLocaleDateString("es-AR")}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {sub.stripeCustomerId && !isMP && (
                <button onClick={handlePortal} disabled={portalLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors disabled:opacity-50">
                  <ExternalLink size={15} />
                  {portalLoading ? "Cargando..." : "Gestionar facturación"}
                </button>
              )}
              {isMP && sub.mpPreapprovalId && sub.status !== "CANCELLED" && (
                <button onClick={handleCancelMP} disabled={cancelling}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 text-sm transition-colors disabled:opacity-50">
                  {cancelling ? "Cancelando..." : "Cancelar suscripción"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Plans grid */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-white font-semibold flex items-center gap-2">
              <Sparkles size={16} className="text-accent" />
              Planes disponibles
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {period === "annual"
                ? `Ahorrás ${Math.round(ANNUAL_DISCOUNT * 100)}% pagando anual · solo disponible vía Mercado Pago`
                : "Cambiá a anual y ahorrás 20%"}
            </p>
          </div>
          <BillingToggle value={period} onChange={setPeriod} annualDiscount={ANNUAL_DISCOUNT} />
        </div>
        {sub?.plan === "ENTERPRISE" && (
          <div className="mb-5 rounded-2xl card-glow p-6 flex items-start gap-4">
            <div className="shrink-0 w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <Crown size={22} className="text-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="text-white font-semibold">Ya estás en el plan Empresa</p>
              <p className="text-sm text-gray-400 mt-1">
                Tenés acceso a todas las funciones sin límites. Si necesitás reducir tu plan o
                cambiar las condiciones comerciales, contactá al equipo de soporte.
              </p>
              <a
                href="mailto:soporte@retailar.com?subject=Cambio%20de%20plan%20Enterprise"
                className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-accent-foreground text-sm font-semibold transition"
              >
                Contactar soporte
              </a>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {(() => {
            const PLAN_ORDER = ["FREE", "STARTER", "PROFESSIONAL", "BUSINESS"] as const
            // "ENTERPRISE" se muestra en una card aparte (arriba). En este grid
            // marcamos todos como "ya desbloqueado" para el tenant Enterprise.
            const subPlan = sub?.plan
            const isEnterprise = subPlan === "ENTERPRISE"
            const orderIdx = subPlan ? PLAN_ORDER.indexOf(subPlan as typeof PLAN_ORDER[number]) : 0
            const currentIdx = isEnterprise ? PLAN_ORDER.length : (orderIdx === -1 ? 0 : orderIdx)

            return PLAN_ORDER.map((plan, idx) => {
              const Icon = PLAN_ICONS[plan]
              const isCurrent = sub?.plan === plan
              const isUpgrade = idx > currentIdx
              const isDowngrade = idx < currentIdx
              const monthlyARS = PLAN_PRICES_ARS[plan]
              const displayPrice = period === "annual"
                ? Math.round(monthlyARS * (1 - ANNUAL_DISCOUNT))
                : monthlyARS
              const features = PLAN_FEATURES[plan]
              const isPopular = plan === "PROFESSIONAL" && !isCurrent

              return (
                <motion.div
                  key={plan}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: idx * 0.05, ease: "easeOut" }}
                  whileHover={{ y: -3, transition: { duration: 0.15 } }}
                  className={`relative card-glow rounded-2xl p-5 flex flex-col ${
                    isPopular ? "ring-1 ring-accent/60" : ""
                  } ${isCurrent ? "ring-1 ring-emerald-500/60" : ""} ${
                    isDowngrade ? "opacity-60" : ""
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-accent rounded-full text-accent-foreground text-[10px] font-bold tracking-wider">
                      MÁS POPULAR
                    </div>
                  )}
                  {isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-emerald-600 rounded-full text-white text-[10px] font-bold tracking-wider">
                      TU PLAN ACTUAL
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-4">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        plan === "FREE" ? "bg-gray-800" :
                        plan === "STARTER" ? "bg-blue-500/15 border border-blue-500/30" :
                        plan === "PROFESSIONAL" ? "bg-purple-500/15 border border-purple-500/30" :
                        "bg-amber-500/15 border border-amber-500/30"
                      }`}
                    >
                      <Icon size={18} className={
                        plan === "FREE" ? "text-gray-400" :
                        plan === "STARTER" ? "text-blue-400" :
                        plan === "PROFESSIONAL" ? "text-purple-400" :
                        "text-amber-400"
                      } />
                    </div>
                    <span className="text-white font-semibold">{PLAN_LABELS_AR[plan]}</span>
                  </div>
                  <div className="mb-1">
                    {monthlyARS === 0 ? (
                      <span className="text-3xl font-bold text-white">Gratis</span>
                    ) : (
                      <div className="flex items-baseline gap-1 flex-wrap">
                        <span className="text-3xl font-bold text-white tabular-nums">
                          $ <NumberFlow value={displayPrice} format={{ useGrouping: true }} />
                        </span>
                        <span className="text-gray-500 text-sm">/mes</span>
                      </div>
                    )}
                  </div>
                  {period === "annual" && monthlyARS > 0 && (
                    <div className="flex items-center gap-1 mb-3">
                      <span className="text-[11px] text-gray-500 line-through tabular-nums">
                        {formatCurrency(monthlyARS)}
                      </span>
                      <span className="text-[11px] font-semibold text-emerald-400">
                        -{Math.round(ANNUAL_DISCOUNT * 100)}%
                      </span>
                    </div>
                  )}
                  {monthlyARS === 0 && <div className="mb-3" />}
                  <ul className="space-y-2 mb-5 flex-1">
                    {features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                        <CheckCircle size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA logic:
                      - isCurrent → "Estás en este plan"
                      - FREE y currentIdx === 0 (sin subscription) → "Plan base"
                      - isDowngrade → mensaje discreto "Plan inferior" (no botón activo)
                      - isUpgrade → MP + Stripe (Stripe solo mensual)
                      - Enterprise actual → todos son downgrade */}
                  {isEnterprise ? (
                    <div className="w-full py-2.5 rounded-lg bg-emerald-600/10 border border-emerald-600/30 text-center text-emerald-300 text-xs">
                      Incluido en tu plan Empresa
                    </div>
                  ) : isCurrent ? (
                    <div className="w-full py-2.5 rounded-lg bg-emerald-600/10 border border-emerald-600/30 text-center text-emerald-300 text-sm font-medium">
                      ✓ Estás en este plan
                    </div>
                  ) : plan === "FREE" && currentIdx === 0 ? (
                    <div className="w-full py-2.5 rounded-lg border border-gray-800 text-center text-gray-600 text-sm">
                      Plan base
                    </div>
                  ) : isDowngrade ? (
                    <div className="w-full py-2.5 rounded-lg border border-gray-800 text-center text-gray-600 text-xs">
                      Plan inferior · cancelá tu plan actual primero
                    </div>
                  ) : (
                    /* isUpgrade */
                    <div className="space-y-2">
                      <button
                        onClick={() => handleUpgradeMP(plan)}
                        disabled={!!upgrading}
                        className="w-full py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 bg-accent hover:bg-accent-hover text-accent-foreground"
                      >
                        {upgrading === `mp:${plan}` ? "Redirigiendo..." : (
                          <>
                            <CreditCard size={14} />
                            Mejorar a {PLAN_LABELS_AR[plan]}
                            {period === "annual" && " (anual)"}
                          </>
                        )}
                      </button>
                      {period === "monthly" ? (
                        <button
                          onClick={() => handleUpgradeStripe(plan)}
                          disabled={!!upgrading}
                          className="w-full py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 bg-gray-800 hover:bg-gray-700 text-gray-400"
                        >
                          {upgrading === `stripe:${plan}` ? "Redirigiendo..." : "o pagar con tarjeta internacional (Stripe USD)"}
                        </button>
                      ) : (
                        <p className="text-[11px] text-gray-600 text-center">
                          Anual solo por Mercado Pago
                        </p>
                      )}
                    </div>
                  )}
                </motion.div>
              )
            })
          })()}
        </div>
        <p className="text-gray-600 text-xs mt-3 text-center">
          Pagos en pesos procesados por <span className="text-sky-400">Mercado Pago</span>. También podés pagar con tarjeta internacional vía Stripe (USD). Cancelá cuando quieras.
        </p>
        <p className="text-gray-700 text-[11px] mt-1 text-center">
          Plan label técnico: <span className="font-mono">{sub?.plan ? PLAN_LABELS[sub.plan as keyof typeof PLAN_LABELS] ?? sub.plan : "—"}</span>
        </p>
      </div>
    </div>
  )
}
