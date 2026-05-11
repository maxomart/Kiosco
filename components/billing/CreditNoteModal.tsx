"use client"

import { useState, useEffect } from "react"
import { X, FileMinus, Loader2, Check, AlertCircle, AlertTriangle } from "lucide-react"
import toast from "react-hot-toast"

interface Props {
  saleId: string
  saleTotal: number
  invoiceLetter: string | null
  invoiceNumber: number | null
  onClose: () => void
  onIssued?: () => void
}

interface IssuedNote {
  cae: string
  invoiceNumber: number
  invoiceCode: number
  qrUrl: string
}

/**
 * Modal para emitir una nota de crédito sobre una venta facturada.
 * La NC neutraliza la factura original y deja la venta como CANCELLED.
 */
export function CreditNoteModal({ saleId, saleTotal, invoiceLetter, invoiceNumber, onClose, onIssued }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [issued, setIssued] = useState<IssuedNote | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose, submitting])

  const handleEmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const r = await fetch(`/api/sales/${saleId}/credit-note`, { method: "POST" })
      const d = await r.json()
      if (!r.ok || !d.ok) {
        setError(d.error ?? "No se pudo emitir la nota de crédito")
        toast.error(d.error ?? "Error al emitir NC")
        return
      }
      setIssued({
        cae: d.cae,
        invoiceNumber: d.invoiceNumber,
        invoiceCode: d.invoiceCode,
        qrUrl: d.qrUrl,
      })
      toast.success(`Nota de crédito emitida — N° ${d.invoiceNumber}`)
      onIssued?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <FileMinus size={18} className="text-red-400" />
            <h2 className="text-lg font-bold text-white">
              {issued ? "Nota de crédito emitida" : "Emitir nota de crédito"}
            </h2>
          </div>
          <button onClick={onClose} disabled={submitting} className="text-gray-400 hover:text-white p-1 rounded">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {issued ? (
            <>
              <div className="text-center space-y-2 pb-2">
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
                  <Check className="w-8 h-8 text-emerald-400" strokeWidth={3} />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-emerald-300 font-bold">
                    Nota de crédito {invoiceLetter ?? ""}
                  </p>
                  <p className="text-2xl font-bold text-white tabular-nums">N° {issued.invoiceNumber}</p>
                  <p className="text-xs text-gray-400 mt-1">CAE: {issued.cae}</p>
                </div>
              </div>

              {issued.qrUrl && (
                <div className="bg-white p-4 rounded-xl flex items-center justify-center">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(issued.qrUrl)}`}
                    alt="QR AFIP"
                    className="w-48 h-48"
                  />
                </div>
              )}

              <p className="text-[11px] text-gray-500 text-center">
                Esta NC anula fiscalmente la factura {invoiceLetter} N° {invoiceNumber}.
                La venta queda registrada como anulada.
              </p>

              <button
                type="button"
                onClick={onClose}
                className="w-full px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium"
              >
                Listo
              </button>
            </>
          ) : (
            <>
              <div className="bg-red-950/30 border border-red-900/40 rounded-lg p-3 text-xs text-red-200 flex gap-2">
                <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium text-red-100">
                    Vas a anular la factura {invoiceLetter} N° {invoiceNumber} con una nota de crédito.
                  </p>
                  <p>
                    Total a anular: <span className="font-bold text-white">${saleTotal.toLocaleString("es-AR")}</span>.
                    La venta queda como anulada y la NC queda registrada en AFIP — no se puede deshacer.
                  </p>
                </div>
              </div>

              {error && (
                <div className="bg-red-950/40 border border-red-800/40 rounded-lg p-3 text-xs text-red-200 flex gap-2">
                  <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm border border-gray-700 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleEmit}
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Emitiendo...
                    </>
                  ) : (
                    "Emitir nota de crédito"
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
