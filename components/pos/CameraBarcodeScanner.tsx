"use client"

import { useEffect, useRef, useState } from "react"
import { X, Camera, AlertCircle, ScanLine } from "lucide-react"

/**
 * Modal con escáner de código de barras usando la cámara.
 * Usa BarcodeDetector (Chromium/Android). Si no está soportado, ofrece input manual.
 */
interface Props {
  onScan: (barcode: string) => void
  onClose: () => void
}

const FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "qr_code",
  "itf",
] as const

export function CameraBarcodeScanner({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectorRef = useRef<any>(null)
  const scanningRef = useRef(true)
  const [error, setError] = useState<string | null>(null)
  const [supported, setSupported] = useState<boolean | null>(null)
  const [manualValue, setManualValue] = useState("")

  useEffect(() => {
    const isSupported = typeof window !== "undefined" && "BarcodeDetector" in window
    setSupported(isSupported)

    if (!isSupported) return
    let cancelled = false

    ;(async () => {
      try {
        // @ts-ignore — BarcodeDetector no está en lib.dom.d.ts
        detectorRef.current = new window.BarcodeDetector({ formats: [...FORMATS] })
      } catch (e) {
        console.warn("BarcodeDetector init falló", e)
        setSupported(false)
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
        loop()
      } catch (e: any) {
        const msg = e?.name === "NotAllowedError"
          ? "Permitime usar la cámara para escanear"
          : "No pude acceder a la cámara"
        setError(msg)
      }
    })()

    return () => {
      cancelled = true
      scanningRef.current = false
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const loop = async () => {
    if (!scanningRef.current || !videoRef.current || !detectorRef.current) return
    try {
      const barcodes = await detectorRef.current.detect(videoRef.current)
      if (barcodes && barcodes.length > 0) {
        const code = barcodes[0].rawValue
        if (code) {
          scanningRef.current = false
          if (navigator.vibrate) navigator.vibrate(60)
          onScan(code)
          return
        }
      }
    } catch {
      // ignore frame errors
    }
    if (scanningRef.current) requestAnimationFrame(loop)
  }

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
          {supported === false ? (
            <div className="bg-amber-950/30 border border-amber-700/40 rounded-lg p-3 flex gap-2 text-sm text-amber-100">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-amber-400" />
              <p>
                Tu navegador no tiene escáner de cámara nativo. Usá Chrome/Edge/Samsung Browser en Android, o entrá el código a mano abajo.
              </p>
            </div>
          ) : error ? (
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
              {/* Overlay de mira */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-3/4 h-1/3 border-2 border-purple-400/60 rounded-lg relative">
                  <ScanLine className="absolute inset-x-0 mx-auto text-purple-400 animate-pulse top-1/2 -translate-y-1/2" size={28} />
                </div>
              </div>
            </div>
          )}

          {/* Manual fallback */}
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
                autoFocus={!!error || supported === false}
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
