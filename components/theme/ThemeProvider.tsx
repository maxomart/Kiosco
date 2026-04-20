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
  /** Resolved current scheme — "light" or "dark" even when mode is "auto". */
  resolved: "light" | "dark"
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = "retailar:theme-accent"
const MODE_KEY = "retailar:theme-mode"

function resolveMode(mode: ThemeMode): "light" | "dark" {
  if (mode === "auto") {
    if (typeof window === "undefined") return "dark"
    return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark"
  }
  return mode
}

function applyScheme(resolved: "light" | "dark") {
  if (typeof document === "undefined") return
  const root = document.documentElement
  if (resolved === "light") root.setAttribute("data-theme", "light")
  else root.removeAttribute("data-theme")
  root.style.colorScheme = resolved
}

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
  const [resolved, setResolved] = useState<"light" | "dark">(
    initialMode === "light" ? "light" : "dark"
  )

  // Apply accent CSS vars
  useEffect(() => {
    applyAccent(accent)
  }, [accent])

  // Resolve + apply theme scheme (light / dark / auto)
  useEffect(() => {
    const apply = () => {
      const r = resolveMode(mode)
      setResolved(r)
      applyScheme(r)
    }
    apply()
    if (mode !== "auto") return
    const mq = window.matchMedia?.("(prefers-color-scheme: light)")
    if (!mq) return
    const handler = () => apply()
    try {
      mq.addEventListener("change", handler)
      return () => mq.removeEventListener("change", handler)
    } catch {
      // Safari < 14
      mq.addListener(handler)
      return () => mq.removeListener(handler)
    }
  }, [mode])

  // Hydrate accent + mode from localStorage when no SSR seed was given
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!initialAccent) {
      try {
        const cached = localStorage.getItem(STORAGE_KEY)
        if (cached && isValidHex(cached)) setAccentState(cached)
      } catch {}
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
    }
    try {
      const cachedMode = localStorage.getItem(MODE_KEY) as ThemeMode | null
      if (cachedMode === "light" || cachedMode === "dark" || cachedMode === "auto") {
        setModeState(cachedMode)
      }
    } catch {}
  }, [initialAccent])

  const setAccent = useCallback((hex: string) => {
    if (!isValidHex(hex)) return
    setAccentState(hex)
    try { localStorage.setItem(STORAGE_KEY, hex) } catch {}
  }, [])

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    try { localStorage.setItem(MODE_KEY, next) } catch {}
  }, [])

  return (
    <ThemeContext.Provider value={{ accent, setAccent, mode, setMode, resolved }}>
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
      resolved: "dark" as const,
    }
  }
  return ctx
}
