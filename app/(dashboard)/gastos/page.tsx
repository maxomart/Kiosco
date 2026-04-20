import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { can, hasFeature } from "@/lib/permissions"
import { NoAccess } from "@/components/shared/NoAccess"
import { PaywallGate } from "@/components/shared/PaywallGate"
import GastosPage from "./GastosClient"
import type { Plan } from "@/lib/utils"

export default async function GastosRoute() {
  const session = await auth()
  const role = session?.user?.role
  const tenantId = (session?.user as any)?.tenantId

  if (!can(role, "expenses:read")) {
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

  if (!hasFeature(plan, "feature:expenses")) {
    return (
      <PaywallGate
        currentPlan={plan}
        requiredPlan="STARTER"
        title="Registro de gastos"
        description="Llevá el control de todos los egresos de tu negocio para entender tu rentabilidad real, no solo las ventas."
        perks={[
          "Categorizar gastos (alquiler, servicios, sueldos, mercadería…)",
          "Filtrar por rango de fechas y categoría",
          "Restar automáticamente de tus ganancias en reportes",
        ]}
      />
    )
  }

  return <GastosPage />
}
