import { auth } from "@/app/api/auth/[...nextauth]/auth"
import { getDebtorAlerts } from "@/lib/analytics/debtors"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const overdueDays = parseInt(searchParams.get("overdueDays") || "0") as
    | 0
    | 30
    | 60

  try {
    const debtors = await getDebtorAlerts(
      session.user.tenantId,
      overdueDays
    )
    return NextResponse.json(debtors)
  } catch (error) {
    console.error("Error fetching debtors:", error)
    return NextResponse.json(
      { error: "Failed to fetch debtors" },
      { status: 500 }
    )
  }
}
