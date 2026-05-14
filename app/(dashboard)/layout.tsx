import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import Sidebar from "@/components/shared/Sidebar"
import Header from "@/components/shared/Header"
import { ThemeProvider } from "@/components/theme/ThemeProvider"
import { SurfaceThemeProvider } from "@/components/theme/SurfaceThemeProvider"
import { AssistantWidget } from "@/components/ai/AssistantWidget"
import { ConfirmProvider } from "@/components/shared/ConfirmDialog"
import TourOverlay from "@/components/shared/TourOverlay"
import { UpgradeWelcomeModal } from "@/components/shared/UpgradeWelcomeModal"
import SupportWidget from "@/components/shared/SupportWidget"
import { InstallPrompt } from "@/components/shared/InstallPrompt"
import { InstallPromoBanner } from "@/components/shared/InstallPromoBanner"
import { OfflineSeeder } from "@/components/shared/OfflineSeeder"
import { OnlineReconnect } from "@/components/shared/OnlineReconnect"
import { OfflineGlobalBanner } from "@/components/shared/OfflineGlobalBanner"
import { SubscriptionGateClient } from "@/components/shared/SubscriptionGateClient"
import { isBlockingState } from "@/lib/subscription-banner"
import { db } from "@/lib/db"
import { hasFeature } from "@/lib/permissions"
import SubscriptionStatusBanner from "@/components/shared/SubscriptionStatusBanner"
import { deriveBannerState, type BannerData } from "@/lib/subscription-banner"
import { PLAN_RANK } from "@/lib/tour-steps"

export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true, nocache: true },
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  // Antes sólo chequeábamos !session. Pero `session.user` puede ser undefined
  // en sesiones corruptas (cookie inválida, JWT secret rotado, etc.) y eso
  // crasheaba el dashboard entero con "Cannot read properties of undefined".
  // Tratamos ambos casos como "no autenticado".
  if (!session?.user) {
    redirect("/login")
  }

  if (session.user.role === "SUPER_ADMIN") {
    redirect("/admin")
  }

  // Todas las queries del layout en paralelo. Antes corrían secuencialmente
  // (5 round-trips a Postgres antes de renderizar). En cold start eso eran
  // 400-800ms perceptibles al entrar a cualquier ruta del dashboard.
  let initialAccent: string | null = null
  let initialMode: "dark" | "light" | "auto" = "dark"
  let plan: string = "STARTER"
  let logoUrl: string | null = null
  let brandName: string | null = null
  let bannerData: BannerData = { kind: null, plan: "" }

  const tenantId = session.user.tenantId
  const wrap = <T,>(p: Promise<T>, name: string) =>
    p.catch((e) => {
      console.error(`[dashboard-layout] ${name} query failed:`, e)
      return null
    })

  const [userRow, sub, cfg, tenant, redemption] = await Promise.all([
    wrap(
      db.user.findUnique({
        where: { id: session.user.id },
        select: {
          emailVerified: true,
          tourCompletedAt: true,
          lastWelcomedPlan: true,
        },
      }),
      "user"
    ),
    tenantId
      ? wrap(
          db.subscription.findUnique({
            where: { tenantId },
            select: {
              plan: true,
              status: true,
              currentPeriodEnd: true,
              paymentProvider: true,
            },
          }),
          "subscription"
        )
      : Promise.resolve(null),
    tenantId
      ? wrap(db.tenantConfig.findUnique({ where: { tenantId } }), "tenantConfig")
      : Promise.resolve(null),
    tenantId
      ? wrap(
          db.tenant.findUnique({
            where: { id: tenantId },
            select: { name: true },
          }),
          "tenant"
        )
      : Promise.resolve(null),
    tenantId
      ? wrap(
          db.promoRedemption.findFirst({
            where: { tenantId },
            include: { promoCode: { select: { planGranted: true } } },
          }) as any,
          "promoRedemption"
        )
      : Promise.resolve(null),
  ])

  if (!userRow?.emailVerified) {
    redirect("/verificar-email")
  }

  if (sub) {
    plan = sub.plan ?? "STARTER"
  }
  if (cfg) {
    const c = cfg as any
    initialAccent = c?.themeColor ?? null
    const m = c?.themeMode
    if (m === "light" || m === "dark" || m === "auto") initialMode = m
    logoUrl = c?.logoUrl ?? null
  }
  if (tenant) {
    brandName = (tenant as { name: string | null }).name ?? null
  }

  let hadPromo = false
  let promoPlanGranted: string | null = null
  if (redemption) {
    hadPromo = true
    promoPlanGranted = (redemption as any).promoCode?.planGranted ?? null
  }

  if (sub) {
    bannerData = deriveBannerState({
      plan: sub.plan ?? "STARTER",
      status: sub.status ?? null,
      currentPeriodEnd: sub.currentPeriodEnd ?? null,
      paymentProvider: sub.paymentProvider ?? null,
      hadPromo,
      promoPlan: promoPlanGranted,
    })
  }

  const aiEnabled = hasFeature(plan as any, "feature:ai_assistant")

  // Tour completo: SÓLO la primera vez (cuando tourCompletedAt es null).
  // Para upgrades de plan ya no usamos el tour entero — eso era invasivo —
  // sino el UpgradeWelcomeModal con confetti, que es mucho más liviano.
  const lastSeen = userRow?.lastWelcomedPlan ?? null
  const lastRank = lastSeen ? PLAN_RANK[lastSeen as keyof typeof PLAN_RANK] ?? -1 : -1
  const currentRank = PLAN_RANK[plan as keyof typeof PLAN_RANK] ?? 0
  const upgraded = lastSeen && currentRank > lastRank
  const showTour = !userRow?.tourCompletedAt
  const showUpgradeWelcome = upgraded && !!userRow?.tourCompletedAt
  const upgradedFrom = upgraded ? (lastSeen as any) : null

  return (
    <ThemeProvider initialAccent={initialAccent} initialMode={initialMode}>
      <SurfaceThemeProvider>
        <ConfirmProvider>
          <div suppressHydrationWarning className="flex h-screen app-surface overflow-hidden">
            <Sidebar user={session.user} plan={plan as any} logoUrl={logoUrl} brandName={brandName} />
            <div className="flex-1 flex flex-col overflow-hidden min-w-0 relative z-10">
              <Header user={session.user} plan={plan as any} />
              <main className="flex-1 overflow-auto">
                <OfflineGlobalBanner />
                <SubscriptionStatusBanner {...bannerData} />
                <InstallPromoBanner />
                <div className="p-4 lg:p-6">{children}</div>
              </main>
            </div>
            {aiEnabled && <AssistantWidget plan={plan as any} />}
            <SupportWidget />
            <InstallPrompt />
            <OfflineSeeder />
            <OnlineReconnect />
            {showTour && <TourOverlay plan={plan as any} upgradedFrom={upgradedFrom} />}
            {showUpgradeWelcome && upgradedFrom && (
              <UpgradeWelcomeModal from={upgradedFrom} to={plan as any} />
            )}
            {/* Bloqueo full-screen si trial vencido o pago en grace period agotado.
                El client decide si mostrarse según el pathname (no muestra
                en /configuracion/suscripcion para que el user pueda pagar). */}
            {isBlockingState(bannerData.kind) && (
              <SubscriptionGateClient
                reason={
                  bannerData.plan === "un plan pago" ? "trial-expired" : "payment-failed"
                }
                ownerEmail={session.user.email ?? null}
              />
            )}
          </div>
        </ConfirmProvider>
      </SurfaceThemeProvider>
    </ThemeProvider>
  )
}
