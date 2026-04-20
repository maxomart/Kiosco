import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { can, hasFeature } from "@/lib/permissions"
import { NoAccess } from "@/components/shared/NoAccess"
import { PaywallGate } from "@/components/shared/PaywallGate"
import type { Plan } from "@/lib/utils"
import FidelidadClient from "./FidelidadClient"

export default async function FidelidadPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (session.user.role === "SUPER_ADMIN") redirect("/admin")

  if (!can(session.user.role, "settings:read") && !can(session.user.role, "clients:read")) {
    return <NoAccess />
  }

  const tenantId = session.user.tenantId
  if (!tenantId) return <NoAccess message="Sin tenant asignado." />

  const sub = await db.subscription.findUnique({
    where: { tenantId },
    select: { plan: true },
  })
  const plan = (sub?.plan ?? "FREE") as Plan
  if (!hasFeature(plan, "feature:loyalty")) {
    return (
      <PaywallGate
        currentPlan={plan}
        requiredPlan="PROFESSIONAL"
        title="Programa de fidelidad"
        description="Premiá a tus clientes recurrentes: acumulan puntos en cada compra y los canjean por descuentos."
        perks={[
          "Acumulación automática de puntos en cada venta",
          "Ajustes manuales (regalos, correcciones)",
          "Canje por descuentos al pasar por caja",
          "Historial completo por cliente",
        ]}
      />
    )
  }

  const cfg = (await db.tenantConfig.findUnique({ where: { tenantId } })) as any
  const pointValue = cfg?.loyaltyPointValue != null ? Number(cfg.loyaltyPointValue) : 1
  const pointsPerPeso = cfg?.loyaltyPointsPerPeso != null ? Number(cfg.loyaltyPointsPerPeso) : 1
  const loyaltyEnabled = !!cfg?.loyaltyEnabled

  return (
    <FidelidadClient
      pointValue={pointValue}
      pointsPerPeso={pointsPerPeso}
      loyaltyEnabled={loyaltyEnabled}
    />
  )
}
