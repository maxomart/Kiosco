"use client"

import { useEffect, useState } from "react"
import { Keyboard, RotateCcw, Save, Lightbulb } from "lucide-react"
import toast from "react-hot-toast"
import Link from "next/link"
import {
  SHORTCUT_ACTIONS,
  getShortcutMap,
  saveShortcutMap,
  resetShortcutMap,
  eventToCombo,
} from "@/lib/shortcuts"

export default function AtajosPage() {
  const [map, setMap] = useState<Record<string, string>>({})
  const [capturing, setCapturing] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setMap(getShortcutMap())
  }, [])

  // While capturing, listen for the next keypress to record it
  useEffect(() => {
    if (!capturing) return
    const handler = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === "Escape") {
        setCapturing(null)
        return
      }
      if (e.key === "Tab") {
        // let user tab out if they want
        return
      }
      const combo = eventToCombo(e)
      setMap((prev) => ({ ...prev, [capturing]: combo }))
      setDirty(true)
      setCapturing(null)
    }
    window.addEventListener("keydown", handler, true)
    return () => window.removeEventListener("keydown", handler, true)
  }, [capturing])

  const save = () => {
    saveShortcutMap(map)
    window.dispatchEvent(new Event("shortcuts:updated"))
    setDirty(false)
    toast.success("Atajos guardados")
  }

  const reset = () => {
    resetShortcutMap()
    setMap(getShortcutMap())
    window.dispatchEvent(new Event("shortcuts:updated"))
    setDirty(false)
    toast.success("Atajos restaurados por defecto")
  }

  // Group by section
  const byGroup: Record<string, typeof SHORTCUT_ACTIONS> = {}
  for (const a of SHORTCUT_ACTIONS) {
    if (!byGroup[a.group]) byGroup[a.group] = []
    byGroup[a.group].push(a)
  }

  // Check for duplicate assignments
  const combos = Object.values(map)
  const dupes = new Set(combos.filter((c, i) => combos.indexOf(c) !== i))

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-6">
      {/* Breadcrumb / back */}
      <div className="text-xs text-gray-500">
        <Link href="/configuracion" className="hover:text-gray-300">Configuración</Link>
        <span className="mx-2">›</span>
        <span className="text-gray-300">Atajos de teclado</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-accent-soft flex items-center justify-center flex-shrink-0">
          <Keyboard className="w-6 h-6 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Atajos de teclado</h1>
          <p className="text-gray-400 text-sm mt-1">
            Personalizá las teclas que usás para las acciones más comunes.
          </p>
        </div>
      </div>

      {/* Helper tip */}
      <div className="bg-gradient-to-r from-accent-soft/40 to-accent-soft/10 border border-accent/30 rounded-lg p-3 flex items-start gap-3">
        <Lightbulb className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
        <p className="text-sm text-gray-300">
          Click en el atajo para grabarlo. Presioná la combinación que quieras usar.
          <br />
          <span className="text-xs text-gray-500">
            Tip: podés usar teclas simples (F2), combinaciones (Ctrl+S) o letras (D).
          </span>
        </p>
      </div>

      {dupes.size > 0 && (
        <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg p-3 text-sm text-amber-300">
          <strong>⚠ Atajos duplicados:</strong> tenés más de una acción con el mismo atajo. Elegí uno distinto o solo se disparará el primero.
        </div>
      )}

      {/* Groups */}
      {Object.entries(byGroup).map(([group, actions]) => (
        <div key={group} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="bg-gray-800/50 px-4 py-2.5 text-xs uppercase tracking-wider font-semibold text-gray-400">
            {group}
          </div>
          <div className="divide-y divide-gray-800">
            {actions.map((a) => {
              const current = map[a.id] ?? a.defaultKey
              const isCapturing = capturing === a.id
              const isDupe = dupes.has(current)
              return (
                <div key={a.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-100 font-medium">{a.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{a.description}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {current !== a.defaultKey && (
                      <button
                        onClick={() => {
                          setMap((prev) => ({ ...prev, [a.id]: a.defaultKey }))
                          setDirty(true)
                        }}
                        className="text-[10px] text-gray-500 hover:text-gray-300"
                        title="Restaurar atajo por defecto"
                      >
                        ↺
                      </button>
                    )}
                    <button
                      onClick={() => setCapturing(a.id)}
                      className={`min-w-[72px] px-3 py-1.5 rounded-md border font-mono text-sm transition-colors ${
                        isCapturing
                          ? "bg-accent-soft border-accent text-accent animate-pulse"
                          : isDupe
                          ? "bg-amber-900/30 border-amber-700/40 text-amber-300"
                          : "bg-gray-800 border-gray-700 text-gray-200 hover:border-accent/50"
                      }`}
                    >
                      {isCapturing ? "Presioná…" : current}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Footer actions */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-800">
        <button
          onClick={reset}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Restaurar todos
        </button>
        <button
          onClick={save}
          disabled={!dirty}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-50 text-accent-foreground text-sm font-medium"
        >
          <Save className="w-4 h-4" />
          Guardar cambios
        </button>
      </div>
    </div>
  )
}
