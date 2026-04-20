import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, tenantId, isSuperAdmin } = await getSessionTenant()
  if (error) return error
  const { id } = await params
  try {
    const sale = await db.sale.findUnique({
      where: { id },
      include: { items: true, user: { select: { name: true } }, client: { select: { name: true } } },
    })
    if (!sale) return NextResponse.json({ error: "No encontrada" }, { status: 404 })
    if (!isSuperAdmin && sale.tenantId !== tenantId) return NextResponse.json({ error: "No autorizado" }, { status: 403 })
    return NextResponse.json({ sale })
  } catch (err) {
    console.error("[GET /api/ventas/[id]]", err)
    return NextResponse.json({ error: "Error al obtener venta" }, { status: 500 })
  }
}
