"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Activity, ArrowRight, Loader2 } from "lucide-react"

type Status = "ok" | "warn" | "down"

interface HealthData {
  summary: { overall: Status; okCount: number; warnCount: number; downCount: number }
  checks: { id: string; label: string; status: Status; detail: string; latencyMs?: number }[]
}

const STATUS_DOT: Record<Status, string> = {
  ok: "bg-emerald-400",
  warn: "bg-amber-400",
  down: "bg-red-400",
}

const STATUS_RING: Record<Status, string> = {
  ok: "border-emerald-500/30 bg-emerald-500/[0.04]",
  warn: "border-amber-500/30 bg-amber-500/[0.04]",
  down: "border-red-500/30 bg-red-500/[0.04]",
}

const STATUS_TXT: Record<Status, string> = {
  ok: "Todo OK",
  warn: "Hay warnings",
  down: "Hay servicios caídos",
}

export default function AdminHealthCard() {
  const [data, setData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const res = await fetch("/api/admin/health", { cache: "no-store" })
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load()
    }, 30000)
    return () => window.clearInterval(id)
  }, [])

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" /> Chequeando servicios…
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/[0.04] p-5 text-sm text-red-300">
        No se pudo cargar el estado del sistema.
      </div>
    )
  }

  return (
    <Link
      href="/admin/salud"
      className={`block rounded-xl border p-5 transition-colors hover:bg-white/[0.02] ${STATUS_RING[data.summary.overall]}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-gray-400" />
          <p className="text-xs uppercase tracking-wider text-gray-400 font-semibold">
            sistema
          </p>
        </div>
        <ArrowRight className="w-3.5 h-3.5 text-gray-500" />
      </div>
      <div className="flex items-center gap-2 mb-3">
        <span className={`relative flex h-2.5 w-2.5`}>
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${STATUS_DOT[data.summary.overall]}`} />
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${STATUS_DOT[data.summary.overall]}`} />
        </span>
        <p className="text-lg font-semibold text-white">{STATUS_TXT[data.summary.overall]}</p>
      </div>
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <p className="text-gray-500">OK</p>
          <p className="font-bold text-emerald-300 tabular-nums">{data.summary.okCount}</p>
        </div>
        <div>
          <p className="text-gray-500">Warn</p>
          <p className="font-bold text-amber-300 tabular-nums">{data.summary.warnCount}</p>
        </div>
        <div>
          <p className="text-gray-500">Down</p>
          <p className="font-bold text-red-300 tabular-nums">{data.summary.downCount}</p>
        </div>
      </div>
    </Link>
  )
}
