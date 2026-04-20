"use client"

/**
 * SyncStatusClient — modal listing pending offline sales.
 *
 * Per-row: items count, total, attempts, last error, "Descartar".
 * Bulk: "Reintentar todas" + "Vaciar cola" (with confirm).
 */

import { useState } from "react"
import { Loader2, RotateCw, Trash2, AlertCircle } from "lucide-react"
import { Modal } from "@/components/ui"
import { discardSale, clearPendingSales, type PendingSale } from "@/lib/offline-store"
import { formatCurrency } from "@/lib/utils"
import toast from "react-hot-toast"

interface Props {
  pendingList: PendingSale[]
  onClose: () => void
  onChange: () => Promise<void> | void
  isOnline: boolean
  isSyncing: boolean
  flush: () => Promise<void>
}

export function SyncStatusClient({
  pendingList, onClose, onChange, isOnline, isSyncing, flush,
}: Props) {
  const [confirmClear, setConfirmClear] = useState(false)

  const handleDiscard = async (id: string) => {
    if (!confirm("¿Descartar esta venta? Esta acción no se puede deshacer.")) return
    await discardSale(id)
    await onChange()
    toast.success("Venta descartada")
  }

  const handleClearAll = async () => {
    await clearPendingSales()
    setConfirmClear(false)
    await onChange()
    toast.success("Cola vaciada")
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Ventas pendientes (${pendingList.length})`}
      description="Ventas guardadas offline esperando sincronización"
      size="xl"
      footer={
        <>
          <button
            onClick={() => setConfirmClear(true)}
            disabled={pendingList.length === 0}
            className="px-3 py-2 text-sm rounded-lg bg-red-900/40 hover:bg-red-800/60 text-red-200 disabled:opacity-40 transition flex items-center gap-1.5"
          >
            <Trash2 size={14} /> Vaciar cola
          </button>
          <button
            onClick={() => flush()}
            disabled={!isOnline || isSyncing || pendingList.length === 0}
            className="px-3 py-2 text-sm rounded-lg bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40 transition flex items-center gap-1.5"
          >
            {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <RotateCw size={14} />}
            Reintentar todas
          </button>
        </>
      }
    >
      {pendingList.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">No hay ventas pendientes.</p>
      ) : (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {pendingList.map((p) => {
            const items = (p.payload?.items ?? []) as any[]
            const total = Number(p.payload?.total ?? 0)
            return (
              <div
                key={p.id}
                className="rounded-lg border border-gray-800 bg-gray-800/40 p-3 text-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-gray-500">
                        {p.id.slice(0, 8)}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(p.createdAt).toLocaleString("es-AR")}
                      </span>
                      {p.attempts > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-900/40 text-yellow-300">
                          {p.attempts} {p.attempts === 1 ? "intento" : "intentos"}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-200">
                      <strong>{items.length}</strong> {items.length === 1 ? "ítem" : "ítems"} ·{" "}
                      <span className="text-purple-300 font-semibold">{formatCurrency(total)}</span> ·{" "}
                      <span className="text-gray-400">{p.payload?.paymentMethod}</span>
                    </p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {items.map((i) => `${i.quantity}× ${i.productName}`).join(", ")}
                    </p>
                    {p.lastError && (
                      <p className="text-xs text-red-300 mt-1.5 flex items-start gap-1">
                        <AlertCircle size={12} className="mt-0.5 shrink-0" />
                        <span>{p.lastError}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <button
                      onClick={() => handleDiscard(p.id)}
                      title="Descartar"
                      className="p-1.5 rounded text-red-400 hover:bg-red-900/30 transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {confirmClear && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center rounded-2xl p-6">
          <div className="bg-gray-900 border border-red-800 rounded-xl p-5 max-w-sm">
            <h3 className="font-bold text-red-300 mb-2">Vaciar cola</h3>
            <p className="text-sm text-gray-300 mb-4">
              Vas a descartar <strong>{pendingList.length}</strong> ventas pendientes. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmClear(false)}
                className="px-3 py-1.5 text-sm rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={handleClearAll}
                className="px-3 py-1.5 text-sm rounded-lg bg-red-700 hover:bg-red-600 text-white"
              >
                Sí, vaciar
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
