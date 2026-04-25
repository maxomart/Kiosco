import Link from "next/link"
import { Check, X, Sparkles, ArrowRight, Zap, Crown, Building2 } from "lucide-react"
import { OrvexLogo } from "@/components/shared/OrvexLogo"

// Native ARS pricing — primary source of truth. USD shown as secondary reference.
// Edit lib/utils.ts → PLAN_PRICES_ARS for the canonical numbers.
import { PLAN_PRICES_ARS, PLAN_PRICES_USD } from "@/lib/utils"

const PLANS = [
  {
    id: "FREE",
    name: "Gratis",
    tagline: "Para arrancar y conocer la herramienta",
    priceUSD: 0,
    priceARS: 0,
    cta: "Empezar gratis",
    href: "/signup",
    icon: Sparkles,
    accent: "border-gray-700",
    highlight: null as string | null,
    features: [
      "Hasta 50 productos",
      "Hasta 200 ventas/mes",
      "1 usuario",
      "POS y caja básicos",
      "Hasta 25 clientes",
      "Hasta 3 categorías",
      "Reportes del día (KPIs básicos)",
      "Asistente IA — 5 mensajes/día",
      "Historial de 7 días",
    ],
    notIncluded: [
      "Proveedores",
      "Gastos",
      "Cargas / recargas",
      "WhatsApp alertas",
      "Reportes avanzados (gráficos, top productos)",
      "Importar/exportar CSV",
      "Logo personalizado",
      "Programa de fidelidad",
    ],
  },
  {
    id: "STARTER",
    name: "Starter",
    tagline: "Para tu primer kiosco / almacén",
    priceUSD: PLAN_PRICES_USD.STARTER,
    priceARS: PLAN_PRICES_ARS.STARTER,
    cta: "Empezar prueba",
    href: "/signup",
    icon: Zap,
    accent: "border-blue-500 ring-2 ring-blue-500/30",
    highlight: "Más elegido",
    features: [
      "Hasta 500 productos",
      "Hasta 2.000 ventas/mes",
      "3 usuarios",
      "Clientes y categorías ilimitados",
      "Proveedores ilimitados",
      "Gastos y cargas",
      "Historial de 90 días",
      "Reportes avanzados (gráficos + top productos + métodos de pago)",
      "WhatsApp — alertas de stock bajo",
      "Importar / exportar CSV",
      "Logo personalizado",
      "Asistente IA — 50 mensajes/día",
    ],
    notIncluded: [
      "Programa de fidelidad",
      "Multi-caja simultánea",
      "API access",
      "Soporte prioritario",
    ],
  },
  {
    id: "PROFESSIONAL",
    name: "Professional",
    tagline: "Para crecer y profesionalizarte",
    priceUSD: PLAN_PRICES_USD.PROFESSIONAL,
    priceARS: PLAN_PRICES_ARS.PROFESSIONAL,
    cta: "Empezar prueba",
    href: "/signup",
    icon: Crown,
    accent: "border-violet-700",
    highlight: null as string | null,
    features: [
      "Hasta 5.000 productos",
      "Ventas ilimitadas",
      "10 usuarios",
      "Todo lo de Starter, más:",
      "Programa de fidelidad (puntos)",
      "Multi-caja simultánea",
      "Historial de 1 año",
      "WhatsApp — resumen diario automático",
      "Asistente IA — 500 mensajes/día",
      "Soporte prioritario por email (24h)",
    ],
    notIncluded: [
      "API access",
      "Multi-tienda",
      "Soporte por WhatsApp",
    ],
  },
  {
    id: "BUSINESS",
    name: "Business",
    tagline: "Para cadenas y operaciones grandes",
    priceUSD: PLAN_PRICES_USD.BUSINESS,
    priceARS: PLAN_PRICES_ARS.BUSINESS,
    cta: "Empezar prueba",
    href: "/signup",
    icon: Building2,
    accent: "border-amber-700",
    highlight: null as string | null,
    features: [
      "Productos y ventas ilimitados",
      "Usuarios ilimitados",
      "Todo lo de Professional, más:",
      "Multi-tienda (varias sucursales)",
      "API access",
      "Historial ilimitado",
      "Asistente IA — 5.000 mensajes/día",
      "Soporte prioritario por WhatsApp",
    ],
    notIncluded: [],
  },
]

