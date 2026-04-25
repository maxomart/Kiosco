import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { can, hasFeature } from "@/lib/permissions"
import { NoAccess } from "@/components/shared/NoAccess"
import ReportesPage from "./ReportesClient"
import { BusinessInsightsSection } from "@/components/reportes/BusinessInsightsSection"
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

  const showInsights = tenantId && hasFeature(plan, "feature:analytics")

  return (
    <div className="space-y-8">
      <ReportesPage plan={plan} />
      {showInsights && (
        <div className="p-6 max-w-7xl mx-auto">
          <BusinessInsightsSection tenantId={tenantId} />
        </div>
      )}
    </div>
  )
}
