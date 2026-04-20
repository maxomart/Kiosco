/**
 * Theme utilities — color manipulation for tenant-customizable accent.
 * Pure functions, safe to import client- or server-side.
 */

export const DEFAULT_ACCENT = "#8b5cf6"

export type ThemeMode = "dark" | "light" | "auto"

export interface ThemePreset {
  name: string
  label: string
  hex: string
}

export const THEME_PRESETS: ThemePreset[] = [
  { name: "purple", label: "Violeta", hex: "#8b5cf6" },
  { name: "indigo", label: "Índigo", hex: "#6366f1" },
  { name: "blue", label: "Azul", hex: "#3b82f6" },
  { name: "sky", label: "Cielo", hex: "#0ea5e9" },
  { name: "emerald", label: "Esmeralda", hex: "#10b981" },
  { name: "amber", label: "Ámbar", hex: "#f59e0b" },
  { name: "rose", label: "Rosa", hex: "#f43f5e" },
  { name: "fuchsia", label: "Fucsia", hex: "#d946ef" },
  { name: "slate", label: "Pizarra", hex: "#64748b" },
]

export function isValidHex(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value)
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const v = hex.replace("#", "")
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")
  return `#${c(r)}${c(g)}${c(b)}`
}

/** Darken a hex color by a percentage (0-1). Used for hover state. */
export function darken(hex: string, amount = 0.1): string {
  const { r, g, b } = hexToRgb(hex)
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount))
}

/** RGBA string with alpha — used for soft backgrounds + ring colors. */
export function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Pick black or white text color for best contrast on a given background. */
export function readableTextOn(hex: string): "#000000" | "#ffffff" {
  const { r, g, b } = hexToRgb(hex)
  // perceived luminance
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.6 ? "#000000" : "#ffffff"
}

/** Apply an accent color to the document root by setting CSS custom props. */
export function applyAccent(hex: string): void {
  if (typeof document === "undefined") return
  const accent = isValidHex(hex) ? hex : DEFAULT_ACCENT
  const root = document.documentElement
  root.style.setProperty("--color-accent", accent)
  root.style.setProperty("--color-accent-hover", darken(accent, 0.1))
  root.style.setProperty("--color-accent-foreground", readableTextOn(accent))
  root.style.setProperty("--color-accent-soft", rgba(accent, 0.14))
  root.style.setProperty("--color-accent-ring", rgba(accent, 0.45))
}
