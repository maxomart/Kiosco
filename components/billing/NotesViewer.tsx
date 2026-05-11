"use client"

import { useState, useEffect } from "react"
import { X, FileMinus, FilePlus2, Download, QrCode, Receipt } from "lucide-react"

export interface AfipNoteSummary {
  id: string
  kind: "credit" | "debit"
  invoiceNumber: number
  invoiceLetter: string
  pointOfSale: number
  amount: number
  concept: string | null
  cae: string
  qrUrl: string | null
  createdAt: string
}

interface Props {
  saleNumber: string | number
  notes: AfipNoteSummary[]
  onClose: () => void
}

/**
 * Modal listando todas las notas de crédito y débito emitidas sobre una venta.
 * Click en una nota despliega su QR + botón para descargar PDF.
 */
export function NotesViewer({ saleNumber, notes, onClose }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(
    notes.length === 1 ? notes[0].id : null,
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const selected = notes.find((n) => n.id === selectedId)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Receipt size={18} className="text-purple-400" />
            <h2 className="text-lg font-bold text-white">
              Notas de venta #{saleNumber}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {notes.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              Esta venta no tiene notas emitidas.
            </p>
          )}

          {notes.map((n) => {
            const isCredit = n.kind === "credit"
            const isSel = selectedId === n.id
            const Icon = isCredit ? FileMinus : FilePlus2
            const accent = isCredit ? "text-red-400" : "text-blue-400"
            const accentBg = isCredit ? "border-red-900/40" : "border-blue-900/40"
            const numero = `${String(n.pointOfSale).padStart(4, "0")}-${String(n.invoiceNumber).padStart(8, "0")}`
            const kindLabel = isCredit ? "Nota de crédito" : "Nota de débito"
            return (
              <div
                key={n.id}
                className={`bg-gray-900 border ${accentBg} rounded-lg overflow-hidden`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedId(isSel ? null : n.id)}
                  className="w-full p-3 flex items-start gap-3 hover:bg-gray-800/40 transition-colors text-left"
                >
                  <Icon size={18} className={`${accent} flex-shrink-0 mt-0.5`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">
                      {kindLabel} {n.invoiceLetter} · {numero}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      ${n.amount.toLocaleString("es-AR")}
                      {n.concept ? ` · ${n.concept}` : ""}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {new Date(n.createdAt).toLocaleString("es-AR")} · CAE {n.cae}
                    </p>
                  </div>
                </button>

                {isSel && (
                  <div className="p-3 border-t border-gray-800 space-y-3 bg-gray-950/40">
                    {n.qrUrl && (
                      <div className="bg-white p-3 rounded-lg flex items-center justify-center">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(n.qrUrl)}`}
                          alt="QR AFIP"
                          className="w-40 h-40"
                        />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <a
                        href={`/api/sales/notes/${n.id}/ticket`}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs border border-gray-700"
                      >
                        <Download size={12} /> PDF
                      </a>
                      {n.qrUrl && (
                        <a
                          href={n.qrUrl}
                          target="_blank"
                          rel="noopener"
                          className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs border border-gray-700"
                        >
                          <QrCode size={12} /> Validar en AFIP
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          <button
            type="button"
            onClick={onClose}
            className="w-full px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm border border-gray-700"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
