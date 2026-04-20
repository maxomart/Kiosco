"use client"

import Link from "next/link"
import { Lock, Sparkles, ArrowRight, Check } from "lucide-react"
import { PLAN_LABELS, type Plan } from "@/lib/utils"

interface PaywallGateProps {
  /** The plan the user currently has. */
  currentPlan: Plan
  /** The cheapest plan that unlocks this feature. */
  requiredPlan: Plan
  /** Title shown in the paywall card. */
  title: string
  /** Description / value prop. */
  description: string
  /** Bullet list of perks (optional). */
  perks?: string[]
}

/**
 * Friendly empty state shown when a user tries to access a feature their
 * plan doesn't unlock. Renders an upgrade CTA pointing at the subscription
 * page. Designed to match the dashboard's dark theme + accent.
 */
export function PaywallGate({
  currentPlan,
  requiredPlan,
  title,
  description,
  perks,
}: PaywallGateProps) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl shadow-black/30 animate-in fade-in zoom-in-95 duration-300">
        <div className="w-16 h-16 rounded-2xl bg-accent-soft flex items-center justify-center mx-auto mb-5">
          <Lock className="w-7 h-7 text-accent" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium mb-3">
          <Sparkles className="w-3 h-3" />
          Disponible en plan {PLAN_LABELS[requiredPlan]} y superiores
        </div>

        <h2 className="text-xl font-bold text-gray-100 mb-2">{title}</h2>
        <p className="text-sm text-gray-400 mb-6 leading-relaxed">{description}</p>

        {perks && perks.length > 0 && (
          <ul className="text-left bg-gray-800/40 rounded-xl p-4 mb-6 space-y-2">
            {perks.map((p) => (
              <li key={p} className="flex items-start gap-2 text-sm text-gray-300">
                <Check className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        )}

        <Link
          href="/configuracion/suscripcion"
          className="inline-flex items-center justify-center gap-2 w-full bg-accent hover:bg-accent-hover text-accent-foreground font-semibold px-5 py-3 rounded-xl transition shadow-lg shadow-accent/20"
        >
          Ver planes y suscribirme
          <ArrowRight className="w-4 h-4" />
        </Link>

        <p className="text-xs text-gray-500 mt-3">
          Estás en el plan{" "}
          <span className="font-medium text-gray-300">{PLAN_LABELS[currentPlan]}</span> ·
          Cancelás cuando quieras
        </p>
      </div>
    </div>
  )
}
