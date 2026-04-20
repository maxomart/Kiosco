import { auth } from "@/lib/auth"
import { hasFeature, minimumPlanFor } from "@/lib/permissions"
import { getTenantPlan } from "@/lib/plan-guard"
import { NoAccess } from "@/components/shared/NoAccess"
import { PaywallGate } from "@/components/shared/PaywallGate"
import { db } from "@/lib/db"
import CuentaCorrienteClient from "./CuentaCorrienteClient"

export default async function CuentaCorrientePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session) return <NoAccess message="Iniciá sesión." />

  const tenantId = session.user.tenantId
  const plan = tenantId ? await getTenantPlan(tenantId) : "FREE"

  // TODO: replace feature:custom_logo proxy with a dedicated feature:cuenta_corriente
  if (!hasFeature(plan, "feature:custom_logo")) {
    return (
      <PaywallGate
        currentPlan={plan}
        requiredPlan={minimumPlanFor("feature:custom_logo")}
        title="Cuenta corriente (fiado)"
        description="Llevá control de lo que te deben tus clientes. Registrá ventas a cuenta y cobros parciales."
        perks={[
          "Saldo por cliente con límite de crédito",
          "Historial de ventas a cuenta y pagos",
          "Alertas cuando un cliente supera el límite",
          "Ideal para almacenes, verdulerías y fiambrerías",
        ]}
      />
    )
  }

  const { id } = await params
  const client = await db.client.findUnique({
    where: { id },
    select: { id: true, name: true, phone: true, tenantId: true, creditLimit: true, currentBalance: true },
  })
  if (!client || (client.tenantId !== tenantId && session.user.role !== "SUPER_ADMIN")) {
    return <NoAccess message="Cliente no encontrado." />
  }

  return (
    <CuentaCorrienteClient
      client={{
        id: client.id,
        name: client.name,
        phone: client.phone,
        creditLimit: Number(client.creditLimit ?? 0),
        currentBalance: Number(client.currentBalance ?? 0),
      }}
    />
  )
}
