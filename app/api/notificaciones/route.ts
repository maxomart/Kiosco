import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { Prisma } from "@prisma/client"

export const dynamic = "force-dynamic"

type Notification = {
  id: string
  type: "LOW_STOCK" | "OUT_STOCK" | "CASH_OPEN" | "TRIAL_ENDING" | "RECENT_SALE"
  title: string
  message: string
  href?: string
  createdAt: string
  severity: "info" | "warning" | "danger" | "success"
}

export async function GET() {
  const { error, tenantId } = await getSessionTenant()
  if (error) return error

  const notifications: Notification[] = []
  const now = new Date()
  const isoNow = now.toISOString()
  const t = tenantId!

  try {
    // Todas las queries en paralelo. Las de stock usan COUNT + sample chico (take 4)
    // en vez de findMany completo — antes traía TODO el catálogo en cada poll.
    const [
      outStockCount,
      outStockSample,
      lowStockAgg,
      openSession,
      sub,
      recentSale,
    ] = await Promise.all([
      db.product.count({
        where: { tenantId: t, active: true, stock: { lte: 0 } },
      }),
      db.product.findMany({
        where: { tenantId: t, active: true, stock: { lte: 0 } },
        select: { name: true },
        orderBy: { stock: "asc" },
        take: 4,
      }),
      // Prisma no soporta comparar 2 columnas en where → raw SQL para low stock.
      // Devuelve count + sample en una sola ida y vuelta.
      db.$queryRaw<Array<{ name: string; stock: number; total_count: bigint }>>(
        Prisma.sql`
          SELECT name, stock,
                 (SELECT COUNT(*)::bigint FROM "Product"
                  WHERE "tenantId" = ${t}
                    AND active = true
                    AND stock > 0
                    AND stock <= "minStock") AS total_count
          FROM "Product"
          WHERE "tenantId" = ${t}
            AND active = true
            AND stock > 0
            AND stock <= "minStock"
          ORDER BY stock ASC
          LIMIT 4
        `
      ),
      db.cashSession.findFirst({
        where: { tenantId: t, status: "OPEN" },
        select: { id: true, createdAt: true },
      }),
      db.subscription.findUnique({
        where: { tenantId: t },
        select: { status: true, currentPeriodEnd: true, plan: true },
      }),
      db.sale.findFirst({
        where: { tenantId: t, status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        select: { id: true, number: true, total: true, createdAt: true },
      }),
    ])

    // 1. Out of stock
    if (outStockCount > 0) {
      const names = outStockSample.map((p) => p.name)
      notifications.push({
        id: "out-stock",
        type: "OUT_STOCK",
        title: `${outStockCount} sin stock`,
        message: names.slice(0, 3).join(", ") + (outStockCount > 3 ? "…" : ""),
        href: "/inventario?filter=outstock",
        createdAt: isoNow,
        severity: "danger",
      })
    }

    // 2. Low stock
    const lowStockCount = Number(lowStockAgg[0]?.total_count ?? 0)
    if (lowStockCount > 0) {
      const items = lowStockAgg
        .slice(0, 3)
        .map((p) => `${p.name} (${p.stock})`)
        .join(", ")
      notifications.push({
        id: "low-stock",
        type: "LOW_STOCK",
        title: `${lowStockCount} con stock bajo`,
        message: items + (lowStockCount > 3 ? "…" : ""),
        href: "/inventario?filter=lowstock",
        createdAt: isoNow,
        severity: "warning",
      })
    }

    // 3. Caja abierta hace mucho
    if (openSession) {
      const hoursOpen = Math.floor(
        (now.getTime() - openSession.createdAt.getTime()) / 1000 / 60 / 60
      )
      if (hoursOpen >= 12) {
        notifications.push({
          id: `cash-open-${openSession.id}`,
          type: "CASH_OPEN",
          title: "Caja abierta hace " + hoursOpen + "h",
          message: "Recordá cerrar la caja al terminar el turno.",
          href: "/caja",
          createdAt: openSession.createdAt.toISOString(),
          severity: "info",
        })
      }
    }

    // 4. Trial por terminar
    if (sub?.status === "TRIALING" && sub.currentPeriodEnd) {
      const daysLeft = Math.ceil(
        (sub.currentPeriodEnd.getTime() - now.getTime()) / 1000 / 60 / 60 / 24
      )
      if (daysLeft >= 0 && daysLeft <= 7) {
        notifications.push({
          id: "trial-ending",
          type: "TRIAL_ENDING",
          title:
            daysLeft <= 0
              ? "Tu prueba terminó"
              : `Quedan ${daysLeft} día${daysLeft === 1 ? "" : "s"} de prueba`,
          message: "Suscribite para no perder acceso a tus datos.",
          href: "/configuracion/suscripcion",
          createdAt: isoNow,
          severity: daysLeft <= 2 ? "warning" : "info",
        })
      }
    }

    // 5. Venta reciente
    if (recentSale) {
      const minsAgo = Math.floor(
        (now.getTime() - recentSale.createdAt.getTime()) / 1000 / 60
      )
      if (minsAgo <= 30) {
        notifications.push({
          id: `sale-${recentSale.id}`,
          type: "RECENT_SALE",
          title: `Venta #${recentSale.number} registrada`,
          message: `Hace ${minsAgo} min · $${Number(recentSale.total).toLocaleString("es-AR")}`,
          href: "/ventas",
          createdAt: recentSale.createdAt.toISOString(),
          severity: "success",
        })
      }
    }

    return NextResponse.json({ notifications, unread: notifications.length })
  } catch (err) {
    console.error("[GET /api/notificaciones]", err)
    return NextResponse.json({ notifications: [], unread: 0 })
  }
}
