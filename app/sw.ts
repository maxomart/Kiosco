"use client"

// Tiny client component that registers the service worker once on mount.
// Only runs in production builds — dev mode skips registration so SW caching
// doesn't interfere with HMR.

import { useEffect } from "react"

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator)) return
    if (process.env.NODE_ENV !== "production") return

    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => console.warn("[SW] registration failed:", err))
    }

    if (document.readyState === "complete") onLoad()
    else window.addEventListener("load", onLoad, { once: true })

    return () => window.removeEventListener("load", onLoad)
  }, [])

  return null
}
