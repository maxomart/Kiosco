import { auth } from "@/app/api/auth/[...nextauth]/auth"
import { detectInvisibleLosses } from "@/lib/analytics/losses"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const period = (searchParams.get("period") || "30") as "7" | "30"
  const days = parseInt(period) as 7 | 30

  try {
    const losses = await detectInvisibleLosses(
      session.user.tenantId,
      days
    )
    return NextResponse.json(losses)
  } catch (error) {
    console.error("Error detecting losses:", error)
    return NextResponse.json(
      { error: "Failed to detect losses" },
      { status: 500 }
    )
  }
}
