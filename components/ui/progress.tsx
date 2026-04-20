"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { cn } from "@/lib/utils"

type ProgressProps = React.ComponentProps<typeof ProgressPrimitive.Root> & {
  tone?: "brand" | "success" | "warning" | "danger"
}

const TONE_CLASSES: Record<NonNullable<ProgressProps["tone"]>, string> = {
  brand: "bg-gradient-to-r from-purple-500 to-indigo-500",
  success: "bg-gradient-to-r from-emerald-500 to-teal-500",
  warning: "bg-gradient-to-r from-amber-500 to-orange-500",
  danger: "bg-gradient-to-r from-rose-500 to-red-500",
}

function Progress({ className, value, tone = "brand", ...props }: ProgressProps) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-white/5 border border-white/5",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn("h-full w-full rounded-full transition-transform duration-500 ease-out", TONE_CLASSES[tone])}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
