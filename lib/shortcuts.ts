/**
 * Keyboard shortcut system for the POS.
 * - Actions have stable IDs (e.g. "pos:charge")
 * - Each action is mapped to a key combo string ("F2", "Ctrl+K", etc.)
 * - User can customize mappings; we persist in localStorage.
 */

export interface ShortcutAction {
  id: string
  label: string
  description: string
  defaultKey: string
  /** Categoría para agrupar en la UI de configuración */
  group: string
  /** Si true, se dispara incluso cuando un input está en foco. */
  captureInInput?: boolean
}

// Master list of all registered shortcuts in the app
export const SHORTCUT_ACTIONS: ShortcutAction[] = [
  // POS
  {
    id: "pos:search",
    label: "Buscar producto",
    description: "Poner el cursor en el buscador del POS",
    defaultKey: "F2",
    group: "POS",
    captureInInput: true,
  },
  {
    id: "pos:scan",
    label: "Escanear código",
    description: "Abre el escáner de código de barras",
    defaultKey: "F3",
    group: "POS",
    captureInInput: true,
  },
  {
    id: "pos:charge",
    label: "Cobrar",
    description: "Cobrar y cerrar la venta actual",
    defaultKey: "F5",
    group: "POS",
    captureInInput: true,
  },
  {
    id: "pos:clear",
    label: "Vaciar carrito",
    description: "Borrar todos los items del carrito actual",
    defaultKey: "F4",
    group: "POS",
    captureInInput: true,
  },
  {
    id: "pos:discount",
    label: "Aplicar descuento",
    description: "Abre el input de descuento",
    defaultKey: "D",
    group: "POS",
  },
  {
    id: "pos:client",
    label: "Asignar cliente",
    description: "Abre el selector de cliente",
    defaultKey: "C",
    group: "POS",
  },
  {
    id: "pos:focusFirst",
    label: "Seleccionar primer producto",
    description: "Agregar al carrito el primer producto visible",
    defaultKey: "F1",
    group: "POS",
    captureInInput: true,
  },
  {
    id: "pos:chargeCash",
    label: "Cobrar en efectivo directo",
    description: "Cobra rápido asumiendo efectivo (sin modal)",
    defaultKey: "F6",
    group: "POS",
    captureInInput: true,
  },

  // Global
  {
    id: "global:help",
    label: "Mostrar ayuda de atajos",
    description: "Abre el panel con todos los atajos disponibles",
    defaultKey: "?",
    group: "Global",
  },
  {
    id: "global:escape",
    label: "Cerrar modales",
    description: "Cierra el modal/popup activo",
    defaultKey: "Escape",
    group: "Global",
    captureInInput: true,
  },
]

const STORAGE_KEY = "app:shortcuts:v1"

/** Returns the user's current mapping, with defaults for unset actions. */
export function getShortcutMap(): Record<string, string> {
  const defaults: Record<string, string> = {}
  for (const a of SHORTCUT_ACTIONS) defaults[a.id] = a.defaultKey
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaults
    const custom = JSON.parse(raw) as Record<string, string>
    return { ...defaults, ...custom }
  } catch {
    return defaults
  }
}

export function saveShortcutMap(map: Record<string, string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

export function resetShortcutMap() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

/**
 * Normalize an event into a string like "Ctrl+F" or "F2" or "?".
 * Single-key presses use e.key; if modifiers are present we join them.
 */
export function eventToCombo(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push("Ctrl")
  if (e.altKey) parts.push("Alt")
  if (e.shiftKey && e.key.length > 1) parts.push("Shift") // shift only matters for special keys
  // The main key
  let main = e.key
  // Normalize: function keys, special keys
  if (/^[a-z]$/.test(main)) main = main.toUpperCase()
  if (main === " ") main = "Space"
  parts.push(main)
  return parts.join("+")
}

export function describeCombo(combo: string): string {
  // Human-friendly rendering
  return combo.replace(/Ctrl/g, "Ctrl").replace(/Alt/g, "Alt").replace(/Shift/g, "⇧")
}

/** True if the event was fired while an editable element was focused. */
export function isEditableFocused(): boolean {
  const el = document.activeElement as HTMLElement | null
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  if (tag === "input" || tag === "textarea" || tag === "select") return true
  if (el.isContentEditable) return true
  return false
}
