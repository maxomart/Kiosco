"use client"

import { useEffect, useState } from "react"
import { Activity, Database, AlertCircle, CheckCircle2, Loader2, RefreshCw, ServerCrash } from "lucide-react"

type Status = "ok" | "warn" | "down"

interface HealthCheck {
  id: string
  label: string
  status: Status
  detail: string
  latencyMs?: number
}

interface HealthData {
  summary: { overall: Status; okCount: number; warnCount: number; downCount: number }
  checks: HealthCheck[]
  counts: { tenants: number; users: number; sales: number }
  recentErrors: { action: string; entity: string; createdAt: string }[]
}

const STATUS_BADGE: Record<Status, string> = {
  ok: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  warn: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  down: "bg-red-500/15 text-red-300 border-red-500/30",
}

const STATUS_LABEL: Record<Status, string> = {
  ok: "OK",
  warn: "WARN",
  down: "DOWN",
}

export default function AdminHealthPage() {
  const [data, setData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  async function load() {
    setRefreshing(true)
    try {
      const res = await fetch("/api/admin/health", { cache: "no-store" })
      if (res.ok) {
        setData(await res.json())
        setLastChecked(new Date())
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void load()
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load()
    }, 20000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-violet-400" />
            Salud del sistema
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Estado en vivo de los servicios externos. Refresh cada 20s.
            {lastChecked && (
              <span className="text-gray-600">
                {" · "}último: {lastChecked.toLocaleTimeString("es-AR")}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-200 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Chequeando…" : "Volver a chequear"}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Cargando estado…
        </div>
      ) : data ? (
        <>
          {/* Top summary banner */}
          <div
            className={`rounded-2xl border p-5 flex items-center justify-between ${STATUS_BADGE[data.summary.overall]}`}
          >
            <div className="flex items-center gap-3">
              {data.summary.overall === "ok" ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : data.summary.overall === "warn" ? (
                <AlertCircle className="w-6 h-6" />
              ) : (
                <ServerCrash className="w-6 h-6" />
              )}
              <div>
                <p className="text-lg font-bold">
                  {data.summary.overall === "ok"
                    ? "Todo funciona"
                    : data.summary.overall === "warn"
                      ? "Hay servicios con warnings"
                      : "Hay servicios caídos"}
                </p>
                <p className="text-xs opacity-80">
                  {data.summary.okCount} OK · {data.summary.warnCount} warn · {data.summary.downCount} down
                </p>
              </div>
            </div>
          </div>

          {/* Counts strip */}
          <div className="grid grid-cols-3 gap-3">
            <Counter label="Tenants" value={data.counts.tenants} icon={Database} />
            <Counter label="Usuarios" value={data.counts.users} icon={Database} />
            <Counter label="Ventas totales" value={data.counts.sales} icon={Database} />
          </div>

          {/* Service checks list */}
          <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-800">
              <h3 className="text-white font-semibold">Servicios</h3>
            </div>
            <ul className="divide-y divide-gray-800">
              {data.checks.map((c) => (
                <li
                  key={c.id}
                  className="flex items-start gap-4 p-4 hover:bg-white/[0.02] transition-colors"
                >
                  <span
                    className={`text-[10px] font-bold tracking-wider px-2 py-1 rounded border whitespace-nowrap ${STATUS_BADGE[c.status]}`}
                  >
                    {STATUS_LABEL[c.status]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-medium">{c.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{c.detail}</p>
                  </div>
                  {typeof c.latencyMs === "number" && (
                    <p className="text-xs text-gray-500 tabular-nums whitespace-nowrap">
                      {c.latencyMs} ms
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Recent errors */}
          {data.recentErrors.length > 0 && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-5">
              <h3 className="text-red-200 font-semibold mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> Errores recientes (últimas 24h)
              </h3>
              <ul className="text-sm text-red-100/80 space-y-1.5">
                {data.recentErrors.map((e, i) => (
                  <li key={i} className="font-mono text-xs">
                    [{new Date(e.createdAt).toLocaleTimeString("es-AR")}] {e.action} · {e.entity}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <div className="text-red-300 text-sm">No se pudo cargar.</div>
      )}
    </div>
  )
}

function Counter({ label, value, icon: Icon }: { label: string; value: number; icon: any }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
        <Icon className="w-3.5 h-3.5 text-gray-600" />
      </div>
      <p className="text-2xl font-bold text-white tabular-nums">
        {value.toLocaleString("es-AR")}
      </p>
    </div>
  )
}
