"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Sparkles, ChevronRight, X } from "lucide-react"

/**
 * Banner accionable arriba de /reportes que consume el endpoint
 * /api/ai/insights (rule-based, sin LLM call). Antes los insights solo
 * se veían en el chatbot del home — donde el dueño nunca entra. Acá los
 * surfaceamos en el lugar donde realmente está mirando los números.
 *
 * El endpoint tira [] cuando no hay paid plan, así que el componente
 * simplemente no se renderiza para FREE.
 */

interface Insight {
  id: string
  severity: "info" | "warning" | "danger" | "success"
  title: string
  message: string
  action?: { label: string; href: string }
}

const SEV_STYLES: Record<Insight["severity"], { bg: string; border: string; text: string; icon: any }> = {
  danger:  { bg: "bg-red-500/[0.08]",      border: "border-red-500/30",      text: "text-red-200",      icon: AlertCircle },
  warning: { bg: "bg-amber-500/[0.08]",    border: "border-amber-500/30",    text: "text-amber-200",    icon: AlertTriangle },
  info:    { bg: "bg-blue-500/[0.08]",     border: "border-blue-500/30",     text: "text-blue-200",     icon: Info },
  success: { bg: "bg-emerald-500/[0.08]",  border: "border-emerald-500/30",  text: "text-emerald-200",  icon: CheckCircle2 },
}

const LS_DISMISSED = "reportes-insights-dismissed"

export function InsightsBanner() {
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set()
    try {
      return new Set(JSON.parse(window.localStorage.getItem(LS_DISMISSED) ?? "[]"))
    } catch {
      return new Set()
    }
  })

  useEffect(() => {
    let cancelled = false
    fetch("/api/ai/insights", { cache: "no-store" })
      .then(r => r.ok ? r.json() : { insights: [] })
      .then(d => {
        if (!cancelled) setInsights(Array.isArray(d.insights) ? d.insights : [])
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const dismiss = (id: string) => {
    const next = new Set(dismissed); next.add(id)
    setDismissed(next)
    try {
      window.localStorage.setItem(LS_DISMISSED, JSON.stringify(Array.from(next)))
    } catch {}
  }

  const visible = insights.filter(i => !dismissed.has(i.id))
  if (loading) return null
  if (visible.length === 0) return null

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wider">
        <Sparkles size={12} className="text-accent" />
        <span className="font-semibold">Oportunidades detectadas</span>
        <span className="text-gray-600">·</span>
        <span className="text-gray-500 normal-case tracking-normal">Sugerencias automáticas según tus números</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {visible.slice(0, 4).map(insight => {
          const s = SEV_STYLES[insight.severity]
          const Icon = s.icon
          return (
            <div
              key={insight.id}
              className={`relative rounded-xl border ${s.border} ${s.bg} p-4 flex items-start gap-3 group`}
            >
              <div className={`shrink-0 w-8 h-8 rounded-full ${s.bg} ${s.border} border flex items-center justify-center`}>
                <Icon size={14} className={s.text} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${s.text} leading-snug`}>{insight.title}</p>
                <p className="text-xs text-gray-300 mt-1 leading-relaxed">{insight.message}</p>
                {insight.action && (
                  <Link
                    href={insight.action.href}
                    className={`inline-flex items-center gap-1 mt-2 text-xs font-semibold ${s.text} hover:underline`}
                  >
                    {insight.action.label}
                    <ChevronRight size={12} />
                  </Link>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(insight.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 -m-1 rounded text-gray-500 hover:text-gray-300"
                aria-label="Descartar sugerencia"
              >
                <X size={12} />
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
