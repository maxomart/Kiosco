"use client"

import { useState, useEffect } from "react"
import { Bot, Play, RefreshCw, AlertCircle, CheckCircle2, Loader2, ShoppingCart, Package, Users, Truck } from "lucide-react"
import toast from "react-hot-toast"

interface BotStatus {
  configured: boolean
  ready?: boolean
  email?: string
  reason?: string
  tenant?: { id: string; name: string; ownerName: string }
  stats?: { products: number; sales: number; suppliers: number; clients: number }
  recentSales?: Array<{ id: string; number: number; total: number; paymentMethod: string; itemsCount: number; createdAt: string }>
  lastBotRun?: {
    runDate: string
    startedAt: string
    finishedAt: string | null
    result: any
  } | null
}

export default function BotPage() {
  const [status, setStatus] = useState<BotStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  const fetchStatus = async () => {
    try {
      const r = await fetch("/api/admin/bot/status", { cache: "no-store" })
      if (r.ok) {
        setStatus(await r.json())
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    const t = setInterval(fetchStatus, 30_000)
    return () => clearInterval(t)
  }, [])

  const runBot = async () => {
    setRunning(true)
    try {
      const r = await fetch("/api/admin/bot/run", { method: "POST" })
      const d = await r.json()
      if (!r.ok) {
        toast.error(d.error ?? "Error")
        return
      }
      const res = d.result
      toast.success(
        `${res.salesCreated} ventas · ${res.itemsSold} items · $${Math.round(res.revenue).toLocaleString("es-AR")} de ingresos`,
        { duration: 5000 }
      )
      await fetchStatus()
    } catch {
      toast.error("Error de red")
    } finally {
      setRunning(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="h-32 bg-gray-900 rounded-xl animate-pulse" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-900/40 border border-purple-700/40 flex items-center justify-center">
          <Bot className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Bot de simulación</h1>
          <p className="text-sm text-gray-400">
            Genera ventas, cargas y gastos diarios sobre una cuenta demo. Útil para videos, pruebas y mostrar la app con datos vivos.
          </p>
        </div>
      </div>

      {/* Configuración */}
      {!status?.configured && (
        <section className="bg-amber-950/40 border border-amber-800/40 rounded-xl p-5 space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-200 space-y-2">
              <p className="font-semibold">Bot no configurado</p>
              <p>{status?.reason ?? "Falta configurar en Railway"}</p>
              <ol className="list-decimal list-inside text-amber-200/80 space-y-1 text-xs">
                <li>Crear una cuenta normal en Orvex (signup) — anotá email y contraseña</li>
                <li>En Railway → Variables → agregar <code className="bg-gray-900 px-1 py-0.5 rounded">BOT_TENANT_EMAIL=tucorreo@gmail.com</code></li>
                <li>Esperar redeploy → recargar esta página</li>
              </ol>
            </div>
          </div>
        </section>
      )}

      {status?.configured && !status?.ready && (
        <section className="bg-amber-950/40 border border-amber-800/40 rounded-xl p-5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-200">
            <p className="font-semibold">Email configurado pero sin tenant</p>
            <p className="mt-1">
              <code>BOT_TENANT_EMAIL = {status.email}</code>
            </p>
            <p className="mt-1">No encontramos un usuario con ese email. ¿Ya hiciste el signup?</p>
          </div>
        </section>
      )}

      {status?.ready && (
        <>
          {/* Tenant info + run button */}
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-white font-semibold">Cuenta demo</h2>
                <p className="text-sm text-gray-400 mt-1">
                  <strong>{status.tenant?.name}</strong> · {status.email}
                </p>
              </div>
              <button
                type="button"
                onClick={runBot}
                disabled={running}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm disabled:opacity-50"
              >
                {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                {running ? "Ejecutando..." : "Ejecutar ahora"}
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat icon={Package} label="Productos" value={status.stats?.products ?? 0} />
              <Stat icon={ShoppingCart} label="Ventas totales" value={status.stats?.sales ?? 0} />
              <Stat icon={Truck} label="Proveedores" value={status.stats?.suppliers ?? 0} />
              <Stat icon={Users} label="Clientes" value={status.stats?.clients ?? 0} />
            </div>
          </section>

          {/* Última run */}
          {status.lastBotRun && (
            <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
              <h2 className="text-white font-semibold">Última ejecución</h2>
              <div className="flex items-center gap-3 text-sm">
                {status.lastBotRun.finishedAt ? (
                  <CheckCircle2 size={16} className="text-emerald-400" />
                ) : (
                  <Loader2 size={16} className="animate-spin text-amber-400" />
                )}
                <span className="text-gray-300">
                  {new Date(status.lastBotRun.startedAt).toLocaleString("es-AR")}
                </span>
              </div>
              {status.lastBotRun.result?.result && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <ResultStat label="Ventas creadas" value={status.lastBotRun.result.result.salesCreated} />
                  <ResultStat label="Items vendidos" value={status.lastBotRun.result.result.itemsSold} />
                  <ResultStat label="Cargas" value={status.lastBotRun.result.result.rechargesCreated} />
                  <ResultStat label="Gastos" value={status.lastBotRun.result.result.expensesCreated} />
                </div>
              )}
            </section>
          )}

          {/* Recent sales */}
          {status.recentSales && status.recentSales.length > 0 && (
            <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-white font-semibold">Últimas 5 ventas del bot</h2>
                <button onClick={fetchStatus} className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200">
                  <RefreshCw size={11} /> Refrescar
                </button>
              </div>
              <div className="space-y-2">
                {status.recentSales.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-gray-800/50 border border-gray-800 text-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <code className="text-purple-300 font-mono">#{s.number}</code>
                      <span className="text-gray-400">{s.itemsCount} items</span>
                      <span className="text-[11px] text-gray-500 uppercase tracking-wider">{s.paymentMethod}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-emerald-400 font-medium tabular-nums">
                        ${Math.round(s.total).toLocaleString("es-AR")}
                      </span>
                      <span className="text-[11px] text-gray-500">
                        {new Date(s.createdAt).toLocaleString("es-AR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Cómo funciona */}
      <section className="bg-gray-900/40 border border-gray-800 rounded-xl p-5 text-sm text-gray-400 space-y-2">
        <p className="text-gray-300 font-semibold">Cómo funciona</p>
        <ul className="space-y-1.5 list-disc list-inside">
          <li>El bot corre automático todos los días a las <strong>23:30 AR</strong> sobre la cuenta cuyo email está en <code>BOT_TENANT_EMAIL</code>.</li>
          <li>Si la cuenta tiene menos de 5 productos, el bot inicializa el catálogo con ~30 productos típicos de kiosco (gaseosas, cigarrillos, alfajores, etc), 5 proveedores y 5 clientes.</li>
          <li>Cada día genera 10-25 ventas distribuidas por horarios reales (mañana 8-10, mediodía 12-14, tarde 17-19), con métodos de pago variados (efectivo 50%, MP 30%, débito 15%, crédito 5%).</li>
          <li>Cuando un producto baja del minStock, registra automáticamente una <em>carga</em> con el proveedor que lo abastece.</li>
          <li>~30% de los días registra un gasto random (luz, sueldos, limpieza).</li>
          <li>Las ventas descontan stock real y crean StockMovements como cualquier venta normal.</li>
        </ul>
      </section>
    </div>
  )
}

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="bg-gray-800/50 border border-gray-800 rounded-lg p-3">
      <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
        <Icon size={12} />
        {label}
      </div>
      <p className="text-xl font-bold text-white tabular-nums">{value}</p>
    </div>
  )
}

function ResultStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-800/50 border border-gray-800 rounded-lg p-3">
      <p className="text-[11px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold text-purple-300 tabular-nums mt-0.5">{value}</p>
    </div>
  )
}
