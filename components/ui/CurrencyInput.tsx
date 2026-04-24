"use client"

import { forwardRef, useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import {
  formatInputLive,
  parseARSNumber,
  countRelevantBefore,
  placeCaret,
} from "@/lib/number-format"

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  value: number | ""
  onValueChange: (n: number) => void
  currencySymbol?: string
  showSymbol?: boolean
}

/**
 * Numeric input with Argentine number formatting as you type.
 *   - "100000" → "100.000"
 *   - "1250,50" → "1.250,50"
 * Keeps cursor position intact while formatting (no jumping to start).
 */
export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  function CurrencyInput(
    {
      value,
      onValueChange,
      className,
      currencySymbol = "$",
      showSymbol = true,
      placeholder = "0",
      ...props
    },
    forwardedRef
  ) {
    const internalRef = useRef<HTMLInputElement | null>(null)
    const [display, setDisplay] = useState<string>(() =>
      value === "" || value === 0 ? "" : formatInputLive(String(value).replace(".", ","))
    )
    // Track whether input is focused to avoid reformatting mid-edit from prop changes
    const focusedRef = useRef(false)

    // Sync internal display when the numeric value changes from outside (and we're not focused)
    useEffect(() => {
      if (focusedRef.current) return
      if (value === "" || value === null || value === undefined) {
        setDisplay("")
        return
      }
      const numStr = String(value)
      // Use toLocaleString to format with AR separators
      const n = Number(value)
      if (isFinite(n)) {
        const hasDecimals = Math.abs(n % 1) > 1e-9
        setDisplay(
          hasDecimals
            ? n.toLocaleString("es-AR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : n.toLocaleString("es-AR")
        )
      }
    }, [value])

    const setRefs = useCallback(
      (node: HTMLInputElement | null) => {
        internalRef.current = node
        if (typeof forwardedRef === "function") forwardedRef(node)
        else if (forwardedRef) forwardedRef.current = node
      },
      [forwardedRef]
    )

    const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
      const input = e.target
      const rawTyped = input.value
      const caret = input.selectionStart ?? rawTyped.length

      // Count relevant chars (digits + comma) to the left of caret in the user-typed string
      const relevantBefore = countRelevantBefore(rawTyped, caret)

      const formatted = formatInputLive(rawTyped)
      setDisplay(formatted)

      // Update numeric value for parent
      const numeric = parseARSNumber(formatted)
      onValueChange(numeric)

      // Restore caret after re-render
      requestAnimationFrame(() => {
        const el = internalRef.current
        if (!el) return
        const newCaret = placeCaret(formatted, relevantBefore)
        try {
          el.setSelectionRange(newCaret, newCaret)
        } catch {
          // ignore
        }
      })
    }

    const handleFocus: React.FocusEventHandler<HTMLInputElement> = (e) => {
      focusedRef.current = true
      props.onFocus?.(e)
      // Select all on focus to make editing easier (optional — removed to respect click position)
    }
    const handleBlur: React.FocusEventHandler<HTMLInputElement> = (e) => {
      focusedRef.current = false
      // Reformat on blur
      const n = parseARSNumber(display)
      if (isFinite(n)) {
        onValueChange(n)
        const hasDecimals = Math.abs(n % 1) > 1e-9
        setDisplay(
          n === 0
            ? ""
            : hasDecimals
            ? n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : n.toLocaleString("es-AR")
        )
      }
      props.onBlur?.(e)
    }

    // Allow only numbers, dot, comma, navigation keys
    const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
      const allowed = [
        "Backspace", "Delete", "Tab", "Escape", "Enter", "Home", "End",
        "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
      ]
      if (allowed.includes(e.key)) return
      // Allow copy/paste
      if ((e.ctrlKey || e.metaKey) && ["a", "c", "v", "x", "z", "y"].includes(e.key.toLowerCase())) return
      // Block invalid characters
      if (!/[0-9.,]/.test(e.key)) {
        e.preventDefault()
      }
      props.onKeyDown?.(e)
    }

    return (
      <div className="relative">
        {showSymbol && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">
            {currencySymbol}
          </span>
        )}
        <input
          {...props}
          ref={setRefs}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={display}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            showSymbol ? "pl-7" : "pl-3",
            "pr-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm w-full tabular-nums text-right focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors",
            className
          )}
        />
      </div>
    )
  }
)
