"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import {
  applySurface,
  DEFAULT_SURFACE,
  sanitizeSurface,
  SURFACE_PRESETS,
  type SurfaceTheme,
} from "@/lib/surface-theme"

interface SurfaceContextValue {
  surface: SurfaceTheme
  setSurface: (s: SurfaceTheme) => void
  patchSurface: (patch: Partial<SurfaceTheme>) => void
  applyPreset: (name: string) => void
  reset: () => void
}

const SurfaceContext = createContext<SurfaceContextValue | null>(null)

const STORAGE_KEY = "retailar:surface-theme"

export function SurfaceThemeProvider({
  children,
  initialSurface,
}: {
  children: React.ReactNode
  initialSurface?: Partial<SurfaceTheme> | null
}) {
  const seed = sanitizeSurface(initialSurface)
  const [surface, setSurfaceState] = useState<SurfaceTheme>(seed)

  // Apply CSS vars on every change
  useEffect(() => {
    applySurface(surface)
  }, [surface])

  // Hydrate from localStorage si no vino del server — ejecutar inmediatamente al montar
  useEffect(() => {
    if (initialSurface) return
    if (typeof window === "undefined") return
    try {
      const cached = localStorage.getItem(STORAGE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached)
        const safe = sanitizeSurface(parsed)
        setSurfaceState(safe)
        // Aplicar CSS vars de inmediato
        applySurface(safe)
      }
    } catch {
      // ignore malformed cache
    }
  }, [])

  const setSurface = useCallback((next: SurfaceTheme) => {
    const safe = sanitizeSurface(next)
    setSurfaceState(safe)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(safe))
    } catch {}
  }, [])

  const patchSurface = useCallback(
    (patch: Partial<SurfaceTheme>) => {
      setSurfaceState((prev) => {
        const safe = sanitizeSurface({ ...prev, ...patch })
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(safe))
        } catch {}
        return safe
      })
    },
    []
  )

  const applyPreset = useCallback(
    (name: string) => {
      const preset = SURFACE_PRESETS.find((p) => p.name === name)
      if (preset) setSurface(preset.surface)
    },
    [setSurface]
  )

  const reset = useCallback(() => {
    setSurface(DEFAULT_SURFACE)
  }, [setSurface])

  return (
    <SurfaceContext.Provider
      value={{ surface, setSurface, patchSurface, applyPreset, reset }}
    >
      {children}
    </SurfaceContext.Provider>
  )
}

export function useSurfaceTheme(): SurfaceContextValue {
  const ctx = useContext(SurfaceContext)
  if (!ctx) {
    return {
      surface: DEFAULT_SURFACE,
      setSurface: () => {},
      patchSurface: () => {},
      applyPreset: () => {},
      reset: () => {},
    }
  }
  return ctx
}
