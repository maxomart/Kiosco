"use client"

import { useState } from "react"
import Link from "next/link"
import { AlertCircle, Crown, Gift, Sparkles, X } from "lucide-react"
import { PLAN_LABELS_AR } from "@/lib/utils"

export type BannerKind = "trial" | "promo" | "expired-promo" | "expired-trial" | null

export interface BannerData {
  kind: BannerKind
  plan: string // plan label, e.g. "Profesional"
  daysLeft?: number // for active windows
  upgradeHref?: string
}

const LS_KEY = "sub-banner-dismissed"

// Server computes `kind`, `plan`, `daysLeft`. Banner does the render + dismiss.
// Dismiss is per-browser (localStorage), scoped by the banner signature so a
// different state (e.g. days=5 vs days=1) re-appears even if the user hid an
// older version of the same message.
export default function SubscriptionStatusBanner({
  kind,
  plan,
  daysLeft,
  upgradeHref = "/configuracion/suscripcion",
}: BannerData) {
  const signature = `${kind}:${plan}:${daysLeft ?? ""}`
  const [hidden, setHidden] = useState(() => {
    if (typeof window === "undefined") return false
    return window.localStorage.getItem(LS_KEY) === signature
  })

  if (!kind || hidden) return null

  function dismiss() {
    try {
      window.localStorage.setItem(LS_KEY, signature)
    } catch {}
    setHidden(true)
  }

  if (kind === "promo") {
    const urgent = (daysLeft ?? 0) <= 10
    return (
      <Wrapper
        className={
          urgent
            ? "border-amber-400/40 bg-gradient-to-r from-amber-400/15 to-amber-500/5"
            : "border-emerald-400/30 bg-gradient-to-r from-emerald-400/10 to-emerald-500/5"
        }
        onDismiss={dismiss}
      >
        <IconCircle
          className={urgent ? "bg-amber-400/20 text-amber-200" : "bg-emerald-400/20 text-emerald-200"}
        >
          <Gift className="w-4 h-4" />
        </IconCircle>
        <Copy>
          <Title>
            {urgent
              ? `Te quedan ${daysLeft} días de ${plan} gratis`
              : `Estás usando ${plan} gratis — quedan ${daysLeft} días`}
          </Title>
          <Sub>
            {urgent
              ? "Suscribite antes para no perder clientes, productos y features Pro."
              : "Después del período tu cuenta pasa a Gratis automáticamente."}
          </Sub>
        </Copy>
        <CTA href={upgradeHref} variant={urgent ? "solid-amber" : "solid-emerald"}>
          {urgent ? "Seguir con Pro" : "Ver planes"}
        </CTA>
      </Wrapper>
    )
  }

  if (kind === "trial") {
    const urgent = (daysLeft ?? 0) <= 3
    return (
      <Wrapper
        className={
          urgent
            ? "border-amber-400/40 bg-gradient-to-r from-amber-400/15 to-amber-500/5"
            : "border-white/10 bg-white/[0.04]"
        }
        onDismiss={dismiss}
      >
        <IconCircle className={urgent ? "bg-amber-400/20 text-amber-200" : "bg-white/10 text-white/80"}>
          <Sparkles className="w-4 h-4" />
        </IconCircle>
        <Copy>
          <Title>
            {urgent
              ? `Prueba gratis vence en ${daysLeft} día${daysLeft === 1 ? "" : "s"}`
              : `Probando ${plan} · ${daysLeft} días restantes`}
          </Title>
          <Sub>
            {urgent
              ? "Agregá un método de pago antes del vencimiento para no interrumpir el servicio."
              : "Sin tarjeta requerida todavía. Cuando quieras, pasá a un plan pago."}
          </Sub>
        </Copy>
        <CTA href={upgradeHref} variant={urgent ? "solid-amber" : "outline"}>
          {urgent ? "Suscribirme" : "Ver planes"}
        </CTA>
      </Wrapper>
    )
  }

  if (kind === "expired-promo" || kind === "expired-trial") {
    const fromPromo = kind === "expired-promo"
    return (
      <Wrapper
        className="border-rose-400/30 bg-gradient-to-r from-rose-500/10 to-rose-400/5"
        onDismiss={dismiss}
      >
        <IconCircle className="bg-rose-500/20 text-rose-200">
          <AlertCircle className="w-4 h-4" />
        </IconCircle>
        <Copy>
          <Title>
            {fromPromo
              ? `Tu período gratuito de ${plan} terminó`
              : `Tu prueba gratuita terminó`}
          </Title>
          <Sub>
            Pasaste a Gratis. Es posible que veas productos, usuarios o reportes limitados.
            Suscribite para recuperar el acceso completo.
          </Sub>
        </Copy>
        <CTA href={upgradeHref} variant="solid-rose">
          <Crown className="w-3.5 h-3.5" />
          Volver a {plan}
        </CTA>
      </Wrapper>
    )
  }

  return null
}

