"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import toast from "react-hot-toast"
import { formatDate, PLAN_LABELS } from "@/lib/utils"
import Breadcrumbs from "@/components/admin/Breadcrumbs"

type Source = "PAID" | "PROMO" | "TRIAL" | "FREE" | "OTHER"

interface Sub {
  id: string
  tenantId: string
  tenant: { id: string; name: string; slug: string; active: boolean }
  plan: string
  status: string
  billingCycle: string
  currentPeriodEnd: string | null
  paymentProvider: string | null
  source: Source
  mrr: number
}

const PLANS = ["FREE", "STARTER", "PROFESSIONAL", "BUSINESS", "ENTERPRISE"]
const STATUSES = ["ACTIVE", "TRIALING", "PAST_DUE", "PAUSED", "CANCELLED"]
const SOURCES: { value: Source | ""; label: string }[] = [
  { value: "", label: "Todos los tipos" },
  { value: "PAID", label: "Pagantes (MRR real)" },
  { value: "PROMO", label: "Promo (gratis)" },
  { value: "TRIAL", label: "Prueba 14 días" },
  { value: "FREE", label: "Plan gratis" },
  { value: "OTHER", label: "Cancelados / Pausa" },
]

// Badge per source. OTHER reuses the sub.status to say CANCELADO / PAUSADO
// instead of a meaningless dash — makes the admin row self-explanatory.
const SOURCE_BADGE: Record<Source, { label: string; cls: string }> = {
  PAID: { label: "PAGANTE", cls: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" },
  PROMO: { label: "PROMO", cls: "bg-amber-500/15 text-amber-300 border border-amber-500/30" },
  TRIAL: { label: "TRIAL", cls: "bg-blue-500/15 text-blue-300 border border-blue-500/30" },
  FREE: { label: "GRATIS", cls: "bg-gray-700/40 text-gray-400 border border-gray-600/40" },
  OTHER: { label: "INACTIVO", cls: "bg-red-500/10 text-red-300 border border-red-500/30" },
}

const OTHER_LABEL_BY_STATUS: Record<string, string> = {
  CANCELLED: "CANCELADO",
  PAUSED: "PAUSADO",
  PAST_DUE: "VENCIDO",
}

export default function AdminSubscriptionsPage() {
  const [subs, setSubs] = useState<Sub[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusF, setStatusF] = useState("")
  const [planF, setPlanF] = useState("")
  const [sourceF, setSourceF] = useState<Source | "">("")
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      ...(statusF && { status: statusF }),
      ...(planF && { plan: planF }),
      ...(sourceF && { source: sourceF }),
    })
    try {
      const res = await fetch(`/api/admin/subscriptions?${params}`)
      if (res.ok) {
        const d = await res.json()
        setSubs(d.subscriptions || [])
        setTotal(d.total || 0)
      }
    } finally { setLoading(false) }
  }, [statusF, planF, sourceF])

  useEffect(() => { load() }, [load])

  const patch = async (s: Sub, body: Record<string, unknown>, msg: string) => {
    setBusyId(s.id)
    try {
      const res = await fetch(`/api/admin/subscriptions/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) { toast.success(msg); load() } else toast.error("Error")
    } finally { setBusyId(null) }
  }

  const syncMP = async (s: Sub) => {
    setBusyId(s.id + ":sync")
    try {
      const res = await fetch(`/api/admin/subscriptions/${s.id}/sync`, { method: "POST" })
      const d = await res.json()
      if (res.ok) {
        toast.success(`Sync OK · MP: ${d.mpStatus} · Facturas creadas: ${d.invoicesCreated}`)
        load()
      } else {
        toast.error(d.error || "Error en sync")
      }
    } finally { setBusyId(null) }
  }

  const totalMRR = subs.reduce((acc, s) => acc + s.mrr, 0)
  const counts = subs.reduce(
    (acc, s) => {
      acc[s.source] = (acc[s.source] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  return (
    <div className="p-6 space-y-6">
      <Breadcrumbs items={[{ label: "Admin", href: "/admin" }, { label: "Suscripciones" }]} />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Suscripciones</h1>
          <p className="text-gray-400 text-sm mt-1">
            {total} en total · <span className="text-emerald-300">{counts.PAID ?? 0} pagantes</span>
            {(counts.PROMO ?? 0) > 0 && <> · <span className="text-amber-300">{counts.PROMO} promo</span></>}
            {(counts.TRIAL ?? 0) > 0 && <> · <span className="text-blue-300">{counts.TRIAL} trial</span></>}
            {" · "}
            <span className="text-green-400 font-medium">MRR real ${totalMRR.toFixed(0)} USD/mes</span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select value={sourceF} onChange={e => setSourceF(e.target.value as Source | "")}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
          {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={statusF} onChange={e => setStatusF(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
          <option value="">Todos los estados</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={planF} onChange={e => setPlanF(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
          <option value="">Todos los planes</option>
          {PLANS.map(p => <option key={p} value={p}>{PLAN_LABELS[p as keyof typeof PLAN_LABELS]}</option>)}
        </select>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400">
              <th className="p-4 text-left font-medium">Tenant</th>
              <th className="p-4 text-left font-medium">Tipo</th>
              <th className="p-4 text-left font-medium">Plan</th>
              <th className="p-4 text-left font-medium">Estado</th>
              <th className="p-4 text-left font-medium">Ciclo</th>
              <th className="p-4 text-left font-medium">Renueva</th>
              <th className="p-4 text-right font-medium">MRR</th>
              <th className="p-4 text-right font-medium">Sync MP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}><td colSpan={8} className="p-4"><div className="h-4 bg-gray-800 rounded animate-pulse" /></td></tr>
            )) : subs.length === 0 ? (
              <tr><td colSpan={8} className="p-12 text-center text-gray-500">Sin suscripciones.</td></tr>
            ) : subs.map(s => {
              const badge = SOURCE_BADGE[s.source]
              // For OTHER subscriptions, refine the label using the actual
              // status so the admin row reads "CANCELADO" / "PAUSADO" etc.
              const label =
                s.source === "OTHER" ? OTHER_LABEL_BY_STATUS[s.status] ?? badge.label : badge.label
              return (
              <tr key={s.id} className="hover:bg-gray-800/30">
                <td className="p-4">
                  <Link href={`/admin/tenants/${s.tenant.id}`} className="text-white font-medium hover:text-purple-300">
                    {s.tenant.name}
                  </Link>
                  <p className="text-gray-500 text-xs">{s.tenant.slug}</p>
                </td>
                <td className="p-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider ${badge.cls}`}>
                    {label}
                  </span>
                </td>
                <td className="p-4">
                  <select
                    value={s.plan}
                    disabled={busyId === s.id}
                    onChange={e => patch(s, { plan: e.target.value }, "Plan actualizado")}
                    className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-purple-300"
                  >
                    {PLANS.map(p => <option key={p} value={p}>{PLAN_LABELS[p as keyof typeof PLAN_LABELS]}</option>)}
                  </select>
                </td>
                <td className="p-4">
                  <select
                    value={s.status}
                    disabled={busyId === s.id}
                    onChange={e => patch(s, { status: e.target.value }, "Estado actualizado")}
                    className={`px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs ${
                      s.status === "ACTIVE" ? "text-green-300" :
                      s.status === "TRIALING" ? "text-blue-300" :
                      s.status === "CANCELLED" ? "text-red-300" : "text-yellow-300"
                    }`}
                  >
                    {STATUSES.map(st => <option key={st}>{st}</option>)}
                  </select>
                </td>
                <td className="p-4 text-gray-300">{s.billingCycle}</td>
                <td className="p-4 text-gray-400">{s.currentPeriodEnd ? formatDate(s.currentPeriodEnd) : "—"}</td>
                <td className="p-4 text-right text-green-400 font-medium">${s.mrr.toFixed(0)}</td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => syncMP(s)}
                    disabled={!!busyId}
                    title="Sync MP: actualiza estado y backfill de facturas"
                    className="px-2 py-1 rounded text-xs bg-gray-800 hover:bg-purple-900/40 text-gray-400 hover:text-purple-300 transition-colors disabled:opacity-40"
                  >
                    {busyId === s.id + ":sync" ? "…" : "Sync"}
                  </button>
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
