import { db } from "@/lib/db"

/**
 * Genera un resumen textual del día para el tenant. Usado por la home del
 * dashboard. Se invoca como función directa desde el server component
 * (sin loopback HTTP) y también desde el endpoint /api/ia/resumen-dia.
 */
export async function buildResumenDia(tenantId: string): Promise<string | null> {
  try {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const sales = await db.sale.findMany({
      where: { tenantId, status: "COMPLETED", createdAt: { gte: todayStart } },
      select: {
        total: true,
        items: {
          select: {
            quantity: true,
            productId: true,
            product: { select: { name: true } },
          },
        },
      },
    })

    if (sales.length === 0) return null

    const totalRevenue = sales.reduce((acc, s) => acc + Number(s.total), 0)
    const productCounts: Record<string, { name: string; qty: number }> = {}
    for (const s of sales) {
      for (const i of s.items) {
        if (!i.productId) continue
        const cur =
          productCounts[i.productId] ?? {
            name: i.product?.name ?? "Producto",
            qty: 0,
          }
        cur.qty += i.quantity
        productCounts[i.productId] = cur
      }
    }
    const top = Object.values(productCounts)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 3)

    const fmt = new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
    })
    const topText = top.length
      ? ` Los productos más vendidos fueron: ${top.map((t) => `${t.name} (${t.qty})`).join(", ")}.`
      : ""

    return `Llevás ${sales.length} venta${sales.length === 1 ? "" : "s"} hoy por un total de ${fmt.format(totalRevenue)}.${topText}`
  } catch (err) {
    console.error("[ai-resumen]", err)
    return null
  }
}
