"use client"

import { useState, useEffect } from "react"
import { X, FileCheck2, Loader2, Check, AlertCircle, Download } from "lucide-react"
import toast from "react-hot-toast"

type DocType = "CUIT" | "CUIL" | "DNI" | "EXTRANJERO" | "SIN_IDENTIFICAR"
type CondicionIVA = "RI" | "MONOTRIBUTO" | "EXENTO" | "CF"

interface Props {
  saleId: string
  saleTotal: number
  /** Si la venta ya tiene CAE, mostramos modo "ya emitida" con QR. */
  existingCae?: string | null
  existingInvoice?: { letter: string | null; number: number | null; pos: number | null; qrUrl: string | null } | null
  onClose: () => void
  onIssued?: () => void
}

const DOC_TYPES: { value: DocType; label: string }[] = [
  { value: "DNI", label: "DNI" },
  { value: "CUIT", label: "CUIT" },
  { value: "CUIL", label: "CUIL" },
  { value: "EXTRANJERO", label: "Pasaporte" },
  { value: "SIN_IDENTIFICAR", label: "Consumidor Final" },
]

export function InvoiceModal({ saleId, saleTotal, existingCae, existingInvoice, onClose, onIssued }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [issued, setIssued] = useState<{ cae: string; invoiceNumber: number; qrUrl: string; letter: string; pos?: number } | null>(
    existingCae && existingInvoice
      ? { cae: existingCae, invoiceNumber: existingInvoice.number ?? 0, qrUrl: existingInvoice.qrUrl ?? "", letter: existingInvoice.letter ?? "", pos: existingInvoice.pos ?? 1 }
      : null
  )

  const [docType, setDocType] = useState<DocType>("SIN_IDENTIFICAR")
  const [docNumber, setDocNumber] = useState("")
  const [condicionIVA, setCondicionIVA] = useState<CondicionIVA>("CF")

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !submitting) onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose, submitting])

  const handleEmit = async () => {
    if (docType !== "SIN_IDENTIFICAR" && !docNumber.match(/^\d{7,11}$/)) {
      setError("El número de documento es obligatorio (7-11 dígitos)")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const r = await fetch(`/api/sales/${saleId}/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerDocType: docType,
          customerDocNumber: docNumber || "0",
          customerCondicionIVA: condicionIVA,
        }),
      })
      const d = await r.json()
      if (!r.ok || !d.ok) {
        setError(d.error ?? "No se pudo emitir la factura")
        toast.error(d.error ?? "Error al emitir")
        return
      }
      setIssued({ cae: d.cae, invoiceNumber: d.invoiceNumber, qrUrl: d.qrUrl, letter: d.invoiceLetter, pos: d.pos ?? 1 })
      toast.success(`Factura ${d.invoiceLetter} emitida — N° ${d.invoiceNumber}`)
      onIssued?.()
    } catch (e: any) {
      setError(e?.message ?? "Error de red")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-md max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <FileCheck2 size={18} className="text-amber-400" />
            <h2 className="text-lg font-bold text-white">
              {issued ? "Factura emitida" : "Emitir factura electrónica"}
            </h2>
          </div>
          <button onClick={onClose} disabled={submitting} className="text-gray-400 hover:text-white p-1 rounded">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1 scrollbar-thin">
          {issued ? (
            <>
              <div className="text-center space-y-2 pb-2">
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
                  <Check className="w-8 h-8 text-emerald-400" strokeWidth={3} />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-emerald-300 font-bold">Factura {issued.letter}</p>
                  <p className="text-2xl font-bold text-white tabular-nums">N° {issued.invoiceNumber}</p>
                  <p className="text-xs text-gray-400 mt-1">CAE: {issued.cae}</p>
                </div>
              </div>

              {issued.qrUrl && (
                <div className="bg-white p-4 rounded-xl flex items-center justify-center">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(issued.qrUrl)}`}
                    alt="QR ARCA"
                    className="w-48 h-48"
                  />
                </div>
              )}

              <p className="text-[11px] text-gray-500 text-center">
                QR de validación AFIP — el cliente puede escanearlo para verificar la factura.
              </p>

              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`/api/ventas/${saleId}/ticket`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm border border-gray-700"
                >
                  <Download size={14} /> Ticket
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium"
                >
                  Listo
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="bg-amber-950/30 border border-amber-900/40 rounded-lg p-3 text-xs text-amber-200 flex gap-2">
                <AlertCircle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <p>
                  Total a facturar: <span className="font-bold text-white">${saleTotal.toLocaleString("es-AR")}</span>.
                  El tipo (A/B/C) se decide automático según tu condición y la del cliente.
                </p>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-[0.1em] text-gray-400 font-bold mb-1.5">
                  Tipo de documento
                </label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as DocType)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                >
                  {DOC_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>

              {docType !== "SIN_IDENTIFICAR" && (
                <div>
                  <label className="block text-[11px] uppercase tracking-[0.1em] text-gray-400 font-bold mb-1.5">
                    Número de documento
                  </label>
                  <input
                    type="text" inputMode="numeric"
                    value={docNumber}
                    onChange={(e) => setDocNumber(e.target.value.replace(/\D/g, "").slice(0, 11))}
                    placeholder={docType === "CUIT" || docType === "CUIL" ? "20123456789" : "12345678"}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] uppercase tracking-[0.1em] text-gray-400 font-bold mb-1.5">
                  Condición frente al IVA
                </label>
                <select
                  value={condicionIVA}
                  onChange={(e) => setCondicionIVA(e.target.value as CondicionIVA)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                >
                  <option value="CF">Consumidor Final</option>
                  <option value="MONOTRIBUTO">Monotributista</option>
                  <option value="RI">Responsable Inscripto</option>
                  <option value="EXENTO">Exento</option>
                </select>
              </div>

              {error && (
                <div className="bg-red-950/40 border border-red-800/40 rounded-lg p-3 text-xs text-red-200 flex gap-2">
                  <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button" onClick={onClose} disabled={submitting}
                  className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm border border-gray-700 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button" onClick={handleEmit} disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold disabled:opacity-50"
                >
                  {submitting ? <><Loader2 size={14} className="animate-spin" /> Emitiendo...</> : "Emitir factura"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