const COMPARISON: { section: string; rows: [string, ...(string | boolean)[]][] }[] = [
  { section: "Inventario", rows: [
    ["Productos", "50", "500", "5.000", "Ilimitados"],
    ["Categorías", "3", "Ilimitadas", "Ilimitadas", "Ilimitadas"],
    ["Importar / exportar CSV", false, true, true, true],
    ["Logo personalizado", false, true, true, true],
  ]},
  { section: "Ventas y POS", rows: [
    ["Ventas por mes", "200", "2.000", "Ilimitadas", "Ilimitadas"],
    ["Caja", true, true, true, true],
    ["Multi-caja simultánea", false, false, true, true],
    ["Métodos de pago argentinos", true, true, true, true],
    ["Historial de ventas", "7 días", "90 días", "1 año", "Ilimitado"],
  ]},
  { section: "Clientes y proveedores", rows: [
    ["Clientes", "25", "Ilimitados", "Ilimitados", "Ilimitados"],
    ["Proveedores", false, true, true, true],
    ["Gastos", false, true, true, true],
    ["Cargas / recargas", false, true, true, true],
    ["Programa de fidelidad", false, false, true, true],
  ]},
  { section: "Reportes e IA", rows: [
    ["KPIs del día", true, true, true, true],
    ["Gráficos y top productos", false, true, true, true],
    ["Comparativas históricas", false, false, true, true],
    ["Asistente IA (mensajes/día)", "5", "50", "500", "5.000"],
    ["Recomendaciones automáticas", true, true, true, true],
  ]},
  { section: "Notificaciones", rows: [
    ["Notificaciones in-app", true, true, true, true],
    ["WhatsApp — stock bajo", false, true, true, true],
    ["WhatsApp — resumen diario", false, false, true, true],
  ]},
  { section: "Equipo y soporte", rows: [
    ["Usuarios", "1", "3", "10", "Ilimitados"],
    ["Multi-tienda", false, false, false, true],
    ["API access", false, false, false, true],
    ["Soporte", "Comunidad", "Email 48h", "Email 24h", "WhatsApp directo"],
  ]},
]

const FAQ = [
  {
    q: "¿Puedo cambiar de plan en cualquier momento?",
    a: "Sí. Subís o bajás de plan cuando quieras desde Configuración → Suscripción. El cambio se prorratea automáticamente.",
  },
  {
    q: "¿Hay periodo de prueba?",
    a: "Sí, todos los planes pagos incluyen 7 días de prueba sin tarjeta. Si te gusta, seguís; si no, cancelás sin cargo.",
  },
  {
    q: "¿Qué pasa con mis datos si cancelo?",
    a: "Tu cuenta vuelve al plan Gratis automáticamente. Conservás todos tus datos pero con los límites del plan Free (50 productos, 7 días de historial). Podés exportar todo antes vía CSV en cualquier plan pago.",
  },
  {
    q: "¿Aceptan facturas A?",
    a: "Sí, emitimos factura A o B según corresponda. Próximamente integración directa con AFIP para emisión electrónica desde el POS.",
  },
  {
    q: "¿El precio es en pesos o en dólares?",
    a: "Los precios son en pesos argentinos. Cobramos por MercadoPago (cualquier tarjeta + dinero en cuenta MP) o por Stripe (tarjeta internacional). Sin cargos ocultos. Revisamos los precios cada 6 meses según inflación.",
  },
]

function formatARS(n: number) {
  return new Intl.NumberFormat("es-AR").format(n)
}

