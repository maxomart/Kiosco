"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, Edit2, Ban, Key, CheckCircle, XCircle, Loader2, Copy } from "lucide-react"
import { formatDate, PLAN_LABELS } from "@/lib/utils"

interface Tenant {
  id: string
  name: string
  slug: string
  active: boolean
  createdAt: string
  config?: { businessType: string | null } | null
  subscription: { plan: string; status: string } | null
  _count: { users: number; products: number; sales: number }
}

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [resettingId, setResettingId] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState<{ email: string; password: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ ...(search && { search }) })
    const res = await fetch(`/api/admin/tenants?${params}`)
    if (res.ok) { const d = await res.json(); setTenants(d.tenants || []); setTotal(d.total || 0) }
    setLoading(false)
  }, [search])

  useEffect(() => { load() }, [load])

  const handleToggle = async (t: Tenant) => {
    if (!confirm(`¿${t.active ? "Desactivar" : "Activar"} "${t.name}"?`)) return
    setTogglingId(t.id)
    await fetch(`/api/admin/tenants/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !t.active }),
    })
    await load()
    setTogglingId(null)
  }

  const handleResetPassword = async (t: Tenant) => {
    if (!confirm(`¿Resetear contraseña del owner de "${t.name}"?`)) return
    setResettingId(t.id)
    const res = await fetch(`/api/admin/tenants/${t.id}/reset-password`, { method: "POST" })
    if (res.ok) { setNewPassword(await res.json()) }
    setResettingId(null)
  }

  const copyPw = () => {
    if (newPassword) navigator.clipboard.writeText(newPassword.password)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tenants</h1>
          <p className="text-gray-400 text-sm mt-1">{total} cuentas totales</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre o slug..."
          className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
      </div>

      {/* Password reveal modal */}
      {newPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 max-w-md w-full">
            <h3 className="text-white font-semibold text-lg mb-3">Contraseña nueva generada</h3>
            <p className="text-gray-400 text-sm mb-4">Compartí esta contraseña de forma segura con el usuario. No podrás verla otra vez.</p>
            <div className="bg-gray-800 rounded-lg p-3 mb-3">
              <p className="text-xs text-gray-500 mb-1">Email</p>
              <p className="text-white font-mono">{newPassword.email}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-3 mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">Contraseña</p>
                <p className="text-white font-mono">{newPassword.password}</p>
              </div>
              <button onClick={copyPw} className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
                <Copy size={16} />
              </button>
            </div>
            <button onClick={() => setNewPassword(null)}
              className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-colors">
              Listo
            </button>
          </div>
        </div>
      )}

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="p-4 text-left text-gray-400 font-medium">Negocio</th>
              <th className="p-4 text-left text-gray-400 font-medium">Plan</th>
              <th className="p-4 text-right text-gray-400 font-medium">Usuarios</th>
              <th className="p-4 text-right text-gray-400 font-medium">Productos</th>
              <th className="p-4 text-right text-gray-400 font-medium">Ventas</th>
              <th className="p-4 text-left text-gray-400 font-medium">Alta</th>
              <th className="p-4 text-center text-gray-400 font-medium">Estado</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}><td colSpan={8} className="p-4"><div className="h-4 bg-gray-800 rounded animate-pulse" /></td></tr>
            )) : tenants.map(t => (
              <tr key={t.id} className="hover:bg-gray-800/30 transition-colors">
                <td className="p-4">
                  <p className="text-white font-medium">{t.name}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{t.slug} · {t.config?.businessType ?? "—"}</p>
                </td>
                <td className="p-4">
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 text-xs">
                    {PLAN_LABELS[t.subscription?.plan as keyof typeof PLAN_LABELS ?? "FREE"]}
                  </span>
                </td>
                <td className="p-4 text-right text-gray-300">{t._count.users}</td>
                <td className="p-4 text-right text-gray-300">{t._count.products}</td>
                <td className="p-4 text-right text-gray-300">{t._count.sales}</td>
                <td className="p-4 text-gray-400">{formatDate(t.createdAt)}</td>
                <td className="p-4 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${t.active ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                    {t.active ? "Activo" : "Desactivado"}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => handleResetPassword(t)} disabled={resettingId === t.id}
                      title="Resetear contraseña"
                      className="p-1.5 rounded-lg hover:bg-yellow-500/10 text-gray-400 hover:text-yellow-400 transition-colors disabled:opacity-50">
                      {resettingId === t.id ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
                    </button>
                    <button onClick={() => handleToggle(t)} disabled={togglingId === t.id}
                      title={t.active ? "Desactivar" : "Activar"}
                      className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                        t.active ? "hover:bg-red-500/10 text-gray-400 hover:text-red-400" : "hover:bg-green-500/10 text-gray-400 hover:text-green-400"
                      }`}>
                      {togglingId === t.id ? <Loader2 size={14} className="animate-spin" /> : t.active ? <Ban size={14} /> : <CheckCircle size={14} />}
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
