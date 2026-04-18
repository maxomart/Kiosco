"use client"

import { useState, useRef } from "react"
import { X, Upload, FileText, CheckCircle, AlertCircle, Download, Loader2, Sparkles } from "lucide-react"
import Papa from "papaparse"
import toast from "react-hot-toast"

interface ImportModalProps {
  onClose: () => void
  onSuccess: () => void
}

interface ParsedRow {
  name: string
  barcode?: string
  sku?: string
  salePrice: number
  costPrice?: number
  stock?: number
  minStock?: number
  unit?: string
  categoryName?: string
  _valid: boolean
  _error?: string
}

const REQUIRED_COLUMNS = ["name", "salePrice"]
const COLUMN_MAP: Record<string, string> = {
  nombre: "name",
  producto: "name",
  name: "name",
  barcode: "barcode",
  "código de barras": "barcode",
  "codigo de barras": "barcode",
  sku: "sku",
  "precio venta": "salePrice",
  "precio de venta": "salePrice",
  saleprice: "salePrice",
  precio: "salePrice",
  "precio costo": "costPrice",
  "precio de costo": "costPrice",
  costo: "costPrice",
  costprice: "costPrice",
  stock: "stock",
  "stock minimo": "minStock",
  "stock mínimo": "minStock",
  minstock: "minStock",
  unidad: "unit",
  unit: "unit",
  categoria: "categoryName",
  categoría: "categoryName",
  category: "categoryName",
  categoryname: "categoryName",
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ")
}

