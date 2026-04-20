import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"

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

  try {
    // 1. Low stock & out-of-stock products
    const products = await db.product.findMany({
      where: { tenantId: tenantId!, active: true },
      select: { id: true, name: true, stock: true, minStock: true },
      orderBy: { stock: "asc" },
    })
    const outOfStock = products.filter((p: { stock: number }) => p.stock <= 0)
    const lowStock = products.filter((p: { stock: number; minStock: number }) => p.stock > 0 && p.stock <= p.minStock)

    if (outOfStock.length > 0) {
      notifications.push({
        id: "out-stock",
        type: "OUT_STOCK",
        title: `${outOfStock.length} sin stock`,
        message: outOfStock.slice(0, 3).map((p: { name: string }) => p.name).join(", ") + (outOfStock.length > 3 ? "…" : ""),
        href: "/inventario?filter=outstock",
        createdAt: isoNow,
        severity: "danger",
      })
    }
    if (lowStock.length > 0) {
      notifications.push({
        id: "low-stock",
        type: "LOW_STOCK",
        title: `${lowStock.length} con stock bajo`,
        message: lowStock.slice(0, 3).map((p: { name: string; stock: number }) => `${p.name} (${p.stock})`).join(", ") + (lowStock.length > 3 ? "…" : ""),
        href: "/inventario?filter=lowstock",
        createdAt: isoNow,
        severity: "warning",
      })
    }

    // 2. Cash session still open
    const openSession = await db.cashSession.findFirst({
      where: { tenantId: tenantId!, status: "OPEN" },
      select: { id: true, createdAt: true },
    })
    if (openSession) {
      const hoursOpen = Math.floor((now.getTime() - openSession.createdAt.getTime()) / 1000 / 60 / 60)
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

    // 3. Trial ending soon
    const sub = await db.subscription.findUnique({
      where: { tenantId: tenantId! },
      select: { status: true, currentPeriodEnd: true, plan: true },
    })
    if (sub?.status === "TRIALING" && sub.currentPeriodEnd) {
      const daysLeft = Math.ceil((sub.currentPeriodEnd.getTime() - now.getTime()) / 1000 / 60 / 60 / 24)
      if (daysLeft >= 0 && daysLeft <= 7) {
        notifications.push({
          id: "trial-ending",
          type: "TRIAL_ENDING",
          title: daysLeft <= 0 ? "Tu prueba terminó" : `Quedan ${daysLeft} día${daysLeft === 1 ? "" : "s"} de prueba`,
          message: "Suscribite para no perder acceso a tus datos.",
          href: "/configuracion/suscripcion",
          createdAt: isoNow,
          severity: daysLeft <= 2 ? "warning" : "info",
        })
      }
    }

    // 4. Recent sale (last 30 min) — informational
    const recentSale = await db.sale.findFirst({
      where: { tenantId: tenantId!, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      select: { id: true, number: true, total: true, createdAt: true },
    })
    if (recentSale) {
      const minsAgo = Math.floor((now.getTime() - recentSale.createdAt.getTime()) / 1000 / 60)
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
