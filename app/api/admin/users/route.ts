import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search") || ""
  const role = searchParams.get("role") || ""
  const tenantId = searchParams.get("tenantId") || ""
  const active = searchParams.get("active") || ""
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "25")

  const where: Record<string, unknown> = {}
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ]
  }
  if (role) where.role = role
  if (tenantId) where.tenantId = tenantId
  if (active === "true") where.active = true
  if (active === "false") where.active = false

  const [users, total] = await Promise.all([
    db.user.findMany({
      where: where as never,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
        tenantId: true,
        tenant: { select: { id: true, name: true, slug: true } },
      },
    }),
    db.user.count({ where: where as never }),
  ])

  return NextResponse.json({ users, total, page, limit })
}
