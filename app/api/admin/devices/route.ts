import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { readDeviceCookie } from "@/lib/admin-device"

// GET /api/admin/devices — list trusted devices for the current admin.
// Marks the current device so the UI can highlight it.
export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const currentDeviceId = await readDeviceCookie()
  const devices = await db.adminTrustedDevice.findMany({
    where: { userId: session.user.id, revokedAt: null },
    orderBy: { lastUsedAt: "desc" },
  })

  return NextResponse.json({
    devices: devices.map((d) => ({
      id: d.id,
      label: d.label,
      ipAddress: d.ipAddress,
      userAgent: d.userAgent,
      createdAt: d.createdAt,
      lastUsedAt: d.lastUsedAt,
      isCurrent: d.id === currentDeviceId,
    })),
  })
}
