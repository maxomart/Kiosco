import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { can } from "@/lib/permissions"
import { NoAccess } from "@/components/shared/NoAccess"
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

  return <ReportesPage plan={plan} />
}
