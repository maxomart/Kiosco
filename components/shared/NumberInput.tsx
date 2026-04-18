"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

interface NumberInputProps {
  value: number
  onChange: (value: number) => void
  placeholder?: string
  className?: string
  min?: number
  max?: number
  step?: number
  prefix?: string
  suffix?: string
  autoFocus?: boolean
  disabled?: boolean
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  /**
   * Si es `true`, muestra el valor con separadores de miles al perder foco.
   * Default: true.
   */
  formatThousands?: boolean
  /**
   * Decimales permitidos. Default: 2.
   */
  decimals?: number
}

/**
 * Input numérico con:
 * - Muestra vacío cuando el valor es 0 (permite empezar a escribir sin borrar el cero)
 * - Formateo con separadores de miles al perder foco (ej: 1000 → 1.000)
 * - Parseo argentino (acepta coma o punto)
 * - Prefijo/sufijo opcional
 */
export default function NumberInput({
  value,
  onChange,
  placeholder = "",
  className,
  min = 0,
  step = 0.01,
  prefix,
  suffix,
  autoFocus,
  disabled,
  onKeyDown,
  formatThousands = true,
  decimals = 2,
  ...rest
}: NumberInputProps) {
  const [focused, setFocused] = useState(false)
  const [rawValue, setRawValue] = useState<string>(value === 0 ? "" : String(value))

  // Sincronizar desde props si cambian externamente
  useEffect(() => {
    if (!focused) {
      setRawValue(value === 0 ? "" : String(value))
    }
  }, [value, focused])

  const formatForDisplay = (v: number): string => {
    if (v === 0) return ""
    if (!formatThousands) return String(v)
    const fixed = Number.isInteger(v) ? String(v) : v.toFixed(decimals).replace(/\.?0+$/, "")
    // Formato argentino: 1.234,56
    const parts = fixed.split(".")
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".")
    return parts.join(",")
  }

  const parseInput = (str: string): number => {
    if (!str || str === "-") return 0
    // Quitar separadores de miles y convertir coma decimal a punto
    const cleaned = str.replace(/\./g, "").replace(",", ".")
    const n = parseFloat(cleaned)
    return isNaN(n) ? 0 : n
  }

  const handleFocus = () => {
    setFocused(true)
    // Al entrar, mostrar sin formato de miles (más fácil editar)
    setRawValue(value === 0 ? "" : String(value))
  }

  const handleBlur = () => {
    setFocused(false)
    const n = parseInput(rawValue)
    const clamped = min !== undefined ? Math.max(min, n) : n
    onChange(clamped)
    setRawValue(formatForDisplay(clamped))
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    // Permitir solo dígitos, coma, punto, signo
    if (/^-?[\d.,]*$/.test(v)) {
      setRawValue(v)
      onChange(parseInput(v))
    }
  }

  const displayValue = focused ? rawValue : formatForDisplay(value)

  return (
    <div className="relative w-full">
      {prefix && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
          {prefix}
        </span>
      )}
      <input
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        className={cn(
          "w-full py-2.5 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl focus:border-blue-500 outline-none transition text-sm",
          prefix ? "pl-7" : "pl-3",
          suffix ? "pr-7" : "pr-3",
          className
        )}
        {...rest}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  )
}
