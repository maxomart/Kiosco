"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Search, Key, Loader2, Trash2 } from "lucide-react"
import toast from "react-hot-toast"
import { formatDate } from "@/lib/utils"
import Breadcrumbs from "@/components/admin/Breadcrumbs"
import PasswordModal from "@/components/admin/PasswordModal"

interface User {
  id: string
  name: string
  email: string
  role: string
  active: boolean
  createdAt: string
  tenant: { id: string; name: string; slug: string } | null
}

interface TenantOption { id: string; name: string }

const ROLES = ["CASHIER", "ADMIN", "OWNER", "SUPER_ADMIN"]

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [tenants, setTenants] = useState<TenantOption[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [role, setRole] = useState("")
  const [tenantId, setTenantId] = useState("")
  const [active, setActive] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [passwordReveal, setPasswordReveal] = useState<{ email: string; password: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      ...(search && { search }),
      ...(role && { role }),
      ...(tenantId && { tenantId }),
      ...(active && { active }),
    })
    try {
      const res = await fetch(`/api/admin/users?${params}`)
      if (res.ok) {
        const d = await res.json()
        setUsers(d.users || [])
        setTotal(d.total || 0)
      }
    } finally {
      setLoading(false)
    }
  }, [search, role, tenantId, active])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch("/api/admin/tenants?limit=500")
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setTenants(d.tenants))
      .catch(() => {})
  }, [])

  const toggleActive = async (u: User) => {
    setBusyId(u.id)
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !u.active }),
      })
      if (res.ok) { toast.success("Usuario actualizado"); load() }
      else toast.error("Error")
    } finally { setBusyId(null) }
  }

  const changeRole = async (u: User, newRole: string) => {
    setBusyId(u.id)
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      })
      if (res.ok) { toast.success("Rol actualizado"); load() }
      else toast.error("Error")
    } finally { setBusyId(null) }
  }

  const reset = async (u: User) => {
    if (!confirm(`¿Resetear contraseña de ${u.email}?`)) return
    setBusyId(u.id)
    try {
      const res = await fetch(`/api/admin/users/${u.id}/reset-password`, { method: "POST" })
      if (res.ok) setPasswordReveal(await res.json())
      else toast.error("Error")
    } finally { setBusyId(null) }
  }

  const remove = async (u: User) => {
    const tenantNote = u.tenant ? ` (${u.tenant.name})` : ""
    if (
      !confirm(
        `¿Borrar a ${u.name}${tenantNote}?\n\nEsto es irreversible. Si tiene ventas o caja asociadas, el sistema te lo va a impedir y tendrás que desactivarlo en su lugar.`
      )
    )
      return
    setBusyId(u.id)
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success("Usuario eliminado")
        load()
      } else {
        toast.error(data.error ?? "Error al borrar")
      }
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <Breadcrumbs items={[{ label: "Admin", href: "/admin" }, { label: "Usuarios" }]} />

      {passwordReveal && <PasswordModal {...passwordReveal} onClose={() => setPasswordReveal(null)} />}

      <div>
        <h1 className="text-2xl font-bold text-white">Usuarios</h1>
        <p className="text-gray-400 text-sm mt-1">{total} usuarios totales en la plataforma</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o email..."
            className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
        </div>
        <select value={role} onChange={e => setRole(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
          <option value="">Todos los roles</option>
          {ROLES.map(r => <option key={r}>{r}</option>)}
        </select>
        <select value={tenantId} onChange={e => setTenantId(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white max-w-[200px]">
          <option value="">Todos los tenants</option>
          {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={active} onChange={e => setActive(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
          <option value="">Activos e inactivos</option>
          <option value="true">Solo activos</option>
          <option value="false">Solo inactivos</option>
        </select>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400">
              <th className="p-4 text-left font-medium">Nombre</th>
              <th className="p-4 text-left font-medium">Email</th>
              <th className="p-4 text-left font-medium">Tenant</th>
              <th className="p-4 text-left font-medium">Rol</th>
              <th className="p-4 text-center font-medium">Activo</th>
              <th className="p-4 text-left font-medium">Alta</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? Array.from({ length: 8 }).map((_, i) => (
              <tr key={i}><td colSpan={7} className="p-4"><div className="h-4 bg-gray-800 rounded animate-pulse" /></td></tr>
            )) : users.length === 0 ? (
              <tr><td colSpan={7} className="p-12 text-center text-gray-500">No hay usuarios.</td></tr>
            ) : users.map(u => (
              <tr key={u.id} className="hover:bg-gray-800/30">
                <td className="p-4 text-white">{u.name}</td>
                <td className="p-4 text-gray-300">{u.email}</td>
                <td className="p-4">
                  {u.tenant ? (
                    <Link href={`/admin/tenants/${u.tenant.id}`} className="text-purple-300 hover:text-purple-200">
                      {u.tenant.name}
                    </Link>
                  ) : <span className="text-gray-500">—</span>}
                </td>
                <td className="p-4">
                  <select
                    value={u.role}
                    onChange={e => changeRole(u, e.target.value)}
                    disabled={busyId === u.id}
                    className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-blue-300"
                  >
                    {ROLES.map(r => <option key={r}>{r}</option>)}
                  </select>
                </td>
                <td className="p-4 text-center">
                  <button
                    disabled={busyId === u.id}
                    onClick={() => toggleActive(u)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${u.active ? "bg-green-500" : "bg-gray-600"}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition ${u.active ? "translate-x-5" : "translate-x-1"}`} />
                  </button>
                </td>
                <td className="p-4 text-gray-400">{formatDate(u.createdAt)}</td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      disabled={busyId === u.id}
                      onClick={() => reset(u)}
                      title="Resetear contraseña"
                      className="p-1.5 rounded-lg hover:bg-yellow-500/10 text-gray-400 hover:text-yellow-400 disabled:opacity-50"
                    >
                      {busyId === u.id ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
                    </button>
                    <button
                      disabled={busyId === u.id || u.role === "SUPER_ADMIN"}
                      onClick={() => remove(u)}
                      title={
                        u.role === "SUPER_ADMIN"
                          ? "No se puede borrar un super-admin desde acá"
                          : "Borrar usuario"
                      }
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
