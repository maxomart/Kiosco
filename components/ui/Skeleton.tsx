import { cn } from "@/lib/utils"

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  shape?: "rect" | "circle" | "text"
}

export function Skeleton({ shape = "rect", className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-shimmer",
        shape === "circle" && "rounded-full",
        shape === "rect" && "rounded-md",
        shape === "text" && "rounded h-3",
        className
      )}
      {...props}
    />
  )
}
