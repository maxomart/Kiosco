import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"

export async function GET() {
  const { error, tenantId, isSuperAdmin } = await getSessionTenant()
  if (error) return error

  const notifications: {
    id: string
    type: string
    title: string
    message: string
    createdAt: string
    read: boolean
  }[] = []

  if (!isSuperAdmin && tenantId) {
    // Productos con stock bajo
    // Prisma no soporta comparaciones entre columnas en where, usar findMany y filtrar en JS
    const allActive = await db.product.findMany({
      where: { tenantId, active: true },
      select: { id: true, name: true, stock: true, minStock: true, unit: true },
    })

    const lowStockProducts = allActive.filter(p => p.stock <= p.minStock)

    lowStockProducts.slice(0, 8).forEach(p => {
      notifications.push({
        id: `low-stock-${p.id}`,
        type: "warning",
        title: "Stock bajo",
        message: `${p.name}: ${p.stock} ${p.unit} (mín: ${p.minStock})`,
        createdAt: new Date().toISOString(),
        read: false,
      })
    })

    // Caja abierta hace más de 24 hs
    const openSession = await db.cashSession.findFirst({
      where: { tenantId, status: "OPEN" },
      orderBy: { openedAt: "desc" },
    })
    if (openSession) {
      const hoursOpen = (Date.now() - new Date(openSession.openedAt).getTime()) / 3600000
      if (hoursOpen > 24) {
        notifications.push({
          id: `caja-open-${openSession.id}`,
          type: "warning",
          title: "Caja abierta hace más de 24hs",
          message: `La caja lleva ${Math.floor(hoursOpen)} horas abierta sin cerrar`,
          createdAt: new Date().toISOString(),
          read: false,
        })
      }
    }
  }

  return NextResponse.json({ notifications, count: notifications.length })
}
