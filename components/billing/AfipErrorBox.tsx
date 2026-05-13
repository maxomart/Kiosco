"use client"

import { AlertCircle, AlertTriangle, Info, ExternalLink } from "lucide-react"
import type { FriendlyAfipError } from "@/lib/afip-errors"

interface Props {
  error: FriendlyAfipError
  className?: string
}

/**
 * Render compacto para un error AFIP "humanizado".
 * Muestra título + hint + (opcional) botón con action link.
 * El raw queda en un <details> escondido por si se necesita debug.
 */
export function AfipErrorBox({ error, className = "" }: Props) {
  const tone =
    error.severity === "fatal"
      ? "bg-red-950/40 border-red-700/50 text-red-100"
      : error.severity === "warning"
        ? "bg-amber-950/40 border-amber-700/50 text-amber-100"
        : "bg-blue-950/40 border-blue-700/50 text-blue-100"

  const iconTone =
    error.severity === "fatal"
      ? "text-red-400"
      : error.severity === "warning"
        ? "text-amber-400"
        : "text-blue-400"

  const Icon =
    error.severity === "fatal"
      ? AlertCircle
      : error.severity === "warning"
        ? AlertTriangle
        : Info

  return (
    <div className={`rounded-lg border p-3 text-sm space-y-2 ${tone} ${className}`}>
      <div className="flex items-start gap-2">
        <Icon size={16} className={`flex-shrink-0 mt-0.5 ${iconTone}`} />
        <div className="flex-1 min-w-0 space-y-1">
          <p className="font-semibold leading-tight">{error.title}</p>
          <p className="text-xs opacity-90 leading-relaxed">{error.hint}</p>
          {error.action && (
            <a
              href={error.action.href}
              target={error.action.href.startsWith("/") ? "_self" : "_blank"}
              rel="noopener"
              className="inline-flex items-center gap-1 text-xs font-medium underline-offset-2 hover:underline mt-1"
            >
              {error.action.label}
              {!error.action.href.startsWith("/") && <ExternalLink size={10} />}
            </a>
          )}
          {error.raw && (
            <details className="mt-1.5">
              <summary className="text-[10px] opacity-60 cursor-pointer hover:opacity-100">
                Mostrar detalle técnico
              </summary>
              <code className="block mt-1 text-[10px] opacity-70 font-mono break-all bg-black/30 rounded p-1.5">
                {error.raw}
              </code>
            </details>
          )}
        </div>
      </div>
    </div>
  )
}
