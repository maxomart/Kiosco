"use client"

/**
 * Banner sticky global que aparece en TODAS las páginas del dashboard
 * cuando se corta el internet.
 *
 * UX:
 *  1. Si estás en /pos-app → no muestra nada (ya estás en la app que
 *     funciona offline).
 *  2. Si estás en cualquier otra ruta → barra naranja arriba con botón
 *     "Ir al POS Offline" para que sigas vendiendo sin perder ventas.
 *  3. Cuando vuelve la conexión, aparece un toast verde + cuenta de
 *     ventas sincronizadas (si había).
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { WifiOff, ArrowRight, Wifi, X } from "lucide-react"
import toast from "react-hot-toast"
import { flushQueue } from "@/lib/sync-queue"

const DISMISS_KEY = "orvex:offline-banner-dismissed"

export function OfflineGlobalBanner() {
  const pathname = usePathname()
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  )
  const [dismissedSession, setDismissedSession] = useState(false)

  useEffect(() => {
    const onOnline = async () => {
      setIsOnline(true)
      setDismissedSession(false)
      // Auto-flush + toast del resultado
      try {
        const res = await flushQueue()
        if (res.ok > 0) {
          toast.success(
            `${res.ok} venta${res.ok === 1 ? "" : "s"} sincronizada${res.ok === 1 ? "" : "s"}`,
            { duration: 4000 }
          )
        } else {
          toast.success("Volvió la conexión", { duration: 2500 })
        }
      } catch {
        toast.success("Volvió la conexión", { duration: 2500 })
      }
    }
    const onOffline = () => {
      setIsOnline(false)
      // Reset dismiss cuando se corta de nuevo
      setDismissedSession(false)
    }
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)
    return () => {
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOffline)
    }
  }, [])

  // No mostrar si:
  //   - hay internet
  //   - el user lo cerró durante esta sesión offline
  //   - ya está en /pos-app (donde el POS funciona offline)
  const isInPosApp = pathname?.startsWith("/pos-app") ?? false
  const shouldShow = !isOnline && !dismissedSession && !isInPosApp

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="sticky top-0 z-[60] w-full bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-orange-900/40"
        >
          <div className="max-w-7xl mx-auto px-3 py-2 flex items-center gap-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
                <WifiOff size={14} />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold leading-tight">Sin internet — modo limitado</p>
              <p className="text-xs opacity-90 leading-tight hidden sm:block">
                Podés ver datos pero no guardar cambios. Para seguir vendiendo, pasate al POS Offline.
              </p>
            </div>
            <Link
              href="/pos-app"
              className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-orange-700 text-xs font-bold hover:bg-orange-50 transition-colors shadow"
            >
              POS Offline
              <ArrowRight size={12} />
            </Link>
            <button
              onClick={() => setDismissedSession(true)}
              className="p-1 rounded text-white/70 hover:text-white hover:bg-white/10 flex-shrink-0"
              aria-label="Cerrar"
              title="Ocultar (volverá a aparecer si te volvés a quedar sin red)"
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * Indicador chico de "ya volviste online" para mostrar 3s después de
 * recuperar conexión. Es opcional — el toast del global banner ya avisa.
 */
export function OnlineIndicator() {
  const [justOnline, setJustOnline] = useState(false)
  useEffect(() => {
    const handler = () => {
      setJustOnline(true)
      setTimeout(() => setJustOnline(false), 3000)
    }
    window.addEventListener("online", handler)
    return () => window.removeEventListener("online", handler)
  }, [])
  if (!justOnline) return null
  return (
    <div className="fixed bottom-4 left-4 z-50 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-medium shadow-lg">
      <Wifi size={14} />
      Volvió la conexión
    </div>
  )
}
