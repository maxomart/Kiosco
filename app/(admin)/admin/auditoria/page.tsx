"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { formatDateTime } from "@/lib/utils"
import Breadcrumbs from "@/components/admin/Breadcrumbs"

interface Log {
  id: string
  action: string
  entity: string
  entityId: string | null
  createdAt: string
  ipAddress: string | null
  user: {
    id: string
    name: string
    email: string
    tenant: { id: string; name: string; slug: string } | null
  }
}

interface TenantOption { id: string; name: string }

const ACTIONS = ["LOGIN", "LOGOUT", "CREATE", "UPDATE", "DELETE"]
const ENTITIES = ["User", "Tenant", "Product", "Sale", "Subscription"]

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<Log[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState("")
  const [entity, setEntity] = useState("")
  const [tenantId, setTenantId] = useState("")
  const [tenants, setTenants] = useState<TenantOption[]>([])
  const limit = 50

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      ...(action && { action }),
      ...(entity && { entity }),
      ...(tenantId && { tenantId }),
    })
    try {
      const res = await fetch(`/api/admin/audit?${params}`)
      if (res.ok) {
        const d = await res.json()
        setLogs(d.logs || [])
        setTotal(d.total || 0)
      }
    } finally { setLoading(false) }
  }, [page, action, entity, tenantId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch("/api/admin/tenants?limit=500").then(r => r.ok ? r.json() : null)
      .then(d => d && setTenants(d.tenants)).catch(() => {})
  }, [])

  const pages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="p-6 space-y-6">
      <Breadcrumbs items={[{ label: "Admin", href: "/admin" }, { label: "Auditoría" }]} />

      <div>
        <h1 className="text-2xl font-bold text-white">Auditoría</h1>
        <p className="text-gray-400 text-sm mt-1">{total} eventos registrados</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select value={action} onChange={e => { setAction(e.target.value); setPage(1) }}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
          <option value="">Todas las acciones</option>
          {ACTIONS.map(a => <option key={a}>{a}</option>)}
        </select>
        <select value={entity} onChange={e => { setEntity(e.target.value); setPage(1) }}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
          <option value="">Todas las entidades</option>
          {ENTITIES.map(e2 => <option key={e2}>{e2}</option>)}
        </select>
        <select value={tenantId} onChange={e => { setTenantId(e.target.value); setPage(1) }}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white max-w-[220px]">
          <option value="">Todos los tenants</option>
          {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400">
              <th className="p-4 text-left font-medium">Fecha</th>
              <th className="p-4 text-left font-medium">Usuario</th>
              <th className="p-4 text-left font-medium">Tenant</th>
              <th className="p-4 text-left font-medium">Acción</th>
              <th className="p-4 text-left font-medium">Entidad</th>
              <th className="p-4 text-left font-medium">ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? Array.from({ length: 10 }).map((_, i) => (
              <tr key={i}><td colSpan={6} className="p-4"><div className="h-4 bg-gray-800 rounded animate-pulse" /></td></tr>
            )) : logs.length === 0 ? (
              <tr><td colSpan={6} className="p-12 text-center text-gray-500">Sin eventos.</td></tr>
            ) : logs.map(l => (
              <tr key={l.id} className="hover:bg-gray-800/30">
                <td className="p-4 text-gray-400 whitespace-nowrap">{formatDateTime(l.createdAt)}</td>
                <td className="p-4">
                  <p className="text-white">{l.user.name}</p>
                  <p className="text-gray-500 text-xs">{l.user.email}</p>
                </td>
                <td className="p-4">
                  {l.user.tenant ? (
                    <Link href={`/admin/tenants/${l.user.tenant.id}`} className="text-purple-300 hover:text-purple-200">
                      {l.user.tenant.name}
                    </Link>
                  ) : <span className="text-gray-500">—</span>}
                </td>
                <td className="p-4">
                  <span className="px-2 py-0.5 bg-purple-500/10 text-purple-300 rounded-full text-xs">{l.action}</span>
                </td>
                <td className="p-4 text-gray-300">{l.entity}</td>
                <td className="p-4 text-gray-500 font-mono text-xs">{l.entityId ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Página {page} de {pages}</p>
        <div className="flex gap-1">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
            className="p-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40">
            <ChevronLeft size={14} />
          </button>
          <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}
            className="p-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
