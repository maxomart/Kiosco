"use client"

import { useState, useRef, useEffect } from "react"
import { HelpCircle } from "lucide-react"

interface HelpTipProps {
  /** Short explanation — 1-2 sentences max. */
  text: string
  /** Optional example or tip after the main text. */
  example?: string
  /** Size of the icon. */
  size?: "sm" | "md"
  /** Tooltip placement relative to the icon. */
  placement?: "top" | "right" | "bottom" | "left"
  className?: string
}

/**
 * Small "?" icon that reveals a contextual explanation on hover/tap.
 * Use next to fields or buttons whose meaning isn't obvious.
 *
 * Example:
 *   <label>Margen {HelpTip...text="Tu ganancia..." /}</label>
 */
export function HelpTip({
  text,
  example,
  size = "sm",
  placement = "top",
  className = "",
}: HelpTipProps) {
  const [visible, setVisible] = useState(false)
  const wrapperRef = useRef<HTMLSpanElement | null>(null)

  // Close on click outside (for mobile taps)
  useEffect(() => {
    if (!visible) return
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setVisible(false)
      }
    }
    document.addEventListener("click", handler)
    return () => document.removeEventListener("click", handler)
  }, [visible])

  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"

  const placementClasses: Record<string, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
  }

  return (
    <span
      ref={wrapperRef}
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setVisible((v) => !v)
        }}
        className="text-gray-500 hover:text-accent transition-colors inline-flex"
        aria-label="Ayuda"
      >
        <HelpCircle className={iconSize} />
      </button>

      {visible && (
        <span
          className={`absolute z-50 w-64 bg-gray-950 border border-gray-700 rounded-lg p-3 shadow-xl shadow-black/50 text-left pointer-events-auto ${placementClasses[placement]}`}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="block text-xs text-gray-200 leading-relaxed">{text}</span>
          {example && (
            <span className="block mt-2 pt-2 border-t border-gray-800 text-[11px] text-accent">
              💡 {example}
            </span>
          )}
          <span
            className={`absolute w-2 h-2 bg-gray-950 border-gray-700 transform rotate-45 ${
              placement === "top"
                ? "border-r border-b left-1/2 -translate-x-1/2 -bottom-1"
                : placement === "bottom"
                ? "border-l border-t left-1/2 -translate-x-1/2 -top-1"
                : placement === "right"
                ? "border-l border-b top-1/2 -translate-y-1/2 -left-1"
                : "border-r border-t top-1/2 -translate-y-1/2 -right-1"
            }`}
          />
        </span>
      )}
    </span>
  )
}
