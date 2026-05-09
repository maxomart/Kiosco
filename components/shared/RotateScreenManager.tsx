"use client"

import { useEffect } from "react"

/**
 * Aplica/desactiva la rotación visual de 90° del sitio según localStorage.
 *
 * Para TVs físicamente montadas verticales pero cuyo OS no rota la salida
 * (Android TV típico, smart TVs LG/Samsung con un solo orientación
 * landscape). Sin esto el sitio se ve "horizontal" en pantallas físicamente
 * verticales.
 *
 * Activación rápida desde el TV — la usuaria puede escribir cualquiera de
 * estas URLs en el navegador del TV (Downloader / Silk / etc.):
 *
 *   cobraorvex.com/?rotate=on    → activa rotación
 *   cobraorvex.com/?rotate=off   → desactiva
 *
 * El estado queda persistido en localStorage, así no hay que re-tipear.
 */

const KEY = "orvex-rotate-screen"

export default function RotateScreenManager() {
  useEffect(() => {
    if (typeof window === "undefined") return

    // Si vino con ?rotate=on/off en la URL, persistir y limpiar el query
    try {
      const params = new URLSearchParams(window.location.search)
      const rotate = params.get("rotate")
      if (rotate === "on" || rotate === "off") {
        if (rotate === "on") localStorage.setItem(KEY, "1")
        else localStorage.removeItem(KEY)
        // Limpiar el param sin recargar
        params.delete("rotate")
        const newSearch = params.toString()
        const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "") + window.location.hash
        window.history.replaceState({}, "", newUrl)
      }
    } catch {
      // ignorar errores de parseo
    }

    // Aplicar clase según valor actual
    const apply = () => {
      const enabled = localStorage.getItem(KEY) === "1"
      document.documentElement.classList.toggle("rotate-screen-90", enabled)
    }
    apply()

    // Escuchar cambios desde otras tabs (sincronización de toggles)
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) apply()
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  return null
}
