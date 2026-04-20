import { cn } from "@/lib/utils"

type Variant =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "free"
  | "starter"
  | "professional"
  | "business"
  | "enterprise"

const VARIANTS: Record<Variant, string> = {
  neutral: "bg-gray-800 text-gray-300 border border-gray-700",
  accent: "bg-accent-soft text-accent border border-accent/30",
  success: "bg-emerald-900/40 text-emerald-300 border border-emerald-700/50",
  warning: "bg-amber-900/40 text-amber-300 border border-amber-700/50",
  danger: "bg-red-900/40 text-red-300 border border-red-700/50",
  info: "bg-sky-900/40 text-sky-300 border border-sky-700/50",
  free: "bg-gray-700 text-gray-300",
  starter: "bg-blue-900/60 text-blue-300 border border-blue-700/50",
  professional: "bg-accent-soft text-accent border border-accent/40",
  business: "bg-amber-900/60 text-amber-300 border border-amber-700/50",
  enterprise: "bg-emerald-900/60 text-emerald-300 border border-emerald-700/50",
}

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: Variant
  dot?: boolean
}

export function Badge({ variant = "neutral", dot, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium",
        VARIANTS[variant],
        className
      )}
      {...props}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-soft" />}
      {children}
    </span>
  )
}
