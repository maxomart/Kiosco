"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Plus, Search, Edit2, Trash2, Users, Star, Phone, Mail, X, Lock, Wallet } from "lucide-react"
import { formatCurrency, formatDate, type Plan } from "@/lib/utils"
import { hasFeature } from "@/lib/permissions"
import { useConfirm } from "@/components/shared/ConfirmDialog"

interface Client {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  loyaltyPoints: number
  totalPurchases?: number
  creditLimit?: number
  currentBalance?: number
  active: boolean
  createdAt: string
  _count?: { sales: number }
}

interface ClientForm {
  name: string
  email: string
  phone: string
  address: string
  active: boolean
}

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [editClient, setEditClient] = useState<Client | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<ClientForm>({ name: "", email: "", phone: "", address: "", active: true })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [plan, setPlan] = useState<Plan>("FREE")
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false)
  const confirm = useConfirm()
  const PER_PAGE = 20

  useEffect(() => {
    fetch("/api/configuracion/suscripcion")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.subscription?.plan) setPlan(d.subscription.plan as Plan) })
      .catch(() => {})
    fetch("/api/configuracion")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.config?.loyaltyEnabled) setLoyaltyEnabled(true) })
      .catch(() => {})
  }, [])

  const loyaltyUnlocked = hasFeature(plan, "feature:loyalty")

  const load = useCallback(async () => {
    setLoading(true)
    // Backend GET /api/clientes currently returns { clients } without paging
    // or search; we paginate / filter client-side until that endpoint grows.
    const res = await fetch(`/api/clientes`)
    if (res.ok) {
      const d = await res.json()
      const all: Client[] = d.clients || []
      const filtered = search
        ? all.filter(c =>
            [c.name, c.email ?? "", c.phone ?? ""]
              .some(v => v.toLowerCase().includes(search.toLowerCase()))
          )
        : all
      setTotal(filtered.length)
      setClients(filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE))
    }
    setLoading(false)
  }, [page, search])

  useEffect(() => { load() }, [load])

  const openNew = () => {
    setEditClient(null)
    setForm({ name: "", email: "", phone: "", address: "", active: true })
    setErrors({})
    setShowModal(true)
  }

  const openEdit = (c: Client) => {
    setEditClient(c)
    setForm({ name: c.name, email: c.email || "", phone: c.phone || "", address: c.address || "", active: c.active })
    setErrors({})
    setShowModal(true)
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = "Nombre requerido"
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Email inválido"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    const body = { name: form.name.trim(), email: form.email || null, phone: form.phone || null, address: form.address || null, active: form.active }
    const res = await fetch(editClient ? `/api/clientes/${editClient.id}` : "/api/clientes", {
      method: editClient ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (res.ok) { setShowModal(false); await load() }
    else { const d = await res.json(); setErrors({ _global: d.error || "Error al guardar" }) }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "¿Eliminar cliente?",
      description: "Se borra del sistema. Sus compras pasadas quedan registradas.",
      confirmText: "Eliminar",
      tone: "danger",
    })
    if (!ok) return
    setDeleting(id)
    await fetch(`/api/clientes/${id}`, { method: "DELETE" })
    await load()
    setDeleting(null)
  }

  const totalPages = Math.ceil(total / PER_PAGE)
  const ccUnlocked = hasFeature(plan, "feature:custom_logo")
  const showBalance = clients.some((c) => (c.currentBalance ?? 0) > 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Clientes</h1>
          <p className="text-gray-400 text-sm mt-1">{total} clientes registrados · programa de fidelidad</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={loyaltyUnlocked ? "/clientes/fidelidad" : "/configuracion/suscripcion"}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              loyaltyUnlocked
                ? "bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
                : "bg-gray-800 hover:bg-gray-700 text-gray-400 border border-gray-700"
            }`}
            title={loyaltyUnlocked ? "Programa de fidelidad" : "Disponible en plan Professional+"}
          >
            {loyaltyUnlocked ? <Star size={14} /> : <Lock size={14} />} Fidelidad
          </Link>
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-colors">
            <Plus size={16} /> Nuevo cliente
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="Buscar por nombre, email, teléfono..."
          className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500" />
      </div>

      {/* Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="p-4 text-left text-gray-400 font-medium">Cliente</th>
              <th className="p-4 text-left text-gray-400 font-medium">Contacto</th>
              <th className="p-4 text-right text-gray-400 font-medium">Compras</th>
              <th className="p-4 text-right text-gray-400 font-medium">Total gastado</th>
              {loyaltyEnabled && <th className="p-4 text-right text-gray-400 font-medium">Puntos</th>}
              {showBalance && <th className="p-4 text-right text-gray-400 font-medium">Saldo cta cte</th>}
              <th className="p-4 text-left text-gray-400 font-medium">Cliente desde</th>
              <th className="p-4 text-center text-gray-400 font-medium">Estado</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}><td colSpan={(loyaltyEnabled ? 8 : 7) + (showBalance ? 1 : 0)} className="p-4"><div className="h-4 bg-gray-800 rounded animate-pulse" /></td></tr>
              ))
            ) : clients.length === 0 ? (
              <tr>
                <td colSpan={(loyaltyEnabled ? 8 : 7) + (showBalance ? 1 : 0)} className="p-12 text-center text-gray-500">
                  <Users size={40} className="mx-auto mb-3 opacity-30" />
                  <p>No hay clientes</p>
                  {!search && (
                    <button onClick={openNew} className="mt-2 text-purple-400 hover:text-purple-300 text-sm transition-colors">
                      + Agregar primer cliente
                    </button>
                  )}
                </td>
              </tr>
            ) : clients.map(c => (
              <tr key={c.id} className="hover:bg-gray-800/30 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-600/20 flex items-center justify-center text-purple-400 font-semibold text-sm">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white font-medium">{c.name}</p>
                      {c.address && <p className="text-gray-500 text-xs mt-0.5">{c.address}</p>}
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <div className="space-y-0.5">
                    {c.email && <div className="flex items-center gap-1.5 text-gray-400 text-xs"><Mail size={11} />{c.email}</div>}
                    {c.phone && <div className="flex items-center gap-1.5 text-gray-400 text-xs"><Phone size={11} />{c.phone}</div>}
                    {!c.email && !c.phone && <span className="text-gray-600">—</span>}
                  </div>
                </td>
                <td className="p-4 text-right text-gray-300">{c._count?.sales ?? 0}</td>
                <td className="p-4 text-right text-gray-300">{formatCurrency(c.totalPurchases ?? 0)}</td>
                {loyaltyEnabled && (
                  <td className="p-4 text-right">
                    {c.loyaltyPoints > 0 ? (
                      <span className="flex items-center justify-end gap-1 text-yellow-400">
                        <Star size={12} fill="currentColor" /> {c.loyaltyPoints}
                      </span>
                    ) : <span className="text-gray-600">0</span>}
                  </td>
                )}
                {showBalance && (
                  <td className="p-4 text-right">
                    {(c.currentBalance ?? 0) > 0 ? (
                      <span className="text-orange-400 font-medium">{formatCurrency(c.currentBalance ?? 0)}</span>
                    ) : <span className="text-gray-600">—</span>}
                  </td>
                )}
                <td className="p-4 text-gray-400">{formatDate(c.createdAt)}</td>
                <td className="p-4 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${c.active ? "bg-green-500/10 text-green-400" : "bg-gray-700 text-gray-500"}`}>
                    {c.active ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center justify-end gap-1">
                    {ccUnlocked && (
                      <Link href={`/clientes/${c.id}/cuenta-corriente`}
                        className="p-1.5 rounded-lg hover:bg-purple-500/10 text-gray-400 hover:text-purple-300 transition-colors"
                        title="Cuenta corriente">
                        <Wallet size={14} />
                      </Link>
                    )}
                    <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDelete(c.id)} disabled={deleting === c.id}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <span className="text-sm text-gray-500">{total} clientes</span>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 disabled:opacity-40 transition-colors">
                ← Anterior
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 disabled:opacity-40 transition-colors">
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h2 className="text-white font-semibold">{editClient ? "Editar cliente" : "Nuevo cliente"}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {errors._global && (
                <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{errors._global}</div>
              )}
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Nombre *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className={`w-full px-3 py-2.5 bg-gray-800 border rounded-lg text-white text-sm focus:outline-none focus:border-purple-500 ${errors.name ? "border-red-500" : "border-gray-700"}`} />
                {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className={`w-full px-3 py-2.5 bg-gray-800 border rounded-lg text-white text-sm focus:outline-none focus:border-purple-500 ${errors.email ? "border-red-500" : "border-gray-700"}`} />
                  {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Teléfono</label>
                  <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Dirección</label>
                <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500" />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <div onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                  className={`w-10 h-5 rounded-full transition-colors relative ${form.active ? "bg-purple-600" : "bg-gray-700"}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.active ? "left-5" : "left-0.5"}`} />
                </div>
                <span className="text-sm text-gray-300">Cliente activo</span>
              </label>
            </div>
            <div className="flex gap-3 p-5 border-t border-gray-800">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium transition-colors">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
                {saving ? "Guardando..." : editClient ? "Guardar cambios" : "Crear cliente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
