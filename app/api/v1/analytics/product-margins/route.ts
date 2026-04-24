import { auth } from "@/lib/auth"
import { calculateProductMargins } from "@/lib/analytics/margins"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const period = (searchParams.get("period") || "30") as
    | "30"
    | "90"
    | "365"
  const days = parseInt(period) as 30 | 90 | 365

  try {
    const margins = await calculateProductMargins(session.user.tenantId, days)
    return NextResponse.json(margins)
  } catch (error) {
    console.error("Error calculating margins:", error)
    return NextResponse.json(
      { error: "Failed to calculate margins" },
      { status: 500 }
    )
  }
}
