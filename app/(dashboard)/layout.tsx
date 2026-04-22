import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import Sidebar from "@/components/shared/Sidebar"
import Header from "@/components/shared/Header"
import { ThemeProvider } from "@/components/theme/ThemeProvider"
import { SurfaceThemeProvider } from "@/components/theme/SurfaceThemeProvider"
import { AssistantWidget } from "@/components/ai/AssistantWidget"
import { ConfirmProvider } from "@/components/shared/ConfirmDialog"
import { db } from "@/lib/db"
import { hasFeature } from "@/lib/permissions"
import SubscriptionStatusBanner, {
  deriveBannerState,
  type BannerData,
} from "@/components/shared/SubscriptionStatusBanner"

export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true, nocache: true },
}

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
  let logoUrl: string | null = null
  let brandName: string | null = null
  let bannerData: BannerData = { kind: null, plan: "" }
  if (session.user.tenantId) {
    try {
      const [cfg, sub, tenant, redemption] = await Promise.all([
        db.tenantConfig.findUnique({ where: { tenantId: session.user.tenantId } }) as any,
        db.subscription.findUnique({
          where: { tenantId: session.user.tenantId },
          select: {
            plan: true,
            status: true,
            currentPeriodEnd: true,
            paymentProvider: true,
          },
        }),
        db.tenant.findUnique({
          where: { id: session.user.tenantId },
          select: { name: true },
        }),
        db.promoRedemption.findFirst({
          where: { tenantId: session.user.tenantId },
          include: { promoCode: { select: { planGranted: true } } },
        }) as any,
      ])
      initialAccent = cfg?.themeColor ?? null
      const m = cfg?.themeMode
      if (m === "light" || m === "dark" || m === "auto") initialMode = m
      plan = sub?.plan ?? "FREE"
      logoUrl = cfg?.logoUrl ?? null
      brandName = tenant?.name ?? null
      bannerData = deriveBannerState({
        plan,
        status: sub?.status,
        currentPeriodEnd: sub?.currentPeriodEnd,
        paymentProvider: sub?.paymentProvider,
        hadPromo: !!redemption,
        promoPlan: redemption?.promoCode?.planGranted ?? null,
      })
    } catch {
      // Schema may not yet have the columns deployed; fall back gracefully.
    }
  }

  const aiEnabled = hasFeature(plan as any, "feature:ai_assistant")

  return (
    <ThemeProvider initialAccent={initialAccent} initialMode={initialMode}>
      <SurfaceThemeProvider>
        <ConfirmProvider>
          <div className="flex h-screen app-surface overflow-hidden">
            <Sidebar user={session.user} plan={plan as any} logoUrl={logoUrl} brandName={brandName} />
            <div className="flex-1 flex flex-col overflow-hidden min-w-0 relative z-10">
              <Header user={session.user} plan={plan as any} />
              <main className="flex-1 overflow-auto">
                <SubscriptionStatusBanner {...bannerData} />
                <div className="p-4 lg:p-6">{children}</div>
              </main>
            </div>
            {aiEnabled && <AssistantWidget plan={plan as any} />}
          </div>
        </ConfirmProvider>
      </SurfaceThemeProvider>
    </ThemeProvider>
  )
}
