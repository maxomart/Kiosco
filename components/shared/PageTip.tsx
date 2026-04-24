"use client"

import { useState, useEffect } from "react"
import { Lightbulb, X } from "lucide-react"

interface PageTipProps {
  /** Unique id for this tip — used to persist "dismissed" state. */
  id: string
  /** The friendly tip message (1-2 lines). */
  children: React.ReactNode
  /** Optional: icon to replace the default Lightbulb. */
  icon?: React.ElementType
  /** Optional: accent color scheme. */
  tone?: "accent" | "sky" | "amber" | "emerald"
}

const TONE_CLASSES = {
  accent: {
    bg: "from-accent-soft/40 to-accent-soft/10 border-accent/30",
    iconBg: "bg-accent/20",
    iconColor: "text-accent",
  },
  sky: {
    bg: "from-sky-900/30 to-sky-950/20 border-sky-700/40",
    iconBg: "bg-sky-900/40",
    iconColor: "text-sky-400",
  },
  amber: {
    bg: "from-amber-900/30 to-amber-950/20 border-amber-700/40",
    iconBg: "bg-amber-900/40",
    iconColor: "text-amber-400",
  },
  emerald: {
    bg: "from-emerald-900/30 to-emerald-950/20 border-emerald-700/40",
    iconBg: "bg-emerald-900/40",
    iconColor: "text-emerald-400",
  },
}

/**
 * Dismissable tip that appears once at the top of a page.
 * Persists dismissal in localStorage by `id` so each user sees each tip once.
 *
 * Example:
 *   <PageTip id="tip:cargas:first-time">
 *     Podés cargar mercadería sacando una foto del remito — la IA detecta todo.
 *   </PageTip>
 */
export function PageTip({ id, children, icon: Icon = Lightbulb, tone = "accent" }: PageTipProps) {
  const storageKey = `app:tip:${id}:dismissed`
  const [dismissed, setDismissed] = useState(true) // start hidden to avoid flash
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const val = localStorage.getItem(storageKey)
      setDismissed(val === "1")
    } catch {
      setDismissed(false)
    }
  }, [storageKey])

  const dismiss = () => {
    try {
      localStorage.setItem(storageKey, "1")
    } catch {
      // ignore
    }
    setDismissed(true)
  }

  if (!mounted || dismissed) return null

  const t = TONE_CLASSES[tone]

  return (
    <div className={`bg-gradient-to-r ${t.bg} border rounded-lg px-4 py-2.5 flex items-start gap-3`}>
      <div className={`w-7 h-7 rounded-lg ${t.iconBg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-4 h-4 ${t.iconColor}`} />
      </div>
      <div className="flex-1 text-sm text-gray-200 leading-snug pt-0.5">{children}</div>
      <button
        onClick={dismiss}
        className="flex-shrink-0 p-1 rounded hover:bg-white/5 text-gray-500 hover:text-gray-300 transition-colors"
        aria-label="Cerrar tip"
        title="Entendido, no volver a mostrar"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
