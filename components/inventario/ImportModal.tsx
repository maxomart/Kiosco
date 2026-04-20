"use client"

import { useState, useRef } from "react"
import { X, Upload, FileText, CheckCircle, AlertTriangle, Download, Loader2 } from "lucide-react"

interface Props {
  onClose: () => void
  onDone: () => void
}

interface ImportResult {
  imported: number
  updated: number
  errors: { row: number; message: string }[]
}

export default function ImportModal({ onClose, onDone }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (f: File) => {
    if (!f.name.endsWith(".csv") && !f.name.endsWith(".xlsx")) {
      alert("Solo se aceptan archivos CSV o Excel (.xlsx)")
      return
    }
    setFile(f)
    setResult(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0])
  }

  const handleImport = async () => {
    if (!file) return
    setLoading(true)
    const formData = new FormData()
    formData.append("file", file)
    const res = await fetch("/api/productos/importar", { method: "POST", body: formData })
    if (res.ok) { setResult(await res.json()) }
    else {
      const d = await res.json()
      setResult({ imported: 0, updated: 0, errors: [{ row: 0, message: d.error || "Error al importar" }] })
    }
    setLoading(false)
  }

  const downloadTemplate = () => {
    const csv = "nombre,codigo_barras,sku,precio_venta,costo,stock,stock_minimo,unidad,categoria\nEjemplo Producto,7891234567890,PROD001,1500,1000,50,5,un,Almacen\n"
    const a = document.createElement("a")
    a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`
    a.download = "plantilla_productos.csv"
    a.click()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-white font-semibold text-lg">Importar productos</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Template download */}
          <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <FileText size={16} className="text-purple-400" />
              Descargar plantilla CSV
            </div>
            <button onClick={downloadTemplate} className="flex items-center gap-1 text-purple-400 hover:text-purple-300 text-sm transition-colors">
              <Download size={14} /> Descargar
            </button>
          </div>

          {/* Drop zone */}
          {!result && (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                dragging ? "border-purple-500 bg-purple-500/5" : file ? "border-green-500 bg-green-500/5" : "border-gray-700 hover:border-gray-600"
              }`}
            >
              <input ref={inputRef} type="file" accept=".csv,.xlsx" className="hidden"
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
              {file ? (
                <>
                  <CheckCircle size={32} className="text-green-400 mx-auto mb-2" />
                  <p className="text-green-400 font-medium">{file.name}</p>
                  <p className="text-gray-500 text-sm mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                </>
              ) : (
                <>
                  <Upload size={32} className="text-gray-500 mx-auto mb-2" />
                  <p className="text-gray-300">Arrastrá tu archivo aquí</p>
                  <p className="text-gray-500 text-sm mt-1">o hacé click para seleccionar (CSV, Excel)</p>
                </>
              )}
            </div>
          )}

          {/* Format info */}
          {!result && !file && (
            <div className="text-xs text-gray-500 space-y-1">
              <p className="font-medium text-gray-400">Columnas esperadas:</p>
              <p>nombre*, precio_venta*, costo, stock, codigo_barras, sku, unidad, categoria</p>
              <p className="text-yellow-400/70">* Columnas obligatorias</p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-400">{result.imported}</p>
                  <p className="text-xs text-green-400/70 mt-0.5">Importados</p>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-400">{result.updated}</p>
                  <p className="text-xs text-blue-400/70 mt-0.5">Actualizados</p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={14} className="text-red-400" />
                    <span className="text-red-400 text-sm font-medium">{result.errors.length} errores</span>
                  </div>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {result.errors.map((e, i) => (
                      <p key={i} className="text-red-300/70 text-xs">
                        {e.row > 0 ? `Fila ${e.row}: ` : ""}{e.message}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 p-5 border-t border-gray-800">
          <button onClick={result ? onDone : onClose}
            className="flex-1 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium transition-colors">
            {result ? "Cerrar" : "Cancelar"}
          </button>
          {!result && (
            <button onClick={handleImport} disabled={!file || loading}
              className="flex-1 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2">
              {loading && <Loader2 size={15} className="animate-spin" />}
              {loading ? "Importando..." : "Importar"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
