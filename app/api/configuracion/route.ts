import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"

// GET /api/configuracion — fetch all business config entries for tenant
export async function GET() {
  const { error, tenantId, isSuperAdmin } = await getSessionTenant()
  if (error) return error

  const tenantFilter = !isSuperAdmin && tenantId ? { tenantId } : {}

  try {
    const config = await db.businessConfig.findMany({
      where: tenantFilter,
      orderBy: { key: "asc" },
    })
    return NextResponse.json(config)
  } catch (err) {
    console.error("Error en configuracion GET:", err)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

// PUT /api/configuracion — upsert array of { key, value } pairs
export async function PUT(req: NextRequest) {
  const { error, tenantId, isSuperAdmin } = await getSessionTenant()
  if (error) return error

  const body = await req.json()

  if (!Array.isArray(body)) {
    return NextResponse.json({ error: "Se esperaba un array de { key, value }" }, { status: 400 })
  }

  const resolvedTenantId = !isSuperAdmin ? tenantId : null

  try {
    const results = await Promise.all(
      body.map(async ({ key, value }: { key: string; value: string }) => {
        // Use findFirst + upsert by id to avoid compound unique key issues
        const existing = await db.businessConfig.findFirst({
          where: { key, tenantId: resolvedTenantId },
        })
        if (existing) {
          return db.businessConfig.update({ where: { id: existing.id }, data: { value } })
        }
        return db.businessConfig.create({ data: { key, value, tenantId: resolvedTenantId } })
      })
    )
    return NextResponse.json(results)
  } catch (err) {
    console.error("Error en configuracion PUT:", err)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
