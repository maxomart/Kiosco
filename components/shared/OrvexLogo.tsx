// Inline SVG version of the Orvex brand mark.
// Three-quarter ring (cyan → blue → violet gradient) with a diagonal violet
// stroke cutting through the bottom-right gap — same silhouette as the
// uploaded logos. Sizable and color-stable across light/dark surfaces.
import type { SVGProps } from "react"

interface OrvexLogoProps extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  size?: number | string
  /** Unique gradient id — needed when multiple logos render on the same page */
  gradientId?: string
}

export function OrvexLogo({
  size = 32,
  gradientId = "orvex-logo-gradient",
  className,
  ...rest
}: OrvexLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Orvex"
      role="img"
      {...rest}
    >
      <defs>
        <linearGradient id={gradientId} x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#22D3EE" />
          <stop offset="45%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      {/* Open ring: starts at top, sweeps clockwise ~270° leaving a gap on the bottom-right */}
      <path
        d="M 50 12 A 38 38 0 1 1 22 80"
        stroke={`url(#${gradientId})`}
        strokeWidth="14"
        strokeLinecap="round"
        fill="none"
      />
      {/* Diagonal stroke filling the gap — evokes the X in "Orvex" */}
      <path
        d="M 54 48 L 82 88"
        stroke={`url(#${gradientId})`}
        strokeWidth="14"
        strokeLinecap="round"
      />
    </svg>
  )
}
