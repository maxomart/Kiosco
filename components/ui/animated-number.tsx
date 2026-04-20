"use client"

import NumberFlow, { type Format } from "@number-flow/react"
import { cn } from "@/lib/utils"

type AnimatedNumberProps = {
  value: number
  prefix?: string
  suffix?: string
  format?: Format
  className?: string
}

export function AnimatedNumber({
  value,
  prefix,
  suffix,
  format,
  className,
}: AnimatedNumberProps) {
  return (
    <span className={cn("inline-flex items-baseline tabular-nums", className)}>
      {prefix}
      <NumberFlow value={value} format={format} />
      {suffix}
    </span>
  )
}
