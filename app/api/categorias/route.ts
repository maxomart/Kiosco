import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { can } from "@/lib/permissions"

export async function GET() {
  const { error, tenantId } = await getSessionTenant()
  if (error) return error
  try {
    const categories = await db.category.findMany({ where: { active: true, ...(tenantId ? { tenantId } : {}) }, orderBy: { name: "asc" } })
    return NextResponse.json({ categories })
  } catch (err) {
    console.error("[GET /api/categorias]", err)
    return NextResponse.json({ error: "Error al obtener categorías" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!can(session.user.role, "categories:manage"))
    return NextResponse.json({ error: "Sin permisos para gestionar categorías" }, { status: 403 })
  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 })
  try {
    const category = await db.category.create({ data: { name: name.trim(), tenantId: tenantId! } })
    return NextResponse.json({ category }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Categoría ya existe" }, { status: 400 })
  }
}
