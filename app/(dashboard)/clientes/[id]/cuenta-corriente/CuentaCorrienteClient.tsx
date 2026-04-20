"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import toast from "react-hot-toast"
import { ArrowLeft, Wallet, Edit2, Plus, X, Loader2 } from "lucide-react"
import { formatCurrency, formatDateTime, PAYMENT_METHODS } from "@/lib/utils"

interface ClientLite {
  id: string
  name: string
  phone: string | null
  creditLimit: number
  currentBalance: number
}

interface Sale {
  id: string
  number: number
  total: number
  paymentMethod: string
  createdAt: string
}

interface Payment {
  id: string
  amount: number
  paymentMethod: string
  reference: string | null
  notes: string | null
  createdAt: string
  user?: { name: string }
}

interface Props { client: ClientLite }

export default function CuentaCorrienteClient({ client: initialClient }: Props) {
  const [client, setClient] = useState(initialClient)
  const [sales, setSales] = useState<Sale[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [showPay, setShowPay] = useState(false)
  const [showLimit, setShowLimit] = useState(false)
  const [limitInput, setLimitInput] = useState(String(initialClient.creditLimit))
  const [savingLimit, setSavingLimit] = useState(false)
  const [payAmount, setPayAmount] = useState("")
  const [payMethod, setPayMethod] = useState("CASH")
  const [payRef, setPayRef] = useState("")
  const [payNotes, setPayNotes] = useState("")
  const [savingPay, setSavingPay] = useState(false)

  const load = async () => {
    setLoading(true)
    const [salesRes, payRes] = await Promise.all([
      fetch(`/api/ventas?limit=100`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/clientes/${client.id}/payment`).then((r) => r.json()).catch(() => ({})),
    ])
    const allSales: any[] = salesRes?.sales ?? []
    setSales(
      allSales
        .filter((s: any) => s.clientId === client.id && s.paymentMethod === "CUENTA_CORRIENTE" && s.status === "COMPLETED")
        .map((s: any) => ({ id: s.id, number: s.number, total: Number(s.total), paymentMethod: s.paymentMethod, createdAt: s.createdAt }))
    )
    setPayments((payRes?.payments ?? []).map((p: any) => ({ ...p, amount: Number(p.amount) })))
    setLoading(false)
  }

  useEffect(() => { load() }, [client.id])

  const available = useMemo(() => {
    if (client.creditLimit <= 0) return null
    return Math.max(0, client.creditLimit - client.currentBalance)
  }, [client])

  // Combined timeline (chronological), with running balance computed forward.
  const timeline = useMemo(() => {
    type Row = { date: string; kind: "SALE" | "PAYMENT"; amount: number; label: string; ref?: string }
    const rows: Row[] = [
      ...sales.map((s) => ({ date: s.createdAt, kind: "SALE" as const, amount: s.total, label: `Venta #${s.number}` })),
      ...payments.map((p) => ({
        date: p.createdAt,
        kind: "PAYMENT" as const,
        amount: -p.amount,
        label: `Pago (${p.paymentMethod})`,
        ref: p.reference ?? undefined,
      })),
    ].sort((a, b) => +new Date(a.date) - +new Date(b.date))

    // Running balance forward (sale +, payment -)
    let bal = 0
    const withBal = rows.map((r) => {
      bal = Math.round((bal + r.amount) * 100) / 100
      return { ...r, balance: bal }
    })
    return withBal.reverse()
  }, [sales, payments])

  const submitPayment = async () => {
    const amt = Number(payAmount)
    if (!amt || amt <= 0) {
      toast.error("Monto inválido")
      return
    }
    setSavingPay(true)
    const res = await fetch(`/api/clientes/${client.id}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: amt, paymentMethod: payMethod, reference: payRef || null, notes: payNotes || null }),
    })
    setSavingPay(false)
    const d = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(d?.error ?? "Error al registrar pago")
      return
    }
    toast.success("Pago registrado")
    setClient({ ...client, currentBalance: Number(d.client.currentBalance) })
    setShowPay(false)
    setPayAmount(""); setPayRef(""); setPayNotes(""); setPayMethod("CASH")
    load()
  }

  const saveLimit = async () => {
    const lim = Number(limitInput)
    if (Number.isNaN(lim) || lim < 0) {
      toast.error("Límite inválido")
      return
    }
    setSavingLimit(true)
    const res = await fetch(`/api/clientes/${client.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creditLimit: lim }),
    })
    setSavingLimit(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      toast.error(d?.error ?? "Error al actualizar límite")
      return
    }
    toast.success("Límite actualizado")
    setClient({ ...client, creditLimit: lim })
    setShowLimit(false)
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/clientes" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-300">
            <ArrowLeft size={14} /> Clientes
          </Link>
          <h1 className="text-2xl font-bold text-white mt-1">Cuenta corriente — {client.name}</h1>
          {client.phone && <p className="text-gray-500 text-sm mt-0.5">{client.phone}</p>}
        </div>
        <button onClick={() => setShowPay(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold">
          <Plus size={15} /> Registrar pago
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wide mb-1">
            <Wallet size={13} /> Saldo actual
          </div>
          <p className={`text-2xl font-bold ${client.currentBalance > 0 ? "text-orange-400" : "text-gray-200"}`}>
            {formatCurrency(client.currentBalance)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {client.currentBalance > 0 ? "El cliente te debe" : "Sin deuda"}
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-gray-400 text-xs uppercase tracking-wide mb-1">
            <span>Límite de crédito</span>
            <button onClick={() => { setLimitInput(String(client.creditLimit)); setShowLimit(true) }}
              className="text-gray-500 hover:text-purple-400">
              <Edit2 size={12} />
            </button>
          </div>
          <p className="text-2xl font-bold text-gray-200">
            {client.creditLimit > 0 ? formatCurrency(client.creditLimit) : <span className="text-gray-500">Sin límite</span>}
          </p>
          <p className="text-xs text-gray-500 mt-1">0 = sin límite</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">Crédito disponible</p>
          <p className="text-2xl font-bold text-green-400">
            {available != null ? formatCurrency(available) : <span className="text-gray-500">—</span>}
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800">
          <h2 className="text-white font-semibold text-sm">Movimientos</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-500"><Loader2 className="animate-spin inline mr-2" size={16} /> Cargando...</div>
        ) : timeline.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Sin movimientos todavía.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500">
                <th className="px-5 py-2 text-left font-medium">Fecha</th>
                <th className="px-5 py-2 text-left font-medium">Detalle</th>
                <th className="px-5 py-2 text-right font-medium">Cargo</th>
                <th className="px-5 py-2 text-right font-medium">Pago</th>
                <th className="px-5 py-2 text-right font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {timeline.map((row, i) => (
                <tr key={i} className="hover:bg-gray-800/30">
                  <td className="px-5 py-2 text-gray-400">{formatDateTime(row.date)}</td>
                  <td className="px-5 py-2 text-gray-200">{row.label}{row.ref ? <span className="text-gray-500"> · {row.ref}</span> : null}</td>
                  <td className="px-5 py-2 text-right text-orange-300">{row.kind === "SALE" ? formatCurrency(row.amount) : "—"}</td>
                  <td className="px-5 py-2 text-right text-green-300">{row.kind === "PAYMENT" ? formatCurrency(-row.amount) : "—"}</td>
                  <td className="px-5 py-2 text-right text-gray-100 font-medium">{formatCurrency(row.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pay modal */}
      {showPay && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h3 className="text-white font-semibold">Registrar pago</h3>
              <button onClick={() => setShowPay(false)} className="text-gray-500 hover:text-gray-300"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Monto recibido</label>
                <input type="number" min="0" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
                  placeholder={formatCurrency(client.currentBalance)}
                  className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-lg font-semibold text-right focus:outline-none focus:border-purple-500" />
                <p className="text-xs text-gray-500 mt-1">Saldo actual: {formatCurrency(client.currentBalance)}</p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Método de pago</label>
                <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500">
                  {PAYMENT_METHODS.filter((m) => m.value !== "MIXED" && m.value !== "LOYALTY_POINTS").map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Referencia (opcional)</label>
                <input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="N° de transferencia, recibo..."
                  className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Notas (opcional)</label>
                <textarea value={payNotes} onChange={(e) => setPayNotes(e.target.value)} rows={2}
                  className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500" />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-gray-800">
              <button onClick={() => setShowPay(false)} className="flex-1 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium">Cancelar</button>
              <button onClick={submitPayment} disabled={savingPay}
                className="flex-1 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-semibold">
                {savingPay ? "Guardando..." : "Registrar pago"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Limit modal */}
      {showLimit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h3 className="text-white font-semibold">Límite de crédito</h3>
              <button onClick={() => setShowLimit(false)} className="text-gray-500 hover:text-gray-300"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <input type="number" min="0" step="0.01" value={limitInput} onChange={(e) => setLimitInput(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-lg font-semibold text-right focus:outline-none focus:border-purple-500" />
              <p className="text-xs text-gray-500">Poné 0 para no aplicar límite. El sistema bloquea ventas a cuenta que excedan este monto.</p>
            </div>
            <div className="flex gap-3 p-5 border-t border-gray-800">
              <button onClick={() => setShowLimit(false)} className="flex-1 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium">Cancelar</button>
              <button onClick={saveLimit} disabled={savingLimit}
                className="flex-1 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-semibold">
                {savingLimit ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
