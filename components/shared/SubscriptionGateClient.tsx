"use client"

import { usePathname } from "next/navigation"
import { SubscriptionBlockScreen } from "./SubscriptionBlockScreen"

/**
 * Wrapper client del SubscriptionBlockScreen — esconde el bloqueo en
 * rutas donde el user tiene que poder operar (suscripción).
 */
const ALLOWED_PATHS = [
  "/configuracion/suscripcion",
  "/configuracion/multi-tienda", // por si tienen que cancelar
]

export function SubscriptionGateClient({
  reason,
  ownerEmail,
}: {
  reason: "trial-expired" | "payment-failed"
  ownerEmail: string | null
}) {
  const pathname = usePathname()
  const isAllowed = ALLOWED_PATHS.some((p) => pathname.startsWith(p))
  if (isAllowed) return null
  return <SubscriptionBlockScreen reason={reason} ownerEmail={ownerEmail} />
}
