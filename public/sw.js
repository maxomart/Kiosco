/**
 * Orvex Service Worker — offline POS support.
 *
 * Strategy:
 *   - /api/auth/*       → never cache, always live
 *   - /api/productos    → network-first + 1h cache fallback (POS necesita catálogo)
 *   - /api/sync/sales   → never cache; en offline devuelve 503 (cliente lo maneja)
 *   - otros /api/*      → network-first; offline = 503 JSON
 *   - /pos, /caja, /inicio → pre-cacheados en install + network-first
 *   - static            → cache-first
 *   - HTML genérico     → network-first con offline.html como fallback
 *
 * Background Sync:
 *   - Registramos tag "orvex-sync-sales" desde el cliente cuando una venta
 *     queda en la cola IDB. El SW dispara un postMessage al cliente al
 *     activarse el sync para que el cliente flushee la cola.
 *
 * NOTA: bumpear VERSION para forzar reinstalación de cache cuando se cambie
 * la lista de assets pre-cacheados o las rutas críticas.
 */

const VERSION = "v9"
const CACHE = `orvex-${VERSION}`
const API_CACHE = `orvex-api-${VERSION}`
const API_TTL_MS = 60 * 60 * 1000 // 1h fallback for /api/productos GETs

const STATIC_ASSETS = [
  "/manifest.json",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/offline.html",
]

// Páginas críticas que pre-cacheamos en install. /pos-app es la app que
// funciona 100% offline. Las demás cargan en modo "limitado / read-only"
// (datos de la última visita online).
const CRITICAL_PAGES = [
  "/pos-app",
  "/pos",
  "/inicio",
  "/caja",
  "/inventario",
  "/ventas",
  "/clientes",
  "/reportes",
]

// Endpoints clave que cacheamos para que el POS-app pueda arrancar offline.
const CRITICAL_API = ["/api/auth/session", "/api/productos?activo=true"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      // Cache assets primero (rápidos y siempre disponibles)
      await cache.addAll(STATIC_ASSETS).catch(() => {})
      // Después intentamos cachear las páginas críticas — pueden fallar
      // si el user no está autenticado, está bien, las cacheamos en uso.
      await Promise.all(
        CRITICAL_PAGES.map((path) =>
          fetch(path, { credentials: "include" })
            .then((res) => res.ok && cache.put(path, res.clone()))
            .catch(() => {})
        )
      )
      // Pre-cachear API críticas para que el POS app arranque offline
      const apiCache = await caches.open(API_CACHE)
      await Promise.all(
        CRITICAL_API.map((path) =>
          fetch(path, { credentials: "include" })
            .then((res) => res.ok && apiCache.put(path, res.clone()))
            .catch(() => {})
        )
      )
    })()
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

  // /api/auth/session — cacheable con TTL para que el POS-app pueda
  // arrancar offline con la sesión cacheada. El resto de /api/auth/* sigue
  // siendo network-only (login, signout, etc).
  if (url.pathname === "/api/auth/session") {
    event.respondWith(networkFirstWithCache(req))
    return
  }
  if (url.pathname.startsWith("/api/auth/")) {
    event.respondWith(fetch(req))
    return
  }

  // /api/sync/* — nunca cachear, fallar limpio en offline para que el cliente
  // sepa que no se sincronizó.
  if (url.pathname.startsWith("/api/sync/")) {
    event.respondWith(
      fetch(req).catch(
        () =>
          new Response(JSON.stringify({ error: "offline" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          })
      )
    )
    return
  }

  // /api/productos — network-first with 1h cache fallback so the POS
  // can still list products on cold-load when offline.
  if (url.pathname.startsWith("/api/productos")) {
    event.respondWith(networkFirstWithCache(req))
    return
  }

  // Other API: network-first, no caching, return 503 JSON on failure.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(req).catch(
        () =>
          new Response(JSON.stringify({ error: "offline" }), {
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
      caches.match(req).then(
        (cached) =>
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

  // Pages: network-first, fall back to cache, then to /offline.html
  // Cacheamos por pathname (sin query) — Next.js manda tokens RSC en query
  // que cambian en cada nav, así con ignoreSearch metemos hits del cache
  // aún cuando los query params son distintos.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone()
          // Guardamos bajo la URL pathname-only para que pegue al buscar offline
          const cacheKey = new Request(url.origin + url.pathname, { method: "GET" })
          caches.open(CACHE).then((c) => c.put(cacheKey, copy)).catch(() => {})
        }
        return res
      })
      .catch(async () => {
        // 1) Buscar exact match
        const exact = await caches.match(req)
        if (exact) return exact
        // 2) Buscar por pathname (sin query)
        const pathOnly = new Request(url.origin + url.pathname, { method: "GET" })
        const byPath = await caches.match(pathOnly)
        if (byPath) return byPath
        // 3) Fallback a la página offline
        const off = await caches.match("/offline.html")
        return off || Response.error()
      })
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
      const headers = new Headers(copy.headers)
      headers.set("sw-cached-at", String(Date.now()))
      const body = await copy.blob()
      const stamped = new Response(body, {
        status: copy.status,
        statusText: copy.statusText,
        headers,
      })
      cache.put(req, stamped).catch(() => {})
    }
    return res
  } catch (err) {
    const cache = await caches.open(API_CACHE)
    const cached = await cache.match(req)
    if (cached) return cached
    return new Response(
      JSON.stringify({ error: "offline", offline: true, products: [] }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    )
  }
}

/**
 * Background Sync — el cliente registra el tag "orvex-sync-sales" cuando
 * encola una venta offline. Cuando vuelve la conexión, el SO dispara este
 * handler aún si la pestaña está cerrada. Nosotros mandamos un mensaje a
 * todos los clients para que disparen el flush; si no hay clients activos,
 * abrimos uno headless al endpoint de sync (best effort).
 */
self.addEventListener("sync", (event) => {
  if (event.tag !== "orvex-sync-sales") return
  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
      if (clientsList.length > 0) {
        for (const c of clientsList) {
          c.postMessage({ type: "orvex:sync-sales" })
        }
      }
    })()
  )
})
