"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

export type BillingPeriod = "monthly" | "annual"

interface BillingToggleProps {
  value: BillingPeriod
  onChange: (v: BillingPeriod) => void
  annualDiscount?: number // 0.2 = 20%
  className?: string
}

export function BillingToggle({
  value,
  onChange,
  annualDiscount = 0.2,
  className,
}: BillingToggleProps) {
  return (
    <div
      className={cn(
        "relative inline-flex items-center rounded-full bg-gray-900 border border-gray-800 p-1.5",
        className
      )}
    >
      <motion.div
        className="absolute top-1.5 bottom-1.5 rounded-full bg-accent"
        initial={false}
        animate={{
          left: value === "monthly" ? 6 : "calc(50% + 3px)",
          width: "calc(50% - 9px)",
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      />
      <button
        type="button"
        onClick={() => onChange("monthly")}
        className={cn(
          "relative z-10 px-4 py-1.5 text-xs font-semibold rounded-full transition-colors",
          value === "monthly" ? "text-accent-foreground" : "text-gray-400"
        )}
      >
        Mensual
      </button>
      <button
        type="button"
        onClick={() => onChange("annual")}
        className={cn(
          "relative z-10 px-4 py-1.5 text-xs font-semibold rounded-full transition-colors flex items-center gap-1.5",
          value === "annual" ? "text-accent-foreground" : "text-gray-400"
        )}
      >
        Anual
        {annualDiscount > 0 && (
          <span
            className={cn(
              "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
              value === "annual"
                ? "bg-white/20 text-white"
                : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
            )}
          >
            -{Math.round(annualDiscount * 100)}%
          </span>
        )}
      </button>
    </div>
  )
}
