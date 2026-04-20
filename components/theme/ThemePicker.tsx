"use client"

import { useState } from "react"
import { Check, Moon, Palette, Sun, SunMoon } from "lucide-react"
import { THEME_PRESETS, isValidHex } from "@/lib/theme"
import { useTheme } from "./ThemeProvider"
import { cn } from "@/lib/utils"

export function ThemePicker() {
  const { accent, setAccent, mode, setMode } = useTheme()
  const [customHex, setCustomHex] = useState(accent)
  const [hexError, setHexError] = useState<string | null>(null)

  const handleHexChange = (value: string) => {
    setCustomHex(value)
    if (isValidHex(value)) {
      setHexError(null)
      setAccent(value)
    } else {
      setHexError("Formato inválido. Usá #RRGGBB")
    }
  }

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 space-y-6">
      <div className="flex items-center gap-2">
        <Palette size={18} className="text-accent" />
        <h2 className="text-white font-semibold">Personalización</h2>
      </div>

      {/* Brand color */}
      <div className="space-y-3">
        <div>
          <p className="text-sm text-gray-200 font-medium">Color de marca</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Se aplica al instante. Recordá guardar para que persista.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {THEME_PRESETS.map((preset) => {
            const active = preset.hex.toLowerCase() === accent.toLowerCase()
            return (
              <button
                key={preset.name}
                type="button"
                onClick={() => {
                  setAccent(preset.hex)
                  setCustomHex(preset.hex)
                  setHexError(null)
                }}
                className={cn(
                  "relative w-9 h-9 rounded-full transition-all duration-200 ease-out",
                  "ring-offset-2 ring-offset-gray-900 focus:outline-none focus:ring-2",
                  active
                    ? "ring-2 ring-white scale-110"
                    : "hover:scale-110 ring-0"
                )}
                style={{ backgroundColor: preset.hex }}
                aria-label={`Color ${preset.label}`}
                title={preset.label}
              >
                {active && (
                  <Check
                    className="absolute inset-0 m-auto w-4 h-4 text-white drop-shadow"
                    strokeWidth={3}
                  />
                )}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-3 pt-1">
          <label htmlFor="custom-hex" className="text-xs text-gray-500">
            Personalizado:
          </label>
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-md border border-gray-700"
              style={{ backgroundColor: isValidHex(customHex) ? customHex : "transparent" }}
              aria-hidden
            />
            <input
              id="custom-hex"
              type="text"
              value={customHex}
              onChange={(e) => handleHexChange(e.target.value.trim())}
              maxLength={7}
              placeholder="#8b5cf6"
              className={cn(
                "h-8 px-2 w-28 bg-gray-800 border rounded-md text-white text-xs font-mono",
                "focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30",
                hexError ? "border-red-500" : "border-gray-700"
              )}
            />
          </div>
        </div>
        {hexError && <p className="text-xs text-red-400">{hexError}</p>}
      </div>

      {/* Mode */}
      <div className="space-y-2 pt-2 border-t border-gray-800">
        <div>
          <p className="text-sm text-gray-200 font-medium">Modo de visualización</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Elegí cómo se ve la interfaz. &quot;Auto&quot; sigue la preferencia de tu sistema.
          </p>
        </div>
        <div className="inline-flex bg-gray-800 border border-gray-700 rounded-lg p-1">
          {([
            { value: "dark", label: "Oscuro", Icon: Moon },
            { value: "light", label: "Claro", Icon: Sun },
            { value: "auto", label: "Auto", Icon: SunMoon },
          ] as const).map(({ value, label, Icon }) => {
            const active = mode === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  active
                    ? "bg-accent text-accent-foreground shadow"
                    : "text-gray-400 hover:text-gray-200"
                )}
              >
                <Icon size={13} /> {label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
