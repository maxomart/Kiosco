import { auth } from "@/lib/auth"
import { hasFeature, minimumPlanFor, can } from "@/lib/permissions"
import { getTenantPlan } from "@/lib/plan-guard"
import { NoAccess } from "@/components/shared/NoAccess"
import { PaywallGate } from "@/components/shared/PaywallGate"
import MultiTiendaClient from "./MultiTiendaClient"

export default async function MultiTiendaPage() {
  const session = await auth()
  if (!session) return <NoAccess message="Iniciá sesión para acceder a multi-tienda." />

  if (!can(session.user.role, "settings:read")) {
    return <NoAccess message="No tenés permiso para ver esta sección." />
  }

  const tenantId = session.user.tenantId
  const plan = tenantId ? await getTenantPlan(tenantId) : "FREE"

  if (!hasFeature(plan, "feature:multi_store")) {
    return (
      <PaywallGate
        currentPlan={plan}
        requiredPlan={minimumPlanFor("feature:multi_store")}
        title="Multi-tienda"
        description="Gestioná varias sucursales bajo una misma cuenta. Reportes consolidados, stock por tienda y permisos por sucursal."
        perks={[
          "Stock independiente por sucursal",
          "Reportes consolidados de todas tus tiendas",
          "Usuarios con acceso a una o varias sucursales",
          "Transferencias de inventario entre tiendas",
        ]}
      />
    )
  }

  return <MultiTiendaClient />
}
