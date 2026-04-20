"use client"

import { useId } from "react"

/**
 * Sparkline ultra-ligero en SVG puro (sin recharts) para stat cards.
 * Data = array de números. Dibuja un polyline + área suave.
 */
export function SparklineMini({
  data,
  width = 100,
  height = 32,
  strokeClass = "stroke-accent",
  fillOpacity = 0.18,
}: {
  data: number[]
  width?: number
  height?: number
  strokeClass?: string
  fillOpacity?: number
}) {
  const uid = useId().replace(/:/g, "")
  if (data.length === 0) return null

  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1

  const step = data.length > 1 ? width / (data.length - 1) : 0
  const pad = 2
  const usableH = height - pad * 2

  const points = data.map((v, i) => {
    const x = i * step
    const y = pad + usableH - ((v - min) / range) * usableH
    return { x, y }
  })

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ")

  const areaPath = `${linePath} L${width},${height} L0,${height} Z`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="overflow-visible"
    >
      <defs>
        <linearGradient id={`spark-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={fillOpacity} />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#spark-${uid})`} className={strokeClass} />
      <path
        d={linePath}
        fill="none"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={strokeClass}
      />
    </svg>
  )
}
