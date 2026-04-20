"use client"

import { useState, useRef, useMemo } from "react"
import {
  X, Upload, FileText, CheckCircle, AlertTriangle, Loader2,
  PackagePlus, ArrowLeft, ArrowRight, Wand2, Type, FileSpreadsheet,
} from "lucide-react"
import toast from "react-hot-toast"
import * as XLSX from "xlsx"
import { formatCurrency } from "@/lib/utils"

interface Props {
  onClose: () => void
  onDone: () => void
}

type Mode = "input" | "review" | "result"
type InputType = "paste" | "file"

interface Line {
  identifier: string
  quantity: number
  costPrice?: number
}

interface MatchedRow {
  line: number
  productId: string
  productName: string
  barcode: string | null
  sku: string | null
  currentStock: number
  newStockADD: number
  currentCostPrice: number
  currentSalePrice: number
  quantity: number
  costPriceUpdate: number | null
}

interface PreviewResp {
  totalLines: number
  matchedCount: number
  unmatchedCount: number
  matched: MatchedRow[]
  unmatched: { line: number; identifier: string; quantity: number }[]
}

export function StockBulkModal({ onClose, onDone }: Props) {
  const [step, setStep] = useState<Mode>("input")
  const [inputType, setInputType] = useState<InputType>("paste")
  const [pasteText, setPasteText] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [preview, setPreview] = useState<PreviewResp | null>(null)
  const [updateMode, setUpdateMode] = useState<"ADD" | "SET">("ADD")
  const [reference, setReference] = useState("")
  const [updateCost, setUpdateCost] = useState(false)
  const [result, setResult] = useState<{ updated: number; stockMovements: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const parseLines = (): Line[] => {
    if (inputType !== "paste") return []
    const lines = pasteText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    return lines.map((l) => {
      // Accept tab/comma/semicolon/multi-space separator
      const parts = l.split(/\t|;|,|\s{2,}/).map((p) => p.trim()).filter(Boolean)
      if (parts.length < 2) return null
      const identifier = parts[0]
      const qty = parseFloat(parts[1].replace(",", "."))
      const cost = parts[2] ? parseFloat(parts[2].replace(",", ".")) : undefined
      if (!identifier || isNaN(qty)) return null
      return {
        identifier,
        quantity: Math.round(qty),
        costPrice: cost && !isNaN(cost) ? cost : undefined,
      }
    }).filter((l): l is Line => l !== null)
  }

  const parseFile = async (f: File): Promise<Line[]> => {
    const buffer = await f.arrayBuffer()
    const wb = XLSX.read(buffer, { type: "array" })
    const ws = wb.Sheets[wb.SheetNames[0]]
    if (!ws) throw new Error("Archivo vacío")
    const matrix = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null })
    if (matrix.length === 0) return []

    // Detect header row: first row with text
    let headerIdx = 0
    for (let i = 0; i < Math.min(5, matrix.length); i++) {
      const r = matrix[i] ?? []
      const stringCells = r.filter((c: any) => typeof c === "string" && c.trim()).length
      const numericCells = r.filter((c: any) => typeof c === "number").length
      if (stringCells >= 1 && numericCells === 0) { headerIdx = i; break }
    }
    const headers = (matrix[headerIdx] ?? []).map((h: any) => String(h ?? "").toLowerCase().trim())

    // Find columns: identifier (barcode/sku/code), quantity, cost (optional)
    const idCol = headers.findIndex((h: string) =>
      /barra|codigo|cod|barcode|sku|ean/.test(h),
    )
    const qtyCol = headers.findIndex((h: string) =>
      /cant|stock|qty|unidad|cantidad/.test(h),
    )
    const costCol = headers.findIndex((h: string) =>
      /costo|precio|cost|price/.test(h),
    )

    if (idCol === -1 || qtyCol === -1) {
      throw new Error("No detecté columnas de código y cantidad. La planilla debe tener al menos 2 columnas: código de barras (o SKU) y cantidad.")
    }

    return matrix
      .slice(headerIdx + 1)
      .map((r) => {
        const id = String(r[idCol] ?? "").trim()
        const q = typeof r[qtyCol] === "number" ? r[qtyCol] : parseFloat(String(r[qtyCol] ?? "").replace(",", "."))
        const c = costCol >= 0 ? (typeof r[costCol] === "number" ? r[costCol] : parseFloat(String(r[costCol] ?? "").replace(",", "."))) : undefined
        if (!id || isNaN(q)) return null
        return {
          identifier: id,
          quantity: Math.round(q),
          costPrice: c && !isNaN(c) ? c : undefined,
        }
      })
      .filter((l): l is Line => l !== null)
  }

  const handleFile = (f: File) => {
    if (!/\.(csv|xlsx|xls)$/i.test(f.name)) {
      toast.error("Solo CSV o Excel")
      return
    }
    if (f.size > 5 * 1024 * 1024) { toast.error("Máx 5 MB"); return }
    setFile(f)
  }

  const handlePreview = async () => {
    setPreviewing(true)
    try {
      let lines: Line[] = []
      if (inputType === "paste") lines = parseLines()
      else if (file) {
        try { lines = await parseFile(file) }
        catch (e: any) { toast.error(e.message ?? "Error al leer el archivo"); return }
      }
      if (lines.length === 0) {
        toast.error("No detecté líneas válidas. Cada línea debe tener: código y cantidad.")
        return
      }

      const res = await fetch("/api/productos/stock-bulk-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Error al previsualizar")
        return
      }
      setPreview(data)
      setStep("review")
    } finally {
      setPreviewing(false)
    }
  }

  const handleCommit = async () => {
    if (!preview) return
    setCommitting(true)
    try {
      const updates = preview.matched.map((m) => ({
        id: m.productId,
        stock: m.quantity,
        ...(updateCost && m.costPriceUpdate ? { costPrice: m.costPriceUpdate } : {}),
      }))
      const res = await fetch("/api/productos/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: updateMode, reference: reference || null, updates }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? "Error al cargar"); return }
      setResult({ updated: data.updated, stockMovements: data.stockMovements })
      setStep("result")
    } finally {
      setCommitting(false)
    }
  }

  const totals = useMemo(() => {
    if (!preview) return { addedUnits: 0, valueAdded: 0 }
    const addedUnits = preview.matched.reduce((s, m) => s + (m.quantity > 0 ? m.quantity : 0), 0)
    const valueAdded = preview.matched.reduce((s, m) => s + (m.quantity > 0 ? m.quantity * m.currentCostPrice : 0), 0)
    return { addedUnits, valueAdded }
  }, [preview])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center">
              <PackagePlus className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-white font-semibold">Carga masiva de stock</h2>
              <p className="text-xs text-gray-500">
                {step === "input" && "Subí o pegá la lista de productos a cargar"}
                {step === "review" && "Revisá antes de aplicar al inventario"}
                {step === "result" && "Listo"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* ── INPUT STEP ─────────────────────────────────────────────────── */}
          {step === "input" && (
            <>
              <div className="flex gap-2">
                <button
                  onClick={() => setInputType("paste")}
                  className={`flex-1 flex items-center gap-2 justify-center px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                    inputType === "paste"
                      ? "bg-accent text-accent-foreground"
                      : "bg-gray-800 text-gray-400 hover:text-gray-200"
                  }`}
                >
                  <Type size={14} /> Pegar texto
                </button>
                <button
                  onClick={() => setInputType("file")}
                  className={`flex-1 flex items-center gap-2 justify-center px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                    inputType === "file"
                      ? "bg-accent text-accent-foreground"
                      : "bg-gray-800 text-gray-400 hover:text-gray-200"
                  }`}
                >
                  <FileSpreadsheet size={14} /> Subir Excel/CSV
                </button>
              </div>

              {inputType === "paste" && (
                <>
                  <div className="bg-accent-soft border border-accent/30 rounded-xl p-3 text-xs text-gray-300 leading-relaxed">
                    Una línea por producto. Formato: <code className="bg-gray-800 px-1 rounded">codigo cantidad [costo]</code>
                    <br />
                    Separadores válidos: tab, coma, punto y coma. Ej:
                    <pre className="mt-2 text-[11px] text-gray-400 bg-gray-800/50 rounded p-2 whitespace-pre-wrap">{`7790895001234 24
7791234567890 12 850
SKU-001 6`}</pre>
                  </div>
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder="Pegá tu lista acá..."
                    rows={10}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm font-mono text-gray-100 placeholder-gray-600 focus:outline-none focus:border-accent transition resize-none"
                  />
                  <p className="text-xs text-gray-500">
                    {parseLines().length > 0 ? `${parseLines().length} líneas detectadas` : "Sin líneas válidas todavía"}
                  </p>
                </>
              )}

              {inputType === "file" && (
                <>
                  <div className="bg-accent-soft border border-accent/30 rounded-xl p-3 text-xs text-gray-300">
                    Tu Excel/CSV necesita 2 columnas mínimas:
                    <span className="font-medium"> código de barras (o SKU) y cantidad</span>.
                    Opcionalmente una tercera con el costo nuevo si querés actualizarlo al mismo tiempo.
                  </div>
                  <div
                    onClick={() => inputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
                      file ? "border-emerald-500 bg-emerald-500/5" : "border-gray-700 hover:border-gray-600"
                    }`}
                  >
                    <input
                      ref={inputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                    />
                    {file ? (
                      <>
                        <CheckCircle size={32} className="text-emerald-400 mx-auto mb-2" />
                        <p className="text-emerald-400 font-medium text-sm">{file.name}</p>
                        <p className="text-gray-500 text-xs mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                      </>
                    ) : (
                      <>
                        <Upload size={32} className="text-gray-500 mx-auto mb-2" />
                        <p className="text-gray-300 text-sm">Click para subir Excel o CSV</p>
                      </>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {/* ── REVIEW STEP ────────────────────────────────────────────────── */}
          {step === "review" && preview && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-400">{preview.matchedCount}</p>
                  <p className="text-xs text-emerald-300 mt-0.5">Productos encontrados</p>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-amber-400">{preview.unmatchedCount}</p>
                  <p className="text-xs text-amber-300 mt-0.5">No encontrados</p>
                </div>
                <div className="bg-gray-800 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-gray-100">{totals.addedUnits}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Unidades a sumar</p>
                </div>
              </div>

              {/* Mode + reference */}
              <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-xs text-gray-400 mb-2">Modo de actualización</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setUpdateMode("ADD")}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition ${
                        updateMode === "ADD"
                          ? "bg-emerald-600 text-white"
                          : "bg-gray-800 text-gray-400 hover:text-gray-200"
                      }`}
                    >
                      ➕ Sumar al stock actual (carga)
                    </button>
                    <button
                      onClick={() => setUpdateMode("SET")}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition ${
                        updateMode === "SET"
                          ? "bg-sky-600 text-white"
                          : "bg-gray-800 text-gray-400 hover:text-gray-200"
                      }`}
                    >
                      ✏️ Reemplazar (inventario físico)
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1.5">
                    {updateMode === "ADD"
                      ? "Sumamos las cantidades al stock actual. Ideal para cargar un pedido del proveedor."
                      : "Reemplazamos el stock con el valor exacto. Ideal después de un conteo físico."}
                  </p>
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Referencia (opcional)</label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Ej: Pedido Coca-Cola 12/04/2026"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-accent"
                  />
                </div>

                {preview.matched.some((m) => m.costPriceUpdate) && (
                  <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={updateCost}
                      onChange={(e) => setUpdateCost(e.target.checked)}
                      className="w-4 h-4 rounded accent-accent"
                    />
                    También actualizar el costo de los productos
                  </label>
                )}
              </div>

              {/* Matched table */}
              {preview.matched.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-2">Productos a actualizar</p>
                  <div className="overflow-x-auto border border-gray-800 rounded-xl max-h-72 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-800/60 text-gray-400 sticky top-0">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-medium">Producto</th>
                          <th className="px-2 py-1.5 text-left font-medium">Código</th>
                          <th className="px-2 py-1.5 text-right font-medium">Stock actual</th>
                          <th className="px-2 py-1.5 text-right font-medium">Cantidad</th>
                          <th className="px-2 py-1.5 text-right font-medium">Stock final</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {preview.matched.map((m) => {
                          const finalStock = updateMode === "ADD" ? m.currentStock + m.quantity : m.quantity
                          return (
                            <tr key={m.line}>
                              <td className="px-2 py-1.5 text-gray-100">{m.productName}</td>
                              <td className="px-2 py-1.5 text-gray-500 font-mono text-[10px]">{m.barcode || m.sku || "—"}</td>
                              <td className="px-2 py-1.5 text-right text-gray-400">{m.currentStock}</td>
                              <td className="px-2 py-1.5 text-right text-emerald-300 font-medium">
                                {updateMode === "ADD" ? `+${m.quantity}` : m.quantity}
                              </td>
                              <td className="px-2 py-1.5 text-right text-white font-semibold">{finalStock}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Unmatched */}
              {preview.unmatched.length > 0 && (
                <div className="bg-amber-500/5 border border-amber-500/30 rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={14} className="text-amber-400" />
                    <p className="text-amber-300 text-sm font-medium">
                      {preview.unmatched.length} no encontrados — se van a saltear
                    </p>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto text-xs">
                    {preview.unmatched.slice(0, 20).map((u) => (
                      <p key={u.line} className="text-amber-200/80">
                        Línea {u.line}: <code className="bg-gray-800 px-1 rounded">{u.identifier}</code> ({u.quantity} u.)
                      </p>
                    ))}
                    {preview.unmatched.length > 20 && (
                      <p className="text-amber-300/60 italic">…y {preview.unmatched.length - 20} más</p>
                    )}
                  </div>
                  <p className="text-[10px] text-amber-200/60 mt-2">
                    Estos códigos no están cargados como productos. Importalos primero desde "Importar".
                  </p>
                </div>
              )}

              {totals.valueAdded > 0 && updateMode === "ADD" && (
                <div className="text-xs text-gray-500 text-right">
                  Valor de la carga al costo: <strong className="text-gray-300">{formatCurrency(totals.valueAdded)}</strong>
                </div>
              )}
            </>
          )}

          {/* ── RESULT ─────────────────────────────────────────────────────── */}
          {step === "result" && result && (
            <div className="space-y-3 py-4">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 rounded-full bg-emerald-900/40 flex items-center justify-center mx-auto">
                  <CheckCircle size={32} className="text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-white">¡Stock actualizado!</h3>
                <p className="text-gray-400 text-sm">
                  {result.updated} producto{result.updated === 1 ? "" : "s"} actualizado
                  {result.updated === 1 ? "" : "s"}
                  {result.stockMovements > 0 && ` · ${result.stockMovements} movimientos de stock registrados`}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-5 border-t border-gray-800">
          {step === "input" && (
            <>
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium">
                Cancelar
              </button>
              <button
                onClick={handlePreview}
                disabled={previewing || (inputType === "paste" ? parseLines().length === 0 : !file)}
                className="flex-1 py-2.5 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-50 text-accent-foreground text-sm font-semibold flex items-center justify-center gap-2"
              >
                {previewing ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
                {previewing ? "Procesando..." : "Previsualizar"}
              </button>
            </>
          )}
          {step === "review" && (
            <>
              <button
                onClick={() => setStep("input")}
                className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium flex items-center gap-1.5"
              >
                <ArrowLeft size={14} /> Volver
              </button>
              <button
                onClick={handleCommit}
                disabled={committing || preview!.matched.length === 0}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2"
              >
                {committing ? <Loader2 size={15} className="animate-spin" /> : <PackagePlus size={15} />}
                {committing ? "Aplicando..." : `Aplicar a ${preview!.matched.length} productos`}
              </button>
            </>
          )}
          {step === "result" && (
            <button
              onClick={onDone}
              className="w-full py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-accent-foreground text-sm font-semibold"
            >
              Listo
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
