"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Loader2,
  UserPlus,
  CreditCard,
  CheckCircle2,
  XCircle,
  TrendingUp,
  RadioTower,
} from "lucide-react"

interface Activity {
  id: string
  kind: "signup" | "subscription" | "invoice-paid" | "invoice-failed" | "sale-big"
  createdAt: string
  title: string
  detail: string
  tenantId?: string
}

const KIND_META: Record<Activity["kind"], { icon: any; tone: string; label: string }> = {
  signup: { icon: UserPlus, tone: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20", label: "Signup" },
  subscription: { icon: CreditCard, tone: "text-violet-300 bg-violet-500/10 border-violet-500/20", label: "Subscripción" },
  "invoice-paid": { icon: CheckCircle2, tone: "text-blue-300 bg-blue-500/10 border-blue-500/20", label: "Pago" },
  "invoice-failed": { icon: XCircle, tone: "text-red-300 bg-red-500/10 border-red-500/20", label: "Falló pago" },
  "sale-big": { icon: TrendingUp, tone: "text-amber-300 bg-amber-500/10 border-amber-500/20", label: "Venta grande" },
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return "ahora"
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  return `hace ${d} d`
}

export default function AdminActivityFeed() {
  const [items, setItems] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const res = await fetch("/api/admin/activity", { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        setItems(data.items ?? [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // poll every 12s — enough to feel live without hammering the DB
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load()
    }, 12000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <RadioTower size={16} className="text-violet-400" />
          <h3 className="text-white font-semibold">Actividad reciente</h3>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
        </div>
        <p className="text-xs text-gray-500">Últimos 7 días · refresh cada 12s</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">
          Sin actividad en los últimos 7 días.
        </p>
      ) : (
        <ul className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {items.map((it) => {
            const meta = KIND_META[it.kind]
            const Icon = meta.icon
            const inner = (
              <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors">
                <div
                  className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${meta.tone}`}
                >
                  <Icon size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-white font-medium truncate">{it.title}</p>
                    <span className="text-[11px] text-gray-500 shrink-0 tabular-nums">
                      {relativeTime(it.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{it.detail}</p>
                </div>
              </div>
            )
            return (
              <li key={it.id}>
                {it.tenantId ? (
                  <Link
                    href={`/admin/tenants/${it.tenantId}`}
                    className="block rounded-lg"
                  >
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
