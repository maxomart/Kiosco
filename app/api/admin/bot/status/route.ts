import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/** Devuelve estado de configuración del bot + estadísticas del tenant demo. */
export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const email = process.env.BOT_TENANT_EMAIL
  if (!email) {
    return NextResponse.json({ configured: false, reason: "BOT_TENANT_EMAIL no seteado en Railway" })
  }

  const owner = await db.user.findUnique({
    where: { email },
    select: { id: true, name: true, tenantId: true, tenant: { select: { name: true } } },
  })
  if (!owner?.tenantId) {
    return NextResponse.json({ configured: true, ready: false, email, reason: "No hay user con ese email" })
  }

  const tenantId = owner.tenantId

  // Stats del tenant demo
  const [productsCount, salesCount, suppliersCount, clientsCount, recentSales, lastBotRun] = await Promise.all([
    db.product.count({ where: { tenantId } }),
    db.sale.count({ where: { tenantId } }),
    db.supplier.count({ where: { tenantId } }),
    db.client.count({ where: { tenantId } }),
    db.sale.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, number: true, total: true, paymentMethod: true, createdAt: true, items: { select: { quantity: true } } },
    }),
    db.cronExecution.findFirst({
      where: { name: { startsWith: "bot" } },
      orderBy: { startedAt: "desc" },
    }),
  ])

  return NextResponse.json({
    configured: true,
    ready: true,
    email,
    tenant: {
      id: tenantId,
      name: owner.tenant?.name,
      ownerName: owner.name,
    },
    stats: {
      products: productsCount,
      sales: salesCount,
      suppliers: suppliersCount,
      clients: clientsCount,
    },
    recentSales: recentSales.map((s) => ({
      id: s.id,
      number: s.number,
      total: Number(s.total),
      paymentMethod: s.paymentMethod,
      itemsCount: s.items.reduce((n, it) => n + it.quantity, 0),
      createdAt: s.createdAt,
    })),
    lastBotRun: lastBotRun
      ? {
          runDate: lastBotRun.runDate,
          startedAt: lastBotRun.startedAt,
          finishedAt: lastBotRun.finishedAt,
          result: lastBotRun.result,
        }
      : null,
  })
}
