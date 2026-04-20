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

const VERSION = "v2"
const CACHE = `retailar-${VERSION}`
const API_CACHE = `retailar-api-${VERSION}`
const API_TTL_MS = 60 * 60 * 1000 // 1h fallback for /api/productos GETs
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
      Promise.all(
        keys
          .filter((k) => k !== CACHE && k !== API_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  const req = event.request
  const url = new URL(req.url)

  // Skip cross-origin / non-GET
  if (req.method !== "GET" || url.origin !== self.location.origin) return

  // /api/auth/* — never cache, always live (sessions/tokens).
  if (url.pathname.startsWith("/api/auth/")) {
    event.respondWith(fetch(req))
    return
  }

  // /api/productos — network-first with 1h cache fallback so the POS
  // can still list products on cold-load when offline.
  // (Only safe for GET; we already filtered method above.)
  if (url.pathname.startsWith("/api/productos")) {
    event.respondWith(networkFirstWithCache(req))
    return
  }

  // Other API: network-first, no caching, return 503 JSON on failure.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(req).catch(
        () => new Response(JSON.stringify({ error: "offline" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        })
      )
    )
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

/**
 * Network-first fetch with API_CACHE fallback.
 * Stores response with a `sw-cached-at` header so we can age it out.
 */
async function networkFirstWithCache(req) {
  try {
    const res = await fetch(req)
    if (res && res.ok) {
      const copy = res.clone()
      const cache = await caches.open(API_CACHE)
      // Stamp with cache time so we can evict via TTL.
      const headers = new Headers(copy.headers)
      headers.set("sw-cached-at", String(Date.now()))
      const body = await copy.blob()
      const stamped = new Response(body, {
        status: copy.status, statusText: copy.statusText, headers,
      })
      cache.put(req, stamped).catch(() => {})
    }
    return res
  } catch (err) {
    const cache = await caches.open(API_CACHE)
    const cached = await cache.match(req)
    if (cached) {
      const at = Number(cached.headers.get("sw-cached-at") ?? 0)
      if (!at || Date.now() - at < API_TTL_MS) return cached
      // Stale but better than nothing when truly offline:
      return cached
    }
    return new Response(
      JSON.stringify({ error: "offline", offline: true, products: [] }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    )
  }
}