/* ────────── primitives ────────── */

function Wrapper({
  children,
  className = "",
  onDismiss,
}: {
  children: React.ReactNode
  className?: string
  onDismiss: () => void
}) {
  return (
    <div
      role="status"
      className={`mx-4 lg:mx-6 mt-4 rounded-xl border p-3 sm:p-3.5 flex items-start gap-3 ${className}`}
    >
      {children}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Cerrar"
        className="shrink-0 p-1 -m-1 rounded-md text-white/50 hover:text-white/90 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

function IconCircle({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <div
      className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${className}`}
      aria-hidden
    >
      {children}
    </div>
  )
}

function Copy({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 min-w-0">{children}</div>
}

function Title({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-semibold text-white leading-snug">{children}</p>
}

function Sub({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-white/70 mt-0.5 leading-relaxed">{children}</p>
}

function CTA({
  href,
  children,
  variant,
}: {
  href: string
  children: React.ReactNode
  variant: "solid-emerald" | "solid-amber" | "solid-rose" | "outline"
}) {
  const cls =
    variant === "solid-emerald"
      ? "bg-emerald-400 hover:bg-emerald-300 text-black"
      : variant === "solid-amber"
        ? "bg-amber-400 hover:bg-amber-300 text-black"
        : variant === "solid-rose"
          ? "bg-rose-400 hover:bg-rose-300 text-black"
          : "bg-white/10 hover:bg-white/20 text-white border border-white/10"
  return (
    <Link
      href={href}
      className={`shrink-0 self-center inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${cls}`}
    >
      {children}
    </Link>
  )
}

/* ────────── server-side derivation helper ────────── */

// Call this from the dashboard layout with the tenant's current subscription
// snapshot. Returns the banner data (or kind=null to hide).
//
// Core rule: if the tenant is on a paid plan without paymentProvider AND the
// current period hasn't ended, they're using the app for free in some way
// (promo or trial). Show them the countdown regardless of the exact status
// string. The `hadPromo` flag only picks the copy/color.
//
// Historical note: the previous version required status === "TRIALING" for
// the trial banner but the promo signup creates subscriptions with status
// ACTIVE, which meant promo users saw no banner when the PromoRedemption
// lookup failed (e.g. stale Prisma client). This version survives that.
export function deriveBannerState(args: {
  plan: string
  status: string | null | undefined
  currentPeriodEnd: Date | null | undefined
  paymentProvider: string | null | undefined
  hadPromo: boolean
  promoPlan?: string | null
}): BannerData {
  const { plan, currentPeriodEnd, paymentProvider, hadPromo, promoPlan } = args
  const now = new Date()

  const daysUntil = (d: Date | null | undefined): number =>
    d ? Math.max(0, Math.ceil((d.getTime() - now.getTime()) / 86_400_000)) : 0

  // Paid plan + payment provider set → real customer, no banner.
  if (plan !== "FREE" && paymentProvider) {
    return { kind: null, plan: "" }
  }

  // Paid plan + NO paymentProvider + period still open → promo or trial window.
  if (plan !== "FREE" && !paymentProvider && currentPeriodEnd && currentPeriodEnd > now) {
    return {
      kind: hadPromo ? "promo" : "trial",
      plan: label(plan),
      daysLeft: daysUntil(currentPeriodEnd),
    }
  }

  // Downgraded to FREE after a promo window closed.
  if (hadPromo && plan === "FREE") {
    return {
      kind: "expired-promo",
      plan: label(promoPlan ?? "PROFESSIONAL"),
    }
  }

  // FREE with a past currentPeriodEnd and no provider → trial expired.
  if (
    !hadPromo &&
    plan === "FREE" &&
    currentPeriodEnd &&
    currentPeriodEnd < now &&
    !paymentProvider
  ) {
    return {
      kind: "expired-trial",
      plan: "un plan pago",
    }
  }

  return { kind: null, plan: "" }
}

function label(plan: string): string {
  return PLAN_LABELS_AR[plan as keyof typeof PLAN_LABELS_AR] ?? plan
}
