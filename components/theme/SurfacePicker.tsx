"use client"

import { Check, Palette, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  SURFACE_PRESETS,
  isValidHex,
} from "@/lib/surface-theme"
import { useSurfaceTheme } from "./SurfaceThemeProvider"

/**
 * Inline panel — vive dentro de /configuracion. El color de marca lo maneja
 * ThemePicker (persistido en la DB del tenant); acá solo tocamos los gradientes
 * de fondo y la intensidad del glow, que se guardan en localStorage para que
 * cada usuario personalice su vista sin afectar al resto del equipo.
 */
export function SurfacePicker() {
  const { surface, patchSurface, applyPreset, reset } = useSurfaceTheme()

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Palette size={18} className="text-accent" />
          <h2 className="text-white font-semibold">Fondo del dashboard</h2>
        </div>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white px-2 py-1 rounded-md hover:bg-gray-800 transition"
          title="Restaurar por defecto"
        >
          <RotateCcw size={12} /> Restaurar
        </button>
      </div>
      <p className="text-xs text-gray-500 -mt-2">
        Personalizá la estética de tu panel. Se guarda en tu navegador — no afecta a otros usuarios del comercio.
      </p>

      <section>
        <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Presets
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
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
                  "rounded-xl p-2.5 text-left border transition-all",
                  isActive
                    ? "border-accent bg-gray-950"
                    : "border-gray-800 hover:border-gray-700 bg-gray-950/50"
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        <section>
          <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Fondo principal
          </h3>
          <div className="space-y-2">
            <ColorRow label="Arriba" value={surface.appFrom} onChange={(v) => patchSurface({ appFrom: v })} />
            <ColorRow label="Centro" value={surface.appVia} onChange={(v) => patchSurface({ appVia: v })} />
            <ColorRow label="Abajo" value={surface.appTo} onChange={(v) => patchSurface({ appTo: v })} />
          </div>
        </section>

        <section>
          <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Barra lateral
          </h3>
          <div className="space-y-2">
            <ColorRow label="Arriba" value={surface.sidebarFrom} onChange={(v) => patchSurface({ sidebarFrom: v })} />
            <ColorRow label="Centro" value={surface.sidebarVia} onChange={(v) => patchSurface({ sidebarVia: v })} />
            <ColorRow label="Abajo" value={surface.sidebarTo} onChange={(v) => patchSurface({ sidebarTo: v })} />
          </div>
        </section>

        <section>
          <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Barra superior
          </h3>
          <div className="space-y-2">
            <ColorRow label="Arriba" value={surface.navFrom} onChange={(v) => patchSurface({ navFrom: v })} />
            <ColorRow label="Abajo" value={surface.navTo} onChange={(v) => patchSurface({ navTo: v })} />
          </div>
        </section>

        <section>
          <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Tarjetas
          </h3>
          <div className="space-y-2">
            <ColorRow label="Fondo" value={surface.cardBg} onChange={(v) => patchSurface({ cardBg: v })} />
            <ColorRow label="Borde" value={surface.cardBorder} onChange={(v) => patchSurface({ cardBorder: v })} />
          </div>
        </section>
      </div>

      <section className="pt-2">
        <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Resplandor
        </h3>
        <div className="rounded-lg border border-gray-800 bg-gray-950/50 px-3 py-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="glow" className="text-xs text-gray-300">Intensidad</label>
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
          Usa el color de marca definido arriba (Personalización).
        </p>
      </section>
    </div>
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
    <label className="flex items-center justify-between gap-3 rounded-lg border border-gray-800 bg-gray-950/40 px-3 py-2 cursor-pointer hover:border-gray-700 transition">
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
