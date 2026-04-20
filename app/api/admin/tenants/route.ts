import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search") || ""
  const plan = searchParams.get("plan") || ""
  const status = searchParams.get("status") || "" // active|inactive|trialing
  const sort = searchParams.get("sort") || "createdAt" // createdAt|users|sales|revenue|name
  const dir = (searchParams.get("dir") || "desc") as "asc" | "desc"
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "25")

  const where: Record<string, unknown> = {}
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { slug: { contains: search } },
    ]
  }
  if (status === "active") where.active = true
  if (status === "inactive") where.active = false
  if (status === "trialing") where.subscription = { status: "TRIALING" }
  if (plan) where.subscription = { ...((where.subscription as object) || {}), plan }

  // Server-side sort for simple fields; for users/sales/revenue we sort post-fetch (small dataset).
  let orderBy: Record<string, "asc" | "desc"> | undefined
  if (sort === "createdAt") orderBy = { createdAt: dir }
  else if (sort === "name") orderBy = { name: dir }

  const fetchAll = ["users", "sales", "revenue"].includes(sort)

  const [tenantsRaw, total] = await Promise.all([
    db.tenant.findMany({
      where: where as never,
      ...(fetchAll ? {} : { skip: (page - 1) * limit, take: limit }),
      orderBy,
      include: {
        subscription: { select: { plan: true, status: true, currentPeriodEnd: true } },
        config: { select: { businessType: true } },
        _count: { select: { users: true, products: true, sales: true } },
      },
    }),
    db.tenant.count({ where: where as never }),
  ])

  type TenantRow = (typeof tenantsRaw)[number]
  let tenants: TenantRow[] = tenantsRaw

  if (fetchAll) {
    if (sort === "revenue") {
      const ids = tenants.map((t: TenantRow) => t.id)
      const aggs = await db.sale.groupBy({
        by: ["tenantId"],
        where: { tenantId: { in: ids }, status: "COMPLETED" },
        _sum: { total: true },
      })
      const rev = new Map<string, number>(
        (aggs as Array<{ tenantId: string; _sum: { total: unknown } }>).map(
          (a) => [a.tenantId, Number(a._sum.total ?? 0)]
        )
      )
      tenants = [...tenants].sort((a: TenantRow, b: TenantRow) => {
        const av = rev.get(a.id) ?? 0
        const bv = rev.get(b.id) ?? 0
        return dir === "asc" ? av - bv : bv - av
      })
    } else {
      const key = (sort === "users" ? "users" : "sales") as "users" | "sales"
      tenants = [...tenants].sort((a: TenantRow, b: TenantRow) => {
        const av = (a._count as Record<string, number>)[key] ?? 0
        const bv = (b._count as Record<string, number>)[key] ?? 0
        return dir === "asc" ? av - bv : bv - av
      })
    }
    tenants = tenants.slice((page - 1) * limit, page * limit)
  }

  return NextResponse.json({ tenants, total })
}
