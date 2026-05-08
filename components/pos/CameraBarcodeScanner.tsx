"use client"

import { useEffect, useRef, useState } from "react"
import { X, Camera, AlertCircle, ScanLine } from "lucide-react"
import { startBarcodeScanner, type StopFn } from "@/lib/barcode-scanner"

/**
 * Modal con escáner de código de barras usando la cámara.
 * Usa BarcodeDetector nativo cuando está disponible (Chrome/Edge en Android),
 * con fallback automático a ZXing para Safari/iOS.
 */
interface Props {
  onScan: (barcode: string) => void
  onClose: () => void
}

export function CameraBarcodeScanner({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const stopScannerRef = useRef<StopFn | null>(null)
  const scannedRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [manualValue, setManualValue] = useState("")

  useEffect(() => {
    let cancelled = false

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Tu navegador no soporta acceso a la cámara. Entrá el código a mano abajo.")
      return
    }

    ;(async () => {
      if (!videoRef.current) return
      try {
        const stop = await startBarcodeScanner(videoRef.current, (code) => {
          if (scannedRef.current) return
          scannedRef.current = true
          if (typeof navigator.vibrate === "function") navigator.vibrate(60)
          onScan(code)
        })
        if (cancelled) {
          stop()
          return
        }
        stopScannerRef.current = stop
      } catch (e: unknown) {
        const name = (e as { name?: string })?.name
        const msg = name === "NotAllowedError"
          ? "Permitime usar la cámara para escanear (revisá los permisos del navegador)."
          : name === "NotFoundError"
            ? "No encontré ninguna cámara en este dispositivo."
            : "No pude iniciar la cámara. Entrá el código a mano abajo."
        if (!cancelled) setError(msg)
      }
    })()

    return () => {
      cancelled = true
      stopScannerRef.current?.()
      stopScannerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const v = manualValue.trim()
    if (v.length >= 4) {
      onScan(v)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-white font-bold flex items-center gap-2">
            <Camera size={16} className="text-purple-400" />
            Escanear código
          </h2>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {error ? (
            <div className="bg-red-950/30 border border-red-700/40 rounded-lg p-3 flex gap-2 text-sm text-red-100">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-red-400" />
              <p>{error}</p>
            </div>
          ) : (
            <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-3/4 h-1/3 border-2 border-purple-400/60 rounded-lg relative">
                  <ScanLine className="absolute inset-x-0 mx-auto text-purple-400 animate-pulse top-1/2 -translate-y-1/2" size={28} />
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleManualSubmit} className="space-y-2 pt-2 border-t border-gray-800">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">
              O entrá el código a mano
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={manualValue}
                onChange={(e) => setManualValue(e.target.value.replace(/[^A-Za-z0-9]/g, ""))}
                placeholder="7790070411111"
                autoFocus={!!error}
                className="flex-1 bg-gray-800 border border-gray-700 hover:border-gray-600 focus:border-purple-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 font-mono"
              />
              <button
                type="submit"
                disabled={manualValue.length < 4}
                className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-sm font-medium"
              >
                Buscar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
