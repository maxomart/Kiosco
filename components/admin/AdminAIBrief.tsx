"use client"

import { useEffect, useState } from "react"
import { Loader2, RefreshCw, Sparkles } from "lucide-react"

interface BriefData {
  summary: string
  model: string
  facts: {
    signupsToday: number
    signupsYesterday: number
    cancelsLast7: number
    activeSubs: number
    salesToday: number
    salesYesterday: number
    failedInvoices: number
    topProducts: { name: string; qty: number }[]
  }
}

export default function AdminAIBrief() {
  const [data, setData] = useState<BriefData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    setRefreshing(true)
    try {
      const res = await fetch("/api/admin/ai-brief", { cache: "no-store" })
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/[0.06] via-blue-500/[0.04] to-transparent p-5 sm:p-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-violet-300" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-violet-300/80 font-semibold">
              brief del día
            </p>
            <p className="text-[11px] text-gray-500">
              {data?.model === "fallback"
                ? "modo fallback (sin OpenAI)"
                : data?.model
                  ? `generado por ${data.model}`
                  : ""}
            </p>
          </div>
        </div>
        <button
          onClick={() => void load()}
          disabled={refreshing}
          className="text-xs text-gray-500 hover:text-violet-300 flex items-center gap-1.5 px-2 py-1 rounded hover:bg-violet-500/10 transition-colors"
          title="Regenerar"
        >
          <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Pensando…" : "Actualizar"}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Pensando…
        </div>
      ) : data ? (
        <>
          <p className="text-base sm:text-lg text-gray-100 leading-relaxed">{data.summary}</p>
          {/* Facts strip — la fuente de verdad detrás del párrafo, así
              cualquier número que mencione el modelo se puede chequear. */}
          <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 sm:grid-cols-5 gap-3 text-[11px]">
            <Fact label="Signups hoy" value={data.facts.signupsToday} />
            <Fact label="Signups ayer" value={data.facts.signupsYesterday} muted />
            <Fact label="Subs activas" value={data.facts.activeSubs} />
            <Fact
              label="Cancel. 7d"
              value={data.facts.cancelsLast7}
              tone={data.facts.cancelsLast7 > 0 ? "warn" : undefined}
            />
            <Fact
              label="Facturas fallidas 7d"
              value={data.facts.failedInvoices}
              tone={data.facts.failedInvoices > 0 ? "danger" : undefined}
            />
          </div>
        </>
      ) : (
        <p className="text-sm text-gray-500">No se pudo cargar el resumen.</p>
      )}
    </div>
  )
}

function Fact({
  label,
  value,
  muted,
  tone,
}: {
  label: string
  value: number
  muted?: boolean
  tone?: "warn" | "danger"
}) {
  const color =
    tone === "danger"
      ? "text-red-300"
      : tone === "warn"
        ? "text-amber-300"
        : muted
          ? "text-gray-500"
          : "text-white"
  return (
    <div>
      <p className="text-gray-500 mb-0.5 truncate">{label}</p>
      <p className={`text-base font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  )
}
