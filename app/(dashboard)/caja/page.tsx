"use client"

import { useEffect, useState } from "react"
import { formatCurrency } from "@/lib/utils"
import { Lock, Unlock, DollarSign, ShoppingCart, Clock, AlertCircle, Download, TrendingUp, TrendingDown } from "lucide-react"
import toast from "react-hot-toast"

interface CashSession {
  id: string
  status: "OPEN" | "CLOSED"
  openedAt: string
  closedAt?: string
  openingBalance: number
  closingBalance?: number
  _count?: { sales: number }
  salesTotalSum?: number
  user?: { name: string }
}

export default function CajaPage() {
  const [session, setSession] = useState<CashSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [openBalance, setOpenBalance] = useState("")
  const [closeBalance, setCloseBalance] = useState("")

  const fetchSession = async () => {
    try {
      const r = await fetch("/api/caja")
      if (r.ok) {
        const data = await r.json()
        setSession(data.session ?? null)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSession() }, [])

  const handleOpen = async () => {
    const balance = parseFloat(openBalance) || 0
    setProcessing(true)
    try {
      const r = await fetch("/api/caja", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open", openingBalance: balance }),
      })
      if (r.ok) {
        toast.success("Caja abierta correctamente")
        setOpenBalance("")
        fetchSession()
      } else {
        const err = await r.json()
        toast.error(err.error ?? "Error al abrir la caja")
      }
    } catch {
      toast.error("Error de conexión")
    } finally {
      setProcessing(false)
    }
  }

  const handleClose = async () => {
    if (!session) return
    const balance = parseFloat(closeBalance) || 0
    if (!confirm(`¿Cerrar la caja con saldo de ${formatCurrency(balance)}?`)) return
    setProcessing(true)
    try {
      const r = await fetch("/api/caja", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close", sessionId: session.id, closingBalance: balance }),
      })
      if (r.ok) {
        toast.success("Caja cerrada correctamente")
        setCloseBalance("")
        fetchSession()
      } else {
        const err = await r.json()
        toast.error(err.error ?? "Error al cerrar la caja")
      }
    } catch {
      toast.error("Error de conexión")
    } finally {
      setProcessing(false)
    }
  }

  const downloadSummary = () => {
    if (!session) return
    const diff = parseFloat(closeBalance) - (session.openingBalance + (session.salesTotalSum ?? 0))
    const text = [
      `=== RESUMEN DE CAJA ===`,
      `Fecha: ${new Date(session.openedAt).toLocaleDateString("es-AR")}`,
      `Apertura: ${new Date(session.openedAt).toLocaleTimeString("es-AR")}`,
      `Saldo inicial: ${formatCurrency(session.openingBalance)}`,
      `Ventas del día: ${formatCurrency(session.salesTotalSum ?? 0)} (${session._count?.sales ?? 0} transacciones)`,
      `Total esperado en caja: ${formatCurrency(session.openingBalance + (session.salesTotalSum ?? 0))}`,
      `Saldo de cierre (contado): ${formatCurrency(parseFloat(closeBalance) || 0)}`,
      `Diferencia: ${diff >= 0 ? "+" : ""}${formatCurrency(diff)}`,
      diff > 0 ? "→ Sobra dinero" : diff < 0 ? "→ Falta dinero" : "→ Cuadra perfecto",
    ].join("\n")
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `caja-${new Date(session.openedAt).toISOString().slice(0, 10)}.txt`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const isOpen = session?.status === "OPEN"

  // Calcular diferencia en tiempo real
  const closeBalanceParsed = parseFloat(closeBalance)
  const hasCloseBalance = !isNaN(closeBalanceParsed) && closeBalance !== ""
  const totalEsperado = session ? session.openingBalance + (session.salesTotalSum ?? 0) : 0
  const diferencia = hasCloseBalance ? closeBalanceParsed - totalEsperado : 0

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Caja</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">Gestión de sesiones de caja</p>
      </div>

      {/* Status card */}
      <div className={`rounded-2xl p-6 mb-6 text-white shadow-lg ${isOpen ? "bg-gradient-to-br from-green-500 to-green-600" : "bg-gradient-to-br from-gray-500 to-gray-600"}`}>
        <div className="flex items-center gap-3 mb-4">
          {isOpen ? <Unlock size={28} /> : <Lock size={28} />}
          <div>
            <p className="text-sm font-semibold opacity-80 uppercase tracking-wide">Estado de la caja</p>
            <p className="text-2xl font-bold">{isOpen ? "ABIERTA" : "CERRADA"}</p>
          </div>
        </div>
        {session && (
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div>
              <p className="text-xs opacity-70 mb-0.5">Saldo inicial</p>
              <p className="text-xl font-bold">{formatCurrency(session.openingBalance)}</p>
            </div>
            <div>
              <p className="text-xs opacity-70 mb-0.5">Apertura</p>
              <p className="text-sm font-semibold">
                {new Date(session.openedAt).toLocaleString("es-AR", {
                  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Session details */}
      {session && isOpen && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingCart size={16} className="text-blue-500" />
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Ventas</p>
            </div>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">
              {session._count?.sales ?? 0}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">transacciones</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign size={16} className="text-green-500" />
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total ventas</p>
            </div>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">
              {formatCurrency(session.salesTotalSum ?? 0)}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">en esta sesión</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={16} className="text-purple-500" />
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Tiempo abierta</p>
            </div>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">
              {Math.floor((Date.now() - new Date(session.openedAt).getTime()) / 3600000)}h
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">desde la apertura</p>
          </div>
        </div>
      )}

      {/* Card de diferencia — solo visible cuando hay monto de cierre y la caja está abierta */}
      {isOpen && hasCloseBalance && (
        <div className={`rounded-2xl p-5 mb-4 border shadow-sm flex items-center gap-4 ${
          diferencia === 0
            ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
            : diferencia > 0
            ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
            : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
        }`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            diferencia >= 0
              ? "bg-green-100 dark:bg-green-900/40"
              : "bg-red-100 dark:bg-red-900/40"
          }`}>
            {diferencia > 0
              ? <TrendingUp size={20} className="text-green-600 dark:text-green-400" />
              : diferencia < 0
              ? <TrendingDown size={20} className="text-red-600 dark:text-red-400" />
              : <DollarSign size={20} className="text-green-600 dark:text-green-400" />
            }
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide mb-0.5 text-gray-500 dark:text-gray-400">Diferencia</p>
            <p className={`text-xl font-bold ${
              diferencia >= 0
                ? "text-green-700 dark:text-green-400"
                : "text-red-700 dark:text-red-400"
            }`}>
              {diferencia === 0
                ? "Cuadra perfecto"
                : diferencia > 0
                ? `Sobra dinero: +${formatCurrency(diferencia)}`
                : `Falta dinero: ${formatCurrency(diferencia)}`}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Esperado: {formatCurrency(totalEsperado)} · Contado: {formatCurrency(closeBalanceParsed)}
            </p>
          </div>
          <button
            onClick={downloadSummary}
            className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition text-xs font-semibold flex-shrink-0"
            title="Descargar resumen"
          >
            <Download size={14} />
            Descargar resumen
          </button>
        </div>
      )}

      {/* Action panel */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        {!isOpen ? (
          <div>
            <h2 className="text-base font-bold text-gray-800 dark:text-white mb-1">Abrir caja</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Ingresá el saldo inicial en efectivo para comenzar la sesión.
            </p>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 font-semibold">$</span>
                <input
                  type="number"
                  value={openBalance}
                  onChange={(e) => setOpenBalance(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:border-blue-500 dark:focus:border-blue-400 transition text-sm dark:text-white"
                />
              </div>
              <button
                onClick={handleOpen}
                disabled={processing}
                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-xl transition text-sm font-bold"
              >
                <Unlock size={16} />
                {processing ? "Abriendo..." : "Abrir caja"}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-start gap-3 mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-700/50">
              <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Al cerrar la caja se registrarán las ventas y gastos de esta sesión.
              </p>
            </div>
            <h2 className="text-base font-bold text-gray-800 dark:text-white mb-1">Cerrar caja</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Contá el dinero en caja e ingresá el monto real.
            </p>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 font-semibold">$</span>
                <input
                  type="number"
                  value={closeBalance}
                  onChange={(e) => setCloseBalance(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:border-blue-500 dark:focus:border-blue-400 transition text-sm dark:text-white"
                />
              </div>
              <button
                onClick={handleClose}
                disabled={processing}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-xl transition text-sm font-bold"
              >
                <Lock size={16} />
                {processing ? "Cerrando..." : "Cerrar caja"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
