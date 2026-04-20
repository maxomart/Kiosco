"use client"

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react"

export type BrandTheme = {
  appFrom: string
  appVia: string
  appTo: string
  sidebarFrom: string
  sidebarVia: string
  sidebarTo: string
  glowPrimary: string
  glowSecondary: string
}

const DEFAULT_THEME: BrandTheme = {
  appFrom: "#050510",
  appVia: "#0a0a18",
  appTo: "#07071a",
  sidebarFrom: "#0b0b14",
  sidebarVia: "#0f0f1a",
  sidebarTo: "#070711",
  glowPrimary: "139 92 246",
  glowSecondary: "99 102 241",
}

export const THEME_PRESETS: Record<string, { name: string; theme: BrandTheme }> = {
  purple: {
    name: "Violeta",
    theme: DEFAULT_THEME,
  },
  ocean: {
    name: "Océano",
    theme: {
      appFrom: "#050a18",
      appVia: "#0a1530",
      appTo: "#05101f",
      sidebarFrom: "#0a1020",
      sidebarVia: "#0d1830",
      sidebarTo: "#06101d",
      glowPrimary: "59 130 246",
      glowSecondary: "14 165 233",
    },
  },
  emerald: {
    name: "Esmeralda",
    theme: {
      appFrom: "#041512",
      appVia: "#062220",
      appTo: "#041a17",
      sidebarFrom: "#081a17",
      sidebarVia: "#0b2521",
      sidebarTo: "#051612",
      glowPrimary: "16 185 129",
      glowSecondary: "20 184 166",
    },
  },
  sunset: {
    name: "Atardecer",
    theme: {
      appFrom: "#180708",
      appVia: "#241213",
      appTo: "#1a0a0a",
      sidebarFrom: "#1c0a0b",
      sidebarVia: "#261314",
      sidebarTo: "#190708",
      glowPrimary: "249 115 22",
      glowSecondary: "236 72 153",
    },
  },
  graphite: {
    name: "Grafito",
    theme: {
      appFrom: "#0a0a0c",
      appVia: "#121215",
      appTo: "#08080a",
      sidebarFrom: "#0b0b0d",
      sidebarVia: "#131316",
      sidebarTo: "#07070a",
      glowPrimary: "148 163 184",
      glowSecondary: "100 116 139",
    },
  },
}

type ThemeContextValue = {
  theme: BrandTheme
  setTheme: (t: BrandTheme) => void
  setPreset: (key: string) => void
  reset: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = "retailar-brand-theme"

function applyTheme(t: BrandTheme) {
  if (typeof document === "undefined") return
  const root = document.documentElement
  root.style.setProperty("--app-bg-from", t.appFrom)
  root.style.setProperty("--app-bg-via", t.appVia)
  root.style.setProperty("--app-bg-to", t.appTo)
  root.style.setProperty("--sidebar-from", t.sidebarFrom)
  root.style.setProperty("--sidebar-via", t.sidebarVia)
  root.style.setProperty("--sidebar-to", t.sidebarTo)
  root.style.setProperty("--glow-primary", t.glowPrimary)
  root.style.setProperty("--glow-secondary", t.glowSecondary)
}

export function BrandThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<BrandTheme>(DEFAULT_THEME)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as BrandTheme
        setThemeState(parsed)
        applyTheme(parsed)
        return
      }
    } catch {}
    applyTheme(DEFAULT_THEME)
  }, [])

  const setTheme = useCallback((t: BrandTheme) => {
    setThemeState(t)
    applyTheme(t)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(t))
    } catch {}
  }, [])

  const setPreset = useCallback((key: string) => {
    const preset = THEME_PRESETS[key]
    if (preset) setTheme(preset.theme)
  }, [setTheme])

  const reset = useCallback(() => {
    setTheme(DEFAULT_THEME)
  }, [setTheme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, setPreset, reset }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useBrandTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useBrandTheme must be used within BrandThemeProvider")
  return ctx
}
