import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { clearDeviceCookie, readDeviceCookie } from "@/lib/admin-device"

// PATCH /api/admin/devices/[id] — rename a trusted device (label only).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }
  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as { label?: string }
  const label = body.label?.toString().slice(0, 60).trim() || null

  const device = await db.adminTrustedDevice.findUnique({ where: { id } })
  if (!device || device.userId !== session.user.id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  }

  await db.adminTrustedDevice.update({ where: { id }, data: { label } })
  return NextResponse.json({ ok: true })
}

// DELETE /api/admin/devices/[id] — revoke a trusted device. If the admin
// revokes the device they're currently using, we also clear the cookie
// so the next request bounces them through verification again.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }
  const { id } = await params

  const device = await db.adminTrustedDevice.findUnique({ where: { id } })
  if (!device || device.userId !== session.user.id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 })
  }

  await db.adminTrustedDevice.update({
    where: { id },
    data: { revokedAt: new Date() },
  })

  const currentDeviceId = await readDeviceCookie()
  if (currentDeviceId === id) {
    await clearDeviceCookie()
  }

  return NextResponse.json({ ok: true })
}
