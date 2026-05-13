"use client"

import { Fragment, useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { CheckCircle, Zap, Crown, ArrowDown, ExternalLink, AlertCircle, CreditCard, Sparkles } from "lucide-react"
import NumberFlow from "@number-flow/react"
import { motion } from "framer-motion"
import toast from "react-hot-toast"
import { BillingToggle, type BillingPeriod } from "@/components/shared/BillingToggle"
import { useConfirm } from "@/components/shared/ConfirmDialog"
import dynamic from "next/dynamic"

// Modal con MP Brick — SSR off para evitar hydration mismatch (#418).
// El SDK de MP toca window al inicializar y eso rompe el render del server.
const MPCardModal = dynamic(
  () => import("@/components/billing/MPCardModal").then((m) => m.MPCardModal),
  { ssr: false }
)

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
    "Hasta 100 productos · 1 usuario",
    "Hasta 50 ventas por mes",
    "15 clientes · 10 proveedores · 15 categorías",
    "POS + inventario + caja",
    "Reportes de los últimos 7 días",
    "POS offline-first",
    "Sin facturación electrónica AFIP",
    "Para arrancar gratis sin tarjeta",
  ],
  STARTER: [
    "1.000 productos · 3 usuarios",
    "200 clientes · 50 proveedores · categorías ilimitadas",
    "AFIP — 50 facturas/mes (A/B/C con CAE)",
    "Notas de crédito por total",
    "Logo y tema con tu color",
    "Importar / exportar Excel",
    "Etiquetas con código de barras",
    "History ilimitado",
  ],
  PROFESSIONAL: [
    "Todo lo del Básico + lo cool",
    "5.000 productos · 10 usuarios · 1.000 clientes",
    "AFIP — 2000 facturas/mes",
    "Auto-factura en el POS (1 clic al cobrar)",
    "NC parcial + ND con monto y concepto custom",
    "Libro IVA Ventas exportable",
    "IA predictiva y chatbot integrado",
    "Pedidos a proveedor con IA",
    "Loyalty (puntos + canje)",
    "Multi-caja simultánea",
    "Reportes IA con comparaciones",
    "Soporte prioritario",
  ],
}

/**
 * Tabla comparativa lado a lado de features clave entre Básico y Profesional.
 * El user ve dónde está el upgrade real con un vistazo.
 *
 * Formato: { feature, free, starter, pro } — boolean o string corto.
 */
const PLAN_COMPARE_ROWS: Array<{
  category: string
  rows: Array<{ label: string; free: string | boolean; starter: string | boolean; pro: string | boolean }>
}> = [
  {
    category: "Operación",
    rows: [
      { label: "POS + inventario + caja", free: true, starter: true, pro: true },
      { label: "Reportes", free: "7 días", starter: "ilimitado", pro: "completo + IA" },
      { label: "Productos", free: "100", starter: "1.000", pro: "5.000" },
      { label: "Usuarios", free: "1", starter: "3", pro: "10" },
      { label: "Clientes", free: "15", starter: "200", pro: "1.000" },
    ],
  },
  {
    category: "Facturación AFIP",
    rows: [
      { label: "Emisión de factura A/B/C", free: false, starter: "50/mes", pro: "2.000/mes" },
      { label: "Auto-factura al cobrar (POS)", free: false, starter: false, pro: true },
      { label: "NC por anulación total", free: false, starter: true, pro: true },
      { label: "NC parcial (monto custom)", free: false, starter: false, pro: true },
      { label: "ND con monto + concepto custom", free: false, starter: false, pro: true },
      { label: "Libro IVA Ventas exportable", free: false, starter: false, pro: true },
    ],
  },
  {
    category: "Productividad",
    rows: [
      { label: "Importar/exportar Excel", free: false, starter: true, pro: true },
      { label: "Etiquetas con código de barras", free: false, starter: true, pro: true },
      { label: "Logo y tema custom", free: false, starter: true, pro: true },
      { label: "Multi-caja simultánea", free: false, starter: false, pro: true },
    ],
  },
  {
    category: "Inteligencia (IA)",
    rows: [
      { label: "Chatbot integrado en /ventas e /inventario", free: false, starter: false, pro: true },
      { label: "Predicción de demanda en /inicio", free: false, starter: false, pro: true },
      { label: "Pedidos a proveedor sugeridos", free: false, starter: false, pro: true },
      { label: "Insights y análisis IA", free: false, starter: false, pro: true },
    ],
  },
  {
    category: "Loyalty y crecimiento",
    rows: [
      { label: "Sistema de puntos + canje", free: false, starter: false, pro: true },
      { label: "Soporte prioritario (WhatsApp)", free: false, starter: false, pro: true },
    ],
  },
]

