import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import Sidebar from "@/components/shared/Sidebar"
import Header from "@/components/shared/Header"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session) {
    redirect("/login")
  }

  if (session.user.role === "SUPER_ADMIN") {
    redirect("/admin")
  }

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      <Sidebar user={session.user} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header user={session.user} />
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
