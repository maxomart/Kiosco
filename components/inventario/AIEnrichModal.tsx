"use client"

import { useState, useEffect } from "react"
import {
  X, Sparkles, Loader2, CheckCircle2, AlertCircle, HelpCircle,
  Plus, Tag, Truck,
} from "lucide-react"
import toast from "react-hot-toast"

interface EnrichMatch {
  type: "existing" | "new" | "skip"
  id: string | null
  name: string
  score: number
}

interface EnrichSuggestion {
  productId: string
  productName: string
  categorySuggestedRaw: string | null
  supplierSuggestedRaw: string | null
  categoryMatch: EnrichMatch
  supplierMatch: EnrichMatch
  confidence: "high" | "medium" | "low"
}

interface EntityList {
  id: string
  name: string
}

interface DecoratedSuggestion extends EnrichSuggestion {
  // Resolved action the user wants
  catAction: "assign_existing" | "create_new" | "skip"
  catSelectedId: string | null
  catNewName: string
  supAction: "assign_existing" | "create_new" | "skip"
  supSelectedId: string | null
  supNewName: string
}

export function AIEnrichModal({
  open,
  onClose,
  onApplied,
}: {
  open: boolean
  onClose: () => void
  onApplied: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scope, setScope] = useState<"missing_any" | "missing_category" | "missing_supplier" | "all">("missing_any")
  const [suggestions, setSuggestions] = useState<DecoratedSuggestion[]>([])
  const [categoriesExisting, setCategoriesExisting] = useState<EntityList[]>([])
  const [suppliersExisting, setSuppliersExisting] = useState<EntityList[]>([])
  const [hasAnalyzed, setHasAnalyzed] = useState(false)

  useEffect(() => {
    if (!open) {
      // reset on close
      setSuggestions([])
      setHasAnalyzed(false)
      setError(null)
    }
  }, [open])

  if (!open) return null

  const analyze = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/productos/ai-enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, limit: 200 }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Error al analizar")
        return
      }
      setCategoriesExisting(data.categoriesExisting || [])
      setSuppliersExisting(data.suppliersExisting || [])
      // Decorate with default action
      const decorated: DecoratedSuggestion[] = (data.suggestions as EnrichSuggestion[]).map((s) => ({
        ...s,
        catAction: s.categoryMatch.type,
        catSelectedId: s.categoryMatch.type === "existing" ? s.categoryMatch.id : null,
        catNewName: s.categoryMatch.type === "new" ? s.categoryMatch.name : "",
        supAction: s.supplierMatch.type,
        supSelectedId: s.supplierMatch.type === "existing" ? s.supplierMatch.id : null,
        supNewName: s.supplierMatch.type === "new" ? s.supplierMatch.name : "",
      }))
      setSuggestions(decorated)
      setHasAnalyzed(true)
      if (decorated.length === 0) {
        toast.success("Todos tus productos ya están organizados 🎉")
      }
    } catch {
      setError("Error de red")
    } finally {
      setLoading(false)
    }
  }

  const apply = async () => {
    const changes = suggestions.map((s) => ({
      productId: s.productId,
      categoryAction: s.catAction,
      categoryId: s.catAction === "assign_existing" ? s.catSelectedId : null,
      categoryName: s.catAction === "create_new" ? s.catNewName.trim() : null,
      supplierAction: s.supAction,
      supplierId: s.supAction === "assign_existing" ? s.supSelectedId : null,
      supplierName: s.supAction === "create_new" ? s.supNewName.trim() : null,
    })).filter(c => c.categoryAction !== "skip" || c.supplierAction !== "skip")

    if (changes.length === 0) {
      toast.error("No hay cambios para aplicar")
      return
    }

    setApplying(true)
    try {
      const res = await fetch("/api/productos/apply-enrichment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Error al aplicar")
        setApplying(false)
        return
      }
      toast.success(
        `${data.productsUpdated} productos actualizados · ${data.categoriesCreated.length} categorías nuevas · ${data.suppliersCreated.length} proveedores nuevos`
      )
      onApplied()
      onClose()
    } catch {
      toast.error("Error de red")
    } finally {
      setApplying(false)
    }
  }

  const countCatNew = suggestions.filter(s => s.catAction === "create_new").length
  const countSupNew = suggestions.filter(s => s.supAction === "create_new").length
  const countSkip = suggestions.filter(s => s.catAction === "skip" && s.supAction === "skip").length
  const countApply = suggestions.length - countSkip

  const updateRow = (idx: number, patch: Partial<DecoratedSuggestion>) => {
    setSuggestions(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], ...patch }
      return next
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={applying ? undefined : onClose}
    >
      <div
        className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-6xl max-h-[92vh] shadow-2xl shadow-black/50 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-800 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-accent-soft flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-accent" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-gray-100">Auto-organizar con IA</h2>
              <p className="text-sm text-gray-400 mt-0.5">
                La IA analiza los nombres de tus productos y sugiere categoría y proveedor.
              </p>
            </div>
          </div>
          <button onClick={onClose} disabled={applying} className="text-gray-500 hover:text-gray-200 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {!hasAnalyzed && !loading && (
            <div className="space-y-4">
              <div className="bg-gray-800/40 rounded-lg p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-2">
                  ¿Qué analizo?
                </p>
                <div className="space-y-2">
                  {[
                    { v: "missing_any", label: "Productos sin categoría o sin proveedor", desc: "Recomendado" },
                    { v: "missing_category", label: "Solo productos sin categoría", desc: "" },
                    { v: "missing_supplier", label: "Solo productos sin proveedor", desc: "" },
                    { v: "all", label: "Todos los productos", desc: "Puede sobrescribir asignaciones actuales" },
                  ].map(opt => (
                    <label
                      key={opt.v}
                      className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition-colors ${
                        scope === opt.v
                          ? "border-accent/50 bg-accent-soft/30"
                          : "border-gray-800 hover:border-gray-700 bg-gray-900/30"
                      }`}
                    >
                      <input
                        type="radio"
                        checked={scope === opt.v}
                        onChange={() => setScope(opt.v as any)}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <p className="text-sm text-white font-medium">{opt.label}</p>
                        {opt.desc && <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="bg-sky-900/20 border border-sky-700/40 rounded-lg p-4">
                <p className="text-xs text-sky-300">
                  <strong>⚡ Cómo funciona:</strong><br />
                  1. La IA lee el nombre de cada producto y sugiere categoría + fabricante argentino<br />
                  2. Si el proveedor/categoría ya existe en tu sistema, reutiliza el existente<br />
                  3. Si no existe, te ofrece crearlo<br />
                  4. Vos revisás cada sugerencia y aplicás solo las que querés
                </p>
              </div>

              {error && (
                <div className="bg-red-900/20 border border-red-700/40 rounded-lg p-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              <button
                onClick={analyze}
                className="w-full py-3 rounded-lg bg-accent hover:bg-accent-hover text-accent-foreground font-medium flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Empezar análisis
              </button>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <Loader2 className="w-10 h-10 text-accent animate-spin" />
              <p className="text-sm text-gray-400">Analizando productos con IA...</p>
              <p className="text-xs text-gray-500">Esto puede tardar unos segundos</p>
            </div>
          )}

          {hasAnalyzed && !loading && suggestions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              <p className="text-lg text-white font-medium">Todo en orden</p>
              <p className="text-sm text-gray-400 text-center max-w-md">
                No hay productos que necesiten categorización o proveedor en este momento.
              </p>
            </div>
          )}

          {hasAnalyzed && !loading && suggestions.length > 0 && (
            <div className="space-y-4">
              {/* Summary bar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">Analizados</p>
                  <p className="text-xl font-bold text-white mt-1">{suggestions.length}</p>
                </div>
                <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wider text-emerald-400">A aplicar</p>
                  <p className="text-xl font-bold text-emerald-300 mt-1">{countApply}</p>
                </div>
                <div className="bg-sky-900/20 border border-sky-700/30 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wider text-sky-400">Categorías nuevas</p>
                  <p className="text-xl font-bold text-sky-300 mt-1">{countCatNew}</p>
                </div>
                <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wider text-amber-400">Proveedores nuevos</p>
                  <p className="text-xl font-bold text-amber-300 mt-1">{countSupNew}</p>
                </div>
              </div>

              {/* Table */}
              <div className="border border-gray-800 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-900/80 sticky top-0">
                      <tr className="border-b border-gray-800">
                        <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-gray-500">Producto</th>
                        <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-gray-500 w-[220px]">
                          <Tag className="w-3 h-3 inline mr-1" /> Categoría
                        </th>
                        <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-gray-500 w-[220px]">
                          <Truck className="w-3 h-3 inline mr-1" /> Proveedor
                        </th>
                        <th className="px-3 py-2 text-center text-[10px] uppercase tracking-wider text-gray-500 w-[80px]">IA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {suggestions.map((s, idx) => (
                        <tr key={s.productId} className="hover:bg-gray-800/40">
                          <td className="px-3 py-2">
                            <p className="text-gray-200 truncate max-w-[240px]">{s.productName}</p>
                          </td>

                          {/* Category */}
                          <td className="px-3 py-2">
                            <EnrichCell
                              action={s.catAction}
                              selectedId={s.catSelectedId}
                              newName={s.catNewName}
                              existing={categoriesExisting}
                              suggestedRaw={s.categorySuggestedRaw}
                              onChangeAction={(a) => updateRow(idx, { catAction: a })}
                              onChangeExisting={(id) => updateRow(idx, { catSelectedId: id })}
                              onChangeNewName={(n) => updateRow(idx, { catNewName: n })}
                            />
                          </td>

                          {/* Supplier */}
                          <td className="px-3 py-2">
                            <EnrichCell
                              action={s.supAction}
                              selectedId={s.supSelectedId}
                              newName={s.supNewName}
                              existing={suppliersExisting}
                              suggestedRaw={s.supplierSuggestedRaw}
                              onChangeAction={(a) => updateRow(idx, { supAction: a })}
                              onChangeExisting={(id) => updateRow(idx, { supSelectedId: id })}
                              onChangeNewName={(n) => updateRow(idx, { supNewName: n })}
                            />
                          </td>

                          <td className="px-3 py-2 text-center">
                            <ConfidenceBadge value={s.confidence} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {hasAnalyzed && !loading && suggestions.length > 0 && (
          <div className="p-4 border-t border-gray-800 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-gray-500">
              {countApply} producto{countApply !== 1 ? "s" : ""} se van a actualizar.
              {countCatNew > 0 && ` ${countCatNew} categoría${countCatNew !== 1 ? "s" : ""} nueva${countCatNew !== 1 ? "s" : ""}.`}
              {countSupNew > 0 && ` ${countSupNew} proveedor${countSupNew !== 1 ? "es" : ""} nuevo${countSupNew !== 1 ? "s" : ""}.`}
            </p>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                disabled={applying}
                className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={apply}
                disabled={applying || countApply === 0}
                className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-50 text-accent-foreground text-sm font-medium flex items-center gap-1.5"
              >
                {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {applying ? "Aplicando..." : `Aplicar ${countApply} cambios`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ConfidenceBadge({ value }: { value: "high" | "medium" | "low" }) {
  const cls = {
    high: "bg-emerald-900/40 text-emerald-300 border-emerald-700/50",
    medium: "bg-amber-900/40 text-amber-300 border-amber-700/50",
    low: "bg-gray-800 text-gray-400 border-gray-700",
  }[value]
  const label = { high: "Alta", medium: "Media", low: "Baja" }[value]
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${cls}`}>
      {label}
    </span>
  )
}

