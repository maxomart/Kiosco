"use client"

import { useEffect, useState } from "react"
import { FileCheck2, AlertTriangle, TrendingUp, RefreshCw } from "lucide-react"

interface TopTenant {
  tenantId: string
  tenantName: string
  used: number
  limit: number // -1 = ilimitado
  percent: number
}

interface ByPlan {
  plan: string
  tenants: number
  used: number
}

interface Usage {
  totalThisMonth: number
  totalLastMonth: number
  topTenants: TopTenant[]
  byPlan: ByPlan[]
}

const SDK_FREE_LIMIT = 100 // estimado del plan gratis de AfipSDK

export default function AfipUsagePage() {
  const [usage, setUsage] = useState<Usage | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchUsage = async () => {
    try {
      const r = await fetch("/api/admin/afip/usage", { cache: "no-store" })
      if (r.ok) setUsage(await r.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsage()
    const t = setInterval(fetchUsage, 60_000)
    return () => clearInterval(t)
  }, [])

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="h-32 bg-gray-900 rounded-xl animate-pulse" />
      </div>
    )
  }

  const change = usage && usage.totalLastMonth > 0
    ? Math.round(((usage.totalThisMonth - usage.totalLastMonth) / usage.totalLastMonth) * 100)
    : null
  const sdkPercent = usage ? Math.min(100, Math.round((usage.totalThisMonth / SDK_FREE_LIMIT) * 100)) : 0
  const nearingSdk = sdkPercent >= 80
  const overSdk = usage ? usage.totalThisMonth >= SDK_FREE_LIMIT : false

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-900/40 border border-amber-700/40 flex items-center justify-center">
          <FileCheck2 className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Uso de facturas ARCA</h1>
          <p className="text-sm text-gray-400">Monitoreo del cupo del SaaS y por tenant.</p>
        </div>
        <button onClick={fetchUsage} className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300">
          <RefreshCw size={13} /> Refrescar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs text-gray-500 mb-1">CAE este mes</p>
          <p className="text-3xl font-bold text-white tabular-nums">{usage?.totalThisMonth ?? 0}</p>
          {change !== null && (
            <p className={`text-xs mt-1 ${change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {change >= 0 ? "↑" : "↓"} {Math.abs(change)}% vs mes pasado
            </p>
          )}
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-xs text-gray-500 mb-1">Mes pasado</p>
          <p className="text-3xl font-bold text-gray-400 tabular-nums">{usage?.totalLastMonth ?? 0}</p>
        </div>
        <div className={`rounded-xl border p-5 ${
          overSdk ? "bg-red-950/30 border-red-800/40" : nearingSdk ? "bg-amber-950/30 border-amber-800/40" : "bg-gray-900 border-gray-800"
        }`}>
          <p className="text-xs text-gray-500 mb-1">Cupo plan gratis AfipSDK</p>
          <p className="text-3xl font-bold text-white tabular-nums">
            {usage?.totalThisMonth ?? 0}<span className="text-base text-gray-500">/{SDK_FREE_LIMIT}</span>
          </p>
          <div className="h-1.5 bg-gray-800 rounded-full mt-2 overflow-hidden">
            <div className={`h-full transition-all ${
              overSdk ? "bg-red-500" : nearingSdk ? "bg-amber-500" : "bg-emerald-500"
            }`} style={{ width: `${sdkPercent}%` }} />
          </div>
          {overSdk && (
            <p className="text-xs text-red-300 mt-2 flex items-center gap-1">
              <AlertTriangle size={12} /> Pasaste el cupo gratis — upgradeá AfipSDK
            </p>
          )}
          {nearingSdk && !overSdk && (
            <p className="text-xs text-amber-300 mt-2">⚠ Cerca del cupo, evaluá upgrade</p>
          )}
        </div>
      </div>

      {/* By plan */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
        <h2 className="text-white font-semibold">Por plan</h2>
        <div className="space-y-2">
          {(usage?.byPlan ?? []).map((p) => (
            <div key={p.plan} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-gray-800/50 border border-gray-800 text-sm">
              <div>
                <code className="text-purple-300 font-mono">{p.plan}</code>
                <span className="text-gray-500 ml-2">{p.tenants} tenants</span>
              </div>
              <div className="text-emerald-300 font-medium tabular-nums">
                {p.used} CAE
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Top tenants */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
        <h2 className="text-white font-semibold">Top 20 — quién más factura este mes</h2>
        {usage?.topTenants?.length ? (
          <div className="space-y-2">
            {usage.topTenants.map((t) => (
              <div key={t.tenantId} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-800/50 border border-gray-800">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{t.tenantName}</p>
                  <p className="text-[11px] text-gray-500">{t.used} de {t.limit === -1 ? "∞" : t.limit}</p>
                </div>
                <div className="w-32 flex-shrink-0">
                  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        t.percent >= 100 ? "bg-red-500" : t.percent >= 80 ? "bg-amber-500" : "bg-purple-500"
                      }`}
                      style={{ width: `${Math.min(100, t.percent)}%` }}
                    />
                  </div>
                </div>
                <p className={`text-xs tabular-nums w-12 text-right ${
                  t.percent >= 100 ? "text-red-400" : t.percent >= 80 ? "text-amber-400" : "text-gray-400"
                }`}>{t.percent}%</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 py-4 text-center">Todavía no hay facturas emitidas este mes.</p>
        )}
      </section>

      <section className="bg-gray-900/40 border border-gray-800 rounded-xl p-5 text-sm text-gray-400 space-y-2">
        <p className="text-gray-300 font-semibold flex items-center gap-2">
          <TrendingUp size={14} /> Cupos por plan de Orvex
        </p>
        <ul className="space-y-1 list-disc list-inside text-xs">
          <li><strong>Gratis</strong>: 0 facturas (no incluido)</li>
          <li><strong>Básico</strong> ($9.999): 50 facturas/mes</li>
          <li><strong>Profesional</strong> ($24.900): 300 facturas/mes</li>
          <li><strong>Negocio</strong> ($59.900): 2.000 facturas/mes</li>
          <li><strong>Enterprise</strong>: ilimitado</li>
        </ul>
        <p className="text-[11px] text-gray-500 pt-2">
          Si querés cambiar estos cupos, edita <code className="text-gray-400">INVOICE_LIMIT_BY_PLAN</code> en <code className="text-gray-400">lib/afip-quota.ts</code>.
        </p>
      </section>
    </div>
  )
}
