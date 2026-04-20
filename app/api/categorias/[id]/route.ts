import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  active: z.boolean().optional(),
})

async function ownTenant(id: string, tenantId: string): Promise<boolean> {
  const c = await db.category.findUnique({ where: { id }, select: { tenantId: true } })
  return !!c && c.tenantId === tenantId
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error, tenantId } = await getSessionTenant()
  if (error) return error
  const { id } = await ctx.params

  if (!(await ownTenant(id, tenantId!))) {
    return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 })
  }

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }) }
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  try {
    const category = await db.category.update({
      where: { id },
      data: {
        ...(parsed.data.name && { name: parsed.data.name.trim() }),
        ...(parsed.data.active !== undefined && { active: parsed.data.active }),
      },
    })
    return NextResponse.json({ category })
  } catch (err: any) {
    if (err?.code === "P2002") return NextResponse.json({ error: "Ya existe una categoría con ese nombre" }, { status: 400 })
    console.error("[PATCH /api/categorias/[id]]", err)
    return NextResponse.json({ error: "Error al actualizar categoría" }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error, tenantId } = await getSessionTenant()
  if (error) return error
  const { id } = await ctx.params

  if (!(await ownTenant(id, tenantId!))) {
    return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 })
  }

  try {
    // Check if any product references it
    const inUse = await db.product.count({ where: { categoryId: id } })
    if (inUse > 0) {
      // Soft-delete instead of hard delete to preserve referential integrity
      await db.category.update({ where: { id }, data: { active: false } })
      return NextResponse.json({ ok: true, softDeleted: true, productsAffected: inUse })
    }
    await db.category.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[DELETE /api/categorias/[id]]", err)
    return NextResponse.json({ error: "Error al eliminar categoría" }, { status: 500 })
  }
}
