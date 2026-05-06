"use client"

import { CloudOff, Loader2, RefreshCw } from "lucide-react"
import { useOfflineSync } from "@/lib/sync-queue"
import { cn } from "@/lib/utils"

/**
 * Badge persistente en el Header que muestra cuántas ventas hay
 * pendientes de sincronizar — visible desde cualquier página, no solo
 * desde POS. Antes el cajero terminaba el día y se olvidaba que tenía
 * 5 ventas atrapadas en IndexedDB porque el OfflineBanner solo aparece
 * en el POS.
 *
 * Estados:
 *   - sin pendientes y online → no se muestra (no contamina el header)
 *   - pendientes + online → amarillo, click manual flush
 *   - sin internet → rojo, no clickable
 *   - sincronizando → spinner
 */
export function OfflineSyncBadge() {
  const { pending, isOnline, isSyncing, flush } = useOfflineSync()

  // Caso happy path: nada que mostrar.
  if (pending === 0 && isOnline) return null

  if (!isOnline) {
    return (
      <div
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs font-medium"
        title="Estás sin internet — las ventas se guardan en este dispositivo y se sincronizan al volver la conexión"
      >
        <CloudOff size={12} />
        <span className="hidden sm:inline">Sin conexión</span>
        {pending > 0 && (
          <span className="font-bold tabular-nums">· {pending} en cola</span>
        )}
      </div>
    )
  }

  // Online con pendientes → invitamos al user a forzar sync.
  return (
    <button
      type="button"
      onClick={() => flush()}
      disabled={isSyncing}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors",
        "bg-amber-500/15 border border-amber-500/40 text-amber-200 hover:bg-amber-500/25",
        isSyncing && "opacity-70 cursor-wait"
      )}
      title={
        isSyncing
          ? "Sincronizando ventas offline…"
          : `Tenés ${pending} venta${pending === 1 ? "" : "s"} pendiente${pending === 1 ? "" : "s"} de sincronizar — click para reintentar ahora`
      }
    >
      {isSyncing ? (
        <Loader2 size={12} className="animate-spin" />
      ) : (
        <RefreshCw size={12} />
      )}
      <span className="font-bold tabular-nums">{pending}</span>
      <span className="hidden sm:inline">
        {pending === 1 ? "venta pendiente" : "ventas pendientes"}
      </span>
    </button>
  )
}
