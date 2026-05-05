import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { PLAN_PRICES_ARS, PLAN_LABELS_AR } from "@/lib/utils"
import { db } from "@/lib/db"
import LandingClient from "./_landing/LandingClient"

interface ActivePromo {
  code: string
  planGranted: keyof typeof PLAN_LABELS_AR
  daysGranted: number
  remaining: number
  maxUses: number
}

async function resolvePromo(codeParam: string | undefined): Promise<ActivePromo | null> {
  if (!codeParam) return null
  const code = codeParam.trim().toLowerCase()
  if (!code || code.length > 64) return null
  try {
    const promo = await db.promoCode.findUnique({
      where: { code },
      select: {
        code: true,
        planGranted: true,
        daysGranted: true,
        maxUses: true,
        usedCount: true,
        active: true,
        expiresAt: true,
      },
    })
    if (!promo || !promo.active) return null
    if (promo.expiresAt && promo.expiresAt < new Date()) return null
    const remaining = promo.maxUses - promo.usedCount
    if (remaining <= 0) return null
    return {
      code: promo.code,
      planGranted: promo.planGranted as keyof typeof PLAN_LABELS_AR,
      daysGranted: promo.daysGranted,
      remaining,
      maxUses: promo.maxUses,
    }
  } catch {
    return null
  }
}

function buildSignupHref(plan: string | undefined, promoCode?: string): string {
  const qs = new URLSearchParams()
  if (plan) qs.set("plan", plan)
  if (promoCode) qs.set("promo", promoCode)
  const s = qs.toString()
  return s ? `/signup?${s}` : "/signup"
}

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ promo?: string | string[] }>
}) {
  const session = await auth()
  if (session) redirect("/inicio")

  const sp = await searchParams
  const promoParam = Array.isArray(sp.promo) ? sp.promo[0] : sp.promo
  const activePromo = await resolvePromo(promoParam)
  const promoCode = activePromo?.code

  const freeHref = buildSignupHref(undefined, promoCode)
  const starterHref = buildSignupHref("STARTER", promoCode)
  const professionalHref = buildSignupHref("PROFESSIONAL", promoCode)

  const plans = [
    {
      plan: "Gratis",
      price: 0,
      desc: "Para arrancar sin tarjeta",
      features: [
        "100 productos · 1 usuario",
        "Hasta 50 ventas por mes",
        "POS + inventario + caja",
        "Reportes de los últimos 7 días",
        "POS offline-first",
      ],
      cta: "Empezar gratis",
      href: freeHref,
      highlight: false,
    },
    {
      plan: "Básico",
      price: PLAN_PRICES_ARS.STARTER,
      desc: "Tu marca + más espacio",
      features: [
        "1.000 productos · 3 usuarios",
        "200 clientes · 50 proveedores",
        "Logo y tema con tu color",
        "Importar / exportar Excel",
        "Etiquetas con código de barras",
        "History ilimitado",
      ],
      cta: "Probar 7 días",
      href: starterHref,
      highlight: true,
    },
    {
      plan: "Profesional",
      price: PLAN_PRICES_ARS.PROFESSIONAL,
      desc: "Todo lo cool — el más completo",
      features: [
        "5.000 productos · 10 usuarios",
        "IA predictiva y chatbot integrado",
        "Pedidos a proveedor con IA",
        "Loyalty · Multi-caja simultánea",
        "Reportes con comparaciones IA",
        "Soporte prioritario",
        "AFIP — 500 facturas/mes",
      ],
      cta:
        activePromo && activePromo.planGranted === "PROFESSIONAL"
          ? "Reclamar promo"
          : "Probar 7 días",
      href: professionalHref,
      highlight: false,
    },
  ]

  const promoForClient = activePromo
    ? {
        code: activePromo.code,
        remaining: activePromo.remaining,
        maxUses: activePromo.maxUses,
        daysGranted: activePromo.daysGranted,
        planLabel: PLAN_LABELS_AR[activePromo.planGranted],
      }
    : null

  return (
    <LandingClient
      plans={plans}
      activePromo={promoForClient}
      freeHref={freeHref}
      professionalHref={professionalHref}
      promoCode={promoCode}
    />
  )
}
