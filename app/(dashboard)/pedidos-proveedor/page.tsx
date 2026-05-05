"use client"

import { useEffect, useState } from "react"
import { Truck, Download, AlertTriangle, MessageCircle, Phone, Mail, Sparkles } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

interface Item {
  productId: string
  productName: string
  sku: string | null
  barcode: string | null
  currentStock: number
  velocityPerDay: number
  daysUntilStockout: number | null
  severity: "critical" | "warning" | "ok"
  suggestedQty: number
  costPrice: number
  estimatedCost: number
}
interface Group {
  supplierId: string | null
  supplierName: string
  contact: string | null
  phone: string | null
  email: string | null
  items: Item[]
  totalItems: number
  totalEstimated: number
}

export default function PedidosProveedorPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/pedidos-proveedor", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setGroups(d?.groups ?? []))
      .finally(() => setLoading(false))
  }, [])

  const downloadXlsx = (g: Group) => {
    const id = g.supplierId ?? "sin-proveedor"
    window.location.href = `/api/pedidos-proveedor/${id}/xlsx`
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-900/40 border border-amber-700/40 flex items-center justify-center">
            <Truck className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              Sugerencias IA
              <Sparkles size={14} className="text-amber-400" />
            </h1>
            <p className="text-sm text-gray-400">
              Plantillas automáticas según velocidad de venta.
            </p>
          </div>
        </div>
        <a
          href="/cargas"
          className="text-sm text-gray-400 hover:text-white inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700"
        >
          ← Volver a pedidos
        </a>
      </div>

      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 text-xs text-gray-400 leading-relaxed">
        Las cantidades sugeridas se calculan con la <strong className="text-gray-200">velocidad de venta de los últimos 14 días</strong>{" "}
        y el stock máximo configurado. Descargás el Excel y vos decidís si lo mandás o no — nada se envía automáticamente.
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-40 bg-gray-900 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-emerald-950/30 border border-emerald-800/30 rounded-xl p-6 text-center">
          <p className="text-emerald-200 font-semibold">¡Todo bajo control!</p>
          <p className="text-sm text-emerald-300/70 mt-1">
            Ningún producto está cerca de agotarse según el ritmo de ventas reciente.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            const criticalCount = g.items.filter((i) => i.severity === "critical").length
            const waMsg = encodeURIComponent(
              `Hola${g.contact ? " " + g.contact : ""}, necesitaría hacer un pedido. Te paso la lista por mail / planilla. Gracias!`
            )
            return (
              <section
                key={g.supplierId ?? "no-supplier"}
                className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
              >
                {/* Header del proveedor */}
                <div className="p-5 border-b border-gray-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-bold text-white">{g.supplierName}</h2>
                      {criticalCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-300 border border-red-500/30 font-bold uppercase tracking-wider">
                          <AlertTriangle size={10} />
                          {criticalCount} crítico{criticalCount === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      <strong>{g.items.length}</strong> producto{g.items.length === 1 ? "" : "s"} ·{" "}
                      <strong>{g.totalItems}</strong> unidades ·{" "}
                      Total estimado: <strong className="text-amber-300">{formatCurrency(g.totalEstimated)}</strong>
                    </p>
                    {(g.phone || g.email || g.contact) && (
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-gray-500">
                        {g.contact && <span>👤 {g.contact}</span>}
                        {g.phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone size={10} /> {g.phone}
                          </span>
                        )}
                        {g.email && (
                          <span className="inline-flex items-center gap-1">
                            <Mail size={10} /> {g.email}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                    <button
                      onClick={() => downloadXlsx(g)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold shadow-lg shadow-purple-900/30"
                    >
                      <Download size={14} /> Descargar plantilla
                    </button>
                    {g.phone && (
                      <a
                        href={`https://wa.me/${g.phone.replace(/\D/g, "")}?text=${waMsg}`}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-200 border border-emerald-600/40 text-sm font-medium"
                        title="Abrir WhatsApp para mandarle la planilla"
                      >
                        <MessageCircle size={14} /> WhatsApp
                      </a>
                    )}
                  </div>
                </div>

                {/* Tabla de items */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-800/40 text-gray-400 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="text-left py-2 px-4">Producto</th>
                        <th className="text-right py-2 px-4">Stock</th>
                        <th className="text-right py-2 px-4">Días</th>
                        <th className="text-right py-2 px-4">Pedir</th>
                        <th className="text-right py-2 px-4">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.items.map((it) => (
                        <tr key={it.productId} className="border-t border-gray-800">
                          <td className="py-2 px-4">
                            <p className="text-gray-100 truncate">{it.productName}</p>
                            {(it.barcode || it.sku) && (
                              <p className="text-[10px] text-gray-500 font-mono">{it.barcode ?? it.sku}</p>
                            )}
                          </td>
                          <td className="py-2 px-4 text-right text-gray-400 tabular-nums">
                            {it.currentStock}
                          </td>
                          <td className={`py-2 px-4 text-right tabular-nums font-medium ${
                            it.severity === "critical"
                              ? "text-red-300"
                              : it.severity === "warning"
                              ? "text-amber-300"
                              : "text-gray-400"
                          }`}>
                            {it.daysUntilStockout === 0 ? "Agotado" : `${it.daysUntilStockout ?? "—"}d`}
                          </td>
                          <td className="py-2 px-4 text-right font-bold text-white tabular-nums">
                            {it.suggestedQty}
                          </td>
                          <td className="py-2 px-4 text-right text-gray-300 tabular-nums">
                            {formatCurrency(it.estimatedCost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
