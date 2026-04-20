"use client"

import NumberFlow from "@number-flow/react"
import { motion } from "framer-motion"
import { Check } from "lucide-react"
import * as React from "react"
import { cn } from "@/lib/utils"

type Plan = {
  name: string
  monthlyPrice: number
  annualPrice: number
  description?: string
  highlight?: boolean
  badge?: string
  features?: string[]
}

type PricingInteractionProps = {
  plans: Plan[]
  currency?: string
  periodLabels?: { monthly: string; annual: string }
  annualHint?: string
  onSelect?: (plan: Plan, period: "monthly" | "annual") => void
  defaultPlan?: number
  ctaLabel?: string
}

export function PricingInteraction({
  plans,
  currency = "$",
  periodLabels = { monthly: "Mensual", annual: "Anual" },
  annualHint,
  onSelect,
  defaultPlan = 0,
  ctaLabel = "Empezar",
}: PricingInteractionProps) {
  const [active, setActive] = React.useState(defaultPlan)
  const [period, setPeriod] = React.useState<0 | 1>(0)

  const currentPrice = (p: Plan) =>
    period === 0 ? p.monthlyPrice : p.annualPrice

  const rowHeight = 92 // px + gap

  return (
    <div className="card-glow rounded-[28px] p-4 w-full max-w-md flex flex-col items-center gap-4">
      {/* Toggle periodo */}
      <div className="relative w-full rounded-full bg-white/5 border border-white/5 p-1.5 flex items-center">
        <button
          type="button"
          onClick={() => setPeriod(0)}
          className="relative z-20 font-semibold rounded-full w-full py-2 text-sm text-white/90"
        >
          {periodLabels.monthly}
        </button>
        <button
          type="button"
          onClick={() => setPeriod(1)}
          className="relative z-20 font-semibold rounded-full w-full py-2 text-sm text-white/90 flex items-center justify-center gap-1.5"
        >
          {periodLabels.annual}
          {annualHint && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {annualHint}
            </span>
          )}
        </button>
        <motion.div
          className="absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] z-10 rounded-full brand-glow"
          style={{
            background: "linear-gradient(135deg, rgba(139,92,246,0.25), rgba(99,102,241,0.25))",
            border: "1px solid rgba(139,92,246,0.4)",
          }}
          animate={{ left: period === 0 ? 6 : "calc(50% + 0px)" }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
        />
      </div>

      {/* Cards */}
      <div className="relative w-full flex flex-col gap-3">
        {plans.map((plan, index) => {
          const selected = active === index
          return (
            <button
              key={plan.name}
              type="button"
              onClick={() => setActive(index)}
              className={cn(
                "w-full text-left flex items-start justify-between gap-4 p-4 rounded-2xl border transition-colors",
                selected
                  ? "border-transparent bg-white/[0.03]"
                  : "border-white/10 hover:border-white/20 bg-white/[0.01]"
              )}
            >
              <div className="flex flex-col items-start gap-1 flex-1 min-w-0">
                <p className="font-semibold text-lg text-white flex items-center gap-2 flex-wrap">
                  {plan.name}
                  {plan.badge && (
                    <span className="py-0.5 px-2 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[11px] font-semibold uppercase tracking-wide">
                      {plan.badge}
                    </span>
                  )}
                </p>
                {plan.description && (
                  <p className="text-xs text-white/50">{plan.description}</p>
                )}
                <div className="text-white/80 text-sm mt-1 flex items-baseline">
                  <span className="font-bold text-white text-xl">
                    {currency}
                    <NumberFlow value={currentPrice(plan)} />
                  </span>
                  <span className="text-white/50 ml-1">/mes</span>
                </div>
                {plan.features && plan.features.length > 0 && (
                  <ul className="mt-2 space-y-1 w-full">
                    {plan.features.slice(0, 3).map((f, i) => (
                      <li
                        key={i}
                        className="text-xs text-white/60 flex items-center gap-1.5"
                      >
                        <Check size={12} className="text-emerald-400 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div
                className={cn(
                  "size-6 rounded-full mt-1 p-1 flex items-center justify-center border-2 transition-colors flex-shrink-0",
                  selected ? "border-purple-400" : "border-white/20"
                )}
              >
                <motion.div
                  className="size-3 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500"
                  animate={{ opacity: selected ? 1 : 0, scale: selected ? 1 : 0.3 }}
                  transition={{ duration: 0.2 }}
                />
              </div>
            </button>
          )
        })}

        {/* Marco animado */}
        <motion.div
          className="absolute left-0 right-0 pointer-events-none rounded-2xl border-2 border-purple-400/60 brand-glow"
          style={{ height: rowHeight + "px" }}
          animate={{ y: active * (rowHeight + 12) }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      </div>

      <button
        type="button"
        onClick={() => onSelect?.(plans[active], period === 0 ? "monthly" : "annual")}
        className="w-full rounded-full py-3 text-base font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-[0.98] transition brand-glow"
      >
        {ctaLabel} · {plans[active].name}
      </button>
    </div>
  )
}
