import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"

async function resolveUser(id: string, tenantId: string) {
  const user = await db.user.findUnique({
    where: { id },
    select: { tenantId: true, role: true, active: true },
  })
  if (!user || user.tenantId !== tenantId) return null
  return user
}

/** True when taking this user out of the active-OWNER set would leave the
 * tenant with zero active owners. Used to block the last-owner escape hatch
 * on delete / deactivate / role change. */
async function wouldLeaveTenantWithoutOwner(
  tenantId: string,
  userId: string
): Promise<boolean> {
  const otherActiveOwners = await db.user.count({
    where: {
      tenantId,
      role: "OWNER",
      active: true,
      id: { not: userId },
    },
  })
  return otherActiveOwners === 0
}

const patchSchema = z.object({
  active: z.boolean().optional(),
  role: z.enum(["OWNER", "ADMIN", "CASHIER"]).optional(),
})

/** Toggle active/inactive and/or change role */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (session.user.role !== "OWNER" && session.user.role !== "ADMIN")
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  const { id } = await params
  const user = await resolveUser(id, tenantId!)
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })

  const nextRole = parsed.data.role ?? user.role
  const nextActive =
    typeof parsed.data.active === "boolean" ? parsed.data.active : user.active

  // Only OWNER can grant/revoke the OWNER role.
  if (parsed.data.role && parsed.data.role !== user.role && session.user.role !== "OWNER") {
    return NextResponse.json(
      { error: "Solo un dueño puede cambiar el rol de otro usuario." },
      { status: 403 }
    )
  }

  // Never leave the tenant without an active OWNER. This triggers if you:
  //   - deactivate the last OWNER
  //   - demote the last OWNER (role change OWNER → ADMIN/CASHIER)
  const willStopBeingActiveOwner =
    user.role === "OWNER" && (nextRole !== "OWNER" || nextActive === false)
  if (willStopBeingActiveOwner) {
    const last = await wouldLeaveTenantWithoutOwner(tenantId!, id)
    if (last) {
      return NextResponse.json(
        {
          error:
            "No podés desactivar o cambiar el rol del último dueño. Creá o promové a otro usuario como dueño primero.",
        },
        { status: 400 }
      )
    }
  }

  await db.user.update({
    where: { id },
    data: {
      ...(parsed.data.role ? { role: parsed.data.role } : {}),
      ...(typeof parsed.data.active === "boolean" ? { active: parsed.data.active } : {}),
    },
  })
  return NextResponse.json({ ok: true, active: nextActive, role: nextRole })
}

/** Hard delete */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (session.user.role !== "OWNER" && session.user.role !== "ADMIN")
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  const { id } = await params
  const user = await resolveUser(id, tenantId!)
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })

  // Owners can only be deleted if there's at least one other active owner.
  if (user.role === "OWNER") {
    const last = await wouldLeaveTenantWithoutOwner(tenantId!, id)
    if (last) {
      return NextResponse.json(
        {
          error:
            "No podés eliminar al último dueño. Creá o promové a otro usuario como dueño primero.",
        },
        { status: 400 }
      )
    }
  }

  // An ADMIN can't delete an OWNER (even if not the last) — keeps the hierarchy
  // intact so an admin can't wipe out the owner they report to.
  if (user.role === "OWNER" && session.user.role !== "OWNER") {
    return NextResponse.json(
      { error: "Solo otro dueño puede eliminar a un dueño." },
      { status: 403 }
    )
  }

  // A user can't delete themselves — avoid the footgun and leave that flow
  // to the subscription cancel / account close path.
  if (id === session.user.id) {
    return NextResponse.json(
      { error: "No podés eliminarte a vos mismo." },
      { status: 400 }
    )
  }

  await db.user.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
