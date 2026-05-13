import { auth } from "@/lib/auth"
import { hasFeature, minimumPlanFor } from "@/lib/permissions"
import { getTenantPlan } from "@/lib/plan-guard"
import { db } from "@/lib/db"
import { NoAccess } from "@/components/shared/NoAccess"
import { PaywallGate } from "@/components/shared/PaywallGate"
import AfipConfigClient from "./AfipConfigClient"

export default async function AfipPage() {
  const session = await auth()
  if (!session?.user) return <NoAccess message="Iniciá sesión para gestionar AFIP." />

  const role = session.user.role
  if (role !== "OWNER" && role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return <NoAccess message="Solo el dueño o un admin pueden gestionar la configuración de AFIP." />
  }

  const tenantId = session.user.tenantId
  if (!tenantId) return <NoAccess message="Sin tenant asignado." />

  const plan = await getTenantPlan(tenantId)

  if (!hasFeature(plan, "feature:afip_invoicing")) {
    return (
      <PaywallGate
        currentPlan={plan}
        requiredPlan={minimumPlanFor("feature:afip_invoicing")}
        title="Facturación electrónica AFIP"
        description="Emití facturas A, B y C con CAE directo de AFIP desde tu kiosco."
        perks={[
          "Hasta 50 facturas/mes incluidas en el plan Básico",
          "Tipo A/B/C calculado según condición IVA del cliente",
          "PDF descargable con QR AFIP válido",
          "Modo homologación para testear antes de producción",
          "Setup en 5 min con el wizard guiado",
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
