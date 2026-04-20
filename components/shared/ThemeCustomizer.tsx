"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Palette, X, RotateCcw, Check } from "lucide-react"
import { useBrandTheme, THEME_PRESETS, type BrandTheme } from "@/lib/brand-theme"
import { cn } from "@/lib/utils"

function hexToRgb(hex: string): string {
  const clean = hex.replace("#", "")
  const full = clean.length === 3 ? clean.split("").map(c => c + c).join("") : clean
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return `${r} ${g} ${b}`
}

function rgbToHex(rgb: string): string {
  const [r, g, b] = rgb.split(" ").map(Number)
  return (
    "#" +
    [r, g, b]
      .map(n => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0"))
      .join("")
  )
}

export function ThemeCustomizer() {
  const { theme, setTheme, setPreset, reset } = useBrandTheme()
  const [open, setOpen] = useState(false)

  const update = (patch: Partial<BrandTheme>) => setTheme({ ...theme, ...patch })

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full flex items-center justify-center brand-glow text-white hover:scale-105 transition-transform"
        style={{
          background:
            "linear-gradient(135deg, rgb(var(--glow-primary)), rgb(var(--glow-secondary)))",
        }}
        title="Personalizar tema"
      >
        <Palette size={20} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              className="fixed right-0 top-0 bottom-0 w-full sm:w-[380px] z-50 bg-[#0a0a14] border-l border-white/10 overflow-y-auto"
              initial={{ x: 400 }}
              animate={{ x: 0 }}
              exit={{ x: 400 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <div className="sticky top-0 bg-[#0a0a14]/90 backdrop-blur border-b border-white/10 px-5 py-4 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-white flex items-center gap-2">
                    <Palette size={18} className="text-purple-300" /> Personalizar tema
                  </h2>
                  <p className="text-xs text-white/40 mt-0.5">Los cambios se guardan en tu navegador</p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/5"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-6">
                <section>
                  <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Presets</h3>
                  <div className="grid grid-cols-2 gap-2.5">
                    {Object.entries(THEME_PRESETS).map(([key, preset]) => {
                      const isActive =
                        theme.appFrom === preset.theme.appFrom &&
                        theme.glowPrimary === preset.theme.glowPrimary
                      return (
                        <button
                          key={key}
                          onClick={() => setPreset(key)}
                          className={cn(
                            "relative rounded-xl p-3 text-left border transition-all overflow-hidden",
                            isActive
                              ? "border-purple-400/60 bg-white/5"
                              : "border-white/10 hover:border-white/20 bg-white/[0.02]"
                          )}
                        >
                          <div
                            className="h-12 rounded-lg mb-2 relative"
                            style={{
                              background: `linear-gradient(135deg, ${preset.theme.appFrom}, ${preset.theme.appVia}, ${preset.theme.appTo})`,
                              boxShadow: `inset 0 0 40px rgb(${preset.theme.glowPrimary} / 0.35)`,
                            }}
                          >
                            <div
                              className="absolute bottom-1.5 right-1.5 w-5 h-5 rounded-full border border-white/20"
                              style={{ background: `rgb(${preset.theme.glowPrimary})` }}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-white">{preset.name}</span>
                            {isActive && <Check size={14} className="text-purple-300" />}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Fondo del dashboard</h3>
                  <div className="space-y-2.5">
                    <ColorRow label="Arriba"   value={theme.appFrom} onChange={v => update({ appFrom: v })} />
                    <ColorRow label="Centro"   value={theme.appVia}  onChange={v => update({ appVia: v })} />
                    <ColorRow label="Abajo"    value={theme.appTo}   onChange={v => update({ appTo: v })} />
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Barra lateral</h3>
                  <div className="space-y-2.5">
                    <ColorRow label="Arriba"   value={theme.sidebarFrom} onChange={v => update({ sidebarFrom: v })} />
                    <ColorRow label="Centro"   value={theme.sidebarVia}  onChange={v => update({ sidebarVia: v })} />
                    <ColorRow label="Abajo"    value={theme.sidebarTo}   onChange={v => update({ sidebarTo: v })} />
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Resplandor de marca</h3>
                  <div className="space-y-2.5">
                    <ColorRow
                      label="Primario"
                      value={rgbToHex(theme.glowPrimary)}
                      onChange={v => update({ glowPrimary: hexToRgb(v) })}
                    />
                    <ColorRow
                      label="Secundario"
                      value={rgbToHex(theme.glowSecondary)}
                      onChange={v => update({ glowSecondary: hexToRgb(v) })}
                    />
                  </div>
                </section>

                <button
                  onClick={reset}
                  className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white/80 border border-white/10 hover:bg-white/5 hover:text-white flex items-center justify-center gap-2 transition"
                >
                  <RotateCcw size={15} /> Restaurar por defecto
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
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 cursor-pointer hover:border-white/20 transition">
      <span className="text-sm text-white/80">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-white/40 uppercase">{value}</span>
        <div
          className="w-7 h-7 rounded-lg border border-white/20 relative overflow-hidden"
          style={{ background: value }}
        >
          <input
            type="color"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </div>
      </div>
    </label>
  )
}
