import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const action = searchParams.get("action") || ""
  const entity = searchParams.get("entity") || ""
  const userId = searchParams.get("userId") || ""
  const tenantId = searchParams.get("tenantId") || ""
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "50")

  const where: Record<string, unknown> = {}
  if (action) where.action = action
  if (entity) where.entity = entity
  if (userId) where.userId = userId
  if (tenantId) where.user = { tenantId }

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where: where as never,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            tenant: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    }),
    db.auditLog.count({ where: where as never }),
  ])

  return NextResponse.json({ logs, total, page, limit })
}
