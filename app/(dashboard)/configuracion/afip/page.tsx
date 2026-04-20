import { auth } from "@/lib/auth"
import { hasFeature, minimumPlanFor } from "@/lib/permissions"
import { getTenantPlan } from "@/lib/plan-guard"
import { db } from "@/lib/db"
import { NoAccess } from "@/components/shared/NoAccess"
import { PaywallGate } from "@/components/shared/PaywallGate"
import AfipConfigClient from "./AfipConfigClient"

export default async function AfipPage() {
  const session = await auth()
  if (!session) return <NoAccess message="Iniciá sesión para gestionar AFIP." />

  const role = session.user.role
  if (role !== "OWNER" && role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return <NoAccess message="Solo el dueño o un admin pueden gestionar la configuración de AFIP." />
  }

  const tenantId = session.user.tenantId
  if (!tenantId) return <NoAccess message="Sin tenant asignado." />

  const plan = await getTenantPlan(tenantId)

  // PROXY GATE — using feature:custom_logo (STARTER+) until feature:afip exists.
  if (!hasFeature(plan, "feature:custom_logo")) {
    return (
      <PaywallGate
        currentPlan={plan}
        requiredPlan={minimumPlanFor("feature:custom_logo")}
        title="Facturación electrónica AFIP"
        description="Emití facturas A, B y C con CAE directo de AFIP desde tu kiosco."
        perks={[
          "Factura automática al cerrar la venta",
          "Tipo A/B/C calculado según condición IVA del cliente",
          "PDF descargable con QR AFIP válido",
          "Modo homologación para testear antes de producción",
          "Integración con TusFacturas (no necesitás certificado propio)",
        ]}
      />
    )
  }

  const cfg = await db.tenantConfig.findUnique({ where: { tenantId } })

  return (
    <AfipConfigClient
      initial={{
        afipEnabled: cfg?.afipEnabled ?? false,
        afipMode: (cfg?.afipMode as "HOMOLOGACION" | "PRODUCCION") ?? "HOMOLOGACION",
        afipCondicionIVA: (cfg?.afipCondicionIVA as "RI" | "MONOTRIBUTO" | "EXENTO" | null) ?? null,
        afipPointOfSale: cfg?.afipPointOfSale ?? 1,
        afipCertProvider: (cfg?.afipCertProvider as "mock" | "tusfacturas" | null) ?? "mock",
        afipCertCuit: cfg?.afipCertCuit ?? "",
        afipCertSecret: cfg?.afipCertSecret ?? "",
        afipLastSyncAt: cfg?.afipLastSyncAt ? cfg.afipLastSyncAt.toISOString() : null,
        afipLastError: cfg?.afipLastError ?? null,
      }}
    />
  )
}