function CheckIcon() {
  return <Check className="w-4 h-4 text-emerald-400" />
}
function XIcon() {
  return <X className="w-4 h-4 text-gray-700" />
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-gray-950/85 backdrop-blur-xl border-b border-gray-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 min-w-0">
            <OrvexLogo size={32} className="flex-shrink-0" gradientId="pricing-nav-logo" />
            <span className="font-bold text-lg truncate">Orvex</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <Link href="/login" className="text-sm text-gray-300 hover:text-white px-2 py-1.5">Ingresar</Link>
            <Link href="/signup" className="px-3 sm:px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-400 hover:to-violet-400 text-white text-sm font-medium whitespace-nowrap shadow-lg shadow-blue-900/30 transition-colors">
              Empezar gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-12 sm:pt-20 pb-10 sm:pb-12 px-4 sm:px-6">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/15 via-transparent to-violet-900/10 pointer-events-none" />
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs mb-5">
            <Sparkles size={12} /> Precios en pesos · Pagás con MercadoPago o tarjeta
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold tracking-tight mb-4 sm:mb-5">
            Planes para cada etapa <br className="hidden md:block" />
            de tu negocio
          </h1>
          <p className="text-base sm:text-lg text-gray-400 max-w-2xl mx-auto px-2">
            Empezá gratis. Sin tarjeta. Crecé cuando estés listo. Cancelás cuando quieras.
          </p>
        </div>
      </section>

      {/* Plan cards */}
      <section className="px-4 sm:px-6 pb-16 sm:pb-20">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {PLANS.map((plan) => {
            const Icon = plan.icon
            return (
              <div
                key={plan.id}
                className={`relative bg-gray-900 rounded-2xl p-6 border ${plan.accent} flex flex-col`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-blue-500 to-violet-500 text-white text-xs font-semibold shadow-lg shadow-blue-900/40 whitespace-nowrap">
                    {plan.highlight}
                  </div>
                )}
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-blue-400" />
                  </div>
                  <h3 className="font-bold text-lg truncate">{plan.name}</h3>
                </div>
                <p className="text-sm text-gray-500 mb-5 min-h-[2.5rem]">{plan.tagline}</p>

                <div className="mb-5">
                  {plan.priceARS === 0 ? (
                    <p className="text-3xl font-bold">Gratis</p>
                  ) : (
                    <>
                      <p className="text-3xl font-bold">
                        ${formatARS(plan.priceARS)}
                        <span className="text-sm font-normal text-gray-500"> ARS/mes</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        ≈ USD {plan.priceUSD} · Sin IVA · Cancelás cuando quieras
                      </p>
                    </>
                  )}
                </div>

                <Link
                  href={plan.href}
                  className={`flex items-center justify-center gap-2 w-full min-h-[44px] py-2.5 rounded-xl font-semibold text-sm transition mb-6 ${
                    plan.id === "STARTER"
                      ? "bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-400 hover:to-violet-400 text-white shadow-lg shadow-blue-900/30"
                      : "bg-gray-800 hover:bg-gray-700 text-gray-100"
                  }`}
                >
                  {plan.cta} <ArrowRight size={14} />
                </Link>

                <ul className="space-y-2.5 text-sm flex-1">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-300 leading-snug">{f}</span>
                    </li>
                  ))}
                  {plan.notIncluded.map((f, i) => (
                    <li key={`x-${i}`} className="flex items-start gap-2 opacity-60">
                      <X className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-500 leading-snug">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </section>

      {/* Comparison table */}
      <section className="px-4 sm:px-6 pb-16 sm:pb-20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold mb-2 text-center">Comparativa completa</h2>
          <p className="text-gray-400 text-center mb-3 text-sm sm:text-base">Todo lo que tenés en cada plan, lado a lado</p>
          {/* Scroll hint on mobile only — disappears once scrolled */}
          <p className="lg:hidden text-center text-xs text-blue-300/80 mb-3 flex items-center justify-center gap-1">
            <ArrowRight size={12} className="animate-pulse" /> Deslizá para ver todos los planes
          </p>

          <div className="relative bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            {/* Edge fade hints on mobile so users know there's more content sideways */}
            <div className="lg:hidden pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-gray-900 to-transparent z-20" aria-hidden />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-900/95 backdrop-blur-sm z-10">
                  <tr className="border-b border-gray-800">
                    <th className="text-left p-3 sm:p-4 font-medium text-gray-400 min-w-[160px] sm:min-w-[220px] sticky left-0 bg-gray-900/95 backdrop-blur-sm z-10">Función</th>
                    {PLANS.map((p) => (
                      <th key={p.id} className="text-center p-3 sm:p-4 font-semibold text-white min-w-[110px] sm:min-w-[120px]">
                        {p.name}
                        {p.id === "STARTER" && (
                          <span className="block mt-0.5 text-[10px] font-normal text-blue-400 uppercase tracking-wide">
                            Más elegido
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((section) => (
                    <>
                      <tr key={`s-${section.section}`} className="bg-gray-800/30">
                        <td colSpan={5} className="px-3 sm:px-4 py-2 text-xs font-semibold uppercase tracking-wide text-blue-400 sticky left-0 bg-gray-900">
                          {section.section}
                        </td>
                      </tr>
                      {section.rows.map(([label, ...vals], i) => (
                        <tr key={`${section.section}-${i}`} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition">
                          <td className="p-3 text-gray-300 sticky left-0 bg-gray-900 text-xs sm:text-sm">{label as string}</td>
                          {vals.map((v, j) => (
                            <td key={j} className="p-3 text-center">
                              {typeof v === "boolean" ? (
                                <span className="inline-flex justify-center">
                                  {v ? <CheckIcon /> : <XIcon />}
                                </span>
                              ) : (
                                <span className="text-gray-200 text-xs sm:text-sm">{v}</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 sm:px-6 pb-16 sm:pb-24">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-10 text-center">Preguntas frecuentes</h2>
          <div className="space-y-3">
            {FAQ.map((f) => (
              <details
                key={f.q}
                className="group bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-5 open:border-gray-700 transition"
              >
                <summary className="font-semibold cursor-pointer flex items-center justify-between gap-3 text-gray-100 list-none text-sm sm:text-base">
                  <span className="flex-1 min-w-0">{f.q}</span>
                  <span className="text-blue-400 text-xl group-open:rotate-45 transition-transform flex-shrink-0">+</span>
                </summary>
                <p className="mt-3 text-gray-400 text-sm leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA footer */}
      <section className="px-4 sm:px-6 pb-16 sm:pb-20">
        <div className="max-w-4xl mx-auto bg-gradient-to-br from-blue-900/40 to-violet-900/30 rounded-3xl p-6 sm:p-10 text-center border border-blue-700/30">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3">¿Listo para empezar?</h2>
          <p className="text-gray-300 mb-6 sm:mb-7 max-w-xl mx-auto text-sm sm:text-base">
            Creá tu cuenta gratis ahora. Sin tarjeta de crédito. 7 días de prueba en planes pagos.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 min-h-[48px] px-6 sm:px-7 py-3.5 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-400 hover:to-violet-400 text-white font-semibold shadow-lg shadow-blue-900/40 transition"
          >
            Empezar gratis <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-gray-900 py-8 text-center text-sm text-gray-600">
        &copy; {new Date().getFullYear()} Orvex — Todos los derechos reservados
      </footer>
    </div>
  )
}
