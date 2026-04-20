import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import AdminNav from "@/components/admin/AdminNav"

export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true, nocache: true },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")
  if (session.user.role !== "SUPER_ADMIN") redirect("/")

  return (
    <div className="min-h-screen bg-gray-950">
      <AdminNav user={session.user} />
      <main className="pt-16">{children}</main>
    </div>
  )
}
