"use client"

import { useEffect, useState } from "react"
import { Key, Plus, Trash2, Copy, Check, AlertTriangle, Eye, EyeOff } from "lucide-react"
import toast from "react-hot-toast"
import { Modal } from "@/components/ui/Modal"
import { formatDateTime } from "@/lib/utils"
import { useConfirm } from "@/components/shared/ConfirmDialog"

interface ApiKey {
  id: string
  name: string
  prefix: string
  scopes: string
  lastUsedAt: string | null
  expiresAt: string | null
  revokedAt: string | null
  createdAt: string
  createdBy?: { name: string | null; email: string }
}

export default function ApiKeysClient() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState("")
  const [scope, setScope] = useState<"read" | "write">("read")
  const [creating, setCreating] = useState(false)
  const [generated, setGenerated] = useState<{ raw: string; prefix: string } | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)
  const confirm = useConfirm()

  const load = async () => {
    setLoading(true)
    const res = await fetch("/api/configuracion/api-keys")
    if (res.ok) {
      const d = await res.json()
      setKeys(d.keys ?? [])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!name.trim()) return toast.error("Poné un nombre descriptivo")
    setCreating(true)
    const res = await fetch("/api/configuracion/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), scopes: scope }),
    })
    if (res.ok) {
      const d = await res.json()
      setGenerated({ raw: d.raw, prefix: d.key.prefix })
      setRevealed(true)
      setShowCreate(false)
      setName("")
      setScope("read")
      await load()
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error || "Error al crear clave")
    }
    setCreating(false)
  }

  const handleRevoke = async (id: string, label: string) => {
    const ok = await confirm({
      title: `¿Revocar la clave "${label}"?`,
      description: "Las integraciones que la usen van a dejar de funcionar inmediatamente.",
      confirmText: "Revocar",
      tone: "danger",
    })
    if (!ok) return
    const res = await fetch(`/api/configuracion/api-keys/${id}`, { method: "DELETE" })
    if (res.ok) { toast.success("Clave revocada"); await load() }
    else toast.error("Error al revocar")
  }

  const copyToClipboard = async () => {
    if (!generated) return
    await navigator.clipboard.writeText(generated.raw)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const sampleUrl = typeof window !== "undefined" ? window.location.origin : "https://your-app.up.railway.app"

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Key className="w-6 h-6 text-accent" />
            API Keys
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Generá tokens para conectar Retailar con sistemas externos vía la API REST.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-accent-foreground font-medium px-4 py-2 rounded-lg shadow-lg shadow-accent/20"
        >
          <Plus className="w-4 h-4" />
          Generar clave
        </button>
      </div>

      {/* Curl example */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-white font-medium mb-2 text-sm">Ejemplo de uso</h3>
        <p className="text-gray-400 text-xs mb-3">
          Probá un endpoint usando tu nueva clave (reemplazá <code>rk_live_…</code>):
        </p>
        <pre className="bg-black/40 rounded-lg p-3 text-xs text-green-300 overflow-x-auto">
{`curl -H "Authorization: Bearer rk_live_..." \\
  ${sampleUrl}/api/v1/products`}
        </pre>
        <p className="text-gray-500 text-xs mt-3">
          Endpoints disponibles: <code className="text-gray-300">/api/v1/products</code>,{" "}
          <code className="text-gray-300">/api/v1/sales</code> (GET y POST con scope <code>write</code>).
        </p>
      </div>

      {/* List */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Cargando…</div>
        ) : keys.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Key className="w-10 h-10 mx-auto mb-3 opacity-30" />
            Todavía no generaste ninguna clave
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="p-4 text-left text-gray-400 font-medium">Nombre</th>
                <th className="p-4 text-left text-gray-400 font-medium">Prefijo</th>
                <th className="p-4 text-left text-gray-400 font-medium">Scope</th>
                <th className="p-4 text-left text-gray-400 font-medium">Último uso</th>
                <th className="p-4 text-left text-gray-400 font-medium">Creada</th>
                <th className="p-4 text-center text-gray-400 font-medium">Estado</th>
                <th className="p-4 text-right text-gray-400 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {keys.map((k) => {
                const revoked = !!k.revokedAt
                const expired = k.expiresAt && new Date(k.expiresAt) < new Date()
                return (
                  <tr key={k.id} className="hover:bg-gray-800/30">
                    <td className="p-4 text-white">{k.name}</td>
                    <td className="p-4 font-mono text-gray-300 text-xs">{k.prefix}…</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${k.scopes.includes("write") ? "bg-orange-500/10 text-orange-300" : "bg-blue-500/10 text-blue-300"}`}>
                        {k.scopes}
                      </span>
                    </td>
                    <td className="p-4 text-gray-400">{k.lastUsedAt ? formatDateTime(k.lastUsedAt) : "Nunca"}</td>
                    <td className="p-4 text-gray-400">{formatDateTime(k.createdAt)}</td>
                    <td className="p-4 text-center">
                      {revoked ? (
                        <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-xs">Revocada</span>
                      ) : expired ? (
                        <span className="px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 text-xs">Vencida</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 text-xs">Activa</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {!revoked && (
                        <button
                          onClick={() => handleRevoke(k.id, k.name)}
                          className="p-1.5 rounded-md text-red-400 hover:bg-red-500/10"
                          aria-label="Revocar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Generar nueva API key"
        description="Vas a poder ver el token UNA SOLA VEZ. Guardalo en un lugar seguro."
        footer={
          <>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-gray-300 hover:bg-gray-800">
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !name.trim()}
              className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-accent-foreground font-medium disabled:opacity-50"
            >
              {creating ? "Generando..." : "Generar"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">Nombre</label>
            <input
              type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Integración Tienda Nube"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">Permisos</label>
            <select
              value={scope} onChange={(e) => setScope(e.target.value as "read" | "write")}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
            >
              <option value="read">Lectura — leer productos y ventas</option>
              <option value="write">Lectura + escritura — además crear ventas</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* Reveal modal */}
      <Modal
        open={!!generated}
        onClose={() => { setGenerated(null); setRevealed(false); setCopied(false) }}
        title="Tu nueva clave"
        size="lg"
        footer={
          <button
            onClick={() => { setGenerated(null); setRevealed(false); setCopied(false) }}
            className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-accent-foreground font-medium"
          >
            Listo, ya la guardé
          </button>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-200">
              Guardala ahora, no la vas a poder ver de nuevo. Si la perdés, generá una nueva y revocá ésta.
            </p>
          </div>
          <div className="bg-black/40 rounded-lg p-3 flex items-center gap-2">
            <code className="text-sm text-green-300 font-mono break-all flex-1">
              {revealed ? generated?.raw : "•".repeat(40)}
            </code>
            <button
              onClick={() => setRevealed(!revealed)}
              className="p-2 rounded-md text-gray-400 hover:bg-gray-800"
              aria-label="Mostrar/ocultar"
            >
              {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button
              onClick={copyToClipboard}
              className="p-2 rounded-md text-gray-400 hover:bg-gray-800"
              aria-label="Copiar"
            >
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
