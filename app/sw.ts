"use client"

// Tiny client component that registers the service worker once on mount.
// Only runs in production builds — dev mode skips registration so SW caching
// doesn't interfere with HMR.
//
// IMPORTANTE: cuando el SW se actualiza (bump de VERSION en sw.js) el SW
// nuevo se instala y activa con skipWaiting/clientsClaim, lo que dispara
// `controllerchange` en el cliente. Acá lo escuchamos y forzamos reload —
// así el usuario nunca queda con código JS viejo en memoria. Sin esto,
// había que cerrar la PWA y reabrirla a mano para ver cambios nuevos.
//
// Guarda contra reload-loops con una flag — sólo recargamos UNA vez por
// cambio de controller (Workbox y otras libs hacen lo mismo).

import { useEffect } from "react"

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator)) return
    if (process.env.NODE_ENV !== "production") return

    let reloading = false
    const onControllerChange = () => {
      if (reloading) return
      reloading = true
      // Pequeño delay para que el SW termine de tomar control de fetches
      // antes de pedir el HTML nuevo.
      setTimeout(() => window.location.reload(), 50)
    }
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange)

    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => console.warn("[SW] registration failed:", err))
    }

    if (document.readyState === "complete") onLoad()
    else window.addEventListener("load", onLoad, { once: true })

    return () => {
      window.removeEventListener("load", onLoad)
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange)
    }
  }, [])

  return null
}
