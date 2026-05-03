"use client"

/**
 * MiniBars — gráfico de barras verticales chiquito para los KPI cards.
 *
 * Por qué barras (en vez de la sparkline antigua):
 *  - A pantalla chica las barras se leen mejor que una línea con dot.
 *  - No hay un único "punto destacado" raro al final, todas las barras
 *    son del mismo peso visual.
 *  - La barra más alta queda resaltada (color sólido, las otras semi-trans).
 *  - Cero animación rara, cero gradient, cero glow — minimalismo.
 *
 * Sigue siendo SVG puro y sin estado.
 */
export function MiniBars({
  data,
  width = 80,
  height = 32,
  fillClass = "fill-accent",
}: {
  data: number[]
  width?: number
  height?: number
  fillClass?: string
}) {
  if (!data || data.length === 0) return null

  const max = Math.max(...data, 1)
  const gap = 2
  const barCount = data.length
  const barWidth = (width - gap * (barCount - 1)) / barCount

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      aria-hidden
    >
      {data.map((v, i) => {
        const safeV = Math.max(0, v)
        const h = max > 0 ? Math.max(2, (safeV / max) * height) : 2
        const x = i * (barWidth + gap)
        const y = height - h
        // La barra más alta queda con opacidad llena, el resto medio-trans
        const isMax = safeV === max && max > 0
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barWidth}
            height={h}
            rx={1.5}
            className={fillClass}
            opacity={isMax ? 0.95 : 0.4}
          />
        )
      })}
    </svg>
  )
}
