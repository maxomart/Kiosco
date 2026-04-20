import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status") || ""
  const tenantId = searchParams.get("tenantId") || ""
  const from = searchParams.get("from") || ""
  const to = searchParams.get("to") || ""
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "25")

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (tenantId) where.subscription = { tenantId }
  if (from || to) {
    const range: Record<string, Date> = {}
    if (from) range.gte = new Date(from)
    if (to) range.lte = new Date(to)
    where.createdAt = range
  }

  const [invoices, total] = await Promise.all([
    db.invoice.findMany({
      where: where as never,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        subscription: {
          select: {
            plan: true,
            tenant: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    }),
    db.invoice.count({ where: where as never }),
  ])

  return NextResponse.json({ invoices, total, page, limit })
}
