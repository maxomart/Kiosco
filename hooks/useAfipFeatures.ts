"use client"

import { useState, useEffect } from "react"

export interface AfipFeatures {
  invoicing: boolean
  autoInvoice: boolean
  ncPartial: boolean
  ndCustom: boolean
  libroIva: boolean
}

export interface AfipStatus {
  enabled: boolean
  ready: boolean
  mode: string | null
  plan: string | null
  features: AfipFeatures
}

const DEFAULT_FEATURES: AfipFeatures = {
  invoicing: false,
  autoInvoice: false,
  ncPartial: false,
  ndCustom: false,
  libroIva: false,
}

// Cache module-level — un solo fetch por sesión, todos los modales lo comparten.
let cached: AfipStatus | null = null
let inFlight: Promise<AfipStatus | null> | null = null

async function fetchStatus(): Promise<AfipStatus | null> {
  if (cached) return cached
  if (inFlight) return inFlight
  inFlight = fetch("/api/afip/status", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (!d) return null
      const status: AfipStatus = {
        enabled: !!d.enabled,
        ready: !!d.ready,
        mode: d.mode ?? null,
        plan: d.plan ?? null,
        features: d.features ?? DEFAULT_FEATURES,
      }
      cached = status
      return status
    })
    .catch(() => null)
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

/** Limpia el cache — usar cuando se sabe que el plan o config AFIP cambió. */
export function clearAfipFeaturesCache() {
  cached = null
}

/**
 * Hook que devuelve los flags de feature AFIP según el plan del tenant.
 * Usa cache module-level para evitar fetches duplicados entre modales.
 */
export function useAfipFeatures(): { status: AfipStatus | null; loading: boolean } {
  const [status, setStatus] = useState<AfipStatus | null>(cached)
  const [loading, setLoading] = useState(!cached)

  useEffect(() => {
    if (cached) {
      setStatus(cached)
      setLoading(false)
      return
    }
    let mounted = true
    fetchStatus().then((s) => {
      if (mounted) {
        setStatus(s)
        setLoading(false)
      }
    })
    return () => {
      mounted = false
    }
  }, [])

  return { status, loading }
}
