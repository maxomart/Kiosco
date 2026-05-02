"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Download, X } from "lucide-react"

/**
 * Banner flotante que aparece cuando el browser dispara `beforeinstallprompt`
 * (Chrome/Edge en Android/desktop, etc). Permite instalar Orvex como PWA.
 *
 * Persistencia: si el user descarta, guardamos un flag en localStorage para
 * no volver a mostrar por 14 días.
 */

const DISMISS_KEY = "orvex-install-dismissed"
const DISMISS_DAYS = 14

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function InstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    // Si fue dismissed reciente, no mostrar
    try {
      const stamp = localStorage.getItem(DISMISS_KEY)
      if (stamp) {
        const ageDays = (Date.now() - Number(stamp)) / (1000 * 60 * 60 * 24)
        if (ageDays < DISMISS_DAYS) return
      }
    } catch { /* ignore */ }

    const handler = (e: Event) => {
      e.preventDefault()
      setEvent(e as BeforeInstallPromptEvent)
      // Pequeño delay para no aparecer apenas carga la página
      setTimeout(() => setVisible(true), 4000)
    }
    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  const install = async () => {
    if (!event) return
    setInstalling(true)
    await event.prompt()
    const choice = await event.userChoice
    if (choice.outcome === "accepted") {
      setVisible(false)
    }
    setInstalling(false)
  }

  const dismiss = () => {
    setVisible(false)
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* ignore */ }
  }

  return (
    <AnimatePresence>
      {visible && event && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          transition={{ type: "spring", damping: 22 }}
          className="fixed bottom-4 right-4 z-[80] max-w-sm bg-gray-950 border border-purple-700/40 rounded-2xl shadow-2xl shadow-purple-950/50 p-4 flex items-start gap-3"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center flex-shrink-0">
            <Download size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">Instalá Orvex en tu celu</p>
            <p className="text-xs text-gray-400 mt-0.5">Como app, sin pestañas — más rápido y siempre a mano.</p>
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={install}
                disabled={installing}
                className="flex-1 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium disabled:opacity-50"
              >
                {installing ? "Instalando..." : "Instalar"}
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs"
              >
                Más tarde
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Cerrar"
            className="text-gray-500 hover:text-white p-1 rounded -mr-1 -mt-1"
          >
            <X size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
