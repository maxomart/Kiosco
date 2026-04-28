/**
 * Guided tour definitions — used by components/shared/TourOverlay.tsx.
 *
 * Each step is either:
 *   - type "welcome": centered card, no spotlight. Uses welcome content
 *     specific to the user's plan (so paid users get their unlocks listed).
 *   - type "spotlight": darkens the page, cuts a hole around the element
 *     identified by `selector`, anchors a tooltip next to it.
 *
 * Steps with `requiresFeature` are skipped if the plan doesn't include it
 * (so a FREE user doesn't see a "look at the AI" step they can't actually
 * use).
 *
 * Selectors point at `data-tour="..."` attributes added in the relevant
 * components (Sidebar, Header). Using a data attribute (not a class) means
 * Tailwind/styling refactors don't accidentally break the tour.
 */
import type { Plan, PlanFeature } from "@/lib/utils"
import { hasFeature } from "@/lib/permissions"

export type TourStep =
  | {
      id: string
      type: "welcome"
    }
  | {
      id: string
      type: "spotlight"
      selector: string
      title: string
      body: string
      placement?: "top" | "bottom" | "left" | "right" | "auto"
      requiresFeature?: PlanFeature
      /** When set, the tour pushes this URL before showing the step.
       *  Lets the walkthrough actually take the user through the app
       *  (POS → Inventario → Caja → Reportes) instead of explaining
       *  everything from /inicio. */
      navigateTo?: string
    }

const BASE_STEPS: TourStep[] = [
  { id: "welcome", type: "welcome" },
  {
    id: "sidebar",
    type: "spotlight",
    selector: "[data-tour='sidebar']",
    title: "Tu mapa",
    body: "Acá tenés todo el menú: POS, inventario, caja, reportes y más. Cada sección lo que dice — sin secretos.",
    placement: "right",
  },
  {
    id: "pos",
    type: "spotlight",
    // Generic — when we navigate to /pos, we spotlight the search bar
    // (it's the focal point of the page). Falls back to the page main
    // if the data-tour isn't found.
    selector: "[data-tour='pos-search'], main",
    title: "Acá cobrás",
    body: "Buscás el producto, sumás al carrito, tap Cobrar. Acepta MODO, MP QR, débito, efectivo y más. Tarda menos que sacar el cambio.",
    placement: "auto",
    navigateTo: "/pos",
  },
  {
    id: "inventario",
    type: "spotlight",
    selector: "[data-tour='inventario-add'], main",
    title: "Acá cargás productos",
    body: "Uno por uno, escaneando códigos, o importando un Excel. La IA categoriza sola los que estén sin clasificar.",
    placement: "auto",
    navigateTo: "/inventario",
  },
  {
    id: "caja",
    type: "spotlight",
    selector: "[data-tour='caja-action'], main",
    title: "Caja del día",
    body: "Antes de vender abrís caja con el efectivo en mano. Al cerrar turno, la app cuadra sola y te marca diferencias si hubo.",
    placement: "auto",
    navigateTo: "/caja",
  },
  {
    id: "reportes",
    type: "spotlight",
    selector: "[data-tour='reportes-summary'], main",
    title: "Cómo te va",
    body: "Ventas, ingresos, top productos, comparativa con períodos anteriores. La IA te tira un brief en castellano sobre lo importante.",
    placement: "auto",
    navigateTo: "/reportes",
  },
  {
    id: "ai",
    type: "spotlight",
    selector: "[data-tour='ai-button']",
    title: "Asistente IA",
    body: "Le hacés preguntas tipo «¿qué se vendió ayer?» y te contesta con tus datos reales. Disponible en cualquier pantalla.",
    placement: "left",
    requiresFeature: "feature:ai_assistant",
  },
  {
    id: "header",
    type: "spotlight",
    selector: "[data-tour='header']",
    title: "Tu cuenta y plan",
    body: "Acá ves tu plan activo, soporte y tu perfil. Para cambiar de plan o invitar empleados, andá a Configuración.",
    placement: "bottom",
  },
]

export function tourStepsFor(plan: Plan): TourStep[] {
  return BASE_STEPS.filter((s) => {
    if (s.type !== "spotlight") return true
    if (!s.requiresFeature) return true
    return hasFeature(plan, s.requiresFeature)
  })
}

