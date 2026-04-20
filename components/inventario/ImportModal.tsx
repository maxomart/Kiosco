"use client"

import { useState, useRef } from "react"
import {
  X, Upload, FileText, CheckCircle, AlertTriangle, Download, Loader2,
  Sparkles, ArrowLeft, ArrowRight, Wand2, Info,
} from "lucide-react"
import toast from "react-hot-toast"
import { formatCurrency } from "@/lib/utils"

interface Props {
  onClose: () => void
  onDone: () => void
}

type ProductField =
  | "name" | "barcode" | "sku" | "salePrice" | "costPrice"
  | "stock" | "minStock" | "category" | "supplier" | "description" | "unit"

const FIELD_LABELS: Record<ProductField, string> = {
  name: "Nombre del producto",
  barcode: "Código de barras",
  sku: "SKU / Código interno",
  salePrice: "Precio de venta",
  costPrice: "Precio de costo",
  stock: "Stock actual",
  minStock: "Stock mínimo",
  category: "Categoría",
  supplier: "Proveedor",
  description: "Descripción",
  unit: "Unidad",
}

const REQUIRED: ProductField[] = ["name", "salePrice"]

interface ColumnMapping {
  fields: Partial<Record<ProductField, string | null>>
  confidence: number
  notes: string
  warnings: string[]
}

interface PreviewRow {
  rowNum: number
  name: string
  barcode: string | null
  salePrice: number
  costPrice: number
  stock: number
  categoryName: string | null
  error?: string
}

interface PreviewResponse {
  sheetName: string
  headers: string[]
  totalRows: number
  sample: Record<string, any>[]
  mapping: ColumnMapping
  preview: PreviewRow[]
  planContext: {
    plan: string
    currentCount: number
    limit: number
    wouldExceed: boolean
    remaining: number
  }
}

interface CommitResponse {
  imported: number
  updated: number
  skipped: number
  errors: { row: number; name: string; message: string }[]
  totalRows: number
}

type Step = "upload" | "review" | "result"

