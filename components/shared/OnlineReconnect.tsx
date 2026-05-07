"use client"

import { useEffect } from "react"
import toast from "react-hot-toast"

/**
 * OnlineReconnect — detecta cuando vuelve la conexión después de un corte
 * y refresca la página automáticamente para que el user vuelva a tener
 * datos frescos del server.
 *
 * Solo dispara reload si:
 *   - El user estuvo offline al menos 5s (sino es spurious — wifi
 *     parpadeó un instante y volvió, no vale la pena romper su flow).
 *   - La pestaña está visible (sino reloadeamos en background y le
 *     pisamos cualquier cosa que tuviera escribiendo).
 *   - No estamos en /pos (el POS funciona offline-first y reloadear
 *     ahí podría perder un carrito en proceso).
 *
 * Antes el comportamiento era: si el browser se cae, ves ERR_FAILED de
 * Chrome y tenés que apretar F5. Ahora detectamos online y se actualiza
 * solo, con un toast amigable.
 */
export function OnlineReconnect() {
  useEffect(() => {
    if (typeof window === "undefined") return
    let offlineSince: number | null = null

    const onOffline = () => {
      offlineSince = Date.now()
    }

    const onOnline = () => {
      const downtime = offlineSince ? Date.now() - offlineSince : 0
      offlineSince = null
      // Si estuvo menos de 5s offline, no vale la pena hacer ruido.
      if (downtime < 5000) return
      // Pestaña no visible → no reloadeamos para no romper formularios
      // abiertos. Mostramos toast cuando vuelva el foco.
      if (document.visibilityState !== "visible") {
        const onVisible = () => {
          if (document.visibilityState === "visible") {
            document.removeEventListener("visibilitychange", onVisible)
            triggerRefresh()
          }
        }
        document.addEventListener("visibilitychange", onVisible)
        return
      }
      triggerRefresh()
    }

    const triggerRefresh = () => {
      // En el POS no reloadeamos: el user puede tener un carrito en curso
      // y los datos del POS son offline-first (catálogo en IndexedDB).
      const onPos = window.location.pathname.startsWith("/pos")
      if (onPos) {
        toast.success("Volvió la conexión — sincronizando ventas pendientes…", {
          duration: 5000,
          icon: "📡",
        })
        return
      }
      toast.success("Volvió la conexión — actualizando…", {
        duration: 2500,
        icon: "📡",
      })
      // Pequeño delay para que el toast alcance a leerse antes del reload.
      setTimeout(() => window.location.reload(), 800)
    }

    window.addEventListener("offline", onOffline)
    window.addEventListener("online", onOnline)
    return () => {
      window.removeEventListener("offline", onOffline)
      window.removeEventListener("online", onOnline)
    }
  }, [])

  return null
}
