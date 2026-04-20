import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import Link from "next/link"
import {
  ShoppingBag,
  Zap,
  Shield,
  TrendingUp,
  Package,
  CreditCard,
  Users,
  BarChart3,
  CheckCircle,
  ArrowRight,
  Store,
  Smartphone,
  Sparkles,
} from "lucide-react"
import { PLAN_PRICES_ARS } from "@/lib/utils"

const fmtARS = (n: number) =>
  n === 0
    ? "Gratis"
    : new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 0,
      }).format(n)

export default async function LandingPage() {
  const session = await auth()
  if (session) redirect("/inicio")

  const plans = [
    {
      plan: "Gratis",
      price: PLAN_PRICES_ARS.FREE,
      desc: "Para probar y empezar",
      features: [
        "Hasta 50 productos",
        "1 usuario",
        "POS + caja básica",
        "200 ventas/mes",
      ],
      cta: "Empezar gratis",
      href: "/signup",
      highlight: false,
    },
    {
      plan: "Básico",
      price: PLAN_PRICES_ARS.STARTER,
      desc: "Para kioscos chicos",
      features: [
        "Hasta 500 productos",
        "3 usuarios",
        "Reportes completos",
        "WhatsApp alertas de stock",
      ],
      cta: "Probar 14 días",
      href: "/signup?plan=STARTER",
      highlight: false,
    },
    {
      plan: "Profesional",
      price: PLAN_PRICES_ARS.PROFESSIONAL,
      desc: "El más elegido",
      features: [
        "5.000 productos",
        "10 usuarios",
        "Clientes + fidelidad",
        "Multi-caja simultánea",
        "IA 500 mensajes/día",
      ],
      cta: "Probar 14 días",
      href: "/signup?plan=PROFESSIONAL",
      highlight: true,
    },
    {
      plan: "Negocio",
      price: PLAN_PRICES_ARS.BUSINESS,
      desc: "Para cadenas",
      features: [
        "Todo ilimitado",
        "Usuarios ilimitados",
        "API access",
        "Multi-tienda",
        "Soporte por WhatsApp",
      ],
      cta: "Probar 14 días",
      href: "/signup?plan=BUSINESS",
      highlight: false,
    },
  ]

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden relative landing-root">
      {/* Global dotted depth pattern */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          maskImage:
            "radial-gradient(ellipse 80% 80% at 50% 30%, black 40%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 80% at 50% 30%, black 40%, transparent 75%)",
        }}
      />
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(1000px 500px at 50% -20%, rgba(139,92,246,0.10), transparent 60%)",
        }}
      />

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/60 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white text-black flex items-center justify-center">
              <ShoppingBag size={16} />
            </div>
            <span className="font-bold text-lg tracking-tight">RetailAR</span>
          </Link>
          <div className="hidden md:flex items-center gap-7 text-sm text-gray-400">
            <a href="#features" className="hover:text-white transition-colors">Funciones</a>
            <a href="#pricing" className="hover:text-white transition-colors">Precios</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-300 hover:text-white transition-colors">
              Ingresar
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 rounded-lg bg-white hover:bg-gray-200 text-black text-sm font-semibold transition-colors"
            >
              Empezar gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-36 pb-24 px-6">
        <div className="relative max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300 text-xs mb-6 backdrop-blur">
            <Sparkles size={12} /> El sistema de gestión para tu comercio en Argentina
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.05]">
            Manejá tu{" "}
            <span className="text-white">kiosco, farmacia o minisúper</span>
            <br className="hidden sm:block" />
            <span className="bg-gradient-to-br from-white via-white to-gray-500 bg-clip-text text-transparent">
              desde cualquier lugar.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            POS, inventario, caja, reportes y clientes. Todo en un solo lugar.
            Pensado para comercios argentinos, con métodos de pago locales y precios en pesos.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white hover:bg-gray-200 text-black font-semibold transition-all shadow-2xl shadow-white/10"
            >
              Empezar gratis <ArrowRight size={16} />
            </Link>
            <Link
              href="#pricing"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold transition-colors backdrop-blur"
            >
              Ver precios
            </Link>
          </div>
          <p className="text-gray-500 text-sm mt-5">
            Sin tarjeta · 14 días de prueba · Cancelás cuando quieras
          </p>
        </div>
      </section>

      {/* Social proof */}
      <section className="relative border-y border-white/5 bg-black/40 backdrop-blur py-10">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <Stat value="500+" label="Comercios activos" />
          <Stat value="1.2M+" label="Ventas procesadas" />
          <Stat value="99.9%" label="Uptime" />
          <Stat value="11" label="Métodos de pago" />
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
              Todo lo que tu negocio necesita
            </h2>
            <p className="text-gray-400 text-lg">
              Una sola herramienta reemplaza 5 sistemas diferentes
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: ShoppingBag,
                title: "POS rápido",
                desc: "Escaneá códigos de barras, buscá productos en milisegundos. Efectivo, Mercado Pago, MODO, Ualá, tarjetas.",
              },
              {
                icon: Package,
                title: "Inventario automático",
                desc: "Stock actualizado en tiempo real con cada venta. Alertas de stock bajo. Importá tu Excel en 30 segundos.",
              },
              {
                icon: CreditCard,
                title: "Caja registradora",
                desc: "Abrí y cerrá caja, controlá efectivo, detectá diferencias. Todo queda registrado con auditoría.",
              },
              {
                icon: BarChart3,
                title: "Reportes completos",
                desc: "Ganancia neta, margen por producto, top ventas, métodos de pago. Decidí en base a datos reales.",
              },
              {
                icon: Users,
                title: "Clientes + fidelidad",
                desc: "Base de clientes integrada. Programa de puntos configurable. Historial de compras por cliente.",
              },
              {
                icon: TrendingUp,
                title: "Gastos y cargas",
                desc: "Registrá egresos, cargas de mercadería, inversión por proveedor. Flujo de caja claro.",
              },
              {
                icon: Shield,
                title: "Multi-usuario seguro",
                desc: "Cada empleado con su cuenta y permisos. Sabé quién hizo qué. Auditoría completa.",
              },
              {
                icon: Smartphone,
                title: "Funciona en todo",
                desc: "Desde tu celular, tablet, notebook o PC. Sin instalar nada. Datos siempre sincronizados.",
              },
              {
                icon: Store,
                title: "Pensado para Argentina",
                desc: "Pesos argentinos, CUIT, métodos locales. Sin conversiones raras ni features que no usás.",
              },
            ].map((f, i) => (
              <div
                key={i}
                className="group relative p-6 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/25 hover:bg-white/[0.05] backdrop-blur transition-all duration-300"
              >
                <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 group-hover:bg-white group-hover:text-black transition-colors">
                  <f.icon size={20} />
                </div>
                <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="relative py-24 px-6 border-y border-white/5 bg-black/40">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4 tracking-tight">
              Para todo tipo de comercio
            </h2>
            <p className="text-gray-400 text-lg">
              Adaptado a la realidad de los negocios argentinos
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { emoji: "🏪", title: "Kioscos", desc: "Miles de productos chicos, alta rotación, ventas rápidas" },
              { emoji: "💊", title: "Farmacias", desc: "Inventario grande, clientes recurrentes, trazabilidad" },
              { emoji: "🥕", title: "Verdulerías", desc: "Precios por kg, productos variables, caja diaria" },
              { emoji: "🛒", title: "Minisúper", desc: "Múltiples categorías, empleados, control de stock" },
            ].map((u, i) => (
              <div
                key={i}
                className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 text-center hover:bg-white/[0.05] transition-colors"
              >
                <div className="text-4xl mb-3">{u.emoji}</div>
                <h3 className="font-semibold text-white mb-2">{u.title}</h3>
                <p className="text-gray-400 text-sm">{u.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
              Planes simples, sin sorpresas
            </h2>
            <p className="text-gray-400 text-lg">
              Precios en pesos argentinos. Empezá gratis. Crecé cuando lo necesites.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((p, i) => (
              <div
                key={i}
                className={`relative p-6 rounded-2xl border transition-all ${
                  p.highlight
                    ? "border-white bg-gradient-to-b from-white/10 to-white/[0.02] shadow-2xl shadow-white/10"
                    : "border-white/10 bg-white/[0.03] hover:border-white/25"
                }`}
              >
                {p.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white text-black text-[10px] font-bold tracking-wider">
                    MÁS POPULAR
                  </div>
                )}
                <h3 className="font-semibold text-white">{p.plan}</h3>
                <p className="text-gray-500 text-sm mt-1">{p.desc}</p>
                <div className="my-5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold tracking-tight tabular-nums">
                      {fmtARS(p.price)}
                    </span>
                    {p.price > 0 && <span className="text-gray-500 text-sm">/mes</span>}
                  </div>
                  {p.price > 0 && (
                    <p className="text-[11px] text-gray-600 mt-1">IVA incluido</p>
                  )}
                </div>
                <ul className="space-y-2 mb-6 min-h-[140px]">
                  {p.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-gray-300">
                      <CheckCircle size={14} className="text-white/80 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={p.href}
                  className={`block text-center py-2.5 rounded-lg font-semibold text-sm transition-colors ${
                    p.highlight
                      ? "bg-white hover:bg-gray-200 text-black"
                      : "bg-white/5 hover:bg-white/10 border border-white/10 text-white"
                  }`}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
          <p className="text-center text-gray-500 text-xs mt-6">
            Pagos recurrentes en pesos por Mercado Pago · También aceptamos tarjeta internacional por Stripe · Ahorrás 20% pagando anual
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative py-24 px-6 border-t border-white/5">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12 tracking-tight">
            Preguntas frecuentes
          </h2>
          <div className="space-y-3">
            {[
              {
                q: "¿Necesito instalar algo?",
                a: "No. RetailAR funciona 100% en el navegador. Entrás con tu usuario desde cualquier dispositivo con internet.",
              },
              {
                q: "¿Qué pasa si no tengo internet?",
                a: "Necesitás internet para sincronizar las ventas. Tenemos modo offline parcial en el POS que guarda las ventas localmente y las sube cuando volvés a tener conexión.",
              },
              {
                q: "¿Puedo importar mis productos existentes?",
                a: "Sí, desde un CSV o Excel. Te damos una plantilla descargable. Importación masiva disponible desde el plan Básico.",
              },
              {
                q: "¿Cómo cobro por Mercado Pago?",
                a: "Integramos con todas las plataformas argentinas. Podés registrar ventas por MP, MODO, Ualá, Cuenta DNI, Naranja X y más. Además, desde el plan Profesional podés cobrar con QR de MP directo desde el POS.",
              },
              {
                q: "¿Qué pasa con mis datos si cancelo?",
                a: "Podés exportar toda tu información en cualquier momento. Guardamos tus datos 30 días después de la cancelación por si querés volver.",
              },
              {
                q: "¿Hay permanencia mínima?",
                a: "Ninguna. Cancelás cuando quieras, sin penalidad. Los pagos son mensuales o anuales (con 20% de descuento).",
              },
            ].map((f, i) => (
              <details
                key={i}
                className="group bg-white/[0.03] rounded-xl border border-white/10 overflow-hidden open:border-white/25 transition-colors"
              >
                <summary className="p-4 cursor-pointer text-white font-medium list-none flex items-center justify-between">
                  {f.q}
                  <span className="text-gray-500 group-open:rotate-45 transition-transform text-xl">
                    +
                  </span>
                </summary>
                <div className="px-4 pb-4 text-gray-400 text-sm leading-relaxed">
                  {f.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-28 px-6">
        <div className="max-w-4xl mx-auto text-center rounded-3xl border border-white/10 p-12 bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur overflow-hidden relative">
          <div
            className="absolute inset-0 pointer-events-none opacity-50"
            style={{
              backgroundImage:
                "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
              backgroundSize: "18px 18px",
              maskImage:
                "radial-gradient(ellipse at center, black 40%, transparent 80%)",
            }}
          />
          <div className="relative">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
              Probalo gratis hoy
            </h2>
            <p className="text-gray-300 text-lg mb-8">
              Creás tu cuenta en 2 minutos. Sin tarjeta. Sin compromiso.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white hover:bg-gray-200 text-black font-bold transition-colors shadow-2xl"
            >
              Crear mi cuenta gratis <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-white/5 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-white text-black flex items-center justify-center">
              <ShoppingBag size={12} />
            </div>
            <span>RetailAR © {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#pricing" className="hover:text-white transition-colors">Precios</a>
            <Link href="/login" className="hover:text-white transition-colors">Ingresar</Link>
            <a href="mailto:soporte@retailar.com" className="hover:text-white transition-colors">Soporte</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
      <p className="text-gray-500 text-sm mt-1">{label}</p>
    </div>
  )
}
