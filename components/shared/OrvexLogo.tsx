// Orvex brand mark — renders the real logo PNG (transparent background) so
// every consumer (navbar, sidebar, footer, auth, mockup) gets the exact
// artwork the user uploaded instead of a hand-traced SVG approximation.
//
// `gradientId` is kept as a no-op prop for backwards compatibility with the
// previous inline-SVG version; existing callsites pass it harmlessly.

interface OrvexLogoProps {
  size?: number | string
  className?: string
  /** Ignored — kept for API compatibility with the old SVG implementation. */
  gradientId?: string
}

export function OrvexLogo({ size = 32, className }: OrvexLogoProps) {
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src="/orvex-symbol.png"
      alt="Orvex"
      width={typeof size === "number" ? size : undefined}
      height={typeof size === "number" ? size : undefined}
      style={{ width: size, height: size }}
      className={className}
      draggable={false}
    />
  )
}
