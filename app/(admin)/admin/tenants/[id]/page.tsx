"use client"

import { useState, useEffect, useCallback, use } from "react"
import {
  Building2,
  Users,
  ShoppingBag,
  DollarSign,
  Activity,
  AlertTriangle,
  Loader2,
  Key,
  Ban,
  CheckCircle,
  ExternalLink,
  Trash2,
} from "lucide-react"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"
import { formatCurrency, formatDate, formatDateTime, PLAN_LABELS, PLAN_LIMITS, type Plan } from "@/lib/utils"
import Breadcrumbs from "@/components/admin/Breadcrumbs"
import PasswordModal from "@/components/admin/PasswordModal"

interface TenantDetail {
  id: string
  name: string
  slug: string
  active: boolean
  createdAt: string
  updatedAt: string
  config: {
    businessType: string | null
    taxId: string | null
    phone: string | null
    email: string | null
  } | null
  subscription: {
    id: string
    plan: string
    status: string
    billingCycle: string
    priceUSD: string | number
    currentPeriodStart: string | null
    currentPeriodEnd: string | null
    cancelledAt: string | null
    invoices: {
      id: string
      number: string
      amount: string | number
      status: string
      paidAt: string | null
      pdfUrl: string | null
      createdAt: string
    }[]
  } | null
  users: { id: string; name: string; email: string; role: string; active: boolean; createdAt: string }[]
  counts: { products: number; users: number; sales: number; clients: number; suppliers: number }
  revenue: number
  lastActivity: string | null
  auditLogs: {
    id: string
    action: string
    entity: string
    entityId: string | null
    createdAt: string
    user: { id: string; name: string; email: string }
  }[]
}

const TABS = [
  { key: "resumen", label: "Resumen" },
  { key: "suscripcion", label: "Suscripción" },
  { key: "usuarios", label: "Usuarios" },
  { key: "auditoria", label: "Auditoría" },
] as const

const PLANS = ["FREE", "STARTER", "PROFESSIONAL", "BUSINESS", "ENTERPRISE"] as const

