"use client"

import { useState, useEffect } from "react"
import {
  Plus, Store, Users, Package, ShoppingCart, Check, Copy,
  Eye, EyeOff, Power, PowerOff, Loader2, X, RefreshCw,
  Mail, Key, Calendar, BarChart3, ChevronRight, User, AlertTriangle
} from "lucide-react"
import toast from "react-hot-toast"
import { cn } from "@/lib/utils"

interface Tenant {
  id: string
  name: string
  slug: string
  active: boolean
  createdAt: string
  _count: { users: number; products: number; sales: number }
}

interface TenantDetail {
  id: string
  name: string
  slug: string
  active: boolean
  createdAt: string
  users: { id: string; name: string; email: string; role: string; active: boolean; createdAt: string }[]
  _count: { products: number; sales: number; clients: number }
}

interface NewTenantCredentials {
  tenantName: string
  email: string
  password: string
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Dueño",
  ADMIN: "Administrador",
  CASHIER: "Cajero/a",
}

export default function AdminPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [credentials, setCredentials] = useState<NewTenantCredentials | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({ name: "", ownerName: "", ownerEmail: "" })

  // Modal detalle
  const [selectedTenant, setSelectedTenant] = useState<TenantDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [resettingUserId, setResettingUserId] = useState<string | null>(null)
  const [resetResult, setResetResult] = useState<{ userId: string; password: string } | null>(null)
  const [showResetPassword, setShowResetPassword] = useState(false)

  const loadTenants = async () => {
    try {
      const r = await fetch("/api/admin/tenants")
      if (r.ok) {
        const data = await r.json()
        setTenants(data.tenants)
      }
    } catch {
      toast.error("Error cargando kioscos")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadTenants() }, [])

  const openDetail = async (tenantId: string) => {
    setLoadingDetail(true)
    setSelectedTenant(null)
    setResetResult(null)
    try {
      const r = await fetch(`/api/admin/tenants/${tenantId}`)
      if (r.ok) {
        const data = await r.json()
        setSelectedTenant(data.tenant)
      } else {
        toast.error("Error cargando detalle")
      }
    } catch {
      toast.error("Error de conexión")
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      const r = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await r.json()
      if (!r.ok) { toast.error(data.error ?? "Error"); return }
      setCredentials({ tenantName: data.tenant.name, email: data.credentials.email, password: data.credentials.password })
      setShowCreate(false)
      setForm({ name: "", ownerName: "", ownerEmail: "" })
      loadTenants()
    } catch {
      toast.error("Error de conexión")
    } finally {
      setCreating(false)
    }
  }

  const toggleTenant = async (id: string, active: boolean) => {
    try {
      const r = await fetch(`/api/admin/tenants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      })
      if (r.ok) {
        setTenants(prev => prev.map(t => t.id === id ? { ...t, active } : t))
        if (selectedTenant?.id === id) setSelectedTenant(prev => prev ? { ...prev, active } : prev)
        toast.success(active ? "Kiosco activado" : "Kiosco desactivado")
      }
    } catch { toast.error("Error") }
  }

  const resetPassword = async (userId: string) => {
    setResettingUserId(userId)
    setResetResult(null)
    try {
      const r = await fetch(`/api/admin/tenants/${selectedTenant!.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      })
      const data = await r.json()
      if (r.ok) {
        setResetResult({ userId, password: data.password })
        setShowResetPassword(true)
        toast.success("Contraseña reseteada")
      } else {
        toast.error(data.error ?? "Error")
      }
    } catch { toast.error("Error") } finally { setResettingUserId(null) }
  }

  const copy = (text: string, label = "Copiado") => {
    navigator.clipboard.writeText(text)
    toast.success(label)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Kioscos</h1>
          <p className="text-gray-400 text-sm mt-1">{tenants.length} kioscos registrados</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-5 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-bold transition"
        >
          <Plus size={18} /> Nuevo kiosco
        </button>
      </div>

      {/* Credenciales recién creadas */}
      {credentials && (
        <div className="mb-6 bg-green-900/30 border border-green-700 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Check size={18} className="text-green-400" />
              <h3 className="text-green-400 font-bold">¡Kiosco "{credentials.tenantName}" creado!</h3>
            </div>
            <button onClick={() => setCredentials(null)} className="text-gray-400 hover:text-white"><X size={18} /></button>
          </div>
          <p className="text-yellow-400 text-sm mb-4 font-medium">Guardá estas credenciales. No se vuelven a mostrar.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-gray-800 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">Email</p>
              <div className="flex items-center justify-between">
                <code className="text-white text-sm">{credentials.email}</code>
                <button onClick={() => copy(credentials.email)} className="text-gray-400 hover:text-white ml-2"><Copy size={14} /></button>
              </div>
            </div>
            <div className="bg-gray-800 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">Contraseña</p>
              <div className="flex items-center justify-between">
                <code className="text-white text-sm font-mono">
                  {showPassword ? credentials.password : "•".repeat(credentials.password.length)}
                </code>
                <div className="flex gap-1 ml-2">
                  <button onClick={() => setShowPassword(!showPassword)} className="text-gray-400 hover:text-white">
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button onClick={() => copy(credentials.password)} className="text-gray-400 hover:text-white"><Copy size={14} /></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lista de kioscos */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tenants.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <Store size={64} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg">No hay kioscos registrados</p>
          <p className="text-sm mt-1">Creá el primero con el botón de arriba</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tenants.map(tenant => (
            <button
              key={tenant.id}
              onClick={() => openDetail(tenant.id)}
              className={cn(
                "bg-gray-900 border rounded-2xl p-5 transition text-left w-full hover:border-purple-500 hover:bg-gray-800/80 group",
                tenant.active ? "border-gray-700" : "border-gray-800 opacity-60"
              )}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", tenant.active ? "bg-blue-600" : "bg-gray-700")}>
                    <Store size={20} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold">{tenant.name}</h3>
                    <p className="text-gray-500 text-xs font-mono">{tenant.slug}</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-gray-600 group-hover:text-purple-400 transition mt-1" />
              </div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-gray-800 rounded-xl p-2 text-center">
                  <Users size={14} className="mx-auto text-blue-400 mb-1" />
                  <p className="text-white text-sm font-bold">{tenant._count.users}</p>
                  <p className="text-gray-500 text-xs">usuarios</p>
                </div>
                <div className="bg-gray-800 rounded-xl p-2 text-center">
                  <Package size={14} className="mx-auto text-green-400 mb-1" />
                  <p className="text-white text-sm font-bold">{tenant._count.products}</p>
                  <p className="text-gray-500 text-xs">productos</p>
                </div>
                <div className="bg-gray-800 rounded-xl p-2 text-center">
                  <ShoppingCart size={14} className="mx-auto text-purple-400 mb-1" />
                  <p className="text-white text-sm font-bold">{tenant._count.sales}</p>
                  <p className="text-gray-500 text-xs">ventas</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium", tenant.active ? "bg-green-900/30 text-green-400" : "bg-gray-800 text-gray-500")}>
                  {tenant.active ? "Activo" : "Desactivado"}
                </span>
                <span className="text-gray-500 text-xs">{new Date(tenant.createdAt).toLocaleDateString("es-AR")}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ===== MODAL DETALLE DEL KIOSCO ===== */}
      {(loadingDetail || selectedTenant) && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-start justify-end">
          <div className="h-full w-full max-w-lg bg-gray-900 border-l border-gray-800 flex flex-col overflow-hidden">
            {/* Header del panel */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
                  <Store size={18} className="text-white" />
                </div>
                <div>
                  <h2 className="text-white font-bold">{selectedTenant?.name ?? "Cargando..."}</h2>
                  {selectedTenant && <p className="text-gray-500 text-xs font-mono">{selectedTenant.slug}</p>}
                </div>
              </div>
              <button onClick={() => { setSelectedTenant(null); setResetResult(null) }} className="text-gray-400 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            {loadingDetail ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 size={32} className="text-purple-500 animate-spin" />
              </div>
            ) : selectedTenant ? (
              <div className="flex-1 overflow-y-auto p-6 space-y-6">

                {/* Estado y acciones */}
                <div className="flex items-center gap-3">
                  <span className={cn("flex-1 text-sm px-3 py-2 rounded-xl font-medium text-center", selectedTenant.active ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400")}>
                    {selectedTenant.active ? "Activo" : "Desactivado"}
                  </span>
                  <button
                    onClick={() => toggleTenant(selectedTenant.id, !selectedTenant.active)}
                    className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition", selectedTenant.active ? "bg-red-900/30 text-red-400 hover:bg-red-900/50" : "bg-green-900/30 text-green-400 hover:bg-green-900/50")}
                  >
                    {selectedTenant.active ? <><PowerOff size={14} /> Desactivar</> : <><Power size={14} /> Activar</>}
                  </button>
                </div>

                {/* Estadísticas */}
                <div>
                  <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <BarChart3 size={14} /> Estadísticas
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-800 rounded-xl p-3 text-center">
                      <Package size={16} className="mx-auto text-green-400 mb-1.5" />
                      <p className="text-white font-bold text-lg">{selectedTenant._count.products}</p>
                      <p className="text-gray-500 text-xs">Productos</p>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-3 text-center">
                      <ShoppingCart size={16} className="mx-auto text-purple-400 mb-1.5" />
                      <p className="text-white font-bold text-lg">{selectedTenant._count.sales}</p>
                      <p className="text-gray-500 text-xs">Ventas</p>
                    </div>
                    <div className="bg-gray-800 rounded-xl p-3 text-center">
                      <Users size={16} className="mx-auto text-blue-400 mb-1.5" />
                      <p className="text-white font-bold text-lg">{selectedTenant._count.clients}</p>
                      <p className="text-gray-500 text-xs">Clientes</p>
                    </div>
                  </div>
                </div>

                {/* Usuarios / Credenciales */}
                <div>
                  <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <Users size={14} /> Usuarios y credenciales
                  </h3>
                  <div className="space-y-3">
                    {selectedTenant.users.map(user => (
                      <div key={user.id} className="bg-gray-800 rounded-xl p-4">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                              <User size={14} className="text-gray-400" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-white text-sm font-semibold truncate">{user.name}</p>
                              <p className="text-xs text-gray-500">{ROLE_LABELS[user.role] ?? user.role}</p>
                            </div>
                          </div>
                          <span className={cn("text-xs px-2 py-0.5 rounded-full flex-shrink-0", user.active ? "bg-green-900/30 text-green-400" : "bg-gray-700 text-gray-500")}>
                            {user.active ? "Activo" : "Inactivo"}
                          </span>
                        </div>

                        {/* Email */}
                        <div className="flex items-center gap-2 mb-2 bg-gray-700/50 rounded-lg px-3 py-2">
                          <Mail size={13} className="text-gray-400 flex-shrink-0" />
                          <code className="text-gray-200 text-xs flex-1 truncate">{user.email}</code>
                          <button onClick={() => copy(user.email, "Email copiado")} className="text-gray-400 hover:text-white flex-shrink-0">
                            <Copy size={13} />
                          </button>
                        </div>

                        {/* Reset password de este usuario */}
                        {resetResult?.userId === user.id && showResetPassword ? (
                          <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg px-3 py-2 flex items-center gap-2">
                            <Key size={13} className="text-yellow-400 flex-shrink-0" />
                            <code className="text-yellow-200 text-xs flex-1 font-mono">{resetResult.password}</code>
                            <button onClick={() => copy(resetResult.password, "Contraseña copiada")} className="text-yellow-400 hover:text-white flex-shrink-0">
                              <Copy size={13} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => resetPassword(user.id)}
                            disabled={resettingUserId === user.id}
                            className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-orange-400 hover:bg-orange-900/20 rounded-lg py-1.5 transition disabled:opacity-50"
                          >
                            {resettingUserId === user.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <RefreshCw size={12} />
                            )}
                            Resetear contraseña
                          </button>
                        )}

                        <div className="flex items-center gap-1 mt-2 text-gray-600">
                          <Calendar size={11} />
                          <span className="text-xs">Creado {new Date(user.createdAt).toLocaleDateString("es-AR")}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Info del kiosco */}
                <div>
                  <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <Store size={14} /> Info
                  </h3>
                  <div className="bg-gray-800 rounded-xl divide-y divide-gray-700">
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-gray-400 text-sm">Nombre</span>
                      <span className="text-white text-sm font-medium">{selectedTenant.name}</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-gray-400 text-sm">Slug / ID</span>
                      <div className="flex items-center gap-1.5">
                        <code className="text-gray-300 text-xs font-mono">{selectedTenant.slug}</code>
                        <button onClick={() => copy(selectedTenant.id)} className="text-gray-600 hover:text-gray-400"><Copy size={12} /></button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-gray-400 text-sm">Creado</span>
                      <span className="text-gray-300 text-sm">{new Date(selectedTenant.createdAt).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}</span>
                    </div>
                  </div>
                </div>

                {/* Advertencia al desactivar */}
                {!selectedTenant.active && (
                  <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 flex gap-3">
                    <AlertTriangle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-red-300 text-sm">Este kiosco está desactivado. Sus usuarios no pueden iniciar sesión.</p>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ===== MODAL CREAR KIOSCO ===== */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-3xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <h2 className="text-white font-bold text-lg">Crear nuevo kiosco</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {[
                { label: "Nombre del kiosco *", key: "name", placeholder: "ej: Kiosco El Pibe", type: "text" },
                { label: "Nombre del dueño *", key: "ownerName", placeholder: "ej: Juan Pérez", type: "text" },
                { label: "Email del dueño *", key: "ownerEmail", placeholder: "ej: juan@kiosco.com", type: "email" },
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{field.label}</label>
                  <input
                    required
                    type={field.type}
                    value={(form as any)[field.key]}
                    onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 outline-none focus:border-purple-500 transition text-sm"
                  />
                </div>
              ))}
              <p className="text-gray-500 text-xs">Se generará automáticamente una contraseña segura de 18 caracteres.</p>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-semibold transition text-sm">
                  Cancelar
                </button>
                <button type="submit" disabled={creating} className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white rounded-xl font-bold transition text-sm flex items-center justify-center gap-2">
                  {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  {creating ? "Creando..." : "Crear kiosco"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
