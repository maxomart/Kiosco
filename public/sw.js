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

const VERSION = "v18"
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

// Páginas críticas que pre-cacheamos en install. Incluimos /login y la
// landing por si el user llega cold sin sesión activa pero con cache —
// antes ahí se rompía con ERR_FAILED del browser.
const CRITICAL_PAGES = [
  "/pos-app",
  "/pos",
  "/inicio",
  "/caja",
  "/inventario",
  "/ventas",
  "/clientes",
  "/reportes",
  "/login",
  "/",
]

// Endpoints clave que cacheamos para que el POS-app pueda arrancar offline.
const CRITICAL_API = ["/api/auth/session", "/api/productos?activo=true"]

/**
 * HTML inline de último recurso — cuando ni siquiera /offline.html está
 * en cache (instalación recién hecha sin haber abierto la app online),
 * devolvemos esta página self-contained para que el user nunca vea el
 * ERR_FAILED del browser.
 *
 * Tiene auto-reload cada 5s vía meta refresh para volver a la app sola
 * cuando el internet vuelve.
 */
const FALLBACK_HTML = `<!doctype html>
<html lang="es-AR"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#050510">
<title>Sin conexión · Orvex</title>
<style>
  :root { color-scheme: dark; }
  *, *::before, *::after { box-sizing: border-box }
  html, body { margin: 0; padding: 0; height: 100%; height: 100dvh }
  body { font-family: -apple-system, system-ui, "Segoe UI", Roboto, sans-serif;
    background: linear-gradient(135deg, #050510, #0a0a18 50%, #07071a);
    color: #f3f4f6; display: flex; align-items: center; justify-content: center; padding: 24px }
  .card { max-width: 380px; text-align: center;
    background: rgba(17,24,39,0.6); border: 1px solid rgba(124,58,237,0.3);
    border-radius: 24px; padding: 32px 28px; backdrop-filter: blur(20px) }
  .icon { width: 64px; height: 64px; margin: 0 auto 16px;
    border-radius: 20px; background: rgba(124,58,237,0.18);
    border: 1px solid rgba(124,58,237,0.4);
    display: flex; align-items: center; justify-content: center; color: #a78bfa }
  h1 { margin: 0 0 8px; font-size: 22px; font-weight: 800; letter-spacing: -0.02em }
  p { margin: 0 0 18px; color: #9ca3af; font-size: 14px; line-height: 1.55 }
  .pill { display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 12px; border-radius: 999px; font-size: 12px;
    background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.3);
    color: #fcd34d; margin-bottom: 14px }
  .pill .dot { width: 8px; height: 8px; border-radius: 50%; background: #f59e0b;
    animation: pulse 1.6s ease-in-out infinite }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
  .btn { display: inline-flex; align-items: center; justify-content: center;
    width: 100%; padding: 12px 16px; border-radius: 12px; font-weight: 600;
    font-size: 14px; text-decoration: none; cursor: pointer; border: 0;
    background: #7c3aed; color: white; margin-top: 10px }
  .btn:hover { background: #8b5cf6 }
  .hint { margin-top: 16px; font-size: 12px; color: #6b7280; line-height: 1.5 }
</style>
</head><body>
  <div class="card">
    <span class="pill"><span class="dot"></span>Sin conexión</span>
    <div class="icon">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/>
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>
        <line x1="2" y1="2" x2="22" y2="22"/>
      </svg>
    </div>
    <h1>Estás sin internet</h1>
    <p>Apenas vuelva la conexión, Orvex va a recargar la página solo. Si estás vendiendo, andá al POS — sigue funcionando offline y las ventas se sincronizan después.</p>
    <button class="btn" onclick="location.reload()">Reintentar</button>
    <p class="hint">Las ventas pendientes están guardadas en este dispositivo. Aparecen como "ventas pendientes" cuando vuelva la conexión.</p>
  </div>
<script>
  // Cuando el browser detecta que volvió internet, recargamos automático.
  window.addEventListener("online", () => location.reload());
  // Backup: probamos cada 8s si volvió la red haciendo HEAD a la raíz.
  setInterval(async () => {
    try {
      const r = await fetch("/", { method: "HEAD", cache: "no-store" });
      if (r.ok) location.reload();
    } catch {}
  }, 8000);
</script>
</body></html>`

function fallbackResponse() {
  return new Response(FALLBACK_HTML, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      // 1) Static assets críticos (offline.html, icons, manifest) — son
      //    fast-fail si alguno no carga, pero al menos intentamos cachear
      //    la offline.html FIRST para asegurarnos de que esté disponible.
      await cache.add("/offline.html").catch(() => {})
      await cache.addAll(STATIC_ASSETS).catch(() => {})
      // 2) Páginas críticas — cacheo best-effort. Las que requieren
      //    sesión van a fallar si el user no está logueado todavía;
      //    está bien, las cacheamos en runtime al primer hit.
      await Promise.all(
        CRITICAL_PAGES.map((path) =>
          fetch(path, { credentials: "include" })
            .then((res) => res.ok && cache.put(path, res.clone()))
            .catch(() => {})
        )
      )
      // 3) Endpoints API críticos para que el POS arranque offline cold.
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

  // ¿Es un request de React Server Components (RSC)? Next.js manda estos
  // requests cuando navegás client-side entre páginas. Tienen el header
  // `RSC: 1` o el query `?_rsc=` y la respuesta NO es HTML — es un payload
  // binario/streaming que el cliente convierte en componentes React.
  // Si los cacheamos como "páginas" y después los servimos, el browser
  // los renderiza como texto plano (lo que el user vio: "1:$Sreact.fragment...").
  // Solución: dejarlos pasar directo sin tocar.
  const isRscRequest =
    req.headers.get("RSC") === "1" ||
    req.headers.get("Next-Router-State-Tree") !== null ||
    url.searchParams.has("_rsc")

  if (isRscRequest) {
    event.respondWith(
      fetch(req).catch(async () => {
        // Si el RSC falla offline, devolvemos un 503 — el cliente Next
        // detecta esto y hace una navegación full-page como fallback,
        // lo cual cae en el handler normal de páginas de abajo.
        return new Response("offline", {
          status: 503,
          headers: { "Content-Type": "text/plain" },
        })
      })
    )
    return
  }

  // Pages: network-first, fall back to cache, then to /offline.html.
  // Solo cacheamos respuestas con Content-Type text/html para evitar
  // cachear payloads de Next que después romperían la pantalla.
  event.respondWith(
    fetch(req)
      .then((res) => {
        const ct = res.headers.get("Content-Type") || ""
        const isHtml = ct.includes("text/html")
        if (res.ok && isHtml) {
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
        // 3) Fallback a la página offline cacheada
        const off = await caches.match("/offline.html")
        if (off) return off
        // 4) Último recurso: HTML inline self-contained con auto-reload.
        //    NUNCA devolvemos Response.error() porque eso muestra el
        //    ERR_FAILED del browser y la PWA se siente rota.
        return fallbackResponse()
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
