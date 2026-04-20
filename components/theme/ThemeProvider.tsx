"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import {
  applyAccent,
  DEFAULT_ACCENT,
  isValidHex,
  type ThemeMode,
} from "@/lib/theme"

interface ThemeContextValue {
  accent: string
  setAccent: (hex: string) => void
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = "retailar:theme-accent"

export function ThemeProvider({
  children,
  initialAccent,
  initialMode = "dark",
}: {
  children: React.ReactNode
  initialAccent?: string | null
  initialMode?: ThemeMode
}) {
  const seed = initialAccent && isValidHex(initialAccent) ? initialAccent : DEFAULT_ACCENT
  const [accent, setAccentState] = useState<string>(seed)
  const [mode, setModeState] = useState<ThemeMode>(initialMode)

  // Apply CSS vars on first render and on every change
  useEffect(() => {
    applyAccent(accent)
  }, [accent])

  // If no SSR initial value provided, hydrate from localStorage / API
  useEffect(() => {
    if (initialAccent) return
    if (typeof window === "undefined") return
    try {
      const cached = localStorage.getItem(STORAGE_KEY)
      if (cached && isValidHex(cached)) {
        setAccentState(cached)
        return
      }
    } catch {}
    // Fall back to fetching from API
    fetch("/api/configuracion")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const hex = data?.config?.themeColor
        if (hex && isValidHex(hex)) {
          setAccentState(hex)
          try { localStorage.setItem(STORAGE_KEY, hex) } catch {}
        }
      })
      .catch(() => {})
  }, [initialAccent])

  const setAccent = useCallback((hex: string) => {
    if (!isValidHex(hex)) return
    setAccentState(hex)
    try { localStorage.setItem(STORAGE_KEY, hex) } catch {}
  }, [])

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    // light mode wiring is a TODO — for now we always render dark.
  }, [])

  return (
    <ThemeContext.Provider value={{ accent, setAccent, mode, setMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    // Safe fallback so non-wrapped trees don't crash.
    return {
      accent: DEFAULT_ACCENT,
      setAccent: () => {},
      mode: "dark",
      setMode: () => {},
    }
  }
  return ctx
}
