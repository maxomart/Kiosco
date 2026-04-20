import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Sidebar from "@/components/shared/Sidebar"
import Header from "@/components/shared/Header"
import OfflineBanner from "@/components/shared/OfflineBanner"
import { ThemeCustomizer } from "@/components/shared/ThemeCustomizer"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect("/login")

  // SUPER_ADMIN va directo al panel de administración de kioscos
  if (session.user.role === "SUPER_ADMIN") redirect("/admin")

  return (
    <div className="flex h-screen app-surface overflow-hidden text-white">
      <OfflineBanner />
      <Sidebar role={session.user.role as string} />
      <div className="flex-1 flex flex-col min-w-0 relative">
        <Header user={session.user} />
        <main className="flex-1 overflow-y-auto relative z-10">
          {children}
        </main>
      </div>
      <ThemeCustomizer />
    </div>
  )
}
