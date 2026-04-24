"use client"

import { useState, useEffect } from "react"
import { X, Loader2, GitMerge, AlertCircle, CheckCircle2, Barcode, Type, Tag } from "lucide-react"
import toast from "react-hot-toast"

interface ProductItem {
  id: string
  name: string
  barcode: string | null
  stock: number
  salePrice: number
  category: { name: string } | null
}

interface DuplicateGroup {
  reason: "barcode" | "name"
  items: ProductItem[]
}

export function DuplicatesModal({
  open,
  onClose,
  onApplied,
}: {
  open: boolean
  onClose: () => void
  onApplied: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [groups, setGroups] = useState<DuplicateGroup[]>([])
  const [summary, setSummary] = useState<{ totalProducts: number; totalGroups: number; totalDuplicates: number } | null>(null)
  const [keepByGroup, setKeepByGroup] = useState<Record<number, string>>({})
  const [merging, setMerging] = useState<number | null>(null)

  useEffect(() => {
    if (!open) return
    load()
  }, [open])

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/productos/duplicates")
      if (res.ok) {
        const data = await res.json()
        setGroups(data.groups || [])
        setSummary({
          totalProducts: data.totalProducts,
          totalGroups: data.totalGroups,
          totalDuplicates: data.totalDuplicates,
        })
        // Auto-select the one with highest stock as "keep"
        const defaults: Record<number, string> = {}
        ;(data.groups as DuplicateGroup[]).forEach((g, idx) => {
          const top = [...g.items].sort((a, b) => b.stock - a.stock)[0]
          if (top) defaults[idx] = top.id
        })
        setKeepByGroup(defaults)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleMerge = async (groupIdx: number) => {
    const group = groups[groupIdx]
    const keepId = keepByGroup[groupIdx]
    if (!keepId) return toast.error("Elegí cuál conservar")
    const mergeIds = group.items.filter((p) => p.id !== keepId).map((p) => p.id)

    setMerging(groupIdx)
    try {
      const res = await fetch("/api/productos/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keepId, mergeIds, sumStock: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Error al unificar")
        setMerging(null)
        return
      }
      toast.success(`${data.merged} duplicados unificados`)
      // Remove this group from view
      setGroups((prev) => prev.filter((_, i) => i !== groupIdx))
      onApplied()
    } catch {
      toast.error("Error de red")
    } finally {
      setMerging(null)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-4xl max-h-[92vh] shadow-2xl shadow-black/50 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-800 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-900/40 flex items-center justify-center">
              <GitMerge className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="font-bold text-gray-100">Detectar productos duplicados</h2>
              <p className="text-sm text-gray-400 mt-0.5">
                Productos con el mismo código de barras o nombre muy parecido
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <Loader2 className="w-10 h-10 text-accent animate-spin" />
              <p className="text-sm text-gray-400">Analizando inventario...</p>
            </div>
          )}

          {!loading && groups.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-400" />
              <p className="text-lg text-white font-medium">Sin duplicados detectados</p>
              <p className="text-sm text-gray-400 text-center max-w-md">
                {summary ? `Analizamos ${summary.totalProducts} productos y no encontramos duplicados.` : "Tu inventario está limpio."}
              </p>
            </div>
          )}

          {!loading && groups.length > 0 && (
            <div className="space-y-4">
              <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg p-3 text-sm text-amber-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p><strong>Encontramos {groups.length} grupo{groups.length !== 1 ? "s" : ""} de duplicados</strong> ({summary?.totalDuplicates ?? 0} productos en total).</p>
                  <p className="text-xs text-amber-300/80 mt-1">
                    Elegí cuál conservar. Los demás se eliminarán y el stock + ventas se transferirán al que elijas.
                  </p>
                </div>
              </div>

              {groups.map((group, idx) => {
                const keepId = keepByGroup[idx]
                const otherItems = group.items.filter((p) => p.id !== keepId)
                const totalStock = group.items.reduce((s, p) => s + p.stock, 0)

                return (
                  <div key={idx} className="border border-gray-800 rounded-xl overflow-hidden">
                    <div className="bg-gray-800/50 px-4 py-2.5 flex items-center gap-2">
                      {group.reason === "barcode" ? (
                        <Barcode className="w-4 h-4 text-amber-400" />
                      ) : (
                        <Type className="w-4 h-4 text-sky-400" />
                      )}
                      <span className="text-xs uppercase tracking-wider font-semibold text-gray-300">
                        {group.reason === "barcode" ? "Mismo código de barras" : "Nombre parecido"}
                      </span>
                      <span className="text-[10px] text-gray-500 ml-auto">
                        {group.items.length} productos · Stock total: {totalStock}
                      </span>
                    </div>
                    <div className="divide-y divide-gray-800">
                      {group.items.map((p) => (
                        <label
                          key={p.id}
                          className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${
                            keepId === p.id ? "bg-emerald-900/20" : "hover:bg-gray-800/40"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`keep-${idx}`}
                            checked={keepId === p.id}
                            onChange={() => setKeepByGroup((prev) => ({ ...prev, [idx]: p.id }))}
                            className="w-4 h-4"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate">{p.name}</p>
                            <p className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-3 flex-wrap">
                              {p.barcode && <span className="font-mono">{p.barcode}</span>}
                              {p.category && <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{p.category.name}</span>}
                              <span>Stock: {p.stock}</span>
                              <span>${Number(p.salePrice).toLocaleString("es-AR")}</span>
                            </p>
                          </div>
                          {keepId === p.id && (
                            <span className="text-[10px] font-semibold bg-emerald-900/40 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-700/50">
                              CONSERVAR
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                    <div className="bg-gray-900 px-4 py-3 border-t border-gray-800 flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-xs text-gray-400">
                        {otherItems.length > 0 ? (
                          <>Se eliminarán {otherItems.length} duplicado{otherItems.length !== 1 ? "s" : ""} y el stock ({totalStock}) se transferirá.</>
                        ) : (
                          "Elegí cuál conservar"
                        )}
                      </p>
                      <button
                        onClick={() => handleMerge(idx)}
                        disabled={merging === idx || !keepId || otherItems.length === 0}
                        className="px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-50 text-accent-foreground text-xs font-medium flex items-center gap-1.5"
                      >
                        {merging === idx ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitMerge className="w-3.5 h-3.5" />}
                        {merging === idx ? "Unificando..." : "Unificar grupo"}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-800 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
