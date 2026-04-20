import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"

export const dynamic = "force-dynamic"

// Stub endpoint for the home page's "AI summary of the day". Returns a
// simple template-based summary so the dashboard isn't empty. Swap with
// a real Claude/Anthropic call later by wiring ANTHROPIC_API_KEY.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const requestedTenantId = searchParams.get("tenantId")
  if (!requestedTenantId) {
    return NextResponse.json({ resumen: null }, { status: 200 })
  }

  // Auth: must be a logged-in user belonging to that tenant (or SUPER_ADMIN).
  const session = await auth()
  if (!session) return NextResponse.json({ resumen: null }, { status: 401 })
  const role = (session.user as any)?.role
  const sessionTenantId = (session.user as any)?.tenantId
  if (role !== "SUPER_ADMIN" && sessionTenantId !== requestedTenantId) {
    return NextResponse.json({ resumen: null }, { status: 403 })
  }
  const tenantId = requestedTenantId

  try {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const sales = await db.sale.findMany({
      where: { tenantId, status: "COMPLETED", createdAt: { gte: todayStart } },
      select: { total: true, items: { select: { quantity: true, productId: true, product: { select: { name: true } } } } },
    })

    if (sales.length === 0) {
      return NextResponse.json({ resumen: null })
    }

    const totalRevenue = sales.reduce(
      (acc: number, s: { total: unknown }) => acc + Number(s.total),
      0,
    )
    const productCounts: Record<string, { name: string; qty: number }> = {}
    for (const s of sales) {
      for (const i of s.items) {
        if (!i.productId) continue
        const cur = productCounts[i.productId] ?? { name: i.product?.name ?? "Producto", qty: 0 }
        cur.qty += i.quantity
        productCounts[i.productId] = cur
      }
    }
    const top = Object.values(productCounts)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 3)

    const fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" })
    const topText = top.length
      ? ` Los productos más vendidos fueron: ${top.map((t) => `${t.name} (${t.qty})`).join(", ")}.`
      : ""

    const resumen = `Llevás ${sales.length} venta${sales.length === 1 ? "" : "s"} hoy por un total de ${fmt.format(totalRevenue)}.${topText}`

    return NextResponse.json({ resumen })
  } catch (err) {
    console.error("[GET /api/ia/resumen-dia]", err)
    return NextResponse.json({ resumen: null })
  }
}
