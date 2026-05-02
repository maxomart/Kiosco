"use client"

import { useEffect, useRef } from "react"
import JsBarcode from "jsbarcode"

interface Props {
  value: string
  height?: number
  width?: number          // Ancho de cada barra en px
  fontSize?: number
  displayValue?: boolean
  format?: string
  className?: string
}

/** Renderiza un código de barras en SVG. Si el value está vacío, no renderiza nada. */
export function Barcode({
  value,
  height = 38,
  width = 1.4,
  fontSize = 11,
  displayValue = true,
  format,
  className,
}: Props) {
  const ref = useRef<SVGSVGElement | null>(null)

  useEffect(() => {
    if (!ref.current || !value) return
    try {
      // Detección automática: 13 dígitos = EAN13, 12 = UPC, 8 = EAN8, sino Code128
      const fmt =
        format ??
        (/^\d{13}$/.test(value)
          ? "EAN13"
          : /^\d{12}$/.test(value)
          ? "UPC"
          : /^\d{8}$/.test(value)
          ? "EAN8"
          : "CODE128")
      JsBarcode(ref.current, value, {
        format: fmt,
        height,
        width,
        fontSize,
        displayValue,
        margin: 4,
        background: "transparent",
        lineColor: "#000",
      })
    } catch {
      // valor inválido para el formato — no renderiza
    }
  }, [value, height, width, fontSize, displayValue, format])

  if (!value) return null
  return <svg ref={ref} className={className} />
}