const PLAN_ICONS: Record<string, React.ElementType> = {
  FREE: Sparkles,
  STARTER: Zap,
  PROFESSIONAL: Crown,
}

const PLAN_BADGE_COLORS: Record<string, string> = {
  FREE: "bg-gray-800/80 text-gray-300 border border-gray-700/60",
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
  // Card-in-app modal (MP Brick) — el flow principal. mpModal queda como
  // fallback "redirigirme a MP" si por algún motivo el Brick no carga.
  const [cardModal, setCardModal] = useState<{ plan: "STARTER" | "PROFESSIONAL"; amount: number } | null>(null)
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
        "Cancelás la renovación automática en Mercado Pago. Al finalizar el período actual pagado vas a tener que suscribirte de nuevo para seguir usando Orvex.",
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
    CANCELLED: "Cancelado", FREE: "Sin plan activo",
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
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Suscripción</h1>
          <p className="text-gray-400 text-sm mt-1">Gestioná tu plan y facturación</p>
        </div>
        <MpEnvBadge />
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
                  Cancelaste la suscripción. Seguís con todas las funciones hasta la fecha indicada y después vas a tener que suscribirte de nuevo para seguir usando Orvex.
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
              <RefundButton planLabel={PLAN_LABELS_AR[sub.plan as keyof typeof PLAN_LABELS_AR] ?? sub.plan} />
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

        {/* Política de cambio de plan — explicación honesta */}
        {sub?.plan && sub.plan !== "FREE" && sub.status !== "CANCELLED" && (
          <div className="mb-5 bg-gray-900/50 border border-gray-800 rounded-xl p-4 flex gap-3">
            <Sparkles size={14} className="text-purple-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-gray-400 leading-relaxed">
              <strong className="text-gray-200">¿Cómo funciona el cambio de plan?</strong>
              <ul className="mt-1.5 space-y-1">
                <li>
                  • <strong className="text-emerald-300">Si subís de plan</strong> (ej: Básico → Profesional): se aplica al toque, cobramos el nuevo plan desde hoy. Si te queda saldo del plan actual, te lo acreditamos manualmente vía Mercado Pago.
                </li>
                <li>
                  • <strong className="text-amber-300">Si bajás de plan</strong> (ej: Profesional → Básico): mantenés tus features hasta el fin del ciclo actual y a partir de ahí seguís con el plan menor. No reembolsamos lo ya pagado.
                </li>
                <li>
                  • Para casos especiales escribinos a{" "}
                  <a href="mailto:cobraorvex@gmail.com" className="text-purple-300 underline">
                    cobraorvex@gmail.com
                  </a>{" "}
                  o pedinos un reembolso desde acá arriba.
                </li>
              </ul>
            </div>
          </div>
        )}
        {(sub?.plan === "ENTERPRISE" || sub?.plan === "BUSINESS") && sub.status !== "CANCELLED" && (
          <div className="mb-5 rounded-2xl card-glow p-6 flex items-start gap-4">
            <div className="shrink-0 w-12 h-12 rounded-xl bg-accent-soft border border-accent/30 flex items-center justify-center">
              <Crown size={22} className="text-accent" />
            </div>
            <div className="flex-1">
              <p className="text-white font-semibold">Estás en un plan legacy ({PLAN_LABELS_AR[sub.plan as keyof typeof PLAN_LABELS_AR] ?? sub.plan})</p>
              <p className="text-sm text-gray-400 mt-1">
                Tenés acceso a todas las funciones sin límites. Este plan ya no se ofrece a clientes
                nuevos pero seguís con todas tus features. Si querés cambiar a Básico o Profesional,
                contactá al equipo de soporte.
              </p>
              <a
                href="mailto:soporte@cobraorvex.com?subject=Cambio%20de%20plan"
                className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-accent-foreground text-sm font-semibold transition"
              >
                Contactar soporte
              </a>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(() => {
            const PLAN_ORDER = ["STARTER", "PROFESSIONAL"] as const
            // "ENTERPRISE" / "BUSINESS" legacy se muestran en cards aparte (arriba).
            // En este grid marcamos todos como "ya desbloqueado" para legacy.
            const subPlan = sub?.plan
            const isLegacyHigher = subPlan === "ENTERPRISE" || subPlan === "BUSINESS"
            const orderIdx = subPlan ? PLAN_ORDER.indexOf(subPlan as typeof PLAN_ORDER[number]) : -1
            const currentIdx = isLegacyHigher ? PLAN_ORDER.length : (orderIdx === -1 ? -1 : orderIdx)

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
              const isPopular = plan === "STARTER" && !isCurrent

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
                      - Legacy (BUSINESS / ENTERPRISE) → todos son downgrade */}
                  {isLegacyHigher ? (
                    <div className="w-full py-2.5 rounded-lg bg-accent-soft border border-accent/30 text-center text-accent text-xs font-medium">
                      Incluido en tu plan legacy
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
                        onClick={() => {
                          const monthly = PLAN_PRICES_ARS[plan as keyof typeof PLAN_PRICES_ARS]
                          const amount = period === "annual"
                            ? Math.round(monthly * 12 * (1 - ANNUAL_DISCOUNT))
                            : monthly
                          setCardModal({ plan: plan as "STARTER" | "PROFESSIONAL", amount })
                        }}
                        disabled={!!upgrading}
                        className="w-full py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 bg-accent hover:bg-accent-hover text-accent-foreground"
                      >
                        <CreditCard size={14} />
                        Suscribirme a {PLAN_LABELS_AR[plan]}
                        {period === "annual" && " (anual)"}
                      </button>
                      <button
                        onClick={() => handleUpgradeMP(plan)}
                        disabled={!!upgrading}
                        className="w-full py-1.5 rounded-lg text-[11px] font-medium transition-colors flex items-center justify-center gap-1 disabled:opacity-50 text-gray-500 hover:text-gray-300"
                      >
                        {upgrading === `mp:${plan}` ? "Redirigiendo..." : "o pagar redirigiendo a Mercado Pago"}
                      </button>
                      {period === "monthly" && (
                        <button
                          onClick={() => handleUpgradeStripe(plan)}
                          disabled={!!upgrading}
                          className="w-full py-1.5 rounded-lg text-[11px] font-medium transition-colors flex items-center justify-center gap-1 disabled:opacity-50 text-gray-500 hover:text-gray-300"
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

      {cardModal && (
        <MPCardModal
          open
          onClose={() => setCardModal(null)}
          plan={cardModal.plan}
          planLabel={PLAN_LABELS_AR[cardModal.plan]}
          amount={cardModal.amount}
          period={period}
          onSuccess={async () => {
            // Refrescar la subscription para que se vea el plan nuevo
            try {
              const res = await fetch("/api/configuracion/suscripcion", { cache: "no-store" })
              const data = await res.json()
              setSub(data.subscription)
            } catch { /* no-op */ }
          }}
        />
      )}

      {/* ─── Tabla comparativa ─────────────────────────────────────────── */}
      <ComparePlansTable currentPlan={sub?.plan ?? "FREE"} />
    </div>
  )
}

/**
 * Tabla comparativa Free vs Básico vs Profesional. Renderiza las features
 * agrupadas por categoría con tildes/checks. Diseñada para ser scanneable —
 * el user ve en 5 segundos qué hay en cada tier.
 */
function ComparePlansTable({ currentPlan }: { currentPlan: string }) {
  const cellValue = (v: string | boolean) => {
    if (v === true) {
      return (
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20">
          <CheckCircle size={12} className="text-emerald-400" />
        </span>
      )
    }
    if (v === false) {
      return <span className="text-gray-700">—</span>
    }
    return <span className="text-xs font-medium text-white">{v}</span>
  }

  const headerCell = (key: "free" | "starter" | "pro", label: string) => {
    const isCurrent =
      (key === "free" && currentPlan === "FREE") ||
      (key === "starter" && currentPlan === "STARTER") ||
      (key === "pro" && (currentPlan === "PROFESSIONAL" || currentPlan === "BUSINESS" || currentPlan === "ENTERPRISE"))
    return (
      <th
        className={`text-center font-bold text-sm px-4 py-3 ${
          isCurrent
            ? "bg-purple-600/15 text-purple-200 border-b-2 border-purple-500/60"
            : key === "pro"
              ? "bg-gradient-to-b from-purple-600/10 to-transparent text-white"
              : "text-gray-300"
        }`}
      >
        <div className="flex flex-col items-center gap-0.5">
          <span>{label}</span>
          {isCurrent && (
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-200 border border-purple-500/30 uppercase tracking-wider">
              Tu plan
            </span>
          )}
        </div>
      </th>
    )
  }

  return (
    <section className="mt-10 bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-800">
        <h2 className="text-xl font-bold text-white">Comparativa detallada de planes</h2>
        <p className="text-sm text-gray-400 mt-1">
          Todo lo que incluye cada tier. Lo de AFIP arranca en Básico y se vuelve completo en Profesional.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-950/60">
            <tr>
              <th className="text-left font-semibold text-xs text-gray-500 uppercase tracking-wider px-4 py-3"></th>
              {headerCell("free", "Gratis")}
              {headerCell("starter", "Básico")}
              {headerCell("pro", "Profesional")}
            </tr>
          </thead>
          <tbody>
            {PLAN_COMPARE_ROWS.map((cat) => (
              <Fragment key={cat.category}>
                <tr>
                  <td
                    colSpan={4}
                    className="bg-gray-950/40 text-[11px] uppercase tracking-wider text-gray-500 font-bold px-4 py-2 border-t border-gray-800"
                  >
                    {cat.category}
                  </td>
                </tr>
                {cat.rows.map((row) => (
                  <tr key={row.label} className="border-t border-gray-900/60 hover:bg-gray-900/30">
                    <td className="px-4 py-2.5 text-gray-300">{row.label}</td>
                    <td className="text-center px-4 py-2.5">{cellValue(row.free)}</td>
                    <td className="text-center px-4 py-2.5">{cellValue(row.starter)}</td>
                    <td className="text-center px-4 py-2.5 bg-purple-950/10">{cellValue(row.pro)}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/** Botón "Pedir reembolso" que abre un modal y crea un ticket de soporte
 * con prioridad alta + escalado al admin. La devolución no es automática
 * — el admin la procesa a mano vía MP, dentro de los 14 días por ley. */
function RefundButton({ planLabel }: { planLabel: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    if (reason.trim().length < 5) {
      toast.error("Decinos brevemente por qué pedís el reembolso")
      return
    }
    setSubmitting(true)
    try {
      const r = await fetch("/api/soporte/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: `Pedido de reembolso — Plan ${planLabel}`,
          message: `Hola, quisiera pedir el reembolso de mi suscripción.\n\nMotivo:\n${reason.trim()}\n\nPor favor revísenlo. Gracias.`,
        }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        toast.error(d.error ?? "No pudimos abrir el ticket")
        return
      }
      toast.success("Ticket de reembolso creado — el admin te va a contactar", { duration: 5000 })
      setOpen(false)
      setReason("")
    } catch {
      toast.error("Error de red")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 text-sm transition-colors border border-gray-700"
        title="Crear ticket de reembolso (revisión manual)"
      >
        Pedir reembolso
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-5 space-y-4">
            <h2 className="text-white font-bold text-lg">Pedir reembolso</h2>
            <p className="text-sm text-gray-400">
              Vas a crear un ticket de soporte con prioridad alta. El equipo te contesta en menos de 24hs y procesa la devolución vía Mercado Pago si corresponde (hasta 14 días desde el cobro).
            </p>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1.5">
                ¿Por qué pedís el reembolso?
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, 800))}
                rows={4}
                placeholder="Ej: pagué por error, no es lo que esperaba, ya no necesito el servicio…"
                className="w-full bg-gray-800 border border-gray-700 hover:border-gray-600 focus:border-purple-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 resize-none"
              />
              <p className="text-[10px] text-gray-500 mt-1">{reason.length}/800</p>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setOpen(false)}
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={submit}
                disabled={submitting || reason.trim().length < 5}
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-semibold"
              >
                {submitting ? "Enviando…" : "Enviar pedido"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/** Badge que muestra si MP está en TEST o PRODUCCIÓN. Solo OWNER lo ve. */
function MpEnvBadge() {
  const [info, setInfo] = useState<{ mode: "test" | "production" | "missing" } | null>(null)
  useEffect(() => {
    fetch("/api/billing/mp/env", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setInfo)
      .catch(() => setInfo(null))
  }, [])
  if (!info) return null
  if (info.mode === "production") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold uppercase tracking-wider">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        MP Producción
      </span>
    )
  }
  if (info.mode === "test") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-bold uppercase tracking-wider" title="MP en sandbox — los pagos son ficticios">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        MP Test (sandbox)
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-300 text-[11px] font-bold uppercase tracking-wider" title="MP_ACCESS_TOKEN no configurado en Railway">
      MP No configurado
    </span>
  )
}