export default function ImportModal({ onClose, onSuccess }: ImportModalProps) {
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload")
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [importResult, setImportResult] = useState<{ created: number; updated: number; errors: string[] } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [aiMapping, setAiMapping] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const buildRows = (rawRows: Record<string, string>[], headerMap: Record<string, string>): ParsedRow[] => {
    const headers = Object.keys(rawRows[0] ?? {})
    return rawRows.map((raw, i) => {
      const mapped: Record<string, string> = {}
      Object.entries(raw).forEach(([k, v]) => {
        const dest = headerMap[k]
        if (dest) mapped[dest] = v
      })

      const name = mapped.name?.trim()
      const salePrice = parseFloat(mapped.salePrice?.replace(/[^0-9.,]/g, "").replace(",", ".") ?? "")

      if (!name) return { name: raw[headers[0]] ?? `Fila ${i + 2}`, _valid: false, _error: "Falta el nombre", salePrice: 0 }
      if (isNaN(salePrice) || salePrice < 0) return { name, _valid: false, _error: "Precio de venta inválido", salePrice: 0 }

      return {
        name,
        barcode: mapped.barcode?.trim() || undefined,
        sku: mapped.sku?.trim() || undefined,
        salePrice,
        costPrice: mapped.costPrice ? parseFloat(mapped.costPrice.replace(/[^0-9.,]/g, "").replace(",", ".")) || 0 : 0,
        stock: mapped.stock ? parseFloat(mapped.stock) || 0 : 0,
        minStock: mapped.minStock ? parseFloat(mapped.minStock) || 5 : 5,
        unit: mapped.unit?.trim() || "un",
        categoryName: mapped.categoryName?.trim() || undefined,
        _valid: true,
      }
    })
  }

  const processFile = (file: File) => {
    if (!file.name.match(/\.(csv|txt)$/i)) {
      toast.error("Solo se aceptan archivos CSV")
      return
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rawRows = results.data as Record<string, string>[]
        if (rawRows.length === 0) {
          toast.error("El archivo está vacío")
          return
        }

        const headers = Object.keys(rawRows[0])

        // Intentar mapeo estático primero
        const staticHeaderMap: Record<string, string> = {}
        headers.forEach((h) => {
          const normalized = normalizeHeader(h)
          const mapped = COLUMN_MAP[normalized]
          if (mapped) staticHeaderMap[h] = mapped
        })

        const mappedCount = Object.keys(staticHeaderMap).length
        const hasRequiredColumns = Object.values(staticHeaderMap).includes("name") && Object.values(staticHeaderMap).includes("salePrice")

        if (hasRequiredColumns) {
          // Mapeo estático funcionó
          setRows(buildRows(rawRows, staticHeaderMap))
          setStep("preview")
          return
        }

        // Fallback: pedir a la IA que mapee las columnas
        setAiMapping(true)
        try {
          const sample = rawRows[0]
          const res = await fetch("/api/ia/mapear-columnas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ headers, sample }),
          })

          if (res.ok) {
            const { mapping } = await res.json()
            // mapping = { "Col original": "campo_sistema_o_null" }
            const aiHeaderMap: Record<string, string> = {}
            Object.entries(mapping as Record<string, string | null>).forEach(([orig, dest]) => {
              if (dest && typeof dest === "string") aiHeaderMap[orig] = dest
            })

            toast.success("IA detectó las columnas automáticamente", { icon: "✨" })
            setRows(buildRows(rawRows, aiHeaderMap))
          } else {
            // Si la IA falla, mostrar igual con lo que tenemos
            toast.error("No se pudo detectar las columnas automáticamente")
            setRows(buildRows(rawRows, staticHeaderMap))
          }
        } catch {
          toast.error("Error al usar IA para mapear columnas")
          setRows(buildRows(rawRows, staticHeaderMap))
        } finally {
          setAiMapping(false)
          setStep("preview")
        }
      },
      error: () => toast.error("Error al leer el archivo"),
    })
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const handleImport = async () => {
    const valid = rows.filter((r) => r._valid)
    if (valid.length === 0) return

    setStep("importing")

    const res = await fetch("/api/productos/importar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productos: valid }),
    })

    const data = await res.json()
    setImportResult(data)
    setStep("done")
  }

  const downloadTemplate = () => {
    const csv = "name,barcode,sku,salePrice,costPrice,stock,minStock,unit,categoryName\nCoca Cola 500ml,7790895000008,,1200,900,24,5,un,Bebidas\nAlfajor Oreo,7794000522501,,800,550,30,5,un,Golosinas"
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "plantilla_productos.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const validCount = rows.filter((r) => r._valid).length
  const errorCount = rows.filter((r) => !r._valid).length

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-white">Importar productos</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Cargá un CSV con tus productos</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition">
            <X size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* STEP: UPLOAD */}
          {step === "upload" && !aiMapping && (
            <div className="space-y-4">
              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                  isDragging
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                }`}
              >
                <Upload className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
                <p className="text-gray-700 dark:text-gray-200 font-semibold text-lg">
                  Arrastrá tu CSV acá o hacé click
                </p>
                <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Solo archivos .csv</p>
                <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" />
              </div>

              {/* Columnas aceptadas */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Columnas reconocidas:</p>
                <div className="flex flex-wrap gap-2">
                  {["name *", "barcode", "sku", "salePrice *", "costPrice", "stock", "minStock", "unit", "categoryName"].map((col) => (
                    <span key={col} className={`text-xs px-2 py-1 rounded-lg font-mono ${col.includes("*") ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" : "bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300"}`}>
                      {col}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">* requeridos · También acepta nombres en español (nombre, precio, costo, categoría...)</p>
              </div>

              {/* Descargar plantilla */}
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                <Download size={16} />
                Descargar plantilla de ejemplo
              </button>
            </div>
          )}

          {/* STEP: PREVIEW */}
          {step === "preview" && (
            <div className="space-y-4">
              {/* Resumen */}
              <div className="flex gap-3">
                <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-4 py-2 rounded-xl text-sm font-medium">
                  <CheckCircle size={16} />
                  {validCount} válidos
                </div>
                {errorCount > 0 && (
                  <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-2 rounded-xl text-sm font-medium">
                    <AlertCircle size={16} />
                    {errorCount} con errores
                  </div>
                )}
              </div>

              {/* Tabla preview */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Estado</th>
                        <th className="text-left px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Nombre</th>
                        <th className="text-left px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Barcode</th>
                        <th className="text-right px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">P. Venta</th>
                        <th className="text-right px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Costo</th>
                        <th className="text-right px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Stock</th>
                        <th className="text-left px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Categoría</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {rows.map((row, i) => (
                        <tr key={i} className={row._valid ? "dark:text-gray-200" : "bg-red-50 dark:bg-red-900/10"}>
                          <td className="px-3 py-2">
                            {row._valid
                              ? <CheckCircle size={14} className="text-green-500" />
                              : <span className="text-xs text-red-500">{row._error}</span>
                            }
                          </td>
                          <td className="px-3 py-2 font-medium truncate max-w-[150px]">{row.name}</td>
                          <td className="px-3 py-2 text-gray-400 dark:text-gray-500 font-mono text-xs">{row.barcode || "-"}</td>
                          <td className="px-3 py-2 text-right">{row._valid ? `$${row.salePrice.toLocaleString("es-AR")}` : "-"}</td>
                          <td className="px-3 py-2 text-right text-gray-500 dark:text-gray-400">{row._valid && row.costPrice ? `$${row.costPrice.toLocaleString("es-AR")}` : "-"}</td>
                          <td className="px-3 py-2 text-right">{row._valid ? row.stock : "-"}</td>
                          <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{row.categoryName || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* AI MAPPING LOADER */}
          {aiMapping && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="relative">
                <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />
                <Sparkles size={18} className="absolute -top-1 -right-1 text-purple-400" />
              </div>
              <p className="text-gray-700 dark:text-gray-200 font-semibold text-lg">IA detectando columnas...</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm text-center max-w-xs">
                Claude está analizando tus encabezados y mapeando cada columna al campo correcto
              </p>
            </div>
          )}

          {/* STEP: IMPORTING */}
          {step === "importing" && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
              <p className="text-gray-600 dark:text-gray-300 font-medium">Importando {validCount} productos...</p>
            </div>
          )}

          {/* STEP: DONE */}
          {step === "done" && importResult && (
            <div className="space-y-4">
              <div className="flex flex-col items-center py-6 gap-3">
                <CheckCircle className="w-16 h-16 text-green-500" />
                <h3 className="text-xl font-bold text-gray-800 dark:text-white">¡Importación completada!</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400">{importResult.created}</p>
                  <p className="text-sm text-green-600 dark:text-green-400">Productos nuevos</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{importResult.updated}</p>
                  <p className="text-sm text-blue-600 dark:text-blue-400">Actualizados</p>
                </div>
              </div>
              {importResult.errors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-4">
                  <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">Errores ({importResult.errors.length}):</p>
                  <ul className="space-y-1">
                    {importResult.errors.map((err, i) => (
                      <li key={i} className="text-xs text-red-500">• {err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
          {step === "upload" && (
            <>
              <p className="text-xs text-gray-400 dark:text-gray-500">Tip: los productos existentes se actualizan por barcode</p>
              <button onClick={onClose} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition text-sm">
                Cancelar
              </button>
            </>
          )}
          {step === "preview" && (
            <>
              <button onClick={() => setStep("upload")} className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition text-sm">
                ← Volver
              </button>
              <button
                onClick={handleImport}
                disabled={validCount === 0}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl font-semibold text-sm transition"
              >
                Importar {validCount} productos
              </button>
            </>
          )}
          {step === "done" && (
            <div className="flex justify-end w-full">
              <button
                onClick={() => { onSuccess(); onClose() }}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold text-sm transition"
              >
                Ver inventario
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
