import Link from "next/link"
import { CheckCircle, X, ArrowLeft, Zap, Crown, Building2, Sparkles } from "lucide-react"

const PLANS = [
  {
    id: "FREE", name: "Gratis", price: 0, desc: "Ideal para probar el sistema",
    features: { products: "500", users: "1", reports: false, imports: false, clients: false, api: false, support: "Comunidad" },
    highlight: false,
  },
  {
    id: "STARTER", name: "Starter", price: 25, desc: "Para kioscos y comercios chicos",
    features: { products: "5.000", users: "2", reports: true, imports: false, clients: "básico", api: false, support: "Email" },
    highlight: false,
  },
  {
    id: "PROFESSIONAL", name: "Professional", price: 60, desc: "El plan más elegido",
    features: { products: "Ilimitados", users: "5", reports: true, imports: true, clients: "completo + fidelidad", api: false, support: "Email + chat" },
    highlight: true,
  },
  {
    id: "BUSINESS", name: "Business", price: 150, desc: "Para cadenas y franquicias",
    features: { products: "Ilimitados", users: "15", reports: true, imports: true, clients: "completo + fidelidad", api: true, support: "Prioritario" },
    highlight: false,
  },
]

const COMPARE_ROWS = [
  { label: "Productos", key: "products" },
  { label: "Usuarios", key: "users" },
  { label: "Reportes avanzados", key: "reports" },
  { label: "Importar/exportar masivo", key: "imports" },
  { label: "Clientes y fidelidad", key: "clients" },
  { label: "API acceso", key: "api" },
  { label: "Soporte", key: "support" },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <nav className="sticky top-0 z-50 bg-gray-950/80 backdrop-blur-xl border-b border-gray-800/50 px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft size={16} /> Volver
        </Link>
        <Link href="/signup" className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-colors">
          Empezar gratis
        </Link>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs mb-6">
            <Sparkles size={12} /> 14 días de prueba en todos los planes pagos
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-4">Precios simples</h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">Pagá solo por lo que usás. Cambiá de plan cuando quieras. Sin sorpresas.</p>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-20">
          {PLANS.map(p => (
            <div key={p.id}
              className={`relative p-6 rounded-2xl border-2 ${p.highlight ? "border-purple-500 bg-gradient-to-b from-purple-500/10 to-transparent" : "border-gray-800 bg-gray-900"}`}>
              {p.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-purple-600 text-white text-xs font-bold">MÁS POPULAR</div>
              )}
              <div className="flex items-center gap-2 mb-1">
                {p.id === "FREE" && <Zap size={16} className="text-gray-400" />}
                {p.id === "STARTER" && <Zap size={16} className="text-blue-400" />}
                {p.id === "PROFESSIONAL" && <Crown size={16} className="text-purple-400" />}
                {p.id === "BUSINESS" && <Building2 size={16} className="text-yellow-400" />}
                <h3 className="font-semibold">{p.name}</h3>
              </div>
              <p className="text-gray-500 text-sm">{p.desc}</p>
              <div className="my-5">
                {p.price === 0 ? (
                  <span className="text-4xl font-bold">Gratis</span>
                ) : (
                  <>
                    <span className="text-4xl font-bold">US${p.price}</span>
                    <span className="text-gray-500 text-sm">/mes</span>
                  </>
                )}
              </div>
              <Link href={p.id === "FREE" ? "/signup" : `/signup?plan=${p.id}`}
                className={`block text-center py-2.5 rounded-lg font-semibold text-sm transition-colors mb-4 ${
                  p.highlight ? "bg-purple-600 hover:bg-purple-700 text-white" : "bg-gray-800 hover:bg-gray-700 text-white"
                }`}>
                {p.price === 0 ? "Empezar gratis" : "Probar 14 días"}
              </Link>
              <ul className="space-y-1.5 text-xs text-gray-400">
                <li>{p.features.products} productos</li>
                <li>{p.features.users} usuarios</li>
                <li>{p.features.reports ? "Reportes avanzados" : "Reportes básicos"}</li>
                <li>{p.features.imports ? "Import/export masivo" : "—"}</li>
                <li>Soporte: {p.features.support}</li>
              </ul>
            </div>
          ))}
        </div>

        {/* Comparison table */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-xl font-semibold">Comparación de planes</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="p-4 text-left text-gray-400 font-medium"></th>
                  {PLANS.map(p => (
                    <th key={p.id} className={`p-4 font-semibold text-center ${p.highlight ? "text-purple-400" : "text-white"}`}>
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {COMPARE_ROWS.map(row => (
                  <tr key={row.key}>
                    <td className="p-4 text-gray-300">{row.label}</td>
                    {PLANS.map(p => {
                      const val = (p.features as any)[row.key]
                      return (
                        <td key={p.id} className="p-4 text-center">
                          {val === true ? <CheckCircle size={16} className="text-green-400 mx-auto" />
                            : val === false ? <X size={16} className="text-gray-600 mx-auto" />
                            : <span className="text-gray-300">{val}</span>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-20 max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">Preguntas sobre los planes</h2>
          <div className="space-y-3">
            {[
              { q: "¿Puedo cambiar de plan?", a: "Sí, cuando quieras. Los cambios son inmediatos y prorrateados." },
              { q: "¿Cómo se pagan los planes?", a: "Con tarjeta de crédito internacional vía Stripe. Pagos mensuales en USD." },
              { q: "¿Qué métodos de pago aceptan?", a: "Todas las tarjetas de crédito internacionales (Visa, Mastercard, Amex)." },
              { q: "¿El IVA está incluido?", a: "Los precios son en USD. Según tu situación fiscal puede aplicarse IVA adicional." },
              { q: "¿Ofrecen descuentos por pago anual?", a: "Sí, 20% off pagando el año completo. Contactanos a ventas@retailar.com." },
            ].map((f, i) => (
              <details key={i} className="group bg-gray-900 rounded-xl border border-gray-800">
                <summary className="p-4 cursor-pointer font-medium list-none flex items-center justify-between">
                  {f.q}
                  <span className="text-gray-500 group-open:rotate-45 transition-transform text-xl">+</span>
                </summary>
                <div className="px-4 pb-4 text-gray-400 text-sm">{f.a}</div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
