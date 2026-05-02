"use client"

import { useEffect, useState } from "react"
import { Percent, TrendingUp, Calendar, Users as UsersIcon } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

interface Row {
  userId: string
  name: string
  email: string
  role: string
  commissionPercent: number
  totalSales: number
  salesCount: number
  commission: number
}
interface Data {
  from: string
  to: string
  rows: Row[]
  totals: { commissions: number; sales: number; salesCount: number }
}

function todayISO() { return new Date().toISOString().slice(0, 10) }
function startOfMonthISO() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

export default function ComisionesPage() {
  const [from, setFrom] = useState(startOfMonthISO())
  const [to, setTo] = useState(todayISO())
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const r = await fetch(`/api/comisiones?from=${from}&to=${to}`, { cache: "no-store" })
    if (r.ok) setData(await r.json())
    setLoading(false)
  }

  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [from, to])

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-900/40 border border-emerald-700/40 flex items-center justify-center">
          <Percent className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Comisiones de empleados</h1>
          <p className="text-sm text-gray-400">
            Cuánto ganó cada cajero según su porcentaje sobre las ventas que cerró.
          </p>
        </div>
      </div>

      {/* Filtros de fecha */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-wrap items-center gap-4">
        <Calendar size={16} className="text-gray-500" />
        <label className="text-xs text-gray-400">Desde
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="ml-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
        </label>
        <label className="text-xs text-gray-400">Hasta
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} max={todayISO()}
            className="ml-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
        </label>
        <div className="flex gap-1 ml-auto">
          <button onClick={() => { setFrom(todayISO()); setTo(todayISO()) }}
            className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300">Hoy</button>
          <button onClick={() => { setFrom(startOfMonthISO()); setTo(todayISO()) }}
            className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300">Mes actual</button>
        </div>
      </section>

      {loading || !data ? (
        <div className="h-32 bg-gray-900 rounded-xl animate-pulse" />
      ) : (
        <>
          {/* KPIs */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <KpiCard
              icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
              label="Total comisiones"
              value={formatCurrency(data.totals.commissions)}
              accent="emerald"
            />
            <KpiCard
              icon={<TrendingUp className="w-5 h-5 text-sky-400" />}
              label="Ventas en el período"
              value={formatCurrency(data.totals.sales)}
              accent="sky"
            />
            <KpiCard
              icon={<UsersIcon className="w-5 h-5 text-purple-400" />}
              label="Empleados con ventas"
              value={String(data.rows.filter((r) => r.salesCount > 0).length)}
              accent="purple"
            />
          </section>

          {/* Tabla */}
          <section className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-800/40 text-gray-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="text-left py-3 px-4">Empleado</th>
                    <th className="text-right py-3 px-4">% comisión</th>
                    <th className="text-right py-3 px-4">Ventas</th>
                    <th className="text-right py-3 px-4">Total facturado</th>
                    <th className="text-right py-3 px-4">Comisión</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center text-gray-500 py-8">Sin datos en el período.</td>
                    </tr>
                  ) : (
                    data.rows.map((r) => (
                      <tr key={r.userId} className="border-t border-gray-800 hover:bg-gray-800/30">
                        <td className="py-3 px-4">
                          <p className="text-white font-medium">{r.name}</p>
                          <p className="text-[11px] text-gray-500">{r.role}</p>
                        </td>
                        <td className="py-3 px-4 text-right text-gray-300 tabular-nums">
                          {r.commissionPercent}%
                        </td>
                        <td className="py-3 px-4 text-right text-gray-300 tabular-nums">
                          {r.salesCount}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-200 tabular-nums">
                          {formatCurrency(r.totalSales)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-300 tabular-nums">
                          {r.commissionPercent === 0 ? (
                            <span className="text-gray-500 italic font-normal text-xs">Sin %</span>
                          ) : (
                            formatCurrency(r.commission)
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-gray-800 bg-gray-800/20 text-xs text-gray-400">
              Tip: configurá el % de comisión de cada usuario desde{" "}
              <a href="/configuracion/usuarios" className="text-emerald-300 underline">
                Configuración → Usuarios
              </a>.
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function KpiCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: "emerald" | "sky" | "purple" }) {
  const map = { emerald: "from-emerald-500/10", sky: "from-sky-500/10", purple: "from-purple-500/10" }
  return (
    <div className={`bg-gradient-to-br ${map[accent]} via-gray-900 to-gray-900 border border-gray-800 rounded-xl p-4`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">{label}</p>
      </div>
      <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
    </div>
  )
}
