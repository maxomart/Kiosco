import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, tenantId, isSuperAdmin } = await getSessionTenant()
  if (error) return error
  const { id } = await params

  const client = await db.client.findUnique({
    where: { id },
    select: { tenantId: true, name: true, loyaltyPoints: true },
  })
  if (!client) return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  if (!isSuperAdmin && client.tenantId !== tenantId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const transactions = await db.loyaltyTransaction.findMany({
    where: { clientId: id },
    orderBy: { createdAt: "desc" },
    take: 200,
  })

  return NextResponse.json({
    client: { id, name: client.name, loyaltyPoints: client.loyaltyPoints },
    transactions,
  })
}
