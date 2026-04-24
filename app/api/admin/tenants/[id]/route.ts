import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"

const patchSchema = z.object({
  active: z.boolean().optional(),
  plan: z.enum(["FREE", "STARTER", "PROFESSIONAL", "BUSINESS", "ENTERPRISE"]).optional(),
  name: z.string().min(1).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const tenant = await db.tenant.findUnique({ where: { id } })
  if (!tenant) return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 })

  try {
    await db.$transaction(async (tx) => {
      if (parsed.data.active !== undefined || parsed.data.name) {
        await tx.tenant.update({
          where: { id },
          data: {
            ...(parsed.data.active !== undefined && { active: parsed.data.active }),
            ...(parsed.data.name && { name: parsed.data.name }),
          },
        })
        if (parsed.data.active === false) {
          await tx.user.updateMany({ where: { tenantId: id }, data: { active: false } })
        }
      }
      if (parsed.data.plan) {
        await tx.subscription.upsert({
          where: { tenantId: id },
          create: { tenantId: id, plan: parsed.data.plan, status: "ACTIVE" },
          update: { plan: parsed.data.plan },
        })
      }
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 })
  }
}

/**
 * Soft-delete (default): deactivates tenant and its users.
 * Hard-delete: pass ?mode=hard&confirm=<tenant-name> to permanently remove.
 * Cascades to all related records via Prisma onDelete:Cascade relations.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get("mode") ?? "soft"
  const confirmName = searchParams.get("confirm") ?? ""

  const tenant = await db.tenant.findUnique({
    where: { id },
    select: { id: true, name: true, slug: true },
  })
  if (!tenant) return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 })

  if (mode === "hard") {
    // Require exact tenant name confirmation to prevent accidental wipes
    if (confirmName.trim() !== tenant.name) {
      return NextResponse.json(
        { error: "La confirmación no coincide con el nombre del negocio" },
        { status: 400 }
      )
    }

    try {
      // Snapshot counts before delete (for response + audit)
      const [userCount, productCount, salesCount, clientCount] = await Promise.all([
        db.user.count({ where: { tenantId: id } }),
        db.product.count({ where: { tenantId: id } }),
        db.sale.count({ where: { tenantId: id } }),
        db.client.count({ where: { tenantId: id } }),
      ])

      // Audit log BEFORE delete (links to super admin, not tenant user)
      try {
        await db.auditLog.create({
          data: {
            action: "TENANT_HARD_DELETE",
            entity: "Tenant",
            entityId: id,
            userId: session.user.id!,
            oldValue: JSON.stringify({
              name: tenant.name,
              slug: tenant.slug,
              users: userCount,
              products: productCount,
              sales: salesCount,
              clients: clientCount,
            }),
          },
        })
      } catch (e) {
        // non-fatal — keep going
        console.error("[tenant hard-delete] audit log failed:", e)
      }

      // Cascade delete — drops products, sales, users, subs, everything linked
      await db.tenant.delete({ where: { id } })

      return NextResponse.json({
        ok: true,
        mode: "hard",
        deleted: {
          tenant: tenant.name,
          users: userCount,
          products: productCount,
          sales: salesCount,
          clients: clientCount,
        },
      })
    } catch (err) {
      console.error("[tenant hard-delete]", err)
      return NextResponse.json(
        { error: "Error al eliminar. Puede haber relaciones bloqueando el borrado." },
        { status: 500 }
      )
    }
  }

  // Default: soft delete
  await db.tenant.update({ where: { id }, data: { active: false } })
  await db.user.updateMany({ where: { tenantId: id }, data: { active: false } })
  return NextResponse.json({ ok: true, mode: "soft" })
}
