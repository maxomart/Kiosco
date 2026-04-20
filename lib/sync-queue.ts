/**
 * RetailAR — Sync queue + React hook for offline POS.
 *
 * Reads pending sales from IndexedDB (lib/offline-store.ts) and POSTs
 * them in bulk to /api/sync/sales. The endpoint is idempotent on
 * `localId` so retries don't double-create sales.
 *
 * Auto-trigger:
 *   - on browser `online` event
 *   - every 30s while there are pending sales (poll loop self-stops)
 *
 * SSR-safe: hook returns sane defaults during SSR; `flushQueue` is a
 * no-op on the server.
 *
 * Testing:
 *   - DevTools → Network → "Offline" → make sale → restore network
 *   - Watch banner change to "1 pendiente" → auto-syncs ≤30s
 */

import { useEffect, useState, useCallback } from "react"
import {
  getPendingSales,
  markSynced,
  markError,
  type PendingSale,
} from "./offline-store"

const SYNC_ENDPOINT = "/api/sync/sales"
const POLL_INTERVAL_MS = 30_000

let _flushInFlight: Promise<void> | null = null

export interface FlushResult {
  ok: number
  failed: number
}

export async function flushQueue(): Promise<FlushResult> {
  if (typeof window === "undefined") return { ok: 0, failed: 0 }
  if (_flushInFlight) {
    await _flushInFlight
    return { ok: 0, failed: 0 }
  }
  let resolveLock!: () => void
  _flushInFlight = new Promise<void>((res) => (resolveLock = res))

  let ok = 0
  let failed = 0
  try {
    const pending = await getPendingSales()
    if (pending.length === 0) return { ok: 0, failed: 0 }
    if (!navigator.onLine) return { ok: 0, failed: pending.length }

    // Send in small batches to keep payloads sane.
    const BATCH = 10
    for (let i = 0; i < pending.length; i += BATCH) {
      const batch = pending.slice(i, i + BATCH)
      try {
        const res = await fetch(SYNC_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sales: batch.map((p) => ({
              localId: p.id,
              payload: p.payload,
              clientCreatedAt: p.createdAt,
            })),
          }),
        })
        if (!res.ok) {
          // Whole batch failed (auth/server) — bump attempts on each.
          const text = await res.text().catch(() => "HTTP " + res.status)
          for (const p of batch) {
            await markError(p.id, text.slice(0, 200))
            failed++
          }
          continue
        }
        const data = (await res.json()) as { results: Array<{ localId: string; ok: boolean; saleId?: string; error?: string }> }
        for (const r of data.results ?? []) {
          if (r.ok) {
            await markSynced(r.localId, r)
            ok++
          } else {
            await markError(r.localId, r.error ?? "Error desconocido")
            failed++
          }
        }
      } catch (err: any) {
        for (const p of batch) {
          await markError(p.id, err?.message ?? "Network error")
          failed++
        }
      }
    }
  } finally {
    resolveLock()
    _flushInFlight = null
  }
  return { ok, failed }
}

export interface OfflineSyncState {
  pending: number
  isOnline: boolean
  isSyncing: boolean
  lastError: string | null
  flush: () => Promise<void>
  refresh: () => Promise<void>
  pendingList: PendingSale[]
}

export function useOfflineSync(): OfflineSyncState {
  const [pending, setPending] = useState(0)
  const [pendingList, setPendingList] = useState<PendingSale[]>([])
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  )
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (typeof window === "undefined") return
    const list = await getPendingSales()
    setPendingList(list)
    setPending(list.length)
  }, [])

  const flush = useCallback(async () => {
    if (typeof window === "undefined") return
    if (!navigator.onLine) return
    setIsSyncing(true)
    setLastError(null)
    try {
      const res = await flushQueue()
      if (res.failed > 0 && res.ok === 0) {
        setLastError(`No se pudieron sincronizar ${res.failed} ventas`)
      }
    } catch (e: any) {
      setLastError(e?.message ?? "Error al sincronizar")
    } finally {
      setIsSyncing(false)
      await refresh()
    }
  }, [refresh])

  // Initial load + listen for storage events from other tabs (best-effort)
  useEffect(() => {
    refresh()
  }, [refresh])

  // Online/offline browser events
  useEffect(() => {
    if (typeof window === "undefined") return
    const onOnline = () => {
      setIsOnline(true)
      flush()
    }
    const onOffline = () => setIsOnline(false)
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)
    // Listen to a custom event so PaymentModal can poke us right after enqueue
    const onEnqueued = () => refresh()
    window.addEventListener("retailar:offline-sale-enqueued", onEnqueued)
    return () => {
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOffline)
      window.removeEventListener("retailar:offline-sale-enqueued", onEnqueued)
    }
  }, [flush, refresh])

  // Polling loop while we have pending and we're online
  useEffect(() => {
    if (typeof window === "undefined") return
    if (pending === 0) return
    if (!isOnline) return
    const t = setInterval(() => { flush() }, POLL_INTERVAL_MS)
    return () => clearInterval(t)
  }, [pending, isOnline, flush])

  return { pending, isOnline, isSyncing, lastError, flush, refresh, pendingList }
}
