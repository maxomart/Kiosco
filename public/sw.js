/**
 * RetailAR Service Worker — minimal install/cache layer.
 *
 * Strategy:
 *   - /api/*       → network-first (fall back to nothing if offline)
 *   - static       → cache-first (icons, manifest, fonts, _next/static)
 *   - everything   → network-first with cache fallback
 *
 * This does NOT make POS truly offline yet — it just makes the app
 * installable and snappier on repeat loads.
 */

const VERSION = "v1"
const CACHE = `retailar-${VERSION}`
const STATIC_ASSETS = [
  "/manifest.json",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  const url = new URL(req.url)

  // Skip cross-origin / non-GET
  if (req.method !== "GET" || url.origin !== self.location.origin) return

  // API: always network-first, never cache
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(req).catch(() => new Response(JSON.stringify({ error: "offline" }), { status: 503, headers: { "Content-Type": "application/json" } })))
    return
  }

  // Static / build assets: cache-first
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.json"
  ) {
    event.respondWith(
      caches.match(req).then((cached) =>
        cached ||
        fetch(req).then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy))
          return res
        })
      )
    )
    return
  }

  // Pages: network-first, fall back to cache
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
        return res
      })
      .catch(() => caches.match(req).then((c) => c || Response.error()))
  )
})
