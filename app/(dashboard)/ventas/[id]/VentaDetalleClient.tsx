"use client"

import { useState } from "react"
import toast from "react-hot-toast"
import { FileCheck2, Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/Button"

interface AfipStatus {
  cae: string | null
  caeExpiresAt: string | null
  invoiceNumber: number | null
  invoiceType: string | null
  pointOfSale: number | null
  afipStatus: string | null
  afipError: string | null
}

export default function VentaDetalleClient({
  saleId,
  initialStatus,
  canIssue,
}: {
  saleId: string
  initialStatus: AfipStatus
  canIssue: boolean
}) {
  const [status, setStatus] = useState<AfipStatus>(initialStatus)
  const [loading, setLoading] = useState(false)

  const requestCae = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/afip/request-cae", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saleId }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        toast.success(`CAE ${data.cae} obtenido`)
        setStatus({
          cae: data.cae,
          caeExpiresAt: data.caeExpiresAt,
          invoiceNumber: data.invoiceNumber,
          invoiceType: data.invoiceType,
          pointOfSale: status.pointOfSale,
          afipStatus: "APPROVED",
          afipError: null,
        })
      } else {
        toast.error(data.error ?? "AFIP rechazó el comprobante")
        setStatus((s) => ({ ...s, afipStatus: data.status ?? "REJECTED", afipError: data.error ?? null }))
      }
    } finally {
      setLoading(false)
    }
  }

  const downloadPdf = () => {
    window.open(`/api/ventas/${saleId}/factura`, "_blank")
  }

  const approved = status.afipStatus === "APPROVED" && !!status.cae

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 space-y-4">
      <div className="flex items-center gap-2">
        <FileCheck2 className="text-accent" size={18} />
        <h2 className="text-white font-semibold">Factura electrónica AFIP</h2>
      </div>

      {approved ? (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Tipo</span>
            <span className="text-gray-200 font-medium">Factura {status.invoiceType}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Número</span>
            <span className="text-gray-200 font-mono">
              {String(status.pointOfSale ?? 0).padStart(4, "0")}-{String(status.invoiceNumber ?? 0).padStart(8, "0")}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">CAE</span>
            <span className="text-gray-200 font-mono">{status.cae}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Vence</span>
            <span className="text-gray-200">
              {status.caeExpiresAt ? new Date(status.caeExpiresAt).toLocaleDateString("es-AR") : "—"}
            </span>
          </div>
          <div className="pt-3 border-t border-gray-800 flex gap-2">
            <Button onClick={downloadPdf} leftIcon={<Download size={14} />} size="md">
              Descargar factura
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">
            {status.afipStatus === "REJECTED"
              ? `AFIP rechazó esta venta: ${status.afipError ?? "error desconocido"}`
              : status.afipStatus === "PENDING"
              ? "Solicitud de CAE pendiente…"
              : "Esta venta todavía no tiene CAE."}
          </p>
          {canIssue ? (
            <Button onClick={requestCae} loading={loading} leftIcon={loading ? <Loader2 className="animate-spin" size={14} /> : <FileCheck2 size={14} />}>
              {loading ? "Solicitando…" : "Solicitar CAE a AFIP"}
            </Button>
          ) : (
            <p className="text-xs text-gray-500">Pedile al dueño o admin que solicite el CAE.</p>
          )}
        </div>
      )}
    </div>
  )
}
