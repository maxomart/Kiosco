// Server-safe helper. Lives outside the "use client" banner component so the
// dashboard layout (a Server Component) can call it without the
// "can't invoke client function from server" error.

import { PLAN_LABELS_AR } from "@/lib/utils"

/** Días que le damos al cliente para arreglar un pago fallido antes de cortar acceso. */
export const GRACE_PERIOD_DAYS = 3

export type BannerKind =
  | "trial"
  | "promo"
  | "expired-promo"
  | "expired-trial"
  | "past-due-grace"   // pago falló pero está dentro de los 3 días de gracia
  | "blocked"          // trial vencido o gracia agotada → bloquear acceso
  | null

export interface BannerData {
  kind: BannerKind
  plan: string
  daysLeft?: number
  upgradeHref?: string
}

// Derives what (if any) subscription banner to show based on the tenant's
// current subscription snapshot and whether they have a PromoRedemption.
//
// Core rule: if the tenant is on a paid plan without paymentProvider AND the
// current period hasn't ended, they're using the app for free in some way
// (promo or trial). Show them the countdown regardless of the exact status
// string. The `hadPromo` flag only picks the copy/color.
export function deriveBannerState(args: {
  plan: string
  status: string | null | undefined
  currentPeriodEnd: Date | null | undefined
  paymentProvider: string | null | undefined
  hadPromo: boolean
  promoPlan?: string | null
}): BannerData {
  const { plan, status, currentPeriodEnd, paymentProvider, hadPromo, promoPlan } = args
  const now = new Date()

  const daysUntil = (d: Date | null | undefined): number =>
    d ? Math.max(0, Math.ceil((d.getTime() - now.getTime()) / 86_400_000)) : 0

  const daysSince = (d: Date | null | undefined): number =>
    d ? Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86_400_000)) : 0

  // ─── Pago vencido (PAST_DUE) ───
  // El proveedor está, pero el último cobro falló. Damos GRACE_PERIOD_DAYS
  // de margen para que arregle la tarjeta antes de bloquear.
  if (status === "PAST_DUE" && currentPeriodEnd) {
    const overdueDays = daysSince(currentPeriodEnd)
    if (overdueDays < GRACE_PERIOD_DAYS) {
      return {
        kind: "past-due-grace",
        plan: label(plan),
        daysLeft: GRACE_PERIOD_DAYS - overdueDays, // días que le quedan antes del corte
      }
    }
    // Más allá del grace → bloqueo
    return { kind: "blocked", plan: label(plan) }
  }

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

  // FREE con period vencido y sin provider → trial agotado → bloqueo total.
  if (
    !hadPromo &&
    plan === "FREE" &&
    currentPeriodEnd &&
    currentPeriodEnd < now &&
    !paymentProvider
  ) {
    return {
      kind: "blocked",
      plan: "un plan pago",
    }
  }

  // FREE recién creado con period futuro → trial activo (kind="trial" lo cubre arriba)
  return { kind: null, plan: "" }
}

/** True si el banner indica que hay que bloquear el acceso al dashboard. */
export function isBlockingState(kind: BannerKind): boolean {
  return kind === "blocked"
}

function label(plan: string): string {
  return PLAN_LABELS_AR[plan as keyof typeof PLAN_LABELS_AR] ?? plan
}
