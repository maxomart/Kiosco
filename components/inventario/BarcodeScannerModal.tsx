"use client"

import { useState, useEffect, useRef } from "react"
import { X, Camera, Scan, AlertCircle, Loader2, Plus, Edit2, Keyboard } from "lucide-react"
import toast from "react-hot-toast"

interface ScannedProduct {
  id: string
  name: string
  barcode: string | null
  stock: number
  salePrice: number
  costPrice: number
  category?: { id: string; name: string } | null
  supplier?: { id: string; name: string } | null
}

type Mode = "idle" | "camera" | "keyboard"

// Type for native BarcodeDetector (experimental browser API)
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => {
  detect: (src: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>
}

export function BarcodeScannerModal({
  open,
  onClose,
  onCreateProduct,
  onEditProduct,
}: {
  open: boolean
  onClose: () => void
  onCreateProduct: (barcode: string) => void
  onEditProduct: (product: ScannedProduct) => void
}) {
  const [mode, setMode] = useState<Mode>("idle")
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [lastScan, setLastScan] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [manualCode, setManualCode] = useState("")
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectorRef = useRef<InstanceType<BarcodeDetectorCtor> | null>(null)
  const stopLoopRef = useRef(false)
  const keyboardInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) {
      stopCamera()
      setMode("idle")
      setLastScan(null)
      setCameraError(null)
      setManualCode("")
    }
  }, [open])

  useEffect(() => {
    if (mode === "camera") startCamera()
    else stopCamera()
    if (mode === "keyboard") {
      setTimeout(() => keyboardInputRef.current?.focus(), 50)
    }
    return () => { if (mode !== "camera") stopCamera() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const startCamera = async () => {
    setCameraError(null)
    // Check if BarcodeDetector is available
    const BD = (window as any).BarcodeDetector as BarcodeDetectorCtor | undefined
    if (!BD) {
      setCameraError("Tu navegador no soporta el detector de códigos nativo. Usá un lector USB o ingresá el código manualmente.")
      return
    }
    try {
      detectorRef.current = new BD({ formats: ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e", "qr_code"] })
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      stopLoopRef.current = false
      detectLoop()
    } catch (err: any) {
      setCameraError("No se pudo acceder a la cámara. Permitir acceso o usar modo manual.")
    }
  }

  const stopCamera = () => {
    stopLoopRef.current = true
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
  }

  const detectLoop = async () => {
    if (stopLoopRef.current) return
    const video = videoRef.current
    const detector = detectorRef.current
    if (!video || !detector || video.readyState < 2) {
      requestAnimationFrame(detectLoop)
      return
    }
    try {
      const codes = await detector.detect(video)
      if (codes.length > 0 && !searching) {
        const code = codes[0].rawValue
        if (code && code !== lastScan) {
          setLastScan(code)
          handleCodeFound(code)
          return // stop loop once a code is found
        }
      }
    } catch {
      // ignore frame errors, keep scanning
    }
    if (!stopLoopRef.current) requestAnimationFrame(detectLoop)
  }

  const handleCodeFound = async (code: string) => {
    setSearching(true)
    try {
      const res = await fetch(`/api/productos?q=${encodeURIComponent(code)}&limit=1`)
      const data = await res.json()
      const match = (data.products || []).find(
        (p: any) => p.barcode === code
      )
      if (match) {
        // Existing product
        toast.success(`Encontrado: ${match.name}`)
        onEditProduct({
          id: match.id,
          name: match.name,
          barcode: match.barcode,
          stock: match.stock,
          salePrice: Number(match.salePrice),
          costPrice: Number(match.costPrice),
          category: match.category,
          supplier: match.supplier,
        })
      } else {
        toast(`Código nuevo: ${code}`, { icon: "🆕" })
        onCreateProduct(code)
      }
    } catch {
      toast.error("Error al buscar el producto")
    } finally {
      setSearching(false)
    }
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const code = manualCode.trim()
    if (!code) return
    handleCodeFound(code)
    setManualCode("")
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl shadow-black/50 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-800 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent-soft flex items-center justify-center">
              <Scan className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="font-bold text-gray-100">Escanear código de barras</h2>
              <p className="text-sm text-gray-400 mt-0.5">Encontrá o creá productos sin tipear</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {mode === "idle" && (
            <div className="space-y-3">
              <button
                onClick={() => setMode("camera")}
                className="w-full p-4 rounded-xl border border-accent/40 bg-accent-soft/30 hover:bg-accent-soft/50 flex items-center gap-3 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <Camera className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Usar cámara</p>
                  <p className="text-xs text-gray-400">Ideal desde el celular</p>
                </div>
              </button>

              <button
                onClick={() => setMode("keyboard")}
                className="w-full p-4 rounded-xl border border-gray-800 bg-gray-800/40 hover:bg-gray-800/60 flex items-center gap-3 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0">
                  <Keyboard className="w-5 h-5 text-gray-300" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Lector USB / Teclado</p>
                  <p className="text-xs text-gray-400">Apuntá con tu escáner USB o tipeá el código</p>
                </div>
              </button>
            </div>
          )}

          {mode === "camera" && (
            <div className="space-y-3">
              {cameraError ? (
                <div className="bg-red-900/20 border border-red-700/40 rounded-lg p-4 flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-300">{cameraError}</p>
                    <button
                      onClick={() => setMode("keyboard")}
                      className="text-xs text-accent hover:underline mt-2"
                    >
                      → Usar lector USB o teclado
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
                    <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
                    {/* Scan frame overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-2/3 h-1/3 border-2 border-accent rounded-lg shadow-[0_0_20px_rgba(139,92,246,0.5)]" />
                    </div>
                    {searching && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-accent animate-spin" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 text-center">
                    Apuntá el código dentro del recuadro
                  </p>
                </>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setMode("idle")}
                  className="flex-1 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm"
                >
                  Volver
                </button>
                <button
                  onClick={() => setMode("keyboard")}
                  className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm"
                >
                  Usar teclado
                </button>
              </div>
            </div>
          )}

          {mode === "keyboard" && (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold block mb-2">
                  Código de barras
                </label>
                <input
                  ref={keyboardInputRef}
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Escaneá con tu lector USB o tipeá..."
                  disabled={searching}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-lg font-mono focus:outline-none focus:border-accent"
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  Los lectores USB emiten el código y Enter automáticamente.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode("idle")}
                  className="flex-1 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm"
                >
                  Volver
                </button>
                <button
                  type="submit"
                  disabled={!manualCode.trim() || searching}
                  className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-50 text-accent-foreground text-sm font-medium flex items-center gap-1.5"
                >
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scan className="w-4 h-4" />}
                  Buscar
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
