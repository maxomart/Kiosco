import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Sidebar from "@/components/shared/Sidebar"
import Header from "@/components/shared/Header"
import OfflineBanner from "@/components/shared/OfflineBanner"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-950 overflow-hidden">
      <OfflineBanner />
      <Sidebar role={session.user.role as string} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header user={session.user} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
