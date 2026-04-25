/**
 * Orvex — Offline IndexedDB wrapper.
 *
 * Pure native IndexedDB, no external deps. Three object stores:
 *   - products      → cached product list for offline search
 *   - pendingSales  → ventas POSTed while offline, waiting to sync
 *   - meta          → key/value store (last sync ts, etc.)
 *
 * SSR safe: every public function is a no-op (or returns []) when
 * `typeof window === "undefined"`.
 *
 * Testing:
 *   - DevTools → Application → IndexedDB → orvex-offline-v1
 */

const DB_NAME = "orvex-offline-v1"
const DB_VERSION = 1

export interface CachedProduct {
  id: string
  name: string
  barcode: string | null
  sku: string | null
  salePrice: number
  costPrice: number
  stock: number
  minStock: number
  soldByWeight: boolean
  taxRate?: string
  category?: { name: string } | null
}

export interface PendingSale {
  id: string                 // localId (uuid-ish)
  payload: any               // exact body posted to /api/ventas
  createdAt: number          // Date.now()
  attempts: number
  lastError?: string | null
}

let _dbPromise: Promise<IDBDatabase> | null = null

function isClient() {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined"
}

function openDb(): Promise<IDBDatabase> {
  if (!isClient()) return Promise.reject(new Error("IndexedDB unavailable (SSR)"))
  if (_dbPromise) return _dbPromise
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains("products")) {
        const s = db.createObjectStore("products", { keyPath: "id" })
        s.createIndex("name", "name", { unique: false })
        s.createIndex("barcode", "barcode", { unique: false })
      }
      if (!db.objectStoreNames.contains("pendingSales")) {
        db.createObjectStore("pendingSales", { keyPath: "id" })
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return _dbPromise
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest | void
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode)
        const s = t.objectStore(store)
        const r = fn(s)
        t.oncomplete = () => resolve((r && "result" in r ? r.result : undefined) as T)
        t.onerror = () => reject(t.error)
        t.onabort = () => reject(t.error)
      })
  )
}

// ---------- Products ----------

export async function cacheProducts(products: CachedProduct[]): Promise<void> {
  if (!isClient()) return
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction("products", "readwrite")
    const s = t.objectStore("products")
    s.clear()
    for (const p of products) s.put(p)
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
  })
  await setMeta("productsCachedAt", Date.now())
}

export async function searchProducts(query: string, limit = 30): Promise<CachedProduct[]> {
  if (!isClient()) return []
  const q = query.trim().toLowerCase()
  if (!q) return []
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const t = db.transaction("products", "readonly")
    const s = t.objectStore("products")
    const out: CachedProduct[] = []
    const req = s.openCursor()
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor || out.length >= limit) {
        resolve(out)
        return
      }
      const p = cursor.value as CachedProduct
      if (
        p.name?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q)
      ) {
        out.push(p)
      }
      cursor.continue()
    }
    req.onerror = () => reject(req.error)
  })
}

// ---------- Pending sales ----------

function genId(): string {
  // RFC4122-ish; fallback for old browsers
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return (crypto as any).randomUUID()
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export async function enqueueSale(payload: any): Promise<string> {
  if (!isClient()) throw new Error("enqueueSale requires browser")
  const localId = genId()
  const entry: PendingSale = {
    id: localId,
    payload: { ...payload, _localId: localId, _clientCreatedAt: Date.now() },
    createdAt: Date.now(),
    attempts: 0,
    lastError: null,
  }
  await tx("pendingSales", "readwrite", (s) => s.put(entry))
  return localId
}

export async function getPendingSales(): Promise<PendingSale[]> {
  if (!isClient()) return []
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const t = db.transaction("pendingSales", "readonly")
    const s = t.objectStore("pendingSales")
    const req = s.getAll()
    req.onsuccess = () => {
      const all = (req.result as PendingSale[]).sort((a, b) => a.createdAt - b.createdAt)
      resolve(all)
    }
    req.onerror = () => reject(req.error)
  })
}

export async function markSynced(localId: string, _serverSale?: any): Promise<void> {
  if (!isClient()) return
  await tx("pendingSales", "readwrite", (s) => s.delete(localId))
}

export async function markError(localId: string, error: string): Promise<void> {
  if (!isClient()) return
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction("pendingSales", "readwrite")
    const s = t.objectStore("pendingSales")
    const getReq = s.get(localId)
    getReq.onsuccess = () => {
      const cur = getReq.result as PendingSale | undefined
      if (!cur) { resolve(); return }
      cur.attempts = (cur.attempts ?? 0) + 1
      cur.lastError = error
      s.put(cur)
    }
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
  })
}

export async function discardSale(localId: string): Promise<void> {
  if (!isClient()) return
  await tx("pendingSales", "readwrite", (s) => s.delete(localId))
}

export async function clearPendingSales(): Promise<void> {
  if (!isClient()) return
  await tx("pendingSales", "readwrite", (s) => s.clear())
}

// ---------- Meta kv ----------

export async function getMeta<T = any>(key: string): Promise<T | null> {
  if (!isClient()) return null
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const t = db.transaction("meta", "readonly")
    const req = t.objectStore("meta").get(key)
    req.onsuccess = () => resolve((req.result?.value as T) ?? null)
    req.onerror = () => reject(req.error)
  })
}

export async function setMeta(key: string, value: any): Promise<void> {
  if (!isClient()) return
  await tx("meta", "readwrite", (s) => s.put({ key, value }))
}
