"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Download, X, Smartphone, ArrowRight } from "lucide-react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

// Compartimos el mismo localStorage key con InstallPrompt (banner flotante)
// para que un dismiss aplique a los dos. Sino el user descartaría el toast
// y aún así seguiríamos mostrando el banner arriba — molesto.
const LS_DISMISSED = "orvex-install-dismissed"
// Si el user descartó, lo dejamos tranquilo por 14 días.
const DISMISS_TTL_MS = 14 * 24 * 60 * 60 * 1000

/**
 * Banner promocional para instalar Orvex como PWA — visible en el dashboard
 * cuando NO está instalada. Antes la opción solo vivía en el dropdown del
 * menú del usuario (oculta), y mucha gente no se enteraba que se podía
 * instalar.
 *
 * Comportamientos:
 *   - Si está corriendo en standalone → no se muestra (ya está instalada).
 *   - Si el browser dispara `beforeinstallprompt` → botón "Instalar Orvex"
 *     que dispara la instalación nativa al toque (1 click).
 *   - Si no (Safari iOS, Firefox, etc) → CTA "Cómo instalarla" que lleva
 *     a /descargar con instrucciones por dispositivo.
 *   - Dismissible: si el user lo cierra, no lo molestamos por 14 días.
 *
 * Diseño: barra fina arriba del contenido del dashboard, no toma mucho
 * espacio pero es notoria. Color emerald sutil para no chocar con el
 * theme accent del producto.
 */
export function InstallPromoBanner() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(true) // pesimista hasta confirmar
  const [dismissed, setDismissed] = useState(true) // pesimista hasta leer LS
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    // ¿Ya está instalada?
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      window.matchMedia?.("(display-mode: window-controls-overlay)").matches ||
      (window.navigator as any).standalone === true
    setInstalled(isStandalone)

    // ¿El user la descartó hace poco?
    try {
      const raw = window.localStorage.getItem(LS_DISMISSED)
      if (raw) {
        const ts = Number(raw)
        if (Number.isFinite(ts) && Date.now() - ts < DISMISS_TTL_MS) {
          setDismissed(true)
        } else {
          setDismissed(false)
          window.localStorage.removeItem(LS_DISMISSED)
        }
      } else {
        setDismissed(false)
      }
    } catch {
      setDismissed(false)
    }

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvent(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setInstalled(true)
    window.addEventListener("beforeinstallprompt", onPrompt)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  if (installed || dismissed) return null

  const dismiss = () => {
    try { window.localStorage.setItem(LS_DISMISSED, String(Date.now())) } catch {}
    setDismissed(true)
  }

  const installNative = async () => {
    if (!event) return
    setInstalling(true)
    try {
      await event.prompt()
      const choice = await event.userChoice
      if (choice.outcome === "accepted") setInstalled(true)
    } catch {}
    finally { setInstalling(false) }
  }

  return (
    <div className="px-4 lg:px-6 pt-3">
      <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/[0.04] to-transparent p-3 sm:p-3.5 flex items-center gap-3">
        <div className="shrink-0 w-9 h-9 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
          <Smartphone size={16} className="text-emerald-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-tight">
            Instalá Orvex como app
          </p>
          <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
            Funciona offline · ícono propio en tu pantalla · sin browser de por medio
          </p>
        </div>

        {event ? (
          <button
            type="button"
            onClick={installNative}
            disabled={installing}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white text-xs font-bold transition-colors"
          >
            <Download size={13} />
            {installing ? "Instalando…" : "Instalar"}
          </button>
        ) : (
          <Link
            href="/descargar"
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-100 text-xs font-semibold transition-colors"
          >
            Cómo instalarla
            <ArrowRight size={12} />
          </Link>
        )}

        <button
          type="button"
          onClick={dismiss}
          aria-label="Cerrar"
          className="shrink-0 p-1 -m-1 rounded-md text-gray-500 hover:text-gray-200 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
