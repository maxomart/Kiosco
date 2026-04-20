"use client"

/**
 * OfflineBanner — sticky status banner for the POS.
 *
 * Shows three modes:
 *   - Offline: amber banner.
 *   - Online + pending > 0: purple banner with "Reintentar" + "Ver detalle".
 *   - Syncing: spinner.
 *
 * Detalle abre <SyncStatusClient /> con la lista de ventas pendientes.
 */

import { useState } from "react"
import { Loader2, WifiOff, CloudUpload, AlertTriangle } from "lucide-react"
import { useOfflineSync } from "@/lib/sync-queue"
import { SyncStatusClient } from "@/app/(dashboard)/pos/SyncStatusClient"

export function OfflineBanner() {
  const { pending, isOnline, isSyncing, lastError, flush, refresh, pendingList } = useOfflineSync()
  const [showDetail, setShowDetail] = useState(false)

  if (isOnline && pending === 0 && !isSyncing) return null

  return (
    <>
      <div
        className={
          !isOnline
            ? "mb-3 flex items-center gap-3 rounded-xl border border-amber-700/60 bg-amber-900/30 px-4 py-2.5 text-sm text-amber-100"
            : isSyncing
              ? "mb-3 flex items-center gap-3 rounded-xl border border-blue-700/60 bg-blue-900/30 px-4 py-2.5 text-sm text-blue-100"
              : "mb-3 flex items-center gap-3 rounded-xl border border-purple-700/60 bg-purple-900/30 px-4 py-2.5 text-sm text-purple-100"
        }
      >
        {!isOnline ? (
          <>
            <WifiOff size={16} className="shrink-0" />
            <span className="flex-1">
              <strong>Modo offline</strong> — las ventas se guardan y se sincronizan al volver la conexión.
              {pending > 0 && <> Hay <strong>{pending}</strong> en cola.</>}
            </span>
          </>
        ) : isSyncing ? (
          <>
            <Loader2 size={16} className="shrink-0 animate-spin" />
            <span className="flex-1">Sincronizando ventas pendientes...</span>
          </>
        ) : (
          <>
            <CloudUpload size={16} className="shrink-0" />
            <span className="flex-1">
              <strong>{pending}</strong> {pending === 1 ? "venta pendiente" : "ventas pendientes"} de sincronizar.
              {lastError && (
                <span className="ml-2 inline-flex items-center gap-1 text-amber-300">
                  <AlertTriangle size={12} /> {lastError}
                </span>
              )}
            </span>
            <button
              onClick={() => flush()}
              className="rounded-md bg-purple-700 hover:bg-purple-600 text-white px-3 py-1 text-xs font-semibold transition"
            >
              Reintentar
            </button>
          </>
        )}
        {pending > 0 && (
          <button
            onClick={() => setShowDetail(true)}
            className="rounded-md border border-current/40 px-3 py-1 text-xs font-medium hover:bg-white/10 transition"
          >
            Ver detalle
          </button>
        )}
      </div>

      {showDetail && (
        <SyncStatusClient
          pendingList={pendingList}
          onClose={() => setShowDetail(false)}
          onChange={refresh}
          isOnline={isOnline}
          isSyncing={isSyncing}
          flush={flush}
        />
      )}
    </>
  )
}
