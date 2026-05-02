"use client"

import { useEffect, useState } from "react"
import { TrendingUp, Receipt, Trophy, Zap, Maximize2, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { formatCurrency } from "@/lib/utils"

interface TvStats {
  businessName: string
  logoUrl: string | null
  today: { total: number; count: number; avgTicket: number; byHour: number[] }
  month: { total: number; count: number }
  topProducts: { name: string; qty: number; revenue: number }[]
  recentSales: {
    total: number
    createdAt: string
    paymentMethod: string
    itemsCount: number
    firstItem: string
  }[]
  serverTime: string
}

export default function TvModePage() {
  const [stats, setStats] = useState<TvStats | null>(null)
  const [now, setNow] = useState(new Date())

  // Reloj actualizado cada segundo
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const load = async () => {
    try {
      const r = await fetch("/api/tv/stats", { cache: "no-store" })
      if (r.ok) setStats(await r.json())
    } catch {}
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 30_000) // refresh cada 30s
    return () => clearInterval(t)
  }, [])

  const handleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen?.()
  }

  if (!stats) {
    return (
      <div className="h-screen w-screen flex items-center justify-center text-gray-500">
        Cargando…
      </div>
    )
  }

  const maxHour = Math.max(...stats.today.byHour, 1)
  const peakHour = stats.today.byHour.indexOf(maxHour)

  return (
    <div className="min-h-screen w-screen bg-gradient-to-br from-gray-950 via-gray-950 to-purple-950/30 p-6 sm:p-10 flex flex-col gap-6 overflow-hidden relative">
      {/* Top toolbar — esconder con auto-hide después de 3s, pero por simplicidad lo dejamos visible */}
      <div className="absolute top-3 right-3 flex gap-2 z-10 print:hidden">
        <Link
          href="/inicio"
          className="p-2 rounded-lg bg-gray-900/60 hover:bg-gray-900 text-gray-400 hover:text-white border border-gray-800 backdrop-blur"
          title="Volver al dashboard"
        >
          <ArrowLeft size={16} />
        </Link>
        <button
          onClick={handleFullscreen}
          className="p-2 rounded-lg bg-gray-900/60 hover:bg-gray-900 text-gray-400 hover:text-white border border-gray-800 backdrop-blur"
          title="Pantalla completa"
        >
          <Maximize2 size={16} />
        </button>
      </div>

      {/* Header */}
      <header className="flex items-end justify-between gap-6">
        <div>
          <p className="text-sm text-purple-300 uppercase tracking-[0.3em] font-bold mb-1">
            {stats.businessName}
          </p>
          <h1 className="text-4xl sm:text-5xl xl:text-6xl font-black text-white leading-none">
            {now.toLocaleDateString("es-AR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </h1>
        </div>
        <p className="text-5xl sm:text-7xl xl:text-8xl font-black text-white tabular-nums leading-none">
          {now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })}
        </p>
      </header>

      {/* KPIs principales */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<TrendingUp className="w-6 h-6 text-emerald-400" />}
          label="Hoy"
          value={formatCurrency(stats.today.total)}
          sub={`${stats.today.count} ventas`}
          accent="emerald"
        />
        <KpiCard
          icon={<Receipt className="w-6 h-6 text-sky-400" />}
          label="Ticket promedio"
          value={formatCurrency(stats.today.avgTicket)}
          sub="Hoy"
          accent="sky"
        />
        <KpiCard
          icon={<Trophy className="w-6 h-6 text-amber-400" />}
          label="Mes"
          value={formatCurrency(stats.month.total)}
          sub={`${stats.month.count} ventas`}
          accent="amber"
        />
        <KpiCard
          icon={<Zap className="w-6 h-6 text-purple-400" />}
          label="Pico del día"
          value={`${peakHour.toString().padStart(2, "0")}:00`}
          sub={formatCurrency(maxHour)}
          accent="purple"
        />
      </section>

      {/* Bloque medio: chart por hora + top productos */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-[300px]">
        {/* Chart por hora */}
        <div className="lg:col-span-2 bg-gray-900/60 border border-gray-800 rounded-2xl p-5 backdrop-blur">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs uppercase tracking-[0.2em] text-gray-400 font-bold">
              Ventas por hora — hoy
            </h2>
            <span className="text-[10px] text-gray-500">
              Actualiza cada 30s
            </span>
          </div>
          <div className="flex items-end gap-1.5 h-[calc(100%-2rem)]">
            {stats.today.byHour.slice(7, 23).map((amount, i) => {
              const hour = i + 7
              const heightPct = maxHour > 0 ? (amount / maxHour) * 100 : 0
              const isCurrent = hour === now.getHours()
              return (
                <div key={hour} className="flex-1 flex flex-col items-center gap-1 h-full">
                  <div
                    className={`w-full flex items-end h-full ${isCurrent ? "" : ""}`}
                  >
                    <div
                      className={`w-full rounded-t-md transition-all duration-700 ${
                        isCurrent
                          ? "bg-gradient-to-t from-purple-600 to-purple-400 ring-2 ring-purple-400/50"
                          : amount > 0
                          ? "bg-gradient-to-t from-emerald-700 to-emerald-500"
                          : "bg-gray-800"
                      }`}
                      style={{ height: `${Math.max(heightPct, amount > 0 ? 4 : 1)}%` }}
                    />
                  </div>
                  <span className={`text-[10px] tabular-nums ${isCurrent ? "text-purple-300 font-bold" : "text-gray-500"}`}>
                    {hour}h
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top productos */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 backdrop-blur">
          <h2 className="text-xs uppercase tracking-[0.2em] text-gray-400 font-bold mb-4">
            Top productos hoy
          </h2>
          {stats.topProducts.length === 0 ? (
            <p className="text-sm text-gray-500 italic">Sin ventas todavía hoy.</p>
          ) : (
            <ul className="space-y-3">
              {stats.topProducts.map((p, idx) => (
                <li key={p.name} className="flex items-center gap-3">
                  <span
                    className={`w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center text-sm font-black ${
                      idx === 0
                        ? "bg-amber-500/20 text-amber-300 ring-2 ring-amber-500/30"
                        : idx === 1
                        ? "bg-gray-400/20 text-gray-300 ring-1 ring-gray-400/30"
                        : idx === 2
                        ? "bg-orange-700/20 text-orange-300 ring-1 ring-orange-700/30"
                        : "bg-gray-800 text-gray-400"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white font-medium truncate">{p.name}</p>
                    <p className="text-xs text-gray-500">
                      {p.qty} unidades · {formatCurrency(p.revenue)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Live ticker — últimas ventas */}
      <section className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 backdrop-blur">
        <div className="flex items-center gap-2 mb-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <h2 className="text-xs uppercase tracking-[0.2em] text-emerald-300 font-bold">
            En vivo — últimas ventas
          </h2>
        </div>
        {stats.recentSales.length === 0 ? (
          <p className="text-sm text-gray-500 italic">Sin ventas hoy todavía.</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto">
            {stats.recentSales.map((s, i) => (
              <div
                key={i}
                className="flex-shrink-0 bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-3 min-w-[180px]"
              >
                <p className="text-lg font-bold text-white tabular-nums">
                  {formatCurrency(s.total)}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {s.firstItem}
                  {s.itemsCount > 1 && ` +${s.itemsCount - 1}`}
                </p>
                <p className="text-[10px] text-gray-500 mt-1">
                  {new Date(s.createdAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                  {" · "}
                  {s.paymentMethod === "CASH" ? "Efectivo" : s.paymentMethod === "TRANSFER" ? "Transfer" : s.paymentMethod === "CARD" ? "Tarjeta" : s.paymentMethod}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  accent: "emerald" | "sky" | "amber" | "purple"
}) {
  const ringMap = {
    emerald: "from-emerald-500/20 ring-emerald-500/30",
    sky: "from-sky-500/20 ring-sky-500/30",
    amber: "from-amber-500/20 ring-amber-500/30",
    purple: "from-purple-500/20 ring-purple-500/30",
  }
  return (
    <div
      className={`relative bg-gradient-to-br ${ringMap[accent]} via-gray-900/40 to-gray-900/40 border border-gray-800 rounded-2xl p-5 ring-1 backdrop-blur overflow-hidden`}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <p className="text-xs uppercase tracking-[0.2em] text-gray-400 font-bold">{label}</p>
      </div>
      <p className="text-3xl xl:text-4xl font-black text-white tabular-nums leading-none">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-2">{sub}</p>}
    </div>
  )
}
