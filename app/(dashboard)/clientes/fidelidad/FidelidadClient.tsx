"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import toast from "react-hot-toast"
import { Star, ArrowLeft, History, Plus, Minus, Gift, Search, Users, AlertTriangle } from "lucide-react"
import { formatCurrency, formatDateTime } from "@/lib/utils"
import { Modal } from "@/components/ui/Modal"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"

interface Client {
  id: string
  name: string
  email: string | null
  phone: string | null
  loyaltyPoints: number
}

interface LoyaltyTx {
  id: string
  points: number
  description: string
  createdAt: string
  saleId: string | null
}

interface Props {
  pointValue: number
  pointsPerPeso: number
  loyaltyEnabled: boolean
}

export default function FidelidadClient({ pointValue, pointsPerPeso, loyaltyEnabled }: Props) {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  // Modals
  const [historyClient, setHistoryClient] = useState<Client | null>(null)
  const [historyTx, setHistoryTx] = useState<LoyaltyTx[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const [adjustClient, setAdjustClient] = useState<Client | null>(null)
  const [adjustPoints, setAdjustPoints] = useState<string>("")
  const [adjustDesc, setAdjustDesc] = useState<string>("")
  const [adjustSign, setAdjustSign] = useState<1 | -1>(1)
  const [adjustSaving, setAdjustSaving] = useState(false)

  const [redeemClient, setRedeemClient] = useState<Client | null>(null)
  const [redeemPoints, setRedeemPoints] = useState<string>("")
  const [redeemSaving, setRedeemSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/clientes")
    if (res.ok) {
      const d = await res.json()
      const all: Client[] = (d.clients || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        loyaltyPoints: c.loyaltyPoints ?? 0,
      }))
      // Sort by points desc
      all.sort((a, b) => b.loyaltyPoints - a.loyaltyPoints)
      setClients(all)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // KPIs
  const clientsWithPoints = clients.filter(c => c.loyaltyPoints > 0)
  const totalPoints = clientsWithPoints.reduce((s, c) => s + c.loyaltyPoints, 0)
  const liability = totalPoints * pointValue

  const filtered = search
    ? clients.filter(c =>
        [c.name, c.email ?? "", c.phone ?? ""]
          .some(v => v.toLowerCase().includes(search.toLowerCase()))
      )
    : clients

  // ---------- HANDLERS ----------
  const openHistory = async (c: Client) => {
    setHistoryClient(c)
    setHistoryTx([])
    setHistoryLoading(true)
    const res = await fetch(`/api/clientes/${c.id}/loyalty`)
    if (res.ok) {
      const d = await res.json()
      setHistoryTx(d.transactions || [])
    }
    setHistoryLoading(false)
  }

  const openAdjust = (c: Client) => {
    setAdjustClient(c)
    setAdjustPoints("")
    setAdjustDesc("")
    setAdjustSign(1)
  }

  const submitAdjust = async () => {
    if (!adjustClient) return
    const n = parseInt(adjustPoints, 10)
    if (!n || n <= 0) { toast.error("Ingresá una cantidad válida"); return }
    if (!adjustDesc.trim()) { toast.error("La descripción es obligatoria"); return }
    setAdjustSaving(true)
    const res = await fetch("/api/loyalty/adjust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: adjustClient.id,
        points: n * adjustSign,
        description: adjustDesc.trim(),
      }),
    })
    setAdjustSaving(false)
    if (res.ok) {
      toast.success("Puntos ajustados")
      setAdjustClient(null)
      await load()
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error(d?.error ?? "No se pudo ajustar")
    }
  }

  const openRedeem = (c: Client) => {
    setRedeemClient(c)
    setRedeemPoints("")
  }

  const submitRedeem = async () => {
    if (!redeemClient) return
    const n = parseInt(redeemPoints, 10)
    if (!n || n <= 0) { toast.error("Ingresá una cantidad válida"); return }
    if (n > redeemClient.loyaltyPoints) { toast.error("Puntos insuficientes"); return }
    setRedeemSaving(true)
    const res = await fetch("/api/loyalty/adjust", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: redeemClient.id,
        points: -n,
        description: `Canje de ${n} puntos ($${(n * pointValue).toFixed(2)} de descuento)`,
      }),
    })
    setRedeemSaving(false)
    if (res.ok) {
      toast.success(`Canje exitoso: ${formatCurrency(n * pointValue)} de descuento`)
      setRedeemClient(null)
      await load()
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error(d?.error ?? "No se pudo canjear")
    }
  }

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href="/clientes" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 mb-1">
            <ArrowLeft size={12} /> Clientes
          </Link>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Star size={20} className="text-yellow-400" />
            Programa de fidelidad
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Tasa: {pointsPerPeso} pto/$ · Valor canje: {formatCurrency(pointValue)}/pto
          </p>
        </div>
        <Link href="/configuracion" className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300">
          Configurar
        </Link>
      </div>

      {!loyaltyEnabled && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <AlertTriangle size={18} className="text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-amber-200">
            El programa de fidelidad está <strong>desactivado</strong>. Las nuevas ventas no acumulan puntos automáticamente.{" "}
            <Link href="/configuracion" className="underline">Activalo en Configuración</Link>.
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="flex items-center gap-2 text-gray-400 text-xs"><Users size={14} /> Clientes con puntos</div>
          <p className="text-2xl font-bold text-white mt-1">{clientsWithPoints.length}</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="flex items-center gap-2 text-gray-400 text-xs"><Star size={14} className="text-yellow-400" /> Puntos en circulación</div>
          <p className="text-2xl font-bold text-white mt-1">{totalPoints.toLocaleString("es-AR")}</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <div className="flex items-center gap-2 text-gray-400 text-xs"><Gift size={14} /> Pasivo monetario</div>
          <p className="text-2xl font-bold text-white mt-1">{formatCurrency(liability)}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar cliente..."
          className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent" />
      </div>

      {/* Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="p-4 text-left text-gray-400 font-medium">#</th>
              <th className="p-4 text-left text-gray-400 font-medium">Cliente</th>
              <th className="p-4 text-right text-gray-400 font-medium">Puntos</th>
              <th className="p-4 text-right text-gray-400 font-medium">Valor canje</th>
              <th className="p-4 text-right text-gray-400 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={5} className="p-4"><div className="h-4 bg-gray-800 rounded animate-pulse" /></td></tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-12 text-center text-gray-500">
                  <Users size={40} className="mx-auto mb-3 opacity-30" />
                  <p>No hay clientes</p>
                </td>
              </tr>
            ) : filtered.map((c, idx) => (
              <tr key={c.id} className="hover:bg-gray-800/30 transition-colors">
                <td className="p-4 text-gray-500 font-mono">{idx + 1}</td>
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent-soft flex items-center justify-center text-accent font-semibold text-sm">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white font-medium">{c.name}</p>
                      {c.email && <p className="text-gray-500 text-xs mt-0.5">{c.email}</p>}
                    </div>
                  </div>
                </td>
                <td className="p-4 text-right">
                  {c.loyaltyPoints > 0 ? (
                    <span className="inline-flex items-center gap-1 text-yellow-400 font-semibold">
                      <Star size={12} fill="currentColor" /> {c.loyaltyPoints.toLocaleString("es-AR")}
                    </span>
                  ) : <span className="text-gray-600">0</span>}
                </td>
                <td className="p-4 text-right text-gray-300">
                  {formatCurrency(c.loyaltyPoints * pointValue)}
                </td>
                <td className="p-4">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openHistory(c)} title="Ver historial"
                      className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
                      <History size={14} />
                    </button>
                    <button onClick={() => openAdjust(c)} title="Ajuste manual"
                      className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
                      <Plus size={14} />
                    </button>
                    <button onClick={() => openRedeem(c)} disabled={c.loyaltyPoints === 0} title="Canjear"
                      className="p-1.5 rounded-lg hover:bg-yellow-500/10 text-gray-400 hover:text-yellow-400 transition-colors disabled:opacity-30 disabled:hover:bg-transparent">
                      <Gift size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* History Modal */}
      <Modal
        open={!!historyClient}
        onClose={() => setHistoryClient(null)}
        title={historyClient ? `Historial — ${historyClient.name}` : ""}
        description={historyClient ? `${historyClient.loyaltyPoints} puntos actuales (${formatCurrency(historyClient.loyaltyPoints * pointValue)})` : ""}
        size="lg"
      >
        {historyLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-800 rounded animate-pulse" />
            ))}
          </div>
        ) : historyTx.length === 0 ? (
          <p className="text-center text-gray-500 py-8">Sin movimientos todavía.</p>
        ) : (
          <div className="max-h-[400px] overflow-y-auto divide-y divide-gray-800">
            {historyTx.map(tx => (
              <div key={tx.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm text-gray-200">{tx.description}</p>
                  <p className="text-xs text-gray-500">{formatDateTime(tx.createdAt)}</p>
                </div>
                <span className={`font-mono font-semibold text-sm ${tx.points >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {tx.points >= 0 ? "+" : ""}{tx.points}
                </span>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Adjust Modal */}
      <Modal
        open={!!adjustClient}
        onClose={() => setAdjustClient(null)}
        title={adjustClient ? `Ajuste manual — ${adjustClient.name}` : ""}
        description={adjustClient ? `Saldo actual: ${adjustClient.loyaltyPoints} puntos` : ""}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdjustClient(null)}>Cancelar</Button>
            <Button onClick={submitAdjust} loading={adjustSaving}>Confirmar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => setAdjustSign(1)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition border ${adjustSign === 1 ? "bg-green-500/15 border-green-500/40 text-green-300" : "bg-gray-800 border-gray-700 text-gray-400"}`}
            >
              <Plus size={14} className="inline mr-1" /> Sumar
            </button>
            <button
              onClick={() => setAdjustSign(-1)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition border ${adjustSign === -1 ? "bg-red-500/15 border-red-500/40 text-red-300" : "bg-gray-800 border-gray-700 text-gray-400"}`}
            >
              <Minus size={14} className="inline mr-1" /> Restar
            </button>
          </div>
          <Input
            label="Cantidad de puntos"
            type="number"
            min="1"
            value={adjustPoints}
            onChange={e => setAdjustPoints(e.target.value)}
          />
          <Input
            label="Motivo / descripción *"
            value={adjustDesc}
            onChange={e => setAdjustDesc(e.target.value)}
            placeholder="Ej: Regalo de cumpleaños, corrección de error..."
          />
        </div>
      </Modal>

      {/* Redeem Modal */}
      <Modal
        open={!!redeemClient}
        onClose={() => setRedeemClient(null)}
        title={redeemClient ? `Canjear puntos — ${redeemClient.name}` : ""}
        description={redeemClient ? `Disponible: ${redeemClient.loyaltyPoints} puntos (${formatCurrency(redeemClient.loyaltyPoints * pointValue)})` : ""}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRedeemClient(null)}>Cancelar</Button>
            <Button onClick={submitRedeem} loading={redeemSaving}>Canjear</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Puntos a canjear"
            type="number"
            min="1"
            max={redeemClient?.loyaltyPoints ?? 0}
            value={redeemPoints}
            onChange={e => setRedeemPoints(e.target.value)}
          />
          {redeemPoints && parseInt(redeemPoints, 10) > 0 && (
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-sm text-yellow-200">
              Descuento equivalente: <strong>{formatCurrency(parseInt(redeemPoints, 10) * pointValue)}</strong>
            </div>
          )}
          <p className="text-xs text-gray-500">
            Esto resta los puntos del saldo del cliente y crea un movimiento &quot;Canje&quot; en su historial.
            Aplicá el descuento manualmente en el POS al cobrar.
          </p>
        </div>
      </Modal>
    </div>
  )
}