export default function ImportModal({ onClose, onDone }: Props) {
  const [step, setStep] = useState<Step>("upload")
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [mapping, setMapping] = useState<Partial<Record<ProductField, string | null>>>({})
  const [defaultCostRatio, setDefaultCostRatio] = useState(0.75)
  const [createCategories, setCreateCategories] = useState(true)
  const [result, setResult] = useState<CommitResponse | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (f: File) => {
    if (!/\.(csv|xlsx|xls)$/i.test(f.name)) {
      toast.error("Solo se aceptan archivos CSV o Excel (.xlsx, .xls)")
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error("Archivo demasiado grande (máx 10 MB)")
      return
    }
    setFile(f)
  }

  const handleAnalyze = async () => {
    if (!file) return
    setAnalyzing(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/productos/importar/preview", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo analizar el archivo")
        return
      }
      setPreview(data)
      setMapping(data.mapping.fields ?? {})
      setStep("review")
    } catch (e) {
      toast.error("Error de conexión al analizar el archivo")
    } finally {
      setAnalyzing(false)
    }
  }

  const handleCommit = async () => {
    if (!file || !preview) return
    setImporting(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("mapping", JSON.stringify({ ...preview.mapping, fields: mapping }))
      fd.append("defaultCostRatio", String(defaultCostRatio))
      fd.append("defaultMinStock", "5")
      fd.append("createCategories", String(createCategories))
      const res = await fetch("/api/productos/importar/commit", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo importar")
        return
      }
      setResult(data)
      setStep("result")
    } catch {
      toast.error("Error de conexión al importar")
    } finally {
      setImporting(false)
    }
  }

  const downloadTemplate = () => {
    const csv =
      "Producto,Código de Barras,Categoría,Precio,Stock\n" +
      "Coca Cola 500ml,7790895001234,Bebidas,2500,24\n" +
      "Galletitas Oreo,7790580001234,Almacén,1800,12\n"
    const a = document.createElement("a")
    a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`
    a.download = "ejemplo_inventario.csv"
    a.click()
  }

  const requiredOk = REQUIRED.every((f) => !!mapping[f])
  const usedHeaders = new Set(Object.values(mapping).filter(Boolean) as string[])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header with steps */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-accent-foreground" />
            </div>
            <div>
              <h2 className="text-white font-semibold">Importar productos</h2>
              <p className="text-xs text-gray-500">
                {step === "upload" && "Subí tu Excel — la IA detecta las columnas"}
                {step === "review" && "Revisá el mapeo antes de importar"}
                {step === "result" && "Listo"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 py-2 border-b border-gray-800/50 bg-gray-900/50">
          {(["upload", "review", "result"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step === s ? "bg-accent text-accent-foreground" :
                  (step === "review" && s === "upload") || (step === "result" && s !== "result")
                    ? "bg-emerald-600/30 text-emerald-300"
                    : "bg-gray-800 text-gray-600"
              }`}>{i + 1}</div>
              {i < 2 && <ArrowRight size={12} className="text-gray-700" />}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* ── STEP 1: UPLOAD ────────────────────────────────────────────── */}
          {step === "upload" && (
            <>
              <div className="flex items-center justify-between p-3 bg-gray-800/40 rounded-xl border border-gray-700">
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <FileText size={16} className="text-accent" />
                  <span>¿No sabés cómo armarlo? Bajá un ejemplo</span>
                </div>
                <button onClick={downloadTemplate} className="flex items-center gap-1 text-accent hover:text-accent-hover text-sm transition">
                  <Download size={14} /> Ejemplo CSV
                </button>
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragging(false)
                  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0])
                }}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                  dragging ? "border-accent bg-accent-soft"
                    : file ? "border-emerald-500 bg-emerald-500/5"
                    : "border-gray-700 hover:border-gray-600"
                }`}
              >
                <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                {file ? (
                  <>
                    <CheckCircle size={36} className="text-emerald-400 mx-auto mb-2" />
                    <p className="text-emerald-400 font-medium">{file.name}</p>
                    <p className="text-gray-500 text-sm mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                    <p className="text-xs text-gray-600 mt-2">Click para cambiar</p>
                  </>
                ) : (
                  <>
                    <Upload size={36} className="text-gray-500 mx-auto mb-3" />
                    <p className="text-gray-200 font-medium">Arrastrá tu Excel acá</p>
                    <p className="text-gray-500 text-sm mt-1">o hacé click para elegir un archivo</p>
                    <p className="text-xs text-gray-600 mt-3">Formatos: .xlsx · .xls · .csv (máx 10 MB)</p>
                  </>
                )}
              </div>

              <div className="bg-accent-soft border border-accent/30 rounded-xl p-3 flex gap-3 items-start">
                <Wand2 size={16} className="text-accent mt-0.5 flex-shrink-0" />
                <div className="text-xs text-gray-300 leading-relaxed">
                  <p className="font-medium text-accent mb-0.5">No tenés que cambiar tu archivo</p>
                  La IA detecta automáticamente qué columna es el precio, el código de barras, el stock, la categoría, etc. Si solo tenés el precio (sin costo), asumimos un margen del 25% (configurable después).
                </div>
              </div>
            </>
          )}

          {/* ── STEP 2: REVIEW MAPPING ─────────────────────────────────────── */}
          {step === "review" && preview && (
            <>
              {/* AI summary */}
              <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-accent" />
                  <span className="text-sm font-medium text-gray-100">
                    Hoja: {preview.sheetName} · {preview.totalRows} filas detectadas
                  </span>
                  <span className="ml-auto text-xs text-gray-500">
                    Confianza IA: {Math.round((preview.mapping.confidence ?? 0.6) * 100)}%
                  </span>
                </div>
                {preview.mapping.notes && (
                  <p className="text-xs text-gray-400 leading-relaxed">{preview.mapping.notes}</p>
                )}
                {preview.mapping.warnings?.length > 0 && (
                  <div className="space-y-1 pt-1">
                    {preview.mapping.warnings.map((w, i) => (
                      <div key={i} className="flex gap-2 items-start text-xs text-amber-300">
                        <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Plan limit warning */}
              {preview.planContext.wouldExceed && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-300">
                  <strong>Atención:</strong> Esta importación excedería el límite de tu plan{" "}
                  ({preview.planContext.limit} productos máx, ya tenés{" "}
                  {preview.planContext.currentCount}). Suscribite a un plan superior para
                  importar todo.
                </div>
              )}

              {/* Mapping editor */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-100">Mapeo de columnas</h3>
                <p className="text-xs text-gray-500">
                  Revisá que cada campo del sistema apunte a la columna correcta de tu archivo.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(Object.keys(FIELD_LABELS) as ProductField[]).map((field) => {
                    const required = REQUIRED.includes(field)
                    const current = mapping[field] ?? ""
                    return (
                      <div key={field} className="flex flex-col gap-1">
                        <label className="text-xs text-gray-400 flex items-center gap-1">
                          {FIELD_LABELS[field]}
                          {required && <span className="text-red-400">*</span>}
                        </label>
                        <select
                          value={current ?? ""}
                          onChange={(e) =>
                            setMapping((m) => ({ ...m, [field]: e.target.value || null }))
                          }
                          className={`bg-gray-800 border rounded-lg px-2.5 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-accent transition ${
                            required && !current
                              ? "border-red-500/60"
                              : current
                              ? "border-emerald-700/60"
                              : "border-gray-700"
                          }`}
                        >
                          <option value="">— Ignorar —</option>
                          {preview.headers.map((h) => (
                            <option key={h} value={h} disabled={usedHeaders.has(h) && current !== h}>
                              {h}{usedHeaders.has(h) && current !== h ? " (usada)" : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Cost ratio */}
              {!mapping.costPrice && (
                <div className="bg-amber-500/5 border border-amber-500/30 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Info size={14} className="text-amber-400" />
                    <span className="text-sm font-medium text-amber-200">
                      No tenés columna de costo
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Vamos a calcular el costo como % del precio (lo podés ajustar después por
                    producto). Margen asumido:
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={50}
                      max={95}
                      step={5}
                      value={Math.round(defaultCostRatio * 100)}
                      onChange={(e) => setDefaultCostRatio(parseInt(e.target.value) / 100)}
                      className="flex-1 accent-amber-500"
                    />
                    <div className="text-xs text-gray-300 min-w-[110px] text-right">
                      Costo = <strong className="text-amber-200">{Math.round(defaultCostRatio * 100)}%</strong> del precio<br />
                      <span className="text-gray-500">
                        (margen {Math.round((1 - defaultCostRatio) * 100)}%)
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600">
                    Ej: producto a $1.500 → costo $
                    {Math.round(1500 * defaultCostRatio).toLocaleString("es-AR")} · ganancia{" "}
                    ${Math.round(1500 * (1 - defaultCostRatio)).toLocaleString("es-AR")}.
                  </p>
                </div>
              )}

              {/* Categories toggle */}
              {mapping.category && (
                <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-800/40 hover:bg-gray-800/60 transition cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-gray-100">
                      Crear categorías nuevas automáticamente
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Si en tu archivo aparece "Bebidas" y no existe, la creamos.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={createCategories}
                    onChange={(e) => setCreateCategories(e.target.checked)}
                    className="w-5 h-5 rounded accent-accent flex-shrink-0"
                  />
                </label>
              )}

              {/* Preview table */}
              <div>
                <h3 className="text-sm font-semibold text-gray-100 mb-2">
                  Preview · primeras filas tal como se importarán
                </h3>
                <div className="overflow-x-auto border border-gray-800 rounded-xl">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-800/60 text-gray-400">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-medium">#</th>
                        <th className="px-2 py-1.5 text-left font-medium">Nombre</th>
                        <th className="px-2 py-1.5 text-left font-medium">Cód. barras</th>
                        <th className="px-2 py-1.5 text-right font-medium">Precio</th>
                        <th className="px-2 py-1.5 text-right font-medium">Costo</th>
                        <th className="px-2 py-1.5 text-right font-medium">Stock</th>
                        <th className="px-2 py-1.5 text-left font-medium">Categoría</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {preview.preview.slice(0, 6).map((r) => (
                        <tr key={r.rowNum} className={r.error ? "bg-red-500/5" : ""}>
                          <td className="px-2 py-1.5 text-gray-500">{r.rowNum}</td>
                          <td className="px-2 py-1.5 text-gray-100">
                            {r.name || <span className="text-red-400 italic">vacío</span>}
                          </td>
                          <td className="px-2 py-1.5 text-gray-400 font-mono text-[10px]">
                            {r.barcode || "—"}
                          </td>
                          <td className="px-2 py-1.5 text-right text-emerald-300">
                            {r.salePrice > 0 ? formatCurrency(r.salePrice) : "—"}
                          </td>
                          <td className="px-2 py-1.5 text-right text-gray-400">
                            {r.costPrice > 0 ? formatCurrency(r.costPrice) : "—"}
                          </td>
                          <td className="px-2 py-1.5 text-right text-gray-300">{r.stock}</td>
                          <td className="px-2 py-1.5 text-gray-400">{r.categoryName || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ── STEP 3: RESULT ─────────────────────────────────────────────── */}
          {step === "result" && result && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-emerald-400">{result.imported}</p>
                  <p className="text-xs text-emerald-300 mt-1">Productos creados</p>
                </div>
                <div className="bg-sky-500/10 border border-sky-500/30 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-sky-400">{result.updated}</p>
                  <p className="text-xs text-sky-300 mt-1">Actualizados</p>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-amber-400">{result.skipped}</p>
                  <p className="text-xs text-amber-300 mt-1">Saltados</p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="bg-red-500/5 border border-red-500/30 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={14} className="text-red-400" />
                    <span className="text-red-300 text-sm font-medium">
                      {result.errors.length} fila{result.errors.length === 1 ? "" : "s"} con problemas
                    </span>
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {result.errors.map((e, i) => (
                      <p key={i} className="text-red-300/80 text-xs">
                        Fila {e.row} · <span className="text-gray-400">{e.name}</span> — {e.message}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-5 border-t border-gray-800">
          {step === "upload" && (
            <>
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium transition">
                Cancelar
              </button>
              <button
                onClick={handleAnalyze}
                disabled={!file || analyzing}
                className="flex-1 py-2.5 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-50 text-accent-foreground text-sm font-semibold transition flex items-center justify-center gap-2"
              >
                {analyzing ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                {analyzing ? "Analizando con IA..." : "Analizar archivo"}
              </button>
            </>
          )}
          {step === "review" && (
            <>
              <button
                onClick={() => { setStep("upload"); setPreview(null) }}
                className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium transition flex items-center gap-1.5"
              >
                <ArrowLeft size={14} /> Volver
              </button>
              <button
                onClick={handleCommit}
                disabled={importing || !requiredOk}
                className="flex-1 py-2.5 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-accent-foreground text-sm font-semibold transition flex items-center justify-center gap-2"
                title={!requiredOk ? "Faltan campos obligatorios" : undefined}
              >
                {importing ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                {importing ? "Importando..." : `Importar ${preview?.totalRows ?? 0} filas`}
              </button>
            </>
          )}
          {step === "result" && (
            <button
              onClick={onDone}
              className="w-full py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-accent-foreground text-sm font-semibold transition"
            >
              Listo
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