/* ============================================================================
   Welcome content per plan — shown in the centered "welcome" step.
   ========================================================================== */

export interface WelcomeContent {
  title: string
  subtitle: string
  bullets: string[]
}

const PLAN_WELCOME: Record<Plan, WelcomeContent> = {
  FREE: {
    title: "Bienvenido a Orvex",
    subtitle: "Empezamos. Esto es lo que ya tenés activo en el plan Gratis:",
    bullets: [
      "Hasta 50 productos y 200 ventas/mes",
      "POS con códigos de barras y todos los métodos de pago locales",
      "Caja diaria con apertura y cierre",
      "Reportes del día y asistente IA con 5 mensajes/día",
    ],
  },
  STARTER: {
    title: "Bienvenido a Básico",
    subtitle: "Tu plan ya está activo. Esto es lo que desbloqueaste:",
    bullets: [
      "Hasta 500 productos y 2.000 ventas/mes",
      "Hasta 3 usuarios con roles separados",
      "Importar/exportar Excel + alertas de stock por WhatsApp",
      "Reportes avanzados con gráficos y top productos",
      "Asistente IA con 50 mensajes/día",
    ],
  },
  PROFESSIONAL: {
    title: "Bienvenido a Profesional",
    subtitle: "Tu plan ya está activo. Esto es lo que desbloqueaste:",
    bullets: [
      "Hasta 5.000 productos y ventas ilimitadas",
      "Hasta 10 usuarios con multi-caja simultánea",
      "Programa de fidelidad y clientes con cuenta corriente",
      "WhatsApp con resumen diario automático",
      "Asistente IA con 500 mensajes/día e insights personalizados",
    ],
  },
  BUSINESS: {
    title: "Bienvenido a Negocio",
    subtitle: "Tu plan ya está activo. Esto es lo que desbloqueaste:",
    bullets: [
      "Todo ilimitado: productos, ventas, usuarios",
      "Multi-tienda con reportes consolidados",
      "API access para integraciones externas",
      "Asistente IA con 5.000 mensajes/día",
      "Soporte prioritario por WhatsApp directo",
    ],
  },
  ENTERPRISE: {
    title: "Bienvenido a Enterprise",
    subtitle: "Plan custom activo. Tu equipo de soporte ya tiene el contexto.",
    bullets: [
      "Todo de Business sin límites",
      "SLA y onboarding dedicado",
      "Integraciones a medida",
    ],
  },
}

export function welcomeContentFor(plan: Plan): WelcomeContent {
  return PLAN_WELCOME[plan] ?? PLAN_WELCOME.FREE
}

/* ============================================================================
   Plan upgrade — what's new vs the previous plan. Shown in the welcome
   modal when a user just upgraded. Listed are the additive unlocks only.
   ========================================================================== */

export const PLAN_RANK: Record<Plan, number> = {
  FREE: 0,
  STARTER: 1,
  PROFESSIONAL: 2,
  BUSINESS: 3,
  ENTERPRISE: 4,
}

export interface UpgradeContent {
  title: string
  bullets: string[]
}

export function upgradeContentFor(from: Plan, to: Plan): UpgradeContent | null {
  if (PLAN_RANK[to] <= PLAN_RANK[from]) return null
  const fromContent = PLAN_WELCOME[from]
  const toContent = PLAN_WELCOME[to]
  // Bullets in `to` that aren't in `from` — naive but works for our list.
  const fromSet = new Set(fromContent.bullets.map((b) => b.toLowerCase()))
  const newOnes = toContent.bullets.filter((b) => !fromSet.has(b.toLowerCase()))
  return {
    title: `Pasaste a ${planLabel(to)}`,
    bullets: newOnes.length > 0 ? newOnes : toContent.bullets,
  }
}

function planLabel(plan: Plan): string {
  switch (plan) {
    case "FREE":
      return "Gratis"
    case "STARTER":
      return "Básico"
    case "PROFESSIONAL":
      return "Profesional"
    case "BUSINESS":
      return "Negocio"
    case "ENTERPRISE":
      return "Enterprise"
  }
}
