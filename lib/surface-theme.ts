/**
 * Surface theme — extiende el ThemeProvider existente (que ya maneja el accent
 * con persistencia por tenant) agregando control sobre los gradient stops del
 * fondo de la app y del sidebar. NO reemplaza nada del sistema de accent.
 */

export interface SurfaceTheme {
  appFrom: string
  appVia: string
  appTo: string
  sidebarFrom: string
  sidebarVia: string
  sidebarTo: string
  navFrom: string
  navTo: string
  cardBg: string
  cardBorder: string
  glowIntensity: number
}

export const DEFAULT_SURFACE: SurfaceTheme = {
  appFrom: "#050510",
  appVia: "#0a0a18",
  appTo: "#07071a",
  sidebarFrom: "#0b0b14",
  sidebarVia: "#0f0f1a",
  sidebarTo: "#070711",
  navFrom: "#111827",
  navTo: "#0b1220",
  cardBg: "#111827",
  cardBorder: "#1f2937",
  glowIntensity: 1,
}

export interface SurfacePreset {
  name: string
  label: string
  surface: SurfaceTheme
}

export const SURFACE_PRESETS: SurfacePreset[] = [
  {
    name: "default",
    label: "Original",
    surface: DEFAULT_SURFACE,
  },
  {
    name: "ocean",
    label: "Océano",
    surface: {
      appFrom: "#050a18",
      appVia: "#0a1530",
      appTo: "#05101f",
      sidebarFrom: "#0a1020",
      sidebarVia: "#0d1830",
      sidebarTo: "#06101d",
      navFrom: "#0a1530",
      navTo: "#05101f",
      cardBg: "#0d1830",
      cardBorder: "#1a2848",
      glowIntensity: 1,
    },
  },
  {
    name: "emerald",
    label: "Esmeralda",
    surface: {
      appFrom: "#041512",
      appVia: "#062220",
      appTo: "#041a17",
      sidebarFrom: "#081a17",
      sidebarVia: "#0b2521",
      sidebarTo: "#051612",
      navFrom: "#072320",
      navTo: "#041a17",
      cardBg: "#0b2521",
      cardBorder: "#143c34",
      glowIntensity: 1,
    },
  },
  {
    name: "sunset",
    label: "Atardecer",
    surface: {
      appFrom: "#180708",
      appVia: "#241213",
      appTo: "#1a0a0a",
      sidebarFrom: "#1c0a0b",
      sidebarVia: "#261314",
      sidebarTo: "#190708",
      navFrom: "#2a1414",
      navTo: "#1a0a0a",
      cardBg: "#261314",
      cardBorder: "#42201f",
      glowIntensity: 1,
    },
  },
  {
    name: "graphite",
    label: "Grafito",
    surface: {
      appFrom: "#0a0a0c",
      appVia: "#121215",
      appTo: "#08080a",
      sidebarFrom: "#0b0b0d",
      sidebarVia: "#131316",
      sidebarTo: "#07070a",
      navFrom: "#131316",
      navTo: "#08080a",
      cardBg: "#131316",
      cardBorder: "#23232a",
      glowIntensity: 0.5,
    },
  },
  {
    name: "flat",
    label: "Plano",
    surface: {
      appFrom: "#030712",
      appVia: "#030712",
      appTo: "#030712",
      sidebarFrom: "#0b1220",
      sidebarVia: "#0b1220",
      sidebarTo: "#0b1220",
      navFrom: "#0b1220",
      navTo: "#0b1220",
      cardBg: "#0b1220",
      cardBorder: "#1f2937",
      glowIntensity: 0,
    },
  },
]

export function isValidHex(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value)
}

export function applySurface(s: SurfaceTheme): void {
  if (typeof document === "undefined") return
  const root = document.documentElement
  root.style.setProperty("--surface-app-from", s.appFrom)
  root.style.setProperty("--surface-app-via", s.appVia)
  root.style.setProperty("--surface-app-to", s.appTo)
  root.style.setProperty("--surface-sidebar-from", s.sidebarFrom)
  root.style.setProperty("--surface-sidebar-via", s.sidebarVia)
  root.style.setProperty("--surface-sidebar-to", s.sidebarTo)
  root.style.setProperty("--surface-nav-from", s.navFrom)
  root.style.setProperty("--surface-nav-to", s.navTo)
  root.style.setProperty("--surface-card-bg", s.cardBg)
  root.style.setProperty("--surface-card-border", s.cardBorder)
  root.style.setProperty(
    "--surface-glow-intensity",
    String(Math.max(0, Math.min(2, s.glowIntensity)))
  )
}

export function sanitizeSurface(
  raw: Partial<SurfaceTheme> | null | undefined
): SurfaceTheme {
  if (!raw) return DEFAULT_SURFACE
  return {
    appFrom: isValidHex(raw.appFrom ?? "") ? raw.appFrom! : DEFAULT_SURFACE.appFrom,
    appVia: isValidHex(raw.appVia ?? "") ? raw.appVia! : DEFAULT_SURFACE.appVia,
    appTo: isValidHex(raw.appTo ?? "") ? raw.appTo! : DEFAULT_SURFACE.appTo,
    sidebarFrom: isValidHex(raw.sidebarFrom ?? "")
      ? raw.sidebarFrom!
      : DEFAULT_SURFACE.sidebarFrom,
    sidebarVia: isValidHex(raw.sidebarVia ?? "")
      ? raw.sidebarVia!
      : DEFAULT_SURFACE.sidebarVia,
    sidebarTo: isValidHex(raw.sidebarTo ?? "")
      ? raw.sidebarTo!
      : DEFAULT_SURFACE.sidebarTo,
    navFrom: isValidHex(raw.navFrom ?? "") ? raw.navFrom! : DEFAULT_SURFACE.navFrom,
    navTo: isValidHex(raw.navTo ?? "") ? raw.navTo! : DEFAULT_SURFACE.navTo,
    cardBg: isValidHex(raw.cardBg ?? "") ? raw.cardBg! : DEFAULT_SURFACE.cardBg,
    cardBorder: isValidHex(raw.cardBorder ?? "")
      ? raw.cardBorder!
      : DEFAULT_SURFACE.cardBorder,
    glowIntensity:
      typeof raw.glowIntensity === "number" &&
      raw.glowIntensity >= 0 &&
      raw.glowIntensity <= 2
        ? raw.glowIntensity
        : DEFAULT_SURFACE.glowIntensity,
  }
}
