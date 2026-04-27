"use client"

import { useId } from "react"

/**
 * Sparkline mini en SVG puro (sin recharts).
 *
 * Por qué se ve mejor que la versión vieja:
 *  1. Curva suave (Catmull-Rom → cubic Bezier) en vez de polyline con
 *     picos angulosos. Una serie con dos puntos altos seguidos de uno
 *     bajo dejaba un "diente de sierra"; ahora fluye.
 *  2. Stroke más gordo (2px) y con `stroke-linejoin: round` para que
 *     no haya esquinas duras.
 *  3. Área debajo con gradient vertical más alto (32% → 0%) y un
 *     glow sutil sobre la línea que da profundidad.
 *  4. El último punto resalta con un dot pequeño + halo, para que se
 *     entienda dónde "estás" hoy en la serie.
 *  5. Anima al montar: el path se dibuja con stroke-dashoffset.
 *
 * Sigue siendo "ultra ligero": sin librería de charts, sin estado, sin
 * useEffect. SSR-safe.
 */
export function SparklineMini({
  data,
  width = 100,
  height = 32,
  strokeClass = "stroke-accent",
  fillOpacity = 0.32,
}: {
  data: number[]
  width?: number
  height?: number
  strokeClass?: string
  fillOpacity?: number
}) {
  const uid = useId().replace(/:/g, "")
  if (data.length === 0) return null

  // Pad the value range a bit on the top so the line never touches the
  // edge of the box, and on the bottom so a flat series doesn't sit on
  // the baseline. Range of 0 (all-equal points) becomes 1 to avoid /0.
  const rawMax = Math.max(...data)
  const rawMin = Math.min(...data)
  const range = rawMax - rawMin || 1
  const max = rawMax + range * 0.08
  const min = rawMin - range * 0.04
  const span = max - min || 1

  const step = data.length > 1 ? width / (data.length - 1) : 0
  const padY = 3
  const usableH = height - padY * 2

  const points = data.map((v, i) => {
    const x = i * step
    const y = padY + usableH - ((v - min) / span) * usableH
    return { x, y }
  })

  const linePath = catmullRomToBezier(points)
  const areaPath = `${linePath} L${width},${height} L0,${height} L0,${points[0].y.toFixed(1)} Z`

  // Approximate path length so the draw-in animation timing doesn't
  // depend on actual SVG measurement (which would need a ref + effect).
  let approxLen = 0
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x
    const dy = points[i].y - points[i - 1].y
    approxLen += Math.sqrt(dx * dx + dy * dy)
  }

  const lastX = points[points.length - 1].x
  const lastY = points[points.length - 1].y

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="overflow-visible"
    >
      <defs>
        <linearGradient id={`spark-fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={fillOpacity} />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
        <filter id={`spark-glow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
      </defs>

      {/* Filled area underneath */}
      <path d={areaPath} fill={`url(#spark-fill-${uid})`} className={strokeClass} />

      {/* Glow copy of the line */}
      <path
        d={linePath}
        fill="none"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={strokeClass}
        opacity={0.35}
        filter={`url(#spark-glow-${uid})`}
      />

      {/* Crisp line on top */}
      <path
        d={linePath}
        fill="none"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={strokeClass}
        style={{
          strokeDasharray: approxLen,
          strokeDashoffset: approxLen,
          animation: `sparkline-draw-${uid} 800ms ease-out forwards`,
        }}
      />

      {/* End-point dot — marks "today" / latest value */}
      <circle
        cx={lastX}
        cy={lastY}
        r={2.2}
        className={strokeClass}
        fill="currentColor"
        style={{ animation: `sparkline-dot-${uid} 600ms ease-out 700ms backwards` }}
      />
      <circle
        cx={lastX}
        cy={lastY}
        r={4}
        fill="none"
        strokeWidth={1}
        className={strokeClass}
        opacity={0.4}
        style={{ animation: `sparkline-dot-${uid} 600ms ease-out 700ms backwards` }}
      />

      {/* Inline keyframes — uid-suffixed so they don't collide between cards */}
      <style>{`
        @keyframes sparkline-draw-${uid} {
          to { stroke-dashoffset: 0; }
        }
        @keyframes sparkline-dot-${uid} {
          from { opacity: 0; transform: scale(0.4); transform-origin: center; }
          to { opacity: 1; transform: scale(1); transform-origin: center; }
        }
      `}</style>
    </svg>
  )
}

/**
 * Catmull-Rom spline → cubic Bezier path string. Passes through every
 * point. Tension is fixed at the canonical 0.5 — anything higher gets
 * twitchy, lower gets too wavy.
 */
function catmullRomToBezier(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return ""
  if (pts.length === 2) {
    return `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)} L${pts[1].x.toFixed(1)},${pts[1].y.toFixed(1)}`
  }
  const tension = 0.5
  const out: string[] = []
  out.push(`M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`)
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const cp1x = p1.x + ((p2.x - p0.x) * tension) / 6
    const cp1y = p1.y + ((p2.y - p0.y) * tension) / 6
    const cp2x = p2.x - ((p3.x - p1.x) * tension) / 6
    const cp2y = p2.y - ((p3.y - p1.y) * tension) / 6
    out.push(
      `C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`,
    )
  }
  return out.join(" ")
}
