"use client"

import { useEffect, useState } from "react"
import { X, Keyboard, Settings } from "lucide-react"
import Link from "next/link"
import { SHORTCUT_ACTIONS, getShortcutMap } from "@/lib/shortcuts"

export function ShortcutsHelpModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [map, setMap] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) setMap(getShortcutMap())
  }, [open])

  if (!open) return null

  // Group by section
  const byGroup: Record<string, typeof SHORTCUT_ACTIONS> = {}
  for (const a of SHORTCUT_ACTIONS) {
    if (!byGroup[a.group]) byGroup[a.group] = []
    byGroup[a.group].push(a)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-xl max-h-[85vh] shadow-2xl shadow-black/50 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-800 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent-soft flex items-center justify-center flex-shrink-0">
              <Keyboard className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="font-bold text-gray-100">Atajos de teclado</h2>
              <p className="text-sm text-gray-400 mt-0.5">
                Accedé a las funciones principales sin mouse
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {Object.entries(byGroup).map(([group, actions]) => (
            <div key={group}>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 mb-2">
                {group}
              </p>
              <div className="space-y-1.5">
                {actions.map((a) => {
                  const key = map[a.id] ?? a.defaultKey
                  return (
                    <div
                      key={a.id}
                      className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-gray-800/40 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-200">{a.label}</p>
                        <p className="text-xs text-gray-500">{a.description}</p>
                      </div>
                      <kbd className="flex-shrink-0 bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-xs font-mono text-gray-200 shadow-[inset_0_-1px_0_rgba(0,0,0,0.4)] min-w-[40px] text-center">
                        {key}
                      </kbd>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-800 flex items-center justify-between gap-3">
          <Link
            href="/configuracion/atajos"
            onClick={onClose}
            className="flex items-center gap-1.5 text-xs text-accent hover:underline"
          >
            <Settings className="w-3.5 h-3.5" />
            Personalizar atajos
          </Link>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
