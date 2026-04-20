"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Check, Palette, RotateCcw, X } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  SURFACE_PRESETS,
  isValidHex,
  type SurfaceTheme,
} from "@/lib/surface-theme"
import { useSurfaceTheme } from "./SurfaceThemeProvider"

/**
 * Panel flotante que permite a cada usuario personalizar las surfaces
 * (fondo de la app + sidebar + intensidad del glow). Los valores se
 * guardan en localStorage — no tocan el accent color del tenant.
 */
export function SurfaceCustomizer() {
  const { surface, patchSurface, applyPreset, reset } = useSurfaceTheme()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-5 right-5 z-40 w-11 h-11 rounded-full flex items-center justify-center",
          "bg-accent text-accent-foreground shadow-lg hover:scale-105 transition-transform",
          "ring-1 ring-white/10 no-print"
        )}
        title="Personalizar fondo"
        aria-label="Personalizar fondo"
      >
        <Palette size={18} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm no-print"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              className="fixed right-0 top-0 bottom-0 w-full sm:w-[380px] z-50 bg-gray-950 border-l border-gray-800 overflow-y-auto no-print"
              initial={{ x: 420 }}
              animate={{ x: 0 }}
              exit={{ x: 420 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <div className="sticky top-0 bg-gray-950/90 backdrop-blur border-b border-gray-800 px-5 py-4 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-white flex items-center gap-2 text-sm">
                    <Palette size={16} className="text-accent" />
                    Personalizar fondo
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Tu navegador recuerda estos cambios
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800"
                  aria-label="Cerrar"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 space-y-6">
                {/* Presets */}
                <section>
                  <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Presets
                  </h3>
                  <div className="grid grid-cols-2 gap-2.5">
                    {SURFACE_PRESETS.map((preset) => {
                      const isActive =
                        surface.appFrom === preset.surface.appFrom &&
                        surface.sidebarFrom === preset.surface.sidebarFrom &&
                        surface.glowIntensity === preset.surface.glowIntensity
                      return (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => applyPreset(preset.name)}
                          className={cn(
                            "rounded-xl p-3 text-left border transition-all",
                            isActive
                              ? "border-accent bg-gray-900"
                              : "border-gray-800 hover:border-gray-700 bg-gray-900/50"
                          )}
                        >
                          <div
                            className="h-12 rounded-lg mb-2 relative overflow-hidden"
                            style={{
                              background: `linear-gradient(135deg, ${preset.surface.appFrom}, ${preset.surface.appVia}, ${preset.surface.appTo})`,
                            }}
                          >
                            <div
                              className="absolute inset-y-0 left-0 w-2"
                              style={{
                                background: `linear-gradient(180deg, ${preset.surface.sidebarFrom}, ${preset.surface.sidebarTo})`,
                              }}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-200">{preset.label}</span>
                            {isActive && <Check size={12} className="text-accent" />}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </section>

                <section>
                  <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Fondo del dashboard
                  </h3>
                  <div className="space-y-2">
                    <ColorRow label="Arriba" value={surface.appFrom} onChange={(v) => patchSurface({ appFrom: v })} />
                    <ColorRow label="Centro" value={surface.appVia} onChange={(v) => patchSurface({ appVia: v })} />
                    <ColorRow label="Abajo" value={surface.appTo} onChange={(v) => patchSurface({ appTo: v })} />
                  </div>
                </section>

                <section>
                  <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Barra lateral
                  </h3>
                  <div className="space-y-2">
                    <ColorRow label="Arriba" value={surface.sidebarFrom} onChange={(v) => patchSurface({ sidebarFrom: v })} />
                    <ColorRow label="Centro" value={surface.sidebarVia} onChange={(v) => patchSurface({ sidebarVia: v })} />
                    <ColorRow label="Abajo" value={surface.sidebarTo} onChange={(v) => patchSurface({ sidebarTo: v })} />
                  </div>
                </section>

                <section>
                  <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Resplandor
                  </h3>
                  <div className="rounded-xl border border-gray-800 bg-gray-900/50 px-3 py-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="glow" className="text-xs text-gray-300">
                        Intensidad
                      </label>
                      <span className="text-xs font-mono text-gray-500">
                        {Math.round(surface.glowIntensity * 100)}%
                      </span>
                    </div>
                    <input
                      id="glow"
                      type="range"
                      min={0}
                      max={2}
                      step={0.1}
                      value={surface.glowIntensity}
                      onChange={(e) =>
                        patchSurface({ glowIntensity: Number(e.target.value) })
                      }
                      className="w-full accent-[var(--color-accent)]"
                    />
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1.5">
                    Usa el color de marca del tenant — editable en Configuración.
                  </p>
                </section>

                <button
                  type="button"
                  onClick={reset}
                  className="w-full rounded-xl px-4 py-2.5 text-xs font-semibold text-gray-300 border border-gray-800 hover:bg-gray-900 hover:text-white flex items-center justify-center gap-2 transition"
                >
                  <RotateCcw size={13} /> Restaurar por defecto
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const safe = isValidHex(value) ? value : "#000000"
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-800 bg-gray-900/50 px-3 py-2 cursor-pointer hover:border-gray-700 transition">
      <span className="text-xs text-gray-300">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-mono text-gray-500 uppercase">{safe}</span>
        <div
          className="w-6 h-6 rounded-md border border-gray-700 relative overflow-hidden"
          style={{ background: safe }}
        >
          <input
            type="color"
            value={safe}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
            aria-label={label}
          />
        </div>
      </div>
    </label>
  )
}
