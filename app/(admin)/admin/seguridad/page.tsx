"use client"

import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import { signOut } from "next-auth/react"
import { Loader2, Monitor, ShieldCheck, Trash2, Pencil, Check, X, Mail, Key } from "lucide-react"

interface TrustedDevice {
  id: string
  label: string | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  lastUsedAt: string
  isCurrent: boolean
}

function formatDate(s: string): string {
  return new Date(s).toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function shortUA(ua: string | null): string {
  if (!ua) return "—"
  // Try to pick out OS + browser without being a full parser
  const browser =
    /Chrome\/(\d+)/.exec(ua)?.[0]?.replace("/", " ") ||
    /Safari\/(\d+)/.exec(ua)?.[0]?.replace("/", " ") ||
    /Firefox\/(\d+)/.exec(ua)?.[0]?.replace("/", " ") ||
    "Browser"
  const os =
    /Mac OS X ([\d_]+)/.exec(ua)?.[0]?.replace(/_/g, ".") ||
    /Windows NT (\d+\.\d+)/.exec(ua)?.[0] ||
    /Android \d+/.exec(ua)?.[0] ||
    /iPhone OS [\d_]+/.exec(ua)?.[0]?.replace(/_/g, ".") ||
    "OS"
  return `${browser} · ${os}`
}

export default function AdminSecurityPage() {
  const [devices, setDevices] = useState<TrustedDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [labelDraft, setLabelDraft] = useState("")
  const [confirmingRevoke, setConfirmingRevoke] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    const res = await fetch("/api/admin/devices")
    if (res.ok) {
      const data = await res.json()
      setDevices(data.devices ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  async function rename(id: string) {
    setBusy(true)
    await fetch(`/api/admin/devices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: labelDraft }),
    })
    setEditing(null)
    setBusy(false)
    await load()
  }

  async function revoke(id: string) {
    setBusy(true)
    const res = await fetch(`/api/admin/devices/${id}`, { method: "DELETE" })
    setBusy(false)
    setConfirmingRevoke(null)
    if (res.ok) {
      // If you revoked your own device, the cookie was cleared — bounce
      // to verification.
      const wasCurrent = devices.find((d) => d.id === id)?.isCurrent
      if (wasCurrent) {
        window.location.href = "/admin/dispositivo"
        return
      }
      await load()
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Seguridad de tu cuenta</h1>
        <p className="text-gray-400 text-sm mt-1">
          Cambiá tu mail/contraseña y gestioná las computadoras que pueden acceder al admin.
        </p>
      </div>

      {/* Cuenta del admin */}
      <AccountSection />

      {/* Dispositivos confiables — header */}
      <div className="pt-4 border-t border-gray-800">
        <h2 className="text-lg font-semibold text-white">Dispositivos confiables</h2>
        <p className="text-gray-400 text-sm mt-1">
          Sólo desde estas computadoras se puede entrar al panel sin verificación por mail.
          Cualquier login desde una distinta queda bloqueado hasta que confirmes con un código de 6 dígitos.
        </p>
      </div>

      {/* Why this is here */}
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.04] p-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-300 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-100/90 leading-relaxed">
          <strong className="text-white">Cómo funciona:</strong> tu navegador genera una huella única
          (modelo + pantalla + zona horaria + canvas). La hasheamos con tu secreto de servidor y la
          comparamos con esta lista. Si una compu desconocida intenta entrar, te llega un mail con un
          código que vence en 10 min.
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
        </div>
      ) : devices.length === 0 ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-6 text-center">
          <p className="text-sm text-amber-200">
            No hay ningún dispositivo confiable todavía. La próxima vez que entres al admin se va a
            registrar el actual automáticamente.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {devices.map((d) => (
            <div
              key={d.id}
              className={`rounded-xl border p-4 ${
                d.isCurrent
                  ? "border-emerald-500/40 bg-emerald-500/[0.05]"
                  : "border-gray-800 bg-gray-900/60"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      d.isCurrent
                        ? "bg-emerald-500/15 border border-emerald-500/30"
                        : "bg-gray-800 border border-gray-700"
                    }`}
                  >
                    <Monitor
                      className={`w-4 h-4 ${d.isCurrent ? "text-emerald-300" : "text-gray-400"}`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    {editing === d.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          value={labelDraft}
                          onChange={(e) => setLabelDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void rename(d.id)
                            if (e.key === "Escape") setEditing(null)
                          }}
                          className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white outline-none focus:border-blue-500"
                        />
                        <button
                          onClick={() => void rename(d.id)}
                          disabled={busy}
                          className="p-1.5 rounded bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => setEditing(null)}
                          className="p-1.5 rounded bg-gray-800 text-gray-400 hover:bg-gray-700"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white font-semibold truncate">
                          {d.label || "Dispositivo sin nombre"}
                        </p>
                        {d.isCurrent && (
                          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                            Esta compu
                          </span>
                        )}
                        <button
                          onClick={() => {
                            setEditing(d.id)
                            setLabelDraft(d.label ?? "")
                          }}
                          className="text-gray-500 hover:text-white p-1"
                          title="Renombrar"
                        >
                          <Pencil size={12} />
                        </button>
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{shortUA(d.userAgent)}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-500">
                      <span>IP {d.ipAddress ?? "—"}</span>
                      <span>·</span>
                      <span>último uso {formatDate(d.lastUsedAt)}</span>
                    </div>
                  </div>
                </div>
                {confirmingRevoke === d.id ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => void revoke(d.id)}
                      disabled={busy}
                      className="text-xs px-2.5 py-1 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30 font-semibold"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => setConfirmingRevoke(null)}
                      className="text-xs px-2.5 py-1 rounded bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmingRevoke(d.id)}
                    className="text-gray-500 hover:text-red-400 p-2 rounded shrink-0"
                    title={d.isCurrent ? "Revocar (te va a sacar)" : "Revocar"}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ============================================================================
   Account section — change email / password from /admin/seguridad.
   Pre-fills from the current session. After a sensitive change the user
   gets logged out so the new credentials take effect cleanly.
   ========================================================================== */

function AccountSection() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [originalEmail, setOriginalEmail] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch("/api/admin/account")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user) {
          setName(d.user.name ?? "")
          setEmail(d.user.email ?? "")
          setOriginalEmail(d.user.email ?? "")
        }
      })
      .catch(() => {})
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    const sensitive =
      email.toLowerCase() !== originalEmail.toLowerCase() ||
      newPassword.length > 0
    if (sensitive && !currentPassword) {
      toast.error("Ingresá tu contraseña actual para confirmar.")
      return
    }
    setBusy(true)
    try {
      const res = await fetch("/api/admin/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          currentPassword: sensitive ? currentPassword : undefined,
          newPassword: newPassword || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "No pudimos guardar.")
        return
      }
      toast.success("Listo. Datos actualizados.")
      setCurrentPassword("")
      setNewPassword("")
      if (data.requiresReauth) {
        // Logout so the new email/password takes effect on next login.
        toast("Volvé a entrar con tu mail/contraseña nueva.", { duration: 4000 })
        setTimeout(() => signOut({ callbackUrl: "/login" }), 1500)
      } else {
        // Refresh the form's "original" email to the new one and clear
        // sensitive inputs.
        setOriginalEmail(email)
      }
    } catch {
      toast.error("Sin conexión.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="rounded-xl border border-gray-800 bg-gray-900/60 p-5 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Tu cuenta de admin</h2>
        <p className="text-gray-500 text-xs mt-0.5">
          Para cambiar mail o contraseña tenés que confirmar con tu contraseña actual.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Nombre">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/60"
          />
        </Field>
        <Field label="Email">
          <div className="flex items-center gap-2 bg-gray-950 border border-gray-800 rounded-lg px-3">
            <Mail className="w-4 h-4 text-gray-500 shrink-0" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="flex-1 bg-transparent py-2 text-sm text-white placeholder-gray-600 focus:outline-none"
            />
          </div>
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-800">
        <Field label="Contraseña actual">
          <div className="flex items-center gap-2 bg-gray-950 border border-gray-800 rounded-lg px-3">
            <Key className="w-4 h-4 text-gray-500 shrink-0" />
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              className="flex-1 bg-transparent py-2 text-sm text-white placeholder-gray-600 focus:outline-none"
            />
          </div>
        </Field>
        <Field label="Contraseña nueva (opcional)">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="Dejá vacío si no querés cambiarla"
            minLength={10}
            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/60"
          />
        </Field>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={busy}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-400 hover:to-violet-400 disabled:opacity-50 text-white text-sm font-semibold"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar cambios"}
        </button>
      </div>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-gray-500 font-medium block mb-1.5">
        {label}
      </span>
      {children}
    </label>
  )
}
