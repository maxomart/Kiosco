"use client"

import { useState, useEffect } from "react"
import toast from "react-hot-toast"
import {
  Ticket,
  Plus,
  Loader2,
  RefreshCw,
  Trash2,
  Power,
  RotateCcw,
  Copy,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface PromoCode {
  id: string
  code: string
  description: string | null
  planGranted: string
  daysGranted: number
  maxUses: number
  usedCount: number
  remaining: number
  active: boolean
  expiresAt: string | null
  status: "ACTIVE" | "DISABLED" | "EXPIRED" | "EXHAUSTED"
  createdAt: string
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: "Activo", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  DISABLED: { label: "Desactivado", cls: "bg-gray-500/15 text-gray-400 border-gray-500/30" },
  EXPIRED: { label: "Vencido", cls: "bg-red-500/15 text-red-300 border-red-500/30" },
  EXHAUSTED: { label: "Agotado", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
}

const PLANS = ["STARTER", "PROFESSIONAL", "BUSINESS"]

export default function AdminPromoCodesPage() {
  const [codes, setCodes] = useState<PromoCode[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Form de creación
  const [fCode, setFCode] = useState("")
  const [fPlan, setFPlan] = useState("PROFESSIONAL")
  const [fDays, setFDays] = useState("90")
  const [fMax, setFMax] = useState("100")
  const [fDesc, setFDesc] = useState("")
  const [fExpires, setFExpires] = useState("")
  const [creating, setCreating] = useState(false)

  async function loadCodes() {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/promo-codes")
      if (!res.ok) {
        toast.error("No pudimos cargar los códigos.")
        return
      }
      const data = await res.json()
      setCodes(data.codes ?? [])
    } catch {
      toast.error("Sin conexión.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadCodes()
  }, [])

  async function createCode() {
    if (creating) return
    setCreating(true)
    try {
      const res = await fetch("/api/admin/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: fCode,
          planGranted: fPlan,
          daysGranted: Number(fDays),
          maxUses: Number(fMax),
          description: fDesc || undefined,
          expiresAt: fExpires || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo crear el código.")
        return
      }
      toast.success("Código creado")
      setFCode("")
      setFDesc("")
      setFExpires("")
      setShowForm(false)
      await loadCodes()
    } catch {
      toast.error("Sin conexión.")
    } finally {
      setCreating(false)
    }
  }

  async function patchCode(id: string, body: Record<string, unknown>, okMsg: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/admin/promo-codes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo actualizar.")
        return
      }
      toast.success(okMsg)
      await loadCodes()
    } catch {
      toast.error("Sin conexión.")
    } finally {
      setBusyId(null)
    }
  }

  async function deleteCode(id: string, code: string) {
    if (!confirm(`¿Borrar el código "${code}"? Esta acción no se puede deshacer.`)) return
    setBusyId(id)
    try {
      const res = await fetch(`/api/admin/promo-codes/${id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo borrar.")
        return
      }
      toast.success("Código borrado")
      await loadCodes()
    } catch {
      toast.error("Sin conexión.")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Ticket className="w-6 h-6 text-violet-400" /> Códigos de promoción
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Cupones que dan un plan pago gratis por un tiempo, sin cobrar. Se aplican al registrarse.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadCodes()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Refrescar
          </button>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm text-white font-medium transition-colors"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? "Cancelar" : "Nuevo código"}
          </button>
        </div>
      </div>

      {/* Form de creación */}
      {showForm && (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-4">
          <h2 className="text-white font-semibold">Crear código nuevo</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Código">
              <input
                value={fCode}
                onChange={(e) => setFCode(e.target.value.toLowerCase().replace(/\s/g, ""))}
                placeholder="lanzamiento"
                className="admin-input"
              />
            </Field>
            <Field label="Plan que otorga">
              <select
                value={fPlan}
                onChange={(e) => setFPlan(e.target.value)}
                className="admin-input"
              >
                {PLANS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Días gratis">
              <input
                type="number"
                value={fDays}
                onChange={(e) => setFDays(e.target.value)}
                min={1}
                className="admin-input"
              />
            </Field>
            <Field label="Cupo total (cuántos lo pueden usar)">
              <input
                type="number"
                value={fMax}
                onChange={(e) => setFMax(e.target.value)}
                min={1}
                className="admin-input"
              />
            </Field>
            <Field label="Descripción (opcional)">
              <input
                value={fDesc}
                onChange={(e) => setFDesc(e.target.value)}
                placeholder="Campaña de lanzamiento"
                className="admin-input"
              />
            </Field>
            <Field label="Vence el (opcional)">
              <input
                type="date"
                value={fExpires}
                onChange={(e) => setFExpires(e.target.value)}
                className="admin-input"
              />
            </Field>
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => void createCode()}
              disabled={creating || !fCode.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Crear código
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : codes.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-10 text-center text-sm text-gray-500">
          Todavía no hay códigos. Creá el primero con &quot;Nuevo código&quot;.
        </div>
      ) : (
        <div className="space-y-3">
          {codes.map((c) => {
            const badge = STATUS_BADGE[c.status]
            const usePct = c.maxUses > 0 ? Math.min(100, (c.usedCount / c.maxUses) * 100) : 0
            const busy = busyId === c.id
            return (
              <div
                key={c.id}
                className="rounded-xl border border-gray-800 bg-gray-900 p-4"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-base font-bold text-white font-mono">{c.code}</code>
                      <span
                        className={cn(
                          "text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border",
                          badge.cls
                        )}
                      >
                        {badge.label}
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(c.code)
                          toast.success("Código copiado")
                        }}
                        className="text-gray-500 hover:text-violet-300 transition-colors"
                        title="Copiar código"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Da <strong className="text-gray-200">{c.planGranted}</strong> por{" "}
                      <strong className="text-gray-200">{c.daysGranted} días</strong>
                      {c.description && ` · ${c.description}`}
                    </p>
                    {c.expiresAt && (
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Vence el {new Date(c.expiresAt).toLocaleDateString("es-AR")}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() =>
                        void patchCode(
                          c.id,
                          { active: !c.active },
                          c.active ? "Código desactivado" : "Código activado"
                        )
                      }
                      disabled={busy}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-40",
                        c.active
                          ? "bg-gray-800 text-gray-300 hover:bg-gray-700"
                          : "bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30"
                      )}
                    >
                      <Power className="w-3.5 h-3.5" />
                      {c.active ? "Desactivar" : "Activar"}
                    </button>
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            `¿Resetear el contador de "${c.code}" a 0? Volverá a tener ${c.maxUses} usos disponibles.`
                          )
                        ) {
                          void patchCode(c.id, { resetUsed: true }, "Contador reseteado")
                        }
                      }}
                      disabled={busy || c.usedCount === 0}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors disabled:opacity-40"
                      title="Poner el contador de usos en 0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Resetear
                    </button>
                    <button
                      onClick={() => void deleteCode(c.id, c.code)}
                      disabled={busy}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-gray-800 text-gray-400 hover:bg-red-500/15 hover:text-red-300 transition-colors disabled:opacity-40"
                      title="Borrar (solo si nunca se usó)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Barra de uso */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                    <span>
                      {c.usedCount} de {c.maxUses} usados
                    </span>
                    <span>{c.remaining} disponibles</span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        usePct >= 100 ? "bg-amber-400" : "bg-violet-500"
                      )}
                      style={{ width: `${usePct}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <style jsx global>{`
        .admin-input {
          width: 100%;
          background-color: #030712;
          border: 1px solid #1f2937;
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: white;
        }
        .admin-input:focus {
          outline: none;
          border-color: rgba(139, 92, 246, 0.6);
        }
      `}</style>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-gray-400 mb-1 block">{label}</span>
      {children}
    </label>
  )
}
