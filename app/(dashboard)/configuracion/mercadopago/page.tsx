import { auth } from "@/lib/auth"
import { hasFeature, minimumPlanFor } from "@/lib/permissions"
import { getTenantPlan } from "@/lib/plan-guard"
import { NoAccess } from "@/components/shared/NoAccess"
import { PaywallGate } from "@/components/shared/PaywallGate"
import MercadoPagoClient from "./MercadoPagoClient"

export default async function MercadoPagoConfigPage() {
  const session = await auth()
  if (!session) return <NoAccess message="Iniciá sesión para configurar Mercado Pago." />

  const tenantId = session.user.tenantId
  const plan = tenantId ? await getTenantPlan(tenantId) : "FREE"

  // TODO: replace feature:loyalty proxy with a dedicated feature:mercadopago
  if (!hasFeature(plan, "feature:loyalty")) {
    return (
      <PaywallGate
        currentPlan={plan}
        requiredPlan={minimumPlanFor("feature:loyalty")}
        title="Cobrá con Mercado Pago QR"
        description="Generá un QR dinámico para que tus clientes paguen escaneando con la app de Mercado Pago."
        perks={[
          "Cobros digitales sin tarjetón POS",
          "Confirmación automática al recibir el pago",
          "Todo queda registrado en la venta",
          "Usa tu propia cuenta de Mercado Pago",
        ]}
      />
    )
  }

  return <MercadoPagoClient />
}