export default function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<TenantDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("resumen")
  const [busy, setBusy] = useState(false)
  const [showHardDelete, setShowHardDelete] = useState(false)
  const [hardDeleteConfirm, setHardDeleteConfirm] = useState("")
  const [hardDeleting, setHardDeleting] = useState(false)
  const router = useRouter()
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState("")
  const [passwordReveal, setPasswordReveal] = useState<{ email: string; password: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/tenants/${id}/detail`)
      if (res.ok) {
        const d = await res.json()
        setData(d.tenant)
        setName(d.tenant.name)
      } else {
        toast.error("No se pudo cargar el tenant")
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const patchTenant = async (body: Record<string, unknown>, success: string) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/tenants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast.success(success)
        await load()
      } else {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || "Error")
      }
    } finally {
      setBusy(false)
    }
  }

  const patchSubscription = async (body: Record<string, unknown>, success: string) => {
    if (!data?.subscription) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/subscriptions/${data.subscription.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast.success(success)
        await load()
      } else toast.error("Error al actualizar suscripción")
    } finally {
      setBusy(false)
    }
  }

  const toggleUserActive = async (uid: string, active: boolean) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/users/${uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      })
      if (res.ok) {
        toast.success("Usuario actualizado")
        await load()
      } else toast.error("Error")
    } finally {
      setBusy(false)
    }
  }

  const resetUserPassword = async (uid: string) => {
    if (!confirm("¿Resetear contraseña de este usuario?")) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/users/${uid}/reset-password`, { method: "POST" })
      if (res.ok) setPasswordReveal(await res.json())
      else toast.error("Error al resetear")
    } finally {
      setBusy(false)
    }
  }

  if (loading || !data) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-4 w-64 bg-gray-800 rounded animate-pulse" />
        <div className="h-8 w-80 bg-gray-800 rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-gray-900 rounded-xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  const plan = (data.subscription?.plan ?? "FREE") as Plan
  const limits = PLAN_LIMITS[plan]
  const productsOver = data.counts.products > limits.products
  const usersOver = data.counts.users > limits.users

  return (
    <div className="p-6 space-y-6">
      {passwordReveal && <PasswordModal {...passwordReveal} onClose={() => setPasswordReveal(null)} />}

      <Breadcrumbs items={[
        { label: "Admin", href: "/admin" },
        { label: "Tenants", href: "/admin/tenants" },
        { label: data.name },
      ]} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-purple-600/20 rounded-xl flex items-center justify-center">
            <Building2 size={26} className="text-purple-400" />
          </div>
          <div>
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-xl font-bold focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={async () => { await patchTenant({ name }, "Nombre actualizado"); setEditingName(false) }}
                  className="px-3 py-1.5 bg-purple-600 rounded text-white text-sm hover:bg-purple-700"
                >Guardar</button>
                <button
                  onClick={() => { setName(data.name); setEditingName(false) }}
                  className="px-3 py-1.5 bg-gray-700 rounded text-white text-sm hover:bg-gray-600"
                >Cancelar</button>
              </div>
            ) : (
              <h1
                className="text-2xl font-bold text-white cursor-pointer hover:text-purple-300"
                onClick={() => setEditingName(true)}
                title="Click para editar"
              >{data.name}</h1>
            )}
            <p className="text-gray-500 text-sm mt-1">
              {data.slug} · creado {formatDate(data.createdAt)} ·{" "}
              <span className={data.active ? "text-green-400" : "text-red-400"}>
                {data.active ? "Activo" : "Desactivado"}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            disabled={busy}
            onClick={() => {
              if (confirm(`¿${data.active ? "Desactivar" : "Activar"} "${data.name}"?`))
                patchTenant({ active: !data.active }, "Estado actualizado")
            }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              data.active ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" : "bg-green-500/10 text-green-400 hover:bg-green-500/20"
            }`}
          >
            {data.active ? <Ban size={14} /> : <CheckCircle size={14} />}
            {data.active ? "Desactivar" : "Activar"}
          </button>

          <button
            onClick={() => setShowHardDelete(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-red-900/30 text-red-300 border border-red-700/40 hover:bg-red-900/60 transition-colors"
            title="Eliminar completamente el tenant y todos sus datos"
          >
            <Trash2 size={14} />
            Eliminar cuenta
          </button>
        </div>
      </div>

      {/* Hard Delete Modal */}
      {showHardDelete && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !hardDeleting && setShowHardDelete(false)}
        >
          <div
            className="bg-gray-900 border border-red-700/50 rounded-2xl w-full max-w-md shadow-2xl shadow-red-900/30"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-800">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-900/40 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h2 className="font-bold text-red-300">Eliminar cuenta completa</h2>
                  <p className="text-sm text-gray-400 mt-0.5">
                    Esta acción NO se puede deshacer
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-red-900/20 border border-red-700/40 rounded-lg p-3">
                <p className="text-xs text-red-200 font-semibold uppercase tracking-wider mb-2">
                  Se van a eliminar PERMANENTEMENTE:
                </p>
                <ul className="text-xs text-red-200/90 space-y-0.5 list-disc list-inside">
                  <li>{data._count.users} usuario{data._count.users !== 1 ? "s" : ""} y sus contraseñas</li>
                  <li>{data._count.products} producto{data._count.products !== 1 ? "s" : ""} e inventario</li>
                  <li>{data._count.sales} venta{data._count.sales !== 1 ? "s" : ""} y su histórico</li>
                  <li>Categorías, proveedores, clientes, gastos, cargas</li>
                  <li>Suscripción, API keys, configuración del tenant</li>
                  <li>Auditoría, sesiones de caja y todos los registros relacionados</li>
                </ul>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1.5">
                  Para confirmar, escribí el nombre exacto del negocio:
                </label>
                <p className="text-sm text-gray-200 font-mono bg-gray-800 px-2 py-1 rounded mb-2 select-all">
                  {data.name}
                </p>
                <input
                  type="text"
                  value={hardDeleteConfirm}
                  onChange={(e) => setHardDeleteConfirm(e.target.value)}
                  placeholder="Escribí el nombre del negocio..."
                  disabled={hardDeleting}
                  autoFocus
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-red-500"
                />
              </div>
            </div>

            <div className="p-5 border-t border-gray-800 flex gap-2 justify-end">
              <button
                onClick={() => { setShowHardDelete(false); setHardDeleteConfirm("") }}
                disabled={hardDeleting}
                className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (hardDeleteConfirm.trim() !== data.name) {
                    toast.error("El nombre no coincide")
                    return
                  }
                  setHardDeleting(true)
                  try {
                    const res = await fetch(
                      `/api/admin/tenants/${data.id}?mode=hard&confirm=${encodeURIComponent(hardDeleteConfirm)}`,
                      { method: "DELETE" }
                    )
                    const result = await res.json()
                    if (res.ok) {
                      toast.success(`"${data.name}" eliminado completamente`)
                      router.push("/admin/tenants")
                    } else {
                      toast.error(result.error || "Error al eliminar")
                      setHardDeleting(false)
                    }
                  } catch (e) {
                    toast.error("Error de red")
                    setHardDeleting(false)
                  }
                }}
                disabled={hardDeleting || hardDeleteConfirm.trim() !== data.name}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium flex items-center gap-1.5"
              >
                {hardDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {hardDeleting ? "Eliminando..." : "Eliminar para siempre"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-800 flex gap-1">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-purple-500 text-purple-300"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >{t.label}</button>
        ))}
      </div>

      {/* RESUMEN */}
      {tab === "resumen" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPI icon={ShoppingBag} label="Productos" value={data.counts.products} accent="purple" />
            <KPI icon={Users} label="Usuarios" value={data.counts.users} accent="blue" />
            <KPI icon={Activity} label="Ventas" value={data.counts.sales} accent="yellow" />
            <KPI icon={DollarSign} label="Ingresos" value={formatCurrency(data.revenue)} accent="green" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <h3 className="text-white font-semibold mb-3">Uso vs límites · Plan {PLAN_LABELS[plan]}</h3>
              <UsageBar label="Productos" value={data.counts.products} limit={limits.products} over={productsOver} />
              <div className="mt-3">
                <UsageBar label="Usuarios" value={data.counts.users} limit={limits.users} over={usersOver} />
              </div>
              {(productsOver || usersOver) && (
                <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <AlertTriangle size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                  <p className="text-yellow-200 text-xs">
                    El tenant excede los límites del plan {PLAN_LABELS[plan]}. Probablemente hizo downgrade.
                  </p>
                </div>
              )}
            </div>
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <h3 className="text-white font-semibold mb-3">Información</h3>
              <dl className="space-y-2 text-sm">
                <Row k="Tipo de negocio" v={data.config?.businessType ?? "—"} />
                <Row k="CUIT" v={data.config?.taxId ?? "—"} />
                <Row k="Email" v={data.config?.email ?? "—"} />
                <Row k="Teléfono" v={data.config?.phone ?? "—"} />
                <Row k="Clientes" v={String(data.counts.clients)} />
                <Row k="Proveedores" v={String(data.counts.suppliers)} />
                <Row k="Última actividad" v={data.lastActivity ? formatDateTime(data.lastActivity) : "Sin ventas"} />
              </dl>
            </div>
          </div>
        </div>
      )}

      {/* SUSCRIPCIÓN */}
      {tab === "suscripcion" && (
        <div className="space-y-6">
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="text-white font-semibold">Plan actual</h3>
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                data.subscription?.status === "ACTIVE" ? "bg-green-500/10 text-green-400" :
                data.subscription?.status === "TRIALING" ? "bg-blue-500/10 text-blue-400" :
                "bg-gray-500/10 text-gray-400"
              }`}>{data.subscription?.status ?? "Sin suscripción"}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Plan</label>
                <select
                  value={data.subscription?.plan ?? "FREE"}
                  onChange={e => patchTenant({ plan: e.target.value }, "Plan actualizado")}
                  disabled={busy}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
                >
                  {PLANS.map(p => <option key={p} value={p}>{PLAN_LABELS[p]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Estado</label>
                <select
                  value={data.subscription?.status ?? "ACTIVE"}
                  onChange={e => patchSubscription({ status: e.target.value }, "Estado actualizado")}
                  disabled={busy || !data.subscription}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
                >
                  {["ACTIVE", "TRIALING", "PAST_DUE", "PAUSED", "CANCELLED"].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Ciclo</label>
                <select
                  value={data.subscription?.billingCycle ?? "MONTHLY"}
                  onChange={e => patchSubscription({ billingCycle: e.target.value }, "Ciclo actualizado")}
                  disabled={busy || !data.subscription}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
                >
                  <option value="MONTHLY">Mensual</option>
                  <option value="YEARLY">Anual</option>
                </select>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <Row k="Inicio período" v={data.subscription?.currentPeriodStart ? formatDate(data.subscription.currentPeriodStart) : "—"} />
              <Row k="Fin período" v={data.subscription?.currentPeriodEnd ? formatDate(data.subscription.currentPeriodEnd) : "—"} />
              <Row k="Cancelada" v={data.subscription?.cancelledAt ? formatDate(data.subscription.cancelledAt) : "—"} />
            </div>
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <h3 className="text-white font-semibold p-5 border-b border-gray-800">Historial de facturas</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400">
                  <th className="p-4 text-left font-medium">Número</th>
                  <th className="p-4 text-right font-medium">Monto</th>
                  <th className="p-4 text-center font-medium">Estado</th>
                  <th className="p-4 text-left font-medium">Pagada</th>
                  <th className="p-4 text-left font-medium">Fecha</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {(data.subscription?.invoices ?? []).length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-500">Sin facturas todavía</td></tr>
                ) : data.subscription!.invoices.map(inv => (
                  <tr key={inv.id}>
                    <td className="p-4 text-white font-mono text-xs">{inv.number}</td>
                    <td className="p-4 text-right text-gray-200">{formatCurrency(Number(inv.amount), "USD")}</td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        inv.status === "PAID" ? "bg-green-500/10 text-green-400" :
                        inv.status === "PENDING" ? "bg-yellow-500/10 text-yellow-400" :
                        "bg-red-500/10 text-red-400"
                      }`}>{inv.status}</span>
                    </td>
                    <td className="p-4 text-gray-400">{inv.paidAt ? formatDate(inv.paidAt) : "—"}</td>
                    <td className="p-4 text-gray-400">{formatDate(inv.createdAt)}</td>
                    <td className="p-4 text-right">
                      {inv.pdfUrl && (
                        <a href={inv.pdfUrl} target="_blank" rel="noopener" className="text-purple-400 hover:text-purple-300 inline-flex items-center gap-1 text-xs">
                          PDF <ExternalLink size={12} />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* USUARIOS */}
      {tab === "usuarios" && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400">
                <th className="p-4 text-left font-medium">Nombre</th>
                <th className="p-4 text-left font-medium">Email</th>
                <th className="p-4 text-left font-medium">Rol</th>
                <th className="p-4 text-center font-medium">Activo</th>
                <th className="p-4 text-left font-medium">Alta</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {data.users.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">Sin usuarios</td></tr>
              ) : data.users.map(u => (
                <tr key={u.id} className="hover:bg-gray-800/30">
                  <td className="p-4 text-white">{u.name}</td>
                  <td className="p-4 text-gray-300">{u.email}</td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 bg-blue-500/10 text-blue-300 rounded-full text-xs">{u.role}</span>
                  </td>
                  <td className="p-4 text-center">
                    <button
                      disabled={busy}
                      onClick={() => toggleUserActive(u.id, !u.active)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${u.active ? "bg-green-500" : "bg-gray-600"}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition ${u.active ? "translate-x-5" : "translate-x-1"}`} />
                    </button>
                  </td>
                  <td className="p-4 text-gray-400">{formatDate(u.createdAt)}</td>
                  <td className="p-4 text-right">
                    <button
                      disabled={busy}
                      onClick={() => resetUserPassword(u.id)}
                      title="Resetear contraseña"
                      className="p-1.5 rounded-lg hover:bg-yellow-500/10 text-gray-400 hover:text-yellow-400 disabled:opacity-50"
                    >
                      {busy ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* AUDITORÍA */}
      {tab === "auditoria" && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400">
                <th className="p-4 text-left font-medium">Fecha</th>
                <th className="p-4 text-left font-medium">Usuario</th>
                <th className="p-4 text-left font-medium">Acción</th>
                <th className="p-4 text-left font-medium">Entidad</th>
                <th className="p-4 text-left font-medium">ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {data.auditLogs.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-500">Sin actividad reciente</td></tr>
              ) : data.auditLogs.map(l => (
                <tr key={l.id}>
                  <td className="p-4 text-gray-400 whitespace-nowrap">{formatDateTime(l.createdAt)}</td>
                  <td className="p-4 text-white">{l.user.name} <span className="text-gray-500 text-xs">{l.user.email}</span></td>
                  <td className="p-4"><span className="px-2 py-0.5 bg-purple-500/10 text-purple-300 rounded-full text-xs">{l.action}</span></td>
                  <td className="p-4 text-gray-300">{l.entity}</td>
                  <td className="p-4 text-gray-500 font-mono text-xs">{l.entityId ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function KPI({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: number | string; accent: string }) {
  const colors: Record<string, string> = {
    purple: "text-purple-400",
    blue: "text-blue-400",
    yellow: "text-yellow-400",
    green: "text-green-400",
  }
  return (
    <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-500 text-sm">{label}</span>
        <Icon size={16} className={colors[accent]} />
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-gray-500 text-xs uppercase tracking-wider">{k}</dt>
      <dd className="text-gray-200 text-sm">{v}</dd>
    </div>
  )
}

function UsageBar({ label, value, limit, over }: { label: string; value: number; limit: number; over: boolean }) {
  const pct = Math.min(100, (value / Math.max(1, limit)) * 100)
  const limitDisplay = limit >= 99999 ? "∞" : limit
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className={over ? "text-yellow-400" : "text-gray-400"}>
          {value} / {limitDisplay}
        </span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${over ? "bg-yellow-400" : pct > 80 ? "bg-orange-400" : "bg-purple-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
