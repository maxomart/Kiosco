"use client"

import { useState, useEffect } from "react"
import { Clock, Play, RefreshCw, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import toast from "react-hot-toast"

interface CronRun {
  id: string
  name: string
  runDate: string
  startedAt: string
  finishedAt: string | null
  result: any
}

const PERIODS = [
  { id: "daily", label: "Resumen diario", schedule: "Cada día 22:00" },
  { id: "weekly", label: "Resumen semanal", schedule: "Lunes 09:00" },
  { id: "monthly", label: "Resumen mensual", schedule: "Día 1 del mes 09:00" },
  { id: "lowstock", label: "Alertas stock bajo", schedule: "Cada día 09:00" },
] as const

export default function CronPage() {
  const [runs, setRuns] = useState<CronRun[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState<string | null>(null)

  const fetchRuns = async () => {
    try {
      const r = await fetch("/api/admin/cron-runs", { cache: "no-store" })
      if (r.ok) {
        const d = await r.json()
        setRuns(d.runs ?? [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRuns()
    const t = setInterval(fetchRuns, 30_000)
    return () => clearInterval(t)
  }, [])

  const runNow = async (period: string) => {
    setRunning(period)
    try {
      const r = await fetch("/api/admin/cron-runs/run-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period }),
      })
      const d = await r.json()
      if (!r.ok) {
        toast.error(d.error ?? "Error al ejecutar")
        return
      }
      toast.success(`OK: ${d.sent} enviados, ${d.skipped} skipped (${d.tenants} tenants)`)
      await fetchRuns()
    } catch {
      toast.error("Error de red")
    } finally {
      setRunning(null)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-900/40 border border-purple-700/40 flex items-center justify-center">
          <Clock className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Cron interno</h1>
          <p className="text-sm text-gray-400">Disparos automáticos de emails programados.</p>
        </div>
      </div>

      {/* Botones para disparar manual */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-white font-semibold">Ejecutar ahora</h2>
          <p className="text-xs text-gray-500 mt-1">
            Dispara el job sin esperar al horario programado. Útil para testear que los emails se envían.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => runNow(p.id)}
              disabled={!!running}
              className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="text-left">
                <p className="text-sm font-medium text-white">{p.label}</p>
                <p className="text-[11px] text-gray-500">{p.schedule}</p>
              </div>
              {running === p.id ? (
                <Loader2 size={16} className="animate-spin text-purple-400" />
              ) : (
                <Play size={14} className="text-purple-400" />
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Historial */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold">Últimas ejecuciones</h2>
            <p className="text-xs text-gray-500 mt-1">Se actualiza automáticamente cada 30s.</p>
          </div>
          <button
            type="button"
            onClick={fetchRuns}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 border border-gray-700"
          >
            <RefreshCw size={13} /> Refrescar
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 bg-gray-800 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : runs.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500">
            Todavía no hay ejecuciones. Apretá un botón de arriba para correr una manual,<br />
            o esperá al próximo horario programado.
          </div>
        ) : (
          <div className="space-y-2">
            {runs.map((r) => {
              const ok = r.finishedAt && !(r.result as any)?.error
              const result = r.result as any
              return (
                <div
                  key={r.id}
                  className="flex items-start gap-3 px-4 py-3 rounded-lg bg-gray-800/50 border border-gray-800"
                >
                  <div className="mt-0.5">
                    {!r.finishedAt ? (
                      <Loader2 size={16} className="animate-spin text-amber-400" />
                    ) : ok ? (
                      <CheckCircle2 size={16} className="text-emerald-400" />
                    ) : (
                      <AlertCircle size={16} className="text-red-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-sm font-mono text-purple-300">{r.name}</code>
                      <span className="text-[11px] text-gray-500">{r.runDate}</span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Iniciado: {new Date(r.startedAt).toLocaleString("es-AR")}
                      {r.finishedAt && ` · Finalizado: ${new Date(r.finishedAt).toLocaleString("es-AR")}`}
                    </p>
                    {result && (
                      <p className="text-xs text-gray-300 mt-1">
                        {result.error ? (
                          <span className="text-red-300">Error: {result.error}</span>
                        ) : (
                          <>
                            {result.tenants ?? 0} tenants ·{" "}
                            <span className="text-emerald-400">{result.sent ?? 0} enviados</span>
                            {result.skipped > 0 && <span className="text-gray-500"> · {result.skipped} skipped</span>}
                          </>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Cómo funciona */}
      <section className="bg-gray-900/40 border border-gray-800 rounded-xl p-5 text-sm text-gray-400 space-y-2">
        <p className="text-gray-300 font-semibold">Cómo funciona</p>
        <ul className="space-y-1.5 list-disc list-inside">
          <li>El cron interno se arranca al boot del server y corre <code>setInterval</code> cada 5 min.</li>
          <li>Cada chequeo mira la hora de Argentina (UTC-3): si es 22:00 dispara <em>daily</em>, si es 09:00 dispara <em>lowstock</em>, los lunes <em>weekly</em>, día 1 <em>monthly</em>.</li>
          <li>La idempotencia es por DB (<code>CronExecution</code> con <code>unique(name, runDate)</code>) — un job NO se dispara dos veces el mismo día aunque el server reinicie.</li>
          <li>Las ejecuciones manuales ("Ejecutar ahora") se loguean con un sufijo <code>-manual-{"{timestamp}"}</code> para distinguirlas.</li>
        </ul>
      </section>
    </div>
  )
}
