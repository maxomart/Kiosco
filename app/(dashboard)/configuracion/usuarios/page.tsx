"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, Mail, UserCheck, UserX, X, Copy, Loader2, AlertCircle } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { useConfirm } from "@/components/shared/ConfirmDialog"
import toast from "react-hot-toast"

interface User {
  id: string
  name: string | null
  email: string
  role: "OWNER" | "ADMIN" | "CASHIER"
  active: boolean
  createdAt: string
  lastLoginAt: string | null
}

const ROLE_LABELS: Record<string, string> = { OWNER: "Dueño", ADMIN: "Admin", CASHIER: "Cajero" }
const ROLE_COLORS: Record<string, string> = {
  OWNER: "bg-amber-500/10 text-amber-400",
  ADMIN: "bg-accent-soft text-accent",
  CASHIER: "bg-gray-700/60 text-gray-300",
}

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [acting, setActing] = useState<string | null>(null)
  const [form, setForm] = useState({ name: "", email: "", role: "CASHIER" as User["role"] })
  const [newUserCreds, setNewUserCreds] = useState<{ email: string; password: string } | null>(null)
  const [limitError, setLimitError] = useState<string | null>(null)
  const confirm = useConfirm()

  const load = async () => {
    setLoading(true)
    const res = await fetch("/api/configuracion/usuarios")
    if (res.ok) { const d = await res.json(); setUsers(d.users || []) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) return
    setSaving(true)
    setLimitError(null)
    const res = await fetch("/api/configuracion/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const d = await res.json()
      setNewUserCreds({ email: d.email, password: d.password })
      setShowModal(false)
      setForm({ name: "", email: "", role: "CASHIER" })
      await load()
    } else {
      const d = await res.json()
      setLimitError(d.error || "Error al crear usuario")
    }
    setSaving(false)
  }

  const handleToggleActive = async (user: User) => {
    const activating = !user.active
    const ok = await confirm({
      title: activating ? "¿Reactivar usuario?" : "¿Desactivar usuario?",
      description: activating
        ? `${user.name || user.email} va a poder volver a iniciar sesión.`
        : `${user.name || user.email} ya no va a poder iniciar sesión. Podés reactivarlo cuando quieras.`,
      confirmText: activating ? "Reactivar" : "Desactivar",
      tone: activating ? "accent" : "warning",
    })
    if (!ok) return
    setActing(user.id + ":toggle")
    const res = await fetch(`/api/configuracion/usuarios/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: activating }),
    })
    if (res.ok) {
      toast.success(activating ? "Usuario reactivado." : "Usuario desactivado.")
      await load()
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error || "No se pudo actualizar")
    }
    setActing(null)
  }

  const handleDelete = async (user: User) => {
    const ok = await confirm({
      title: "¿Eliminar usuario permanentemente?",
      description: `Se eliminará ${user.name || user.email} y todos sus datos. Esta acción no se puede deshacer.`,
      confirmText: "Eliminar",
      tone: "danger",
    })
    if (!ok) return
    setActing(user.id + ":delete")
    const res = await fetch(`/api/configuracion/usuarios/${user.id}`, { method: "DELETE" })
    if (res.ok) {
      toast.success("Usuario eliminado.")
      await load()
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error || "No se pudo eliminar")
    }
    setActing(null)
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Usuarios y permisos</h1>
          <p className="text-gray-400 text-sm mt-1">{users.filter(u => u.active).length} usuarios activos</p>
        </div>
        <button
          onClick={() => { setLimitError(null); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-accent-foreground text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Nuevo usuario
        </button>
      </div>

      {/* New credentials modal */}
      {newUserCreds && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 max-w-md w-full">
            <h3 className="text-white font-semibold text-lg mb-3">Usuario creado</h3>
            <p className="text-gray-400 text-sm mb-4">Compartí estas credenciales con el usuario. No podrás verlas otra vez.</p>
            <div className="bg-gray-800 rounded-lg p-3 mb-3">
              <p className="text-xs text-gray-500 mb-1">Email</p>
              <p className="text-white font-mono text-sm">{newUserCreds.email}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-3 mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">Contraseña</p>
                <p className="text-white font-mono text-sm">{newUserCreds.password}</p>
              </div>
              <button
                onClick={() => { navigator.clipboard.writeText(newUserCreds.password); toast.success("Copiado") }}
                className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              >
                <Copy size={16} />
              </button>
            </div>
            <button
              onClick={() => setNewUserCreds(null)}
              className="w-full py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-accent-foreground font-semibold transition-colors"
            >
              Listo
            </button>
          </div>
        </div>
      )}

      {/* Users table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="p-4 text-left text-gray-400 font-medium">Usuario</th>
              <th className="p-4 text-left text-gray-400 font-medium">Rol</th>
              <th className="p-4 text-left text-gray-400 font-medium hidden sm:table-cell">Último ingreso</th>
              <th className="p-4 text-center text-gray-400 font-medium">Estado</th>
              <th className="p-4 text-right text-gray-400 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={5} className="p-4">
                      <div className="h-4 bg-gray-800 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              : users.map(u => (
                  <tr key={u.id} className={`hover:bg-gray-800/30 transition-colors ${!u.active ? "opacity-60" : ""}`}>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-accent-soft border border-accent/20 flex items-center justify-center text-accent font-semibold text-sm flex-shrink-0">
                          {(u.name || u.email).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white font-medium">{u.name || "—"}</p>
                          <p className="text-gray-500 text-xs">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role]}`}>
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td className="p-4 text-gray-400 hidden sm:table-cell">
                      {u.lastLoginAt ? formatDate(u.lastLoginAt) : "Nunca"}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.active
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-gray-700/60 text-gray-500"
                      }`}>
                        {u.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="p-4">
                      {(() => {
                        // Last-owner rule: if this is the only active OWNER,
                        // hide destructive actions entirely so the UI matches
                        // what the backend will accept. Users can still click
                        // on another owner once they exist.
                        const activeOwners = users.filter(x => x.role === "OWNER" && x.active)
                        const isLastOwner = u.role === "OWNER" && activeOwners.length <= 1
                        if (isLastOwner) {
                          return (
                            <p className="text-[11px] text-gray-500 text-right italic">
                              Único dueño — creá otro para poder editar
                            </p>
                          )
                        }
                        return (
                          <div className="flex items-center gap-1 justify-end">
                            {/* Toggle active */}
                            <button
                              onClick={() => handleToggleActive(u)}
                              disabled={acting === u.id + ":toggle"}
                              title={u.active ? "Desactivar" : "Reactivar"}
                              className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                                u.active
                                  ? "hover:bg-amber-500/10 text-gray-400 hover:text-amber-400"
                                  : "hover:bg-emerald-500/10 text-gray-400 hover:text-emerald-400"
                              }`}
                            >
                              {acting === u.id + ":toggle"
                                ? <Loader2 size={14} className="animate-spin" />
                                : u.active
                                ? <UserX size={14} />
                                : <UserCheck size={14} />
                              }
                            </button>
                            {/* Hard delete */}
                            <button
                              onClick={() => handleDelete(u)}
                              disabled={acting === u.id + ":delete"}
                              title="Eliminar permanentemente"
                              className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
                            >
                              {acting === u.id + ":delete"
                                ? <Loader2 size={14} className="animate-spin" />
                                : <Trash2 size={14} />
                              }
                            </button>
                          </div>
                        )
                      })()}
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>

      {/* Create user modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h2 className="text-white font-semibold">Nuevo usuario</h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-gray-800 text-gray-400">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {limitError && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" /> {limitError}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Nombre *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-black/40 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-black/40 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Rol</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value as User["role"] }))}
                  className="w-full px-3 py-2.5 bg-black/40 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                >
                  <option value="CASHIER">Cajero — solo POS y caja</option>
                  <option value="ADMIN">Admin — acceso total (sin billing)</option>
                  <option value="OWNER">Dueño — acceso total + billing</option>
                </select>
                {form.role === "OWNER" && (
                  <p className="text-[11px] text-amber-400/80 mt-1.5 leading-relaxed">
                    ⚠️ Los dueños tienen acceso total, pueden cancelar la suscripción y eliminar usuarios. Usalo solo con gente de máxima confianza.
                  </p>
                )}
              </div>
              <p className="text-xs text-gray-500">Se generará una contraseña aleatoria que podés compartir con el usuario.</p>
            </div>
            <div className="flex gap-3 p-5 border-t border-gray-800">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim() || !form.email.trim()}
                className="flex-1 py-2.5 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-50 text-accent-foreground text-sm font-semibold transition-colors"
              >
                {saving ? "Creando..." : "Crear usuario"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
