import { auth } from "@/app/api/auth/[...nextauth]/auth"
import { predictStockLevels } from "@/lib/analytics/stock"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const urgency = searchParams.get("urgency") as
    | "CRITICAL"
    | "HIGH"
    | "NORMAL"
    | null
  const period = (searchParams.get("period") || "30") as "30" | "90"
  const days = parseInt(period) as 30 | 90

  try {
    let predictions = await predictStockLevels(
      session.user.tenantId,
      days
    )

    // Filter by urgency if specified
    if (urgency) {
      predictions = predictions.filter((p) => p.urgency === urgency)
    }

    return NextResponse.json(predictions)
  } catch (error) {
    console.error("Error predicting stock:", error)
    return NextResponse.json(
      { error: "Failed to predict stock levels" },
      { status: 500 }
    )
  }
}
