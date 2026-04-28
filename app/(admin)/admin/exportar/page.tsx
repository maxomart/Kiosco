"use client"

import { useState, useEffect } from "react"
import { FileSpreadsheet, Check, X, AlertTriangle, RefreshCw, Sparkles } from "lucide-react"
import toast from "react-hot-toast"

interface Status {
  users: boolean
  payments: boolean
  secret: boolean
}

export default function ExportarPage() {
  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState<"users" | "payments" | "both" | null>(null)

  useEffect(() => {
    fetch("/api/admin/sheets/status")
      .then(r => r.json())
      .then(d => setStatus(d))
      .finally(() => setLoading(false))
  }, [])

  const sync = async (target: "users" | "payments" | "both") => {
    setSyncing(target)
    try {
      const r = await fetch("/api/admin/sheets/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      })
      const d = await r.json()
      if (!r.ok) {
        toast.error(d.error ?? "Error al sincronizar")
        return
      }
      const lines: string[] = []
      for (const [k, v] of Object.entries(d.results ?? {}) as [string, { ok: boolean; count?: number; error?: string }][]) {
        if (v.ok) lines.push(`${k}: ${v.count ?? 0} filas`)
        else lines.push(`${k} falló: ${v.error}`)
      }
      const allOk = Object.values(d.results ?? {}).every((v: any) => v.ok)
      if (allOk) toast.success(lines.join(" · "))
      else toast.error(lines.join(" · "), { duration: 6000 })
    } catch (e) {
      toast.error("Error de red")
    } finally {
      setSyncing(null)
    }
  }

  const fullyReady = status?.users && status?.payments && status?.secret

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-900/40 border border-emerald-700/40 flex items-center justify-center">
          <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Sincronización con Google Sheets</h1>
          <p className="text-sm text-gray-400">Cada signup y cada pago se reflejan en tus planillas en tiempo real.</p>
        </div>
      </div>

      {loading ? (
        <div className="h-32 bg-gray-900 rounded-xl animate-pulse" />
      ) : (
        <>
          {/* Status */}
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
            <h2 className="text-white font-semibold">Estado de la conexión</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <StatusRow label="Token compartido" ok={!!status?.secret} envName="SHEETS_WEBHOOK_SECRET" />
              <StatusRow label="Webhook Usuarios" ok={!!status?.users} envName="SHEETS_WEBHOOK_USERS_URL" />
              <StatusRow label="Webhook Pagos" ok={!!status?.payments} envName="SHEETS_WEBHOOK_PAYMENTS_URL" />
            </div>

            {!fullyReady && (
              <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg p-3 flex gap-3 text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-amber-200">
                  Faltan variables en Railway. Agregalas en <strong>Project → Variables</strong> y redeployá.
                </div>
              </div>
            )}
          </section>

          {/* Sync */}
          {fullyReady && (
            <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
              <div>
                <h2 className="text-white font-semibold flex items-center gap-2">
                  <Sparkles size={16} className="text-emerald-400" />
                  Sincronizar histórico
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Vuelca todo lo que ya tenés en la base de datos a las planillas. Borra lo que haya y reescribe.
                  Los signups y pagos nuevos van solos en tiempo real — esto sólo lo corrés la primera vez (o si querés re-empezar).
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <SyncBtn
                  label="Sincronizar todo"
                  primary
                  onClick={() => sync("both")}
                  loading={syncing === "both"}
                  disabled={!!syncing}
                />
                <SyncBtn
                  label="Solo Usuarios"
                  onClick={() => sync("users")}
                  loading={syncing === "users"}
                  disabled={!!syncing}
                />
                <SyncBtn
                  label="Solo Pagos"
                  onClick={() => sync("payments")}
                  loading={syncing === "payments"}
                  disabled={!!syncing}
                />
              </div>
            </section>
          )}

          {/* Cómo funciona */}
          <section className="bg-gray-900/40 border border-gray-800 rounded-xl p-5 space-y-2 text-sm text-gray-400">
            <p className="text-gray-300 font-semibold">Cómo funciona</p>
            <ol className="space-y-1.5 list-decimal list-inside">
              <li>Cada vez que alguien se registra, el backend hace POST al webhook del Apps Script y aparece la fila al toque.</li>
              <li>Cada vez que MercadoPago / Stripe / Mobbex confirma un pago, lo mismo en la hoja de Pagos.</li>
              <li>Si el Apps Script falla por algún motivo, el signup/pago igual se completa en la app — no rompe nada.</li>
              <li>El upsert es por la columna A (ID): si ya existe la fila, se actualiza; si no, se appendea.</li>
              <li>Para forzar una resincronización completa, usá los botones de arriba.</li>
            </ol>
          </section>
        </>
      )}
    </div>
  )
}

function StatusRow({ label, ok, envName }: { label: string; ok: boolean; envName: string }) {
  return (
    <div className={`rounded-lg border p-3 ${ok ? "bg-emerald-950/40 border-emerald-800/40" : "bg-amber-950/40 border-amber-800/40"}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400">{label}</span>
        {ok ? <Check size={14} className="text-emerald-400" /> : <X size={14} className="text-amber-400" />}
      </div>
      <code className="text-[11px] text-gray-500 font-mono">{envName}</code>
    </div>
  )
}

function SyncBtn({
  label, primary, onClick, loading, disabled,
}: {
  label: string
  primary?: boolean
  onClick: () => void
  loading: boolean
  disabled: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${
        primary
          ? "bg-emerald-600 hover:bg-emerald-500 text-white"
          : "bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700"
      }`}
    >
      {loading ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
      {loading ? "Sincronizando..." : label}
    </button>
  )
}
