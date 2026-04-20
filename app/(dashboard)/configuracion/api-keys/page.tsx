import { auth } from "@/lib/auth"
import { can, hasFeature, minimumPlanFor } from "@/lib/permissions"
import { getTenantPlan } from "@/lib/plan-guard"
import { NoAccess } from "@/components/shared/NoAccess"
import { PaywallGate } from "@/components/shared/PaywallGate"
import ApiKeysClient from "./ApiKeysClient"

export default async function ApiKeysPage() {
  const session = await auth()
  if (!session) return <NoAccess message="Iniciá sesión para gestionar API keys." />

  const role = session.user.role
  if (!can(role, "billing:manage")) {
    return <NoAccess message="Solo el dueño puede gestionar las claves de API." />
  }

  const tenantId = session.user.tenantId
  const plan = tenantId ? await getTenantPlan(tenantId) : "FREE"

  if (!hasFeature(plan, "feature:api")) {
    return (
      <PaywallGate
        currentPlan={plan}
        requiredPlan={minimumPlanFor("feature:api")}
        title="Acceso por API"
        description="Conectá tu negocio con sistemas externos: ERPs, e-commerce, Zapier, scripts propios."
        perks={[
          "Token bearer para autenticar tus integraciones",
          "Endpoints REST para productos y ventas",
          "Crear ventas desde tu propio software",
          "Roles read y write con auditoría completa",
        ]}
      />
    )
  }

  return <ApiKeysClient />
}
