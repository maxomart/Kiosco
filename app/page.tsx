import Link from "next/link"
import { ShoppingBag, Zap, Shield, TrendingUp, Package, CreditCard, Users, BarChart3, CheckCircle, ArrowRight, Store, Smartphone, Clock } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-xl border-b border-gray-800/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <ShoppingBag size={16} className="text-white" />
            </div>
            <span className="font-bold text-lg">RetailAR</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-400">
            <a href="#features" className="hover:text-white transition-colors">Funciones</a>
            <a href="#pricing" className="hover:text-white transition-colors">Precios</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-gray-300 hover:text-white transition-colors">Ingresar</Link>
            <Link href="/signup" className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-colors">
              Empezar gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-6">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-pink-900/10 pointer-events-none" />
        <div className="absolute top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs mb-6">
            <Zap size={12} /> El sistema de gestión para tu negocio en Argentina
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            Manejá tu <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">kiosco, farmacia o minisúper</span> desde cualquier lugar
          </h1>
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10">
            POS, inventario, caja, reportes y clientes. Todo en un solo lugar. Diseñado para negocios argentinos,
            con todos los métodos de pago locales y precios en pesos.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/signup"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-all shadow-lg shadow-purple-600/30">
              Empezar gratis <ArrowRight size={16} />
            </Link>
            <Link href="#pricing"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-700 text-white font-semibold transition-colors">
              Ver precios
            </Link>
          </div>
          <p className="text-gray-500 text-sm mt-4">Sin tarjeta de crédito · 14 días de prueba · Cancelá cuando quieras</p>
        </div>
      </section>

      {/* Social proof row */}
      <section className="border-y border-gray-900 bg-gray-950/50 py-8">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div><p className="text-3xl font-bold text-white">500+</p><p className="text-gray-500 text-sm">Negocios</p></div>
          <div><p className="text-3xl font-bold text-white">1.2M+</p><p className="text-gray-500 text-sm">Ventas procesadas</p></div>
          <div><p className="text-3xl font-bold text-white">99.9%</p><p className="text-gray-500 text-sm">Uptime</p></div>
          <div><p className="text-3xl font-bold text-white">11</p><p className="text-gray-500 text-sm">Métodos de pago</p></div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Todo lo que tu negocio necesita</h2>
            <p className="text-gray-400 text-lg">Una sola herramienta reemplaza 5 sistemas diferentes</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: ShoppingBag, title: "POS rápido", desc: "Escaneá códigos de barras, buscá productos en milisegundos. Efectivo, Mercado Pago, MODO, Ualá, tarjetas." },
              { icon: Package, title: "Inventario automático", desc: "Stock actualizado en tiempo real con cada venta. Alertas de stock bajo. Importá tu Excel en 30 segundos." },
              { icon: CreditCard, title: "Caja registradora", desc: "Abrí y cerrá caja, controlá efectivo, detectá diferencias. Todo queda registrado con auditoría." },
              { icon: BarChart3, title: "Reportes completos", desc: "Ganancia neta, margen por producto, top ventas, métodos de pago. Decidí en base a datos reales." },
              { icon: Users, title: "Clientes + fidelidad", desc: "Base de clientes integrada. Programa de puntos configurable. Historial de compras por cliente." },
              { icon: TrendingUp, title: "Gastos y cargas", desc: "Registrá egresos, cargas de mercadería, inversión por proveedor. Flujo de caja claro." },
              { icon: Shield, title: "Multi-usuario seguro", desc: "Cada empleado con su cuenta y permisos. Sabé quién hizo qué. Auditoría completa." },
              { icon: Smartphone, title: "Funciona en todo", desc: "Desde tu celular, tablet, notebook o PC. Sin instalar nada. Datos siempre sincronizados." },
              { icon: Store, title: "Pensado para Argentina", desc: "Pesos argentinos, CUIT, métodos locales. Sin conversiones raras ni features que no usás." },
            ].map((f, i) => (
              <div key={i} className="group p-6 rounded-2xl bg-gray-900 border border-gray-800 hover:border-purple-500/40 transition-all">
                <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4 group-hover:bg-purple-500/20 transition-colors">
                  <f.icon size={20} className="text-purple-400" />
                </div>
                <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="py-24 px-6 bg-gradient-to-b from-gray-950 to-gray-900/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Para todo tipo de negocio</h2>
            <p className="text-gray-400 text-lg">Adaptado a la realidad de comercios argentinos</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { emoji: "🏪", title: "Kioscos", desc: "Mil productos chicos, alta rotación, ventas rápidas" },
              { emoji: "💊", title: "Farmacias", desc: "Inventario grande, clientes recurrentes, trazabilidad" },
              { emoji: "🥕", title: "Verdulerías", desc: "Precios por kg, productos variables, caja diaria" },
              { emoji: "🛒", title: "Minisúper", desc: "Múltiples categorías, empleados, control de stock" },
            ].map((u, i) => (
              <div key={i} className="p-6 rounded-2xl bg-gray-900 border border-gray-800 text-center">
                <div className="text-4xl mb-3">{u.emoji}</div>
                <h3 className="font-semibold text-white mb-2">{u.title}</h3>
                <p className="text-gray-500 text-sm">{u.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Planes simples, sin sorpresas</h2>
            <p className="text-gray-400 text-lg">Empezá gratis. Crecé cuando lo necesites.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { plan: "Gratis", price: "US$0", desc: "Para empezar", features: ["500 productos", "1 usuario", "POS + caja básico"], cta: "Empezar gratis", href: "/signup", highlight: false },
              { plan: "Starter", price: "US$25", desc: "Para kioscos pequeños", features: ["5.000 productos", "2 usuarios", "Reportes completos", "Soporte por email"], cta: "Probar 14 días", href: "/signup?plan=STARTER", highlight: false },
              { plan: "Professional", price: "US$60", desc: "El más elegido", features: ["Productos ilimitados", "5 usuarios", "Importar masivo", "Clientes + fidelidad", "Exportar CSV/Excel"], cta: "Probar 14 días", href: "/signup?plan=PROFESSIONAL", highlight: true },
              { plan: "Business", price: "US$150", desc: "Para cadenas", features: ["Todo ilimitado", "15 usuarios", "API acceso", "Soporte prioritario", "Múltiples sucursales"], cta: "Probar 14 días", href: "/signup?plan=BUSINESS", highlight: false },
            ].map((p, i) => (
              <div key={i} className={`relative p-6 rounded-2xl border-2 ${p.highlight ? "border-purple-500 bg-purple-500/5" : "border-gray-800 bg-gray-900"}`}>
                {p.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-purple-600 text-white text-xs font-bold">MÁS POPULAR</div>
                )}
                <h3 className="font-semibold text-white">{p.plan}</h3>
                <p className="text-gray-500 text-sm mt-1">{p.desc}</p>
                <div className="my-4">
                  <span className="text-4xl font-bold">{p.price}</span>
                  {p.price !== "US$0" && <span className="text-gray-500 text-sm">/mes</span>}
                </div>
                <ul className="space-y-2 mb-6">
                  {p.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-gray-300">
                      <CheckCircle size={14} className="text-green-400 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={p.href}
                  className={`block text-center py-2.5 rounded-lg font-semibold text-sm transition-colors ${
                    p.highlight ? "bg-purple-600 hover:bg-purple-700 text-white" : "bg-gray-800 hover:bg-gray-700 text-white"
                  }`}>
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 px-6 bg-gray-900/30">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12">Preguntas frecuentes</h2>
          <div className="space-y-3">
            {[
              { q: "¿Necesito instalar algo?", a: "No. RetailAR funciona 100% en el navegador. Entrás con tu usuario desde cualquier dispositivo con internet." },
              { q: "¿Qué pasa si no tengo internet?", a: "Necesitás internet para sincronizar las ventas. Estamos trabajando en modo offline para el plan Business." },
              { q: "¿Puedo importar mis productos existentes?", a: "Sí, desde un CSV o Excel. Te damos una plantilla descargable. Import masivo disponible desde el plan Professional." },
              { q: "¿Cómo cobro por Mercado Pago?", a: "Integramos con todas las plataformas argentinas. Podés registrar ventas por MP, MODO, Ualá, Cuenta DNI, Naranja X y más." },
              { q: "¿Qué pasa con mis datos si cancelo?", a: "Podés exportar toda tu información en cualquier momento. Guardamos tus datos 30 días después de la cancelación por si querés volver." },
              { q: "¿Hay permanencia mínima?", a: "Ninguna. Cancelás cuando quieras, sin penalidad. Los pagos son mensuales." },
            ].map((f, i) => (
              <details key={i} className="group bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                <summary className="p-4 cursor-pointer text-white font-medium list-none flex items-center justify-between">
                  {f.q}
                  <span className="text-gray-500 group-open:rotate-45 transition-transform text-xl">+</span>
                </summary>
                <div className="px-4 pb-4 text-gray-400 text-sm">{f.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-3xl border border-purple-500/30 p-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Probalo gratis hoy</h2>
          <p className="text-gray-300 text-lg mb-8">Configurás tu cuenta en 2 minutos. Sin tarjeta. Sin compromiso.</p>
          <Link href="/signup"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white hover:bg-gray-100 text-gray-950 font-bold transition-colors shadow-xl">
            Crear mi cuenta gratis <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-900 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <ShoppingBag size={12} className="text-white" />
            </div>
            <span>RetailAR © {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/pricing" className="hover:text-white transition-colors">Precios</Link>
            <Link href="/login" className="hover:text-white transition-colors">Ingresar</Link>
            <a href="mailto:soporte@retailar.com" className="hover:text-white transition-colors">Soporte</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
