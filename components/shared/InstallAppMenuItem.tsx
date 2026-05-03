"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Download } from "lucide-react"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

/**
 * Item del dropdown del header para instalar Orvex como PWA.
 * - Si ya está instalada (standalone) → no renderiza nada.
 * - Si el browser dispara `beforeinstallprompt` → botón que lo dispara directo.
 * - Sino (Safari iOS, etc) → link a /descargar con instrucciones.
 */
export function InstallAppMenuItem({ onClick }: { onClick?: () => void }) {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true
    if (isStandalone) setInstalled(true)

    const handler = (e: Event) => {
      e.preventDefault()
      setEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener("beforeinstallprompt", handler)
    const onInstalled = () => setInstalled(true)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", handler)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  if (installed) return null

  const handleNativeInstall = async () => {
    if (!event) return
    await event.prompt()
    const choice = await event.userChoice
    if (choice.outcome === "accepted") setInstalled(true)
    onClick?.()
  }

  if (event) {
    return (
      <button
        type="button"
        onClick={handleNativeInstall}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-gray-200 hover:bg-emerald-500/10 hover:text-emerald-200 transition-colors"
        role="menuitem"
      >
        <Download size={15} className="text-emerald-400" />
        <span className="flex-1 text-left">Instalar como app</span>
        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded px-1.5 py-0.5 font-bold uppercase tracking-wider">
          1 click
        </span>
      </button>
    )
  }

  // Fallback: link a /descargar para instrucciones manuales (iOS Safari, etc)
  return (
    <Link
      href="/descargar"
      role="menuitem"
      onClick={onClick}
      className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-gray-200 hover:bg-emerald-500/10 hover:text-emerald-200 transition-colors"
    >
      <Download size={15} className="text-emerald-400" />
      <span className="flex-1">Instalar como app</span>
    </Link>
  )
}
