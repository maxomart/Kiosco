import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  const { id } = await ctx.params

  const tenant = await db.tenant.findUnique({
    where: { id },
    include: {
      config: true,
      subscription: { include: { invoices: { orderBy: { createdAt: "desc" } } } },
      users: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          active: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
      _count: {
        select: {
          products: true,
          users: true,
          sales: true,
          clients: true,
          suppliers: true,
        },
      },
    },
  })
  if (!tenant) return NextResponse.json({ error: "No encontrado" }, { status: 404 })

  // Sales aggregate (revenue) and last activity
  const [salesAgg, lastSale] = await Promise.all([
    db.sale.aggregate({
      where: { tenantId: id, status: "COMPLETED" },
      _sum: { total: true },
    }),
    db.sale.findFirst({
      where: { tenantId: id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ])

  // Audit log entries for users in this tenant
  const userIds = tenant.users.map((u: { id: string }) => u.id)
  const auditLogs = await db.auditLog.findMany({
    where: { userId: { in: userIds } },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  })

  return NextResponse.json({
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      active: tenant.active,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
      config: tenant.config,
      subscription: tenant.subscription,
      users: tenant.users,
      counts: tenant._count,
      revenue: Number(salesAgg._sum.total ?? 0),
      lastActivity: lastSale?.createdAt ?? null,
      auditLogs,
    },
  })
}
