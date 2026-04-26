import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import AdminNav from "@/components/admin/AdminNav"
import { db } from "@/lib/db"
import { readDeviceCookie } from "@/lib/admin-device"

export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true, nocache: true },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")
  if (session.user.role !== "SUPER_ADMIN") redirect("/")

  // Device-binding check. The /admin/dispositivo page runs the
  // verification flow itself, so it has to skip this gate or we'd loop.
  const hdrs = await headers()
  const path = hdrs.get("x-invoke-path") ?? hdrs.get("x-pathname") ?? ""
  const isOnVerifyPage = path.includes("/admin/dispositivo")

  if (!isOnVerifyPage) {
    const deviceId = await readDeviceCookie()
    let trusted = false
    if (deviceId) {
      const device = await db.adminTrustedDevice.findUnique({ where: { id: deviceId } })
      trusted = !!device && device.userId === session.user.id && !device.revokedAt
      if (trusted) {
        // Touch lastUsedAt so the security page shows accurate "last seen".
        // Best-effort — don't block the render if it fails.
        db.adminTrustedDevice
          .update({ where: { id: deviceId }, data: { lastUsedAt: new Date() } })
          .catch(() => {})
      }
    }
    if (!trusted) {
      redirect("/admin/dispositivo")
    }
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <AdminNav user={session.user} />
      <main className="pt-16">{children}</main>
    </div>
  )
}
