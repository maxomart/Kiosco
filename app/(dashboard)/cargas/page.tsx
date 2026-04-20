import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { can, hasFeature } from "@/lib/permissions"
import { NoAccess } from "@/components/shared/NoAccess"
import { PaywallGate } from "@/components/shared/PaywallGate"
import CargasPage from "./CargasClient"
import type { Plan } from "@/lib/utils"

export default async function CargasRoute() {
  const session = await auth()
  const role = session?.user?.role
  const tenantId = (session?.user as any)?.tenantId

  if (!can(role, "recharges:read")) {
    return <NoAccess />
  }

  let plan: Plan = "FREE"
  if (tenantId) {
    const sub = await db.subscription.findUnique({
      where: { tenantId },
      select: { plan: true },
    })
    plan = (sub?.plan as Plan) ?? "FREE"
  }

  if (!hasFeature(plan, "feature:recharges")) {
    return (
      <PaywallGate
        currentPlan={plan}
        requiredPlan="STARTER"
        title="Cargas y recargas"
        description="Registrá las cargas a proveedores (telefonía, servicios, etc.) para llevar el control de costos y márgenes."
        perks={[
          "Alta de proveedores con datos de contacto",
          "Cálculo automático de utilidad por carga",
          "Historial filtrable por proveedor y fecha",
        ]}
      />
    )
  }

  return <CargasPage />
}
