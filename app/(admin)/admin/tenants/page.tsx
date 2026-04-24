"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Search, Ban, Key, CheckCircle, Loader2, ExternalLink } from "lucide-react"
import toast from "react-hot-toast"
import { formatDate, PLAN_LABELS } from "@/lib/utils"
import Breadcrumbs from "@/components/admin/Breadcrumbs"
import SortHeader from "@/components/admin/SortHeader"
import PasswordModal from "@/components/admin/PasswordModal"

interface Tenant {
  id: string
  name: string
  slug: string
  active: boolean
  createdAt: string
  config?: { businessType: string | null } | null
  subscription: { plan: string; status: string } | null
  users?: { phone: string | null; email: string; name: string }[]
  _count: { users: number; products: number; sales: number }
}

const PLANS = ["FREE", "STARTER", "PROFESSIONAL", "BUSINESS", "ENTERPRISE"] as const

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [planFilter, setPlanFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [sort, setSort] = useState("createdAt")
  const [dir, setDir] = useState<"asc" | "desc">("desc")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [passwordReveal, setPasswordReveal] = useState<{ email: string; password: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      ...(search && { search }),
      ...(planFilter && { plan: planFilter }),
      ...(statusFilter && { status: statusFilter }),
      sort,
      dir,
    })
    try {
      const res = await fetch(`/api/admin/tenants?${params}`)
      if (res.ok) {
        const d = await res.json()
        setTenants(d.tenants || [])
        setTotal(d.total || 0)
      }
    } finally {
      setLoading(false)
    }
  }, [search, planFilter, statusFilter, sort, dir])

  useEffect(() => {
    load()
  }, [load])

  const onSort = (field: string) => {
    if (sort === field) setDir(dir === "asc" ? "desc" : "asc")
    else { setSort(field); setDir("desc") }
  }

  const handleToggle = async (t: Tenant) => {
    if (!confirm(`¿${t.active ? "Desactivar" : "Activar"} "${t.name}"?`)) return
    setBusyId(t.id)
    try {
      const res = await fetch(`/api/admin/tenants/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !t.active }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || "Error al actualizar")
      } else {
        toast.success(t.active ? "Tenant desactivado" : "Tenant activado")
        await load()
      }
    } catch {
      toast.error("Error de red")
    } finally {
      setBusyId(null)
    }
  }

  const handlePlanChange = async (t: Tenant, plan: string) => {
    setBusyId(t.id)
    try {
      const res = await fetch(`/api/admin/tenants/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || "Error al cambiar plan")
      } else {
        toast.success(`Plan actualizado a ${PLAN_LABELS[plan as keyof typeof PLAN_LABELS]}`)
        await load()
      }
    } finally {
      setBusyId(null)
    }
  }

  const handleResetPassword = async (t: Tenant) => {
    if (!confirm(`¿Resetear contraseña del owner de "${t.name}"?`)) return
    setBusyId(t.id)
    try {
      const res = await fetch(`/api/admin/tenants/${t.id}/reset-password`, { method: "POST" })
      if (res.ok) {
        setPasswordReveal(await res.json())
      } else {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || "Error al resetear contraseña")
      }
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <Breadcrumbs items={[{ label: "Admin", href: "/admin" }, { label: "Tenants" }]} />

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Tenants</h1>
          <p className="text-gray-400 text-sm mt-1">{total} cuentas totales</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o slug..."
            className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
        </div>
        <select
          value={planFilter}
          onChange={e => setPlanFilter(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
        >
          <option value="">Todos los planes</option>
          {PLANS.map(p => <option key={p} value={p}>{PLAN_LABELS[p]}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
        >
          <option value="">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
          <option value="trialing">En prueba</option>
        </select>
      </div>

      {passwordReveal && (
        <PasswordModal {...passwordReveal} onClose={() => setPasswordReveal(null)} />
      )}

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <SortHeader label="Negocio" field="name" sort={sort} dir={dir} onSort={onSort} />
              <th className="p-4 text-left text-gray-400 font-medium">Celular</th>
              <th className="p-4 text-left text-gray-400 font-medium">Plan</th>
              <SortHeader label="Usuarios" field="users" sort={sort} dir={dir} onSort={onSort} align="right" />
              <th className="p-4 text-right text-gray-400 font-medium">Productos</th>
              <SortHeader label="Ventas" field="sales" sort={sort} dir={dir} onSort={onSort} align="right" />
              <SortHeader label="Alta" field="createdAt" sort={sort} dir={dir} onSort={onSort} />
              <th className="p-4 text-center text-gray-400 font-medium">Estado</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={9} className="p-4">
                    <div className="h-4 bg-gray-800 rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : tenants.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-12 text-center text-gray-500">
                  No hay tenants que coincidan con los filtros.
                </td>
              </tr>
            ) : (
              tenants.map(t => (
                <tr key={t.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="p-4">
                    <Link href={`/admin/tenants/${t.id}`} className="text-white font-medium hover:text-purple-300">
                      {t.name}
                    </Link>
                    <p className="text-gray-500 text-xs mt-0.5">{t.slug} · {t.config?.businessType ?? "—"}</p>
                  </td>
                  <td className="p-4">
                    {t.users?.[0]?.phone ? (
                      <a
                        href={`https://wa.me/${t.users[0].phone.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-emerald-400 hover:text-emerald-300"
                      >
                        {t.users[0].phone}
                      </a>
                    ) : (
                      <span className="text-xs text-gray-600">—</span>
                    )}
                  </td>
                  <td className="p-4">
                    <select
                      value={t.subscription?.plan ?? "FREE"}
                      onChange={e => handlePlanChange(t, e.target.value)}
                      disabled={busyId === t.id}
                      className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-purple-300 focus:outline-none focus:border-purple-500"
                    >
                      {PLANS.map(p => <option key={p} value={p}>{PLAN_LABELS[p]}</option>)}
                    </select>
                  </td>
                  <td className="p-4 text-right text-gray-300">{t._count.users}</td>
                  <td className="p-4 text-right text-gray-300">{t._count.products}</td>
                  <td className="p-4 text-right text-gray-300">{t._count.sales}</td>
                  <td className="p-4 text-gray-400">{formatDate(t.createdAt)}</td>
                  <td className="p-4 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${
                        t.active ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                      }`}
                    >
                      {t.active ? "Activo" : "Desactivado"}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/admin/tenants/${t.id}`}
                        title="Ver detalle"
                        className="p-1.5 rounded-lg hover:bg-purple-500/10 text-gray-400 hover:text-purple-400 transition-colors"
                      >
                        <ExternalLink size={14} />
                      </Link>
                      <button
                        onClick={() => handleResetPassword(t)}
                        disabled={busyId === t.id}
                        title="Resetear contraseña"
                        className="p-1.5 rounded-lg hover:bg-yellow-500/10 text-gray-400 hover:text-yellow-400 transition-colors disabled:opacity-50"
                      >
                        {busyId === t.id ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
                      </button>
                      <button
                        onClick={() => handleToggle(t)}
                        disabled={busyId === t.id}
                        title={t.active ? "Desactivar" : "Activar"}
                        className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                          t.active ? "hover:bg-red-500/10 text-gray-400 hover:text-red-400" : "hover:bg-green-500/10 text-gray-400 hover:text-green-400"
                        }`}
                      >
                        {busyId === t.id ? <Loader2 size={14} className="animate-spin" /> : t.active ? <Ban size={14} /> : <CheckCircle size={14} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
