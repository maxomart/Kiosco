import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  iconColor?: string
  iconBg?: string
  change?: number       // percentage change vs previous period (positive = up, negative = down)
  changeLabel?: string  // e.g. "vs ayer"
  subtitle?: string     // extra detail line below value
  loading?: boolean
  className?: string
}

export default function StatCard({
  title,
  value,
  icon: Icon,
  iconColor = "text-purple-400",
  iconBg = "bg-purple-900/40",
  change,
  changeLabel = "vs período anterior",
  subtitle,
  loading = false,
  className,
}: StatCardProps) {
  const hasChange = change !== undefined && change !== null
  const isPositive = hasChange && change! > 0
  const isNegative = hasChange && change! < 0
  const isNeutral = hasChange && change === 0

  const changeColor = isPositive
    ? "text-emerald-400"
    : isNegative
    ? "text-red-400"
    : "text-gray-500"

  const TrendIcon = isPositive
    ? TrendingUp
    : isNegative
    ? TrendingDown
    : Minus

  if (loading) {
    return (
      <div
        className={cn(
          "bg-gray-900 border border-gray-800 rounded-xl p-5 animate-pulse",
          className
        )}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="w-10 h-10 bg-gray-800 rounded-lg" />
          <div className="w-16 h-4 bg-gray-800 rounded" />
        </div>
        <div className="w-24 h-7 bg-gray-800 rounded mb-2" />
        <div className="w-20 h-4 bg-gray-800 rounded" />
      </div>
    )
  }

  return (
    <div
      className={cn(
        "card-glow rounded-xl p-5 transition-colors",
        className
      )}
    >
      <div className="flex items-start justify-between mb-4">
        {/* Icon */}
        <div
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
            iconBg
          )}
        >
          <Icon className={cn("w-5 h-5", iconColor)} />
        </div>

        {/* Change badge */}
        {hasChange && (
          <div
            className={cn(
              "flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
              isPositive && "bg-emerald-950/60 text-emerald-400",
              isNegative && "bg-red-950/60 text-red-400",
              isNeutral && "bg-gray-800 text-gray-500"
            )}
          >
            <TrendIcon className="w-3 h-3" />
            <span>
              {isPositive ? "+" : ""}
              {change!.toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      {/* Value */}
      <div className="space-y-1">
        <p className="text-2xl font-bold text-gray-100 leading-none">{value}</p>
        <p className="text-sm font-medium text-gray-400">{title}</p>
        {subtitle && <p className="text-xs text-gray-600">{subtitle}</p>}
        {hasChange && (
          <p className={cn("text-xs", changeColor)}>
            {changeLabel}
          </p>
        )}
      </div>
    </div>
  )
}
