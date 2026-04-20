import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { can, hasFeature } from "@/lib/permissions"
import { NoAccess } from "@/components/shared/NoAccess"
import { PaywallGate } from "@/components/shared/PaywallGate"
import ReportesPage from "./ReportesClient"
import type { Plan } from "@/lib/utils"

export default async function ReportesRoute() {
  const session = await auth()
  const role = session?.user?.role
  const tenantId = (session?.user as any)?.tenantId

  if (!can(role, "reports:read")) {
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

  if (!hasFeature(plan, "feature:reports")) {
    return (
      <PaywallGate
        currentPlan={plan}
        requiredPlan="STARTER"
        title="Reportes y análisis"
        description="Visualizá tus ventas, márgenes y rentabilidad con gráficos interactivos y rankings de productos. Tomá decisiones con datos en tiempo real."
        perks={[
          "Ingresos, costos, ganancia y margen por período",
          "Gráficos de evolución diaria y top productos",
          "Desglose por método de pago",
          "Exportar a CSV",
        ]}
      />
    )
  }

  return <ReportesPage />
}
