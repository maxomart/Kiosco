import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"

const patchSchema = z.object({
  active: z.boolean().optional(),
  role: z.enum(["CASHIER", "ADMIN", "OWNER", "SUPER_ADMIN"]).optional(),
  name: z.string().min(1).optional(),
})

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  const { id } = await ctx.params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const user = await db.user.findUnique({ where: { id } })
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })

  await db.user.update({
    where: { id },
    data: {
      ...(parsed.data.active !== undefined && { active: parsed.data.active }),
      ...(parsed.data.role && { role: parsed.data.role }),
      ...(parsed.data.name && { name: parsed.data.name }),
    },
  })

  return NextResponse.json({ ok: true })
}

// DELETE /api/admin/users/[id]
// Hard-delete a user. Guards:
//   - Not allowed on super-admin accounts (would lock the platform).
//   - Not allowed on yourself (would brick your own session).
//   - If the user is the last OWNER of a tenant, we refuse — the admin
//     should pick a new owner first or delete the whole tenant.
//
// Cascade behavior: User has FKs from Sales, AuditLogs, CashSessions,
// ApiKey (createdBy), ClientPayment, StockMovement. Most of those use
// onDelete defaults (Restrict for required, SetNull for nullable). If
// the delete is blocked by FKs we return 409 with the offending
// relation so the admin knows what's holding it.
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  const { id } = await ctx.params

  if (id === session.user.id) {
    return NextResponse.json(
      { error: "No te podés borrar a vos mismo. Pedile a otro super-admin." },
      { status: 400 }
    )
  }

  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, role: true, tenantId: true, email: true },
  })
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })

  if (user.role === "SUPER_ADMIN") {
    return NextResponse.json(
      { error: "No se puede borrar un super-admin desde acá. Hacelo manualmente en la base." },
      { status: 400 }
    )
  }

  // If this is an OWNER and removing it would leave the tenant ownerless,
  // bail. Soft-blocking instead of cascading is safer — gives the admin
  // a chance to promote someone else first.
  if (user.role === "OWNER" && user.tenantId) {
    const otherOwners = await db.user.count({
      where: { tenantId: user.tenantId, role: "OWNER", id: { not: id } },
    })
    if (otherOwners === 0) {
      return NextResponse.json(
        {
          error:
            "Este usuario es el único dueño de su tenant. Promové otro a dueño antes de borrarlo, o eliminá el tenant entero.",
        },
        { status: 409 }
      )
    }
  }

  try {
    await db.user.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    // Prisma P2003: foreign key constraint failed
    const code = e?.code ?? ""
    if (code === "P2003") {
      return NextResponse.json(
        {
          error:
            "No se puede borrar — el usuario tiene ventas, sesiones de caja u otros registros asociados. Desactivalo en lugar de borrar.",
        },
        { status: 409 }
      )
    }
    console.error("[admin/users DELETE]", e)
    return NextResponse.json(
      { error: "Error al borrar el usuario." },
      { status: 500 }
    )
  }
}
