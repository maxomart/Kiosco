import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import Sidebar from "@/components/shared/Sidebar"
import Header from "@/components/shared/Header"
import { ThemeProvider } from "@/components/theme/ThemeProvider"
import { AssistantWidget } from "@/components/ai/AssistantWidget"
import { db } from "@/lib/db"
import { hasFeature } from "@/lib/permissions"

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

  // Read tenant theme + plan on the server so the first paint already has
  // the correct accent and the sidebar can lock plan-gated items.
  let initialAccent: string | null = null
  let initialMode: "dark" | "light" | "auto" = "dark"
  let plan: string = "FREE"
  if (session.user.tenantId) {
    try {
      const [cfg, sub] = await Promise.all([
        db.tenantConfig.findUnique({ where: { tenantId: session.user.tenantId } }) as any,
        db.subscription.findUnique({
          where: { tenantId: session.user.tenantId },
          select: { plan: true },
        }),
      ])
      initialAccent = cfg?.themeColor ?? null
      const m = cfg?.themeMode
      if (m === "light" || m === "dark" || m === "auto") initialMode = m
      plan = sub?.plan ?? "FREE"
    } catch {
      // Schema may not yet have the columns deployed; fall back gracefully.
    }
  }

  const aiEnabled = hasFeature(plan as any, "feature:ai_assistant")

  return (
    <ThemeProvider initialAccent={initialAccent} initialMode={initialMode}>
      <div className="flex h-screen bg-gray-950 overflow-hidden">
        <Sidebar user={session.user} plan={plan as any} />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <Header user={session.user} plan={plan as any} />
          <main className="flex-1 overflow-auto p-4 lg:p-6">
            {children}
          </main>
        </div>
        {aiEnabled && <AssistantWidget plan={plan as any} />}
      </div>
    </ThemeProvider>
  )
}
