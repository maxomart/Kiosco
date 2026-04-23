"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
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
  STARTER: Zap,
  PROFESSIONAL: Crown,
  BUSINESS: Building2,
}

const PLAN_BADGE_COLORS: Record<string, string> = {
  STARTER: "bg-accent-soft text-accent border border-accent/40",
  PROFESSIONAL: "bg-accent-soft text-accent border border-accent/40",
  BUSINESS: "bg-accent-soft text-accent border border-accent/40",
  ENTERPRISE: "bg-accent-soft text-accent border border-accent/40",
  CANCELLED: "bg-red-500/15 text-red-300 border border-red-500/30",
}

export default function SuscripcionPage() {
  const [sub, setSub] = useState<Subscription | null>(null)
  const [userEmail, setUserEmail] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncAttempt, setSyncAttempt] = useState(0)
  const [welcomed, setWelcomed] = useState(false)
  const [upgrading, setUpgrading] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [period, setPeriod] = useState<BillingPeriod>("monthly")
  // MP email modal — we can't pass the signup email to MP by default
  // because if the user's MP account is on a different email (or a
  // different country), MP rejects with "Cannot operate between different
  // countries". We ask explicitly before redirecting.
  const [mpModal, setMpModal] = useState<{ plan: string; email: string; error?: string } | null>(null)
  const confirm = useConfirm()
  const router = useRouter()
  const searchParams = useSearchParams()
  const success = searchParams.get("success")
  const cancelled = searchParams.get("cancelled")
  const mpResult = searchParams.get("mp")
  const mobbexResult = searchParams.get("mobbex")

  useEffect(() => {
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
    const run = async () => {
      if (mobbexResult === "success") {
        setSyncing(true)
        // Mobbex webhook arrives fast — wait a few seconds then reload
        for (let i = 0; i < 5; i++) {
          setSyncAttempt(i + 1)
          if (i > 0) await sleep(3000)
          const d = await fetch("/api/configuracion/suscripcion").then(r => r.json())
          if (d.subscription?.status === "ACTIVE") {
            setSub(d.subscription)
            setWelcomed(true)
            router.refresh()
            setSyncing(false)
            return
          }
        }
        setSyncing(false)
      }
      if (mpResult === "success") {
        setSyncing(true)
        const MAX = 8
        for (let i = 0; i < MAX; i++) {
          setSyncAttempt(i + 1)
          if (i > 0) await sleep(3000)
          try {
            const syncRes = await fetch("/api/billing/mp/sync", { method: "POST" })
            const syncData = await syncRes.json()
            if (syncData.synced) { setWelcomed(true); router.refresh(); break }
          } catch { /* silencioso */ }
        }
        setSyncing(false)
      }
      const d = await fetch("/api/configuracion/suscripcion").then(r => r.json())
      setSub(d.subscription)
      if (d.userEmail) setUserEmail(d.userEmail)
      setLoading(false)
    }
    run()
  }, [mpResult])

  const handleUpgradeMobbex = async (plan: string) => {
    setUpgrading(`mobbex:${plan}`)
    try {
      const res = await fetch("/api/billing/mobbex/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, period }),
      })
      if (res.ok) {
        const { checkoutUrl } = await res.json()
        window.location.href = checkoutUrl
      } else {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || "Error al iniciar pago con Mobbex")
        setUpgrading(null)
      }
    } catch {
      toast.error("Error de red al contactar Mobbex")
      setUpgrading(null)
    }
  }

  // Try the checkout directly with the signup email first (friction-free
  // happy path). Only open the email modal if MP rejects with
  // different-country / invalid email — at that point we need the user to
  // type their actual MP Argentina account email.
  const attemptMPCheckout = async (
    plan: string,
    email: string
  ): Promise<{ ok: true } | { ok: false; code?: string; error?: string }> => {
    try {
      const res = await fetch("/api/billing/mp/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, period, payerEmail: email }),
      })
      if (res.ok) {
        const { initPoint } = await res.json()
        if (!initPoint) return { ok: false, error: "Mercado Pago no devolvió un link de pago. Intentá de nuevo." }
        window.location.href = initPoint
        return { ok: true }
      }
      const d = await res.json().catch(() => ({}))
      if (d.detail) console.error("[MP detail]", d.detail)
      return { ok: false, code: d.code, error: d.error }
    } catch {
      return { ok: false, error: "Error de red al contactar Mercado Pago." }
    }
  }

  const handleUpgradeMP = async (plan: string) => {
    // If we don't have the signup email yet, fall straight to the modal
    // so the user can type it in.
    if (!userEmail) {
      setMpModal({ plan, email: "" })
      return
    }
    setUpgrading(`mp:${plan}`)
    const result = await attemptMPCheckout(plan, userEmail)
    if (result.ok) return // redirect happened
    setUpgrading(null)
    // Different country / invalid email → open the modal with the error so
    // the user can switch to their actual MP Argentina email. Any other
    // error (token, amount, network) gets surfaced as a toast and we don't
    // bother the user with a form they can't fix.
    if (result.code === "DIFFERENT_COUNTRIES" || result.code === "PAYER_EMAIL_INVALID") {
      const msg =
        result.code === "DIFFERENT_COUNTRIES"
          ? "Ese email no tiene cuenta Mercado Pago Argentina. Probá con el email exacto de tu cuenta MP."
          : "El email no es válido para Mercado Pago. Probá con otro."
      setMpModal({ plan, email: userEmail, error: msg })
    } else {
      toast.error(result.error || "Error al iniciar pago con Mercado Pago", { duration: 6000 })
    }
  }

  const submitMPCheckout = async () => {
    if (!mpModal) return
    const email = mpModal.email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMpModal({ ...mpModal, error: "Ingresá un email válido." })
      return
    }
    setUpgrading(`mp:${mpModal.plan}`)
    const result = await attemptMPCheckout(mpModal.plan, email)
    if (result.ok) return
    setUpgrading(null)
    const msg =
      result.code === "DIFFERENT_COUNTRIES"
        ? "Ese email no está asociado a una cuenta Mercado Pago Argentina. Probá con el email exacto de tu cuenta MP."
        : result.code === "PAYER_EMAIL_INVALID"
          ? "El email no es válido para Mercado Pago."
          : result.error || "Error al iniciar pago con Mercado Pago."
    setMpModal({ ...mpModal, error: msg })
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

  if (syncing || (loading && mpResult === "success")) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-14 h-14 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
        <p className="text-gray-400 text-sm">Verificando tu pago con Mercado Pago…</p>
        {syncAttempt > 1 && (
          <p className="text-gray-600 text-xs">Intento {syncAttempt} de 8 — MP puede tardar unos segundos</p>
        )}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Suscripción</h1>
        <p className="text-gray-400 text-sm mt-1">Gestioná tu plan y facturación</p>
      </div>

      {/* Welcome banner after MP payment */}
      {welcomed && sub && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-xl border border-accent/30 bg-accent-soft p-6"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center flex-shrink-0">
              <Sparkles size={22} className="text-accent" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">¡Bienvenido a {PLAN_LABELS_AR[sub.plan as keyof typeof PLAN_LABELS_AR] ?? sub.plan}!</h2>
              <p className="text-accent/80 text-sm mt-1">
                Tu suscripción está activa. Ya podés usar todas las funciones de tu nuevo plan.
              </p>
              <button
                onClick={() => setWelcomed(false)}
                className="mt-3 text-xs text-accent/60 hover:text-accent transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Manual sync button — always visible when MP preapproval exists and plan not active */}
      {!welcomed && !syncing && sub?.mpPreapprovalId && sub?.status !== "ACTIVE" && (
        <div className="flex items-start gap-3 px-4 py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-300 text-sm">
          <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">¿Ya pagaste con Mercado Pago?</p>
            <p className="text-yellow-400/70 text-xs mt-0.5 mb-2">
              Si tu pago fue aprobado pero el plan no cambió, hacé click para verificar.
            </p>
            <button
              onClick={async () => {
                setSyncing(true)
                try {
                  const r = await fetch("/api/billing/mp/sync", { method: "POST" })
                  const d = await r.json()
                  if (d.synced) {
                    setWelcomed(true)
                    router.refresh()
                    const sub2 = await fetch("/api/configuracion/suscripcion").then(r2 => r2.json())
                    setSub(sub2.subscription)
                  } else {
                    toast.error(`MP respondió: ${d.mpStatus ?? d.reason ?? "pendiente"}. Si el pago fue aprobado, esperá 1 min y volvé a intentar.`)
                  }
                } catch { toast.error("Error de red") }
                setSyncing(false)
              }}
              className="px-3 py-1.5 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 text-xs font-medium transition-colors"
            >
              {syncing ? "Verificando…" : "Verificar pago"}
            </button>
          </div>
        </div>
      )}

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
      {!loading && sub && (() => {
        // Promo / trial countdown — always shown inside this page (no dismiss).
        const now = Date.now()
        const endMs = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).getTime() : null
        const daysLeft = endMs ? Math.max(0, Math.ceil((endMs - now) / 86_400_000)) : null
        const isFreeWindow =
          sub.plan !== "FREE" && !sub.paymentProvider && !!daysLeft && daysLeft > 0
        const urgent = isFreeWindow && daysLeft! <= 10
        return (
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-gray-500 text-sm">Plan actual</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-2xl font-bold text-white">{PLAN_LABELS_AR[sub.plan as keyof typeof PLAN_LABELS_AR] ?? sub.plan}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  sub.status === "CANCELLED"
                    ? PLAN_BADGE_COLORS.CANCELLED
                    : PLAN_BADGE_COLORS[sub.plan] || "bg-gray-700 text-gray-300"
                }`}>
                  {STATUS_LABELS[sub.status] || sub.status}
                </span>
                {isMP && (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-accent-soft text-accent border border-accent/30">
                    Suscrito vía Mercado Pago
                  </span>
                )}
                {sub.paymentProvider === "stripe" && (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-accent-soft text-accent border border-accent/30">
                    Suscrito vía Stripe
                  </span>
                )}
              </div>
              {sub.currentPeriodEnd && (
                <p className="text-gray-500 text-xs mt-1">
                  {sub.status === "CANCELLED" ? "Acceso hasta" : "Próxima renovación"}:{" "}
                  <span className={sub.status === "CANCELLED" ? "text-red-300 font-medium" : ""}>
                    {new Date(sub.currentPeriodEnd).toLocaleDateString("es-AR")}
                  </span>
                </p>
              )}
              {isFreeWindow && (
                <div
                  className={`mt-3 rounded-lg px-3 py-2 text-xs font-medium flex items-start gap-2 ${
                    urgent
                      ? "bg-amber-400/10 border border-amber-400/30 text-amber-200"
                      : "bg-emerald-400/10 border border-emerald-400/30 text-emerald-200"
                  }`}
                >
                  <Sparkles size={14} className="mt-0.5 shrink-0" />
                  <span>
                    {urgent
                      ? `Te quedan solo ${daysLeft} días de ${PLAN_LABELS_AR[sub.plan as keyof typeof PLAN_LABELS_AR] ?? sub.plan} gratis. `
                      : `Estás usando ${PLAN_LABELS_AR[sub.plan as keyof typeof PLAN_LABELS_AR] ?? sub.plan} gratis — te quedan ${daysLeft} días. `}
                    Suscribite antes del vencimiento para no perder features.
                  </span>
                </div>
              )}
              {sub.status === "CANCELLED" && (
                <p className="text-[11px] text-red-300/80 mt-1 max-w-md">
                  Cancelaste la suscripción. Seguís con todas las funciones hasta la fecha indicada y después pasás automáticamente al plan Gratis.
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
        )
      })()}

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
        {sub?.plan === "ENTERPRISE" && sub.status !== "CANCELLED" && (
          <div className="mb-5 rounded-2xl card-glow p-6 flex items-start gap-4">
            <div className="shrink-0 w-12 h-12 rounded-xl bg-accent-soft border border-accent/30 flex items-center justify-center">
              <Crown size={22} className="text-accent" />
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(() => {
            const PLAN_ORDER = ["STARTER", "PROFESSIONAL", "BUSINESS"] as const
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
                  } ${isCurrent ? "ring-1 ring-accent" : ""} ${
                    isDowngrade ? "opacity-60" : ""
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-accent rounded-full text-accent-foreground text-[10px] font-bold tracking-wider">
                      MÁS POPULAR
                    </div>
                  )}
                  {isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-accent rounded-full text-accent-foreground text-[10px] font-bold tracking-wider">
                      TU PLAN ACTUAL
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-accent-soft border border-accent/30">
                      <Icon size={18} className="text-accent" />
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
                        <span className="text-gray-500 text-sm">{period === "annual" ? "/mes" : "/mes"}</span>
                      </div>
                    )}
                  </div>
                  {period === "annual" && monthlyARS > 0 && (
                    <div className="space-y-2 mb-3">
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-gray-500 line-through tabular-nums">
                          {formatCurrency(monthlyARS)}
                        </span>
                        <span className="text-[11px] font-semibold text-accent">
                          -{Math.round(ANNUAL_DISCOUNT * 100)}%
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400 bg-gray-800/40 rounded px-2 py-1.5">
                        <span className="text-white font-semibold">Total anual: ${formatCurrency(Math.round(monthlyARS * 12 * (1 - ANNUAL_DISCOUNT)))}</span>
                      </div>
                    </div>
                  )}
                  {monthlyARS === 0 && <div className="mb-3" />}
                  <ul className="space-y-2 mb-5 flex-1">
                    {features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                        <CheckCircle size={14} className="text-accent mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA logic:
                      - isCurrent → "Estás en este plan"
                      - isDowngrade → mensaje discreto "Plan inferior" (no botón activo)
                      - isUpgrade → MP + Stripe (Stripe solo mensual)
                      - Enterprise actual → todos son downgrade */}
                  {isEnterprise ? (
                    <div className="w-full py-2.5 rounded-lg bg-accent-soft border border-accent/30 text-center text-accent text-xs font-medium">
                      Incluido en tu plan Empresa
                    </div>
                  ) : isCurrent ? (
                    <div className="w-full py-2.5 rounded-lg bg-accent-soft border border-accent/40 text-center text-accent text-sm font-medium">
                      ✓ Estás en este plan
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
                      {period === "monthly" && (
                        <button
                          onClick={() => handleUpgradeStripe(plan)}
                          disabled={!!upgrading}
                          className="w-full py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 bg-gray-800 hover:bg-gray-700 text-gray-400"
                        >
                          {upgrading === `stripe:${plan}` ? "Redirigiendo..." : "o pagar con tarjeta internacional (Stripe USD)"}
                        </button>
                      )}
                    </div>
                  )}
                </motion.div>
              )
            })
          })()}
        </div>
        <p className="text-gray-600 text-xs mt-3 text-center">
          Pagos en pesos procesados por <span className="text-accent font-medium">Mercado Pago</span>. También podés pagar con tarjeta internacional vía Stripe (USD). Cancelá cuando quieras.
        </p>
        <p className="text-gray-700 text-[11px] mt-1 text-center">
          Plan label técnico: <span className="font-mono">{sub?.plan ? PLAN_LABELS[sub.plan as keyof typeof PLAN_LABELS] ?? sub.plan : "—"}</span>
        </p>
      </div>

      {mpModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !upgrading && setMpModal(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-gray-950 shadow-2xl p-5 sm:p-6"
          >
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-full bg-accent-soft text-accent flex items-center justify-center">
                <CreditCard size={16} />
              </div>
              <h3 className="text-white font-semibold text-base">Email de Mercado Pago</h3>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed mb-4">
              Ingresá el email de <span className="text-white">tu cuenta Mercado Pago Argentina</span>.
              Puede ser distinto al email con el que te registraste.
            </p>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Email de tu cuenta MP</label>
            <input
              type="email"
              autoFocus
              value={mpModal.email}
              onChange={(e) => setMpModal({ ...mpModal, email: e.target.value, error: undefined })}
              placeholder="tu@email.com"
              className={`w-full bg-black/40 border rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition focus:ring-2 focus:ring-white/20 ${
                mpModal.error ? "border-red-500/60" : "border-white/10 focus:border-white/30"
              }`}
              onKeyDown={(e) => { if (e.key === "Enter" && !upgrading) submitMPCheckout() }}
            />
            {mpModal.error && (
              <p className="mt-2 text-[12px] text-red-300 leading-relaxed">{mpModal.error}</p>
            )}
            <div className="mt-2 text-[11px] text-gray-500 leading-relaxed">
              Si no tenés cuenta MP Argentina, creá una gratis en{" "}
              <a
                href="https://www.mercadopago.com.ar/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                mercadopago.com.ar
              </a>
              {" "}y volvé acá.
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setMpModal(null)}
                disabled={!!upgrading}
                className="px-3.5 py-2 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submitMPCheckout}
                disabled={!!upgrading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white hover:bg-gray-200 text-black text-sm font-semibold transition-colors disabled:opacity-60"
              >
                {upgrading === `mp:${mpModal.plan}` ? "Redirigiendo…" : "Ir a Mercado Pago"}
                <ExternalLink size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
