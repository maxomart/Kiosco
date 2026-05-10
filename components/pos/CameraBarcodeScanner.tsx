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

type ErrorKind = "denied" | "no-camera" | "no-api" | "other"

export function CameraBarcodeScanner({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const stopScannerRef = useRef<StopFn | null>(null)
  const scannedRef = useRef(false)
  const [errorKind, setErrorKind] = useState<ErrorKind | null>(null)
  const [started, setStarted] = useState(false)
  const [manualValue, setManualValue] = useState("")

  // Detectar si la app corre como PWA standalone para mostrar instrucciones
  // específicas (los permisos en standalone se piden distinto que en tab).
  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true)

  // Detectar plataforma para instrucciones puntuales
  const platform: "android" | "ios" | "desktop" | "other" =
    typeof navigator === "undefined"
      ? "other"
      : /android/i.test(navigator.userAgent)
        ? "android"
        : /iphone|ipad|ipod/i.test(navigator.userAgent)
          ? "ios"
          : /macintosh|windows|linux/i.test(navigator.userAgent)
            ? "desktop"
            : "other"

  // Cleanup en unmount sin re-disparar la cámara: la cámara se inicia
  // SÓLO en respuesta a un click del usuario (ver `start()` abajo). Sin
  // user-gesture explícito, los browsers en modo PWA pueden rechazar
  // getUserMedia en silencio — bug que pasaba antes cuando la cámara se
  // arrancaba automático en useEffect.
  useEffect(() => {
    return () => {
      stopScannerRef.current?.()
      stopScannerRef.current = null
    }
  }, [])

  // Inicia la cámara — debe llamarse DIRECTO desde un onClick para que
  // los browsers consideren la llamada como "user-initiated". Como el
  // <video> está siempre montado en el DOM (sólo lo ocultamos con CSS
  // antes de iniciar), videoRef.current está disponible al instante.
  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorKind("no-api")
      return
    }
    if (!videoRef.current) return
    setStarted(true)
    setErrorKind(null)
    try {
      const stop = await startBarcodeScanner(videoRef.current, (code) => {
        if (scannedRef.current) return
        scannedRef.current = true
        if (typeof navigator.vibrate === "function") navigator.vibrate(60)
        onScan(code)
      })
      stopScannerRef.current = stop
    } catch (e: unknown) {
      const name = (e as { name?: string })?.name
      const kind: ErrorKind =
        name === "NotAllowedError"
          ? "denied"
          : name === "NotFoundError"
            ? "no-camera"
            : "other"
      setErrorKind(kind)
    }
  }

  const retry = () => start()

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
          {errorKind ? (
            <div className="bg-red-950/30 border border-red-700/40 rounded-lg p-3 space-y-2 text-sm text-red-100">
              <div className="flex gap-2">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-red-400" />
                <p className="font-medium">
                  {errorKind === "denied"
                    ? "El navegador no me dejó usar la cámara."
                    : errorKind === "no-camera"
                      ? "No encontré ninguna cámara en este dispositivo."
                      : errorKind === "no-api"
                        ? "Tu navegador no soporta acceso a la cámara."
                        : "No pude iniciar la cámara."}
                </p>
              </div>

              {errorKind === "denied" && (
                <div className="text-[12px] text-red-200/90 space-y-1.5 pl-6">
                  {isStandalone && platform === "android" ? (
                    <>
                      <p className="font-semibold text-white">
                        Estás usando Orvex como app instalada (PWA). Para darle permiso de cámara:
                      </p>
                      <ol className="list-decimal list-inside space-y-0.5">
                        <li>Mantené apretado el ícono de Orvex en tu pantalla.</li>
                        <li>Tocá <strong>"Información de la app"</strong> (ícono de info ⓘ).</li>
                        <li>Entrá a <strong>Permisos → Cámara → Permitir</strong>.</li>
                        <li>Volvé a Orvex y tocá "Volver a pedir" abajo.</li>
                      </ol>
                    </>
                  ) : platform === "android" ? (
                    <>
                      <p>En Chrome/Android: tocá el <strong>candado</strong> al lado del URL → <strong>Permisos del sitio</strong> → <strong>Cámara → Permitir</strong>. Después tocá "Volver a pedir".</p>
                    </>
                  ) : platform === "ios" ? (
                    <>
                      {isStandalone ? (
                        <p>Andá a <strong>Ajustes del iPhone → Orvex → Cámara</strong> y activala. Volvé y tocá "Volver a pedir".</p>
                      ) : (
                        <p>Tocá el ícono <strong>aA</strong> en la barra de Safari → "Ajustes del sitio web" → <strong>Cámara → Permitir</strong>.</p>
                      )}
                    </>
                  ) : (
                    <p>En Chrome: candado al lado del URL → Permisos del sitio → Cámara → Permitir. Después recargá la página.</p>
                  )}
                </div>
              )}

              {(errorKind === "denied" || errorKind === "other") && (
                <div className="pl-6 pt-1">
                  <button
                    type="button"
                    onClick={retry}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold"
                  >
                    <Camera size={12} />
                    Volver a pedir permiso
                  </button>
                </div>
              )}
              {errorKind !== "denied" && (
                <p className="pl-6 text-[11px] text-red-200/70">Mientras tanto, tipeá el código a mano abajo.</p>
              )}
            </div>
          ) : (
            <>
              {/* Video container: siempre montado para que videoRef.current
                  esté disponible cuando el usuario toca "Activar cámara".
                  Antes de iniciar, mostramos un overlay con el botón. */}
              <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${started ? "" : "opacity-0"}`}
                />
                {started ? (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-3/4 h-1/3 border-2 border-purple-400/60 rounded-lg relative">
                      <ScanLine className="absolute inset-x-0 mx-auto text-purple-400 animate-pulse top-1/2 -translate-y-1/2" size={28} />
                    </div>
                  </div>
                ) : (
                  // Estado inicial — botón explícito para activar cámara.
                  // getUserMedia tiene que llamarse DIRECTO desde un click
                  // del usuario; algunos browsers en PWA lo exigen.
                  <button
                    type="button"
                    onClick={start}
                    className="absolute inset-0 bg-gradient-to-br from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 active:scale-[0.99] text-white flex flex-col items-center justify-center gap-2 transition-all"
                  >
                    <Camera className="w-10 h-10" />
                    <span className="font-semibold text-sm">Activar cámara</span>
                    <span className="text-[11px] text-purple-200/80">Tocá acá para empezar a escanear</span>
                  </button>
                )}
              </div>
            </>
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
