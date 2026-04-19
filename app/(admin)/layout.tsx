import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import AdminNav from "./AdminNav"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN") redirect("/login")

  return (
    <div className="min-h-screen bg-gray-950">
      <AdminNav email={session.user.email ?? ""} />
      <main>{children}</main>
    </div>
  )
}
