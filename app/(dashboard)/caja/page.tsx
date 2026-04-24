"use client"

import { useState, useEffect } from "react"
import { DollarSign, Lock, Unlock, AlertCircle, CheckCircle, History, TrendingUp, Users } from "lucide-react"
import toast from "react-hot-toast"
import { formatCurrency, formatDateTime } from "@/lib/utils"
import { useConfirm } from "@/components/shared/ConfirmDialog"
import { CurrencyInput } from "@/components/ui/CurrencyInput"
import { PageTip } from "@/components/shared/PageTip"

interface CashSession {
  id: string
  status: "OPEN" | "CLOSED"
  openingBalance: number
  closingBalance: number | null
  difference: number | null
  notes: string | null
  createdAt: string
  closedAt: string | null
  user: { name: string | null }
  _count?: { sales: number }
}

export default function CajaPage() {
  const [current, setCurrent] = useState<CashSession | null>(null)
  const [salesTotal, setSalesTotal] = useState(0)
  const [grossProfit, setGrossProfit] = useState(0)
  const [marginPct, setMarginPct] = useState(0)
  const [expensesTotal, setExpensesTotal] = useState(0)
  const [netProfit, setNetProfit] = useState(0)
  const [sessions, setSessions] = useState<CashSession[]>([])
  const [openSessions, setOpenSessions] = useState<CashSession[]>([])
  const [multiCash, setMultiCash] = useState(false)
  const [loading, setLoading] = useState(true)
  const [openAmount, setOpenAmount] = useState("")
  const [closeAmount, setCloseAmount] = useState("")
  const [closeNotes, setCloseNotes] = useState("")
  const [working, setWorking] = useState(false)
  const [view, setView] = useState<"current" | "history">("current")
  const confirm = useConfirm()

  const load = async () => {
    setLoading(true)
    const [curRes, listRes] = await Promise.all([
      fetch("/api/caja/sesion-actual"),
      fetch("/api/caja"),
    ])
    if (curRes.ok) {
      const d = await curRes.json()
      setCurrent(d.session)
      setSalesTotal(Number(d.salesTotal ?? 0))
      setGrossProfit(Number(d.grossProfit ?? 0))
      setMarginPct(Number(d.marginPct ?? 0))
      setExpensesTotal(Number(d.expensesTotal ?? 0))
      setNetProfit(Number(d.netProfit ?? 0))
      setMultiCash(!!d.multiCash)
      setOpenSessions(d.openSessions ?? [])
    }
    if (listRes.ok) {
      const d = await listRes.json()
      setSessions(d.sessions ?? [])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleOpen = async () => {
    const amount = parseFloat(openAmount)
    if (isNaN(amount) || amount < 0) return toast.error("Ingresá un monto válido")
    setWorking(true)
    const res = await fetch("/api/caja", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openingBalance: amount }),
    })
    if (res.ok) { setOpenAmount(""); toast.success("Caja abierta"); await load() }
    else { const d = await res.json(); toast.error(d.error || "Error al abrir caja") }
    setWorking(false)
  }

  const handleClose = async () => {
    if (!current) return
    const amount = parseFloat(closeAmount)
    if (isNaN(amount) || amount < 0) return toast.error("Ingresá el monto de cierre")
    const expected = Number(current.openingBalance) + salesTotal
    const diff = amount - expected
    if (Math.abs(diff) > 1000) {
      const ok = await confirm({
        title: "Diferencia detectada",
        description: `Diferencia de ${formatCurrency(diff)}. ¿Confirmar cierre de todas formas?`,
        confirmText: "Cerrar igualmente",
        tone: "warning",
      })
      if (!ok) return
    }
    setWorking(true)
    const res = await fetch(`/api/caja/${current.id}/cerrar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ closingBalance: amount, notes: closeNotes }),
    })
    if (res.ok) { setCloseAmount(""); setCloseNotes(""); toast.success("Caja cerrada"); await load() }
    else { const d = await res.json(); toast.error(d.error || "Error al cerrar caja") }
    setWorking(false)
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-800 rounded w-40" />
          <div className="h-48 bg-gray-800 rounded-xl" />
        </div>
      </div>
    )
  }

  const expectedCash = current ? Number(current.openingBalance) + salesTotal : 0

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageTip id="caja:intro" tone="amber">
        La <strong>caja</strong> te ayuda a controlar el efectivo: <strong>abrís</strong> contando lo que tenés al arrancar,
        durante el día se suman las ventas en efectivo, y al <strong>cerrar</strong> comparás contra lo real para detectar diferencias.
        Vas a ver también <strong>ganancia bruta, margen y neta</strong> en vivo.
      </PageTip>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Caja</h1>
          <p className="text-gray-400 text-sm mt-1">Control de efectivo y sesiones</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView("current")}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${view === "current" ? "bg-purple-600 text-white" : "bg-gray-800 hover:bg-gray-700 text-gray-300"}`}>
            Caja actual
          </button>
          <button onClick={() => setView("history")}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${view === "history" ? "bg-purple-600 text-white" : "bg-gray-800 hover:bg-gray-700 text-gray-300"}`}>
            <History size={14} className="inline mr-1" />Historial
          </button>
        </div>
      </div>

      {view === "current" ? (
        <div className="space-y-6">
          {multiCash && openSessions.length > 0 && (
            <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users size={16} className="text-purple-400" />
                <h3 className="text-white font-medium text-sm">
                  Cajas abiertas ahora ({openSessions.length})
                </h3>
                <span className="ml-auto text-xs text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-full">
                  Multi-caja
                </span>
              </div>
              <ul className="space-y-1.5">
                {openSessions.map(s => (
                  <li key={s.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                      <span className="text-gray-200">{s.user?.name || "—"}</span>
                      {current && s.id === current.id && (
                        <span className="text-xs text-purple-300">(la tuya)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>Apertura {formatCurrency(s.openingBalance)}</span>
                      <span>· {formatDateTime(s.createdAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!current ? (
            /* Open cash session - centered with max-width */
            <div className="bg-gradient-to-br from-gray-900 to-gray-900/60 rounded-xl p-6 border border-amber-700/30 relative overflow-hidden max-w-2xl mx-auto">
              <div
                className="absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl opacity-30 pointer-events-none bg-amber-500"
                aria-hidden
              />
              <div className="relative">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-amber-900/40 border border-amber-700/30 flex items-center justify-center">
                      <Unlock size={22} className="text-amber-400" />
                    </div>
                    <div>
                      <h2 className="text-white font-bold text-lg">Abrir caja</h2>
                      <p className="text-gray-400 text-sm">Empezá la jornada declarando el efectivo</p>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-900/10 border border-amber-700/20 rounded-lg p-3 mb-5">
                  <p className="text-xs text-amber-300/90 flex items-start gap-2">
                    <span className="flex-shrink-0">💡</span>
                    <span>Contá el efectivo que tenés en el cajón al abrir. Esto te va a permitir detectar diferencias al cerrar.</span>
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Monto inicial</label>
                    <CurrencyInput
                      value={parseFloat(openAmount) || 0}
                      onValueChange={(n) => setOpenAmount(String(n))}
                      onKeyDown={e => e.key === "Enter" && handleOpen()}
                      placeholder="0"
                      className="text-xl font-semibold py-4"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[1000, 5000, 10000, 20000, 50000, 100000].map((n) => (
                      <button
                        key={n}
                        onClick={() => setOpenAmount(String((parseFloat(openAmount) || 0) + n))}
                        className="text-xs py-1.5 rounded-lg bg-gray-800 hover:bg-amber-900/40 hover:text-amber-300 text-gray-400 transition-colors"
                      >
                        +${n.toLocaleString("es-AR")}
                      </button>
                    ))}
                  </div>
                  <button onClick={handleOpen} disabled={working || !openAmount || parseFloat(openAmount) < 0}
                    className="w-full py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">
                    {working ? "Abriendo..." : "Abrir Caja"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Current session status - left column (2/3) */}
              <div className="lg:col-span-2 bg-gray-900 rounded-xl p-6 border border-gray-800">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                      <CheckCircle size={20} className="text-green-400" />
                    </div>
                    <div>
                      <h2 className="text-white font-semibold">Caja abierta</h2>
                      <p className="text-gray-500 text-sm">Por {current.user?.name || "usuario"} · {formatDateTime(current.createdAt)}</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-medium border border-green-500/20">ABIERTA</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <p className="text-gray-500 text-xs mb-1">Apertura</p>
                    <p className="text-white text-xl font-bold">{formatCurrency(current.openingBalance)}</p>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <p className="text-gray-500 text-xs mb-1">Ventas en efectivo</p>
                    <p className="text-green-400 text-xl font-bold">+{formatCurrency(salesTotal)}</p>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <p className="text-gray-500 text-xs mb-1">Efectivo esperado</p>
                    <p className="text-purple-400 text-xl font-bold">{formatCurrency(expectedCash)}</p>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <p className="text-gray-500 text-xs mb-1">Ventas totales</p>
                    <p className="text-white text-xl font-bold">{current._count?.sales ?? 0}</p>
                  </div>
                </div>

                {/* Ganancias y margen */}
                <div className="mt-4 pt-4 border-t border-gray-800">
                  <h3 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">
                    Rendimiento de la caja
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-sky-900/30 to-sky-950/30 border border-sky-800/40 rounded-lg p-4">
                      <p className="text-sky-400 text-xs mb-1 font-medium">Ganancia bruta</p>
                      <p className="text-white text-lg font-bold">{formatCurrency(grossProfit)}</p>
                      <p className="text-gray-500 text-[10px] mt-1">Ventas − costo de productos</p>
                    </div>
                    <div className="bg-gradient-to-br from-purple-900/30 to-purple-950/30 border border-purple-800/40 rounded-lg p-4">
                      <p className="text-purple-400 text-xs mb-1 font-medium">Margen</p>
                      <p className="text-white text-lg font-bold">{marginPct.toFixed(1)}%</p>
                      <p className="text-gray-500 text-[10px] mt-1">Bruto / ventas</p>
                    </div>
                    <div className="bg-gradient-to-br from-orange-900/30 to-orange-950/30 border border-orange-800/40 rounded-lg p-4">
                      <p className="text-orange-400 text-xs mb-1 font-medium">Gastos</p>
                      <p className="text-white text-lg font-bold">−{formatCurrency(expensesTotal)}</p>
                      <p className="text-gray-500 text-[10px] mt-1">Desde la apertura</p>
                    </div>
                    <div className={`bg-gradient-to-br ${netProfit >= 0 ? "from-emerald-900/30 to-emerald-950/30 border-emerald-800/40" : "from-red-900/30 to-red-950/30 border-red-800/40"} border rounded-lg p-4`}>
                      <p className={`text-xs mb-1 font-medium ${netProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>Ganancia neta</p>
                      <p className="text-white text-lg font-bold">{formatCurrency(netProfit)}</p>
                      <p className="text-gray-500 text-[10px] mt-1">Bruto − gastos</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Close session - right column (1/3) sticky */}
              <div className="lg:col-span-1 bg-gray-900 rounded-xl p-6 border border-gray-800 lg:sticky lg:top-6 lg:self-start">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                    <Lock size={20} className="text-red-400" />
                  </div>
                  <div>
                    <h2 className="text-white font-semibold">Cerrar caja</h2>
                    <p className="text-gray-500 text-sm">Ingresá el efectivo real al cerrar</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Monto real en caja al cerrar</label>
                    <CurrencyInput
                      value={parseFloat(closeAmount) || 0}
                      onValueChange={(n) => setCloseAmount(String(n))}
                      placeholder={String(expectedCash)}
                      className="text-xl font-semibold py-4"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">Esperado: {formatCurrency(expectedCash)}</p>
                    {closeAmount && !isNaN(parseFloat(closeAmount)) && (
                      <div className={`mt-2 text-sm px-3 py-2 rounded-lg ${
                        parseFloat(closeAmount) - expectedCash === 0
                          ? "bg-emerald-900/20 border border-emerald-700/40 text-emerald-300"
                          : parseFloat(closeAmount) - expectedCash > 0
                          ? "bg-sky-900/20 border border-sky-700/40 text-sky-300"
                          : "bg-red-900/20 border border-red-700/40 text-red-300"
                      }`}>
                        {parseFloat(closeAmount) - expectedCash === 0 ? (
                          <>✓ Coincide con lo esperado</>
                        ) : (
                          <>
                            <strong>Diferencia:</strong> {formatCurrency(parseFloat(closeAmount) - expectedCash)}
                            {" "}{parseFloat(closeAmount) > expectedCash ? "(sobrante)" : "(faltante)"}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1.5">Notas (opcional)</label>
                    <textarea value={closeNotes} onChange={e => setCloseNotes(e.target.value)}
                      rows={2} placeholder="Observaciones del cierre..."
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500 resize-none" />
                  </div>
                  <button onClick={handleClose} disabled={working || !closeAmount}
                    className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors">
                    {working ? "Cerrando..." : "Cerrar Caja"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* History */
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="p-4 text-left text-gray-400 font-medium">Apertura</th>
                  <th className="p-4 text-left text-gray-400 font-medium">Cierre</th>
                  <th className="p-4 text-left text-gray-400 font-medium">Responsable</th>
                  <th className="p-4 text-right text-gray-400 font-medium">Apertura</th>
                  <th className="p-4 text-right text-gray-400 font-medium">Cierre</th>
                  <th className="p-4 text-right text-gray-400 font-medium">Diferencia</th>
                  <th className="p-4 text-right text-gray-400 font-medium">Ventas</th>
                  <th className="p-4 text-center text-gray-400 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-gray-500">
                      <DollarSign size={40} className="mx-auto mb-3 opacity-30" />
                      No hay sesiones de caja
                    </td>
                  </tr>
                ) : sessions.map(s => (
                  <tr key={s.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="p-4 text-gray-300">{formatDateTime(s.createdAt)}</td>
                    <td className="p-4 text-gray-300">{s.closedAt ? formatDateTime(s.closedAt) : "—"}</td>
                    <td className="p-4 text-gray-300">{s.user?.name || "—"}</td>
                    <td className="p-4 text-right text-gray-300">{formatCurrency(s.openingBalance)}</td>
                    <td className="p-4 text-right text-gray-300">{s.closingBalance != null ? formatCurrency(s.closingBalance) : "—"}</td>
                    <td className="p-4 text-right">
                      {s.difference != null ? (
                        <span className={s.difference >= 0 ? "text-green-400" : "text-red-400"}>
                          {s.difference >= 0 ? "+" : ""}{formatCurrency(s.difference)}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="p-4 text-right text-gray-300">{s._count?.sales ?? 0}</td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${s.status === "OPEN" ? "bg-green-500/10 text-green-400" : "bg-gray-700 text-gray-400"}`}>
                        {s.status === "OPEN" ? "Abierta" : "Cerrada"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