function EnrichCell({
  action,
  selectedId,
  newName,
  existing,
  suggestedRaw,
  onChangeAction,
  onChangeExisting,
  onChangeNewName,
}: {
  action: "assign_existing" | "create_new" | "skip"
  selectedId: string | null
  newName: string
  existing: EntityList[]
  suggestedRaw: string | null
  onChangeAction: (a: "assign_existing" | "create_new" | "skip") => void
  onChangeExisting: (id: string | null) => void
  onChangeNewName: (name: string) => void
}) {
  if (action === "skip") {
    return (
      <div className="flex items-center gap-1">
        <span className="text-gray-600 text-xs italic">Saltar</span>
        {suggestedRaw && (
          <button
            onClick={() => onChangeAction("create_new")}
            className="text-[10px] text-accent hover:underline"
          >
            → usar "{suggestedRaw}"
          </button>
        )}
      </div>
    )
  }

  if (action === "create_new") {
    return (
      <div className="flex items-center gap-1">
        <Plus className="w-3 h-3 text-amber-400 flex-shrink-0" />
        <input
          value={newName}
          onChange={(e) => onChangeNewName(e.target.value)}
          placeholder="Nuevo nombre"
          className="flex-1 min-w-0 bg-amber-900/20 border border-amber-700/40 rounded px-2 py-1 text-xs text-amber-100 focus:outline-none focus:border-amber-500"
        />
        <button
          onClick={() => onChangeAction("skip")}
          className="text-[10px] text-gray-500 hover:text-gray-300"
          title="No asignar"
        >✕</button>
      </div>
    )
  }

  // assign_existing
  return (
    <div className="flex items-center gap-1">
      <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
      <select
        value={selectedId ?? ""}
        onChange={(e) => {
          const val = e.target.value
          if (val === "__create__") {
            onChangeAction("create_new")
          } else if (val === "__skip__") {
            onChangeAction("skip")
          } else {
            onChangeExisting(val)
          }
        }}
        className="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-accent"
      >
        <option value="">—</option>
        {existing.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
        {suggestedRaw && !existing.some(e => e.name.toLowerCase() === suggestedRaw.toLowerCase()) && (
          <option value="__create__">+ Crear "{suggestedRaw}"</option>
        )}
        <option value="__skip__">— Saltar —</option>
      </select>
    </div>
  )
}
