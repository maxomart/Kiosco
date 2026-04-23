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
import SubscriptionStatusBanner from "@/components/shared/SubscriptionStatusBanner"
import { deriveBannerState, type BannerData } from "@/lib/subscription-banner"

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
    // Queries split so a single failure doesn't hide all three outputs. The
    // promoRedemption query in particular may reference a model that isn't
    // present on older Prisma clients in the running container — keeping it
    // isolated means the rest of the layout still renders correctly.
    const tenantId = session.user.tenantId

    let subForBanner: {
      plan: string
      status: string | null
      currentPeriodEnd: Date | null
      paymentProvider: string | null
    } | null = null
    try {
      const sub = await db.subscription.findUnique({
        where: { tenantId },
        select: {
          plan: true,
          status: true,
          currentPeriodEnd: true,
          paymentProvider: true,
        },
      })
      if (sub) {
        plan = sub.plan ?? "FREE"
        subForBanner = {
          plan: sub.plan ?? "FREE",
          status: sub.status ?? null,
          currentPeriodEnd: sub.currentPeriodEnd ?? null,
          paymentProvider: sub.paymentProvider ?? null,
        }
      }
    } catch (e) {
      console.error("[dashboard-layout] subscription query failed:", e)
    }

    try {
      const cfg = (await db.tenantConfig.findUnique({
        where: { tenantId },
      })) as any
      initialAccent = cfg?.themeColor ?? null
      const m = cfg?.themeMode
      if (m === "light" || m === "dark" || m === "auto") initialMode = m
      logoUrl = cfg?.logoUrl ?? null
    } catch (e) {
      console.error("[dashboard-layout] tenantConfig query failed:", e)
    }

    try {
      const tenant = await db.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      })
      brandName = tenant?.name ?? null
    } catch (e) {
      console.error("[dashboard-layout] tenant query failed:", e)
    }

    // Promo lookup is best-effort. If it fails, the banner will still render
    // as a trial-style banner for paid plans without paymentProvider, which
    // is the correct UX for a user on a promo window anyway.
    let hadPromo = false
    let promoPlanGranted: string | null = null
    try {
      const redemption = (await db.promoRedemption.findFirst({
        where: { tenantId },
        include: { promoCode: { select: { planGranted: true } } },
      })) as any
      if (redemption) {
        hadPromo = true
        promoPlanGranted = redemption.promoCode?.planGranted ?? null
      }
    } catch (e) {
      console.error("[dashboard-layout] promoRedemption query failed:", e)
    }

    if (subForBanner) {
      bannerData = deriveBannerState({
        plan: subForBanner.plan,
        status: subForBanner.status,
        currentPeriodEnd: subForBanner.currentPeriodEnd,
        paymentProvider: subForBanner.paymentProvider,
        hadPromo,
        promoPlan: promoPlanGranted,
      })
    }
  }

  const aiEnabled = hasFeature(plan as any, "feature:ai_assistant")

  return (
    <ThemeProvider initialAccent={initialAccent} initialMode={initialMode}>
      <SurfaceThemeProvider>
        <ConfirmProvider>
          <div suppressHydrationWarning className="flex h-screen app-surface overflow-hidden">
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
