"use client"

import { useMemo, useState } from "react"
import {
  Search,
  ChevronDown,
  LifeBuoy,
  ShoppingCart,
  Package,
  DollarSign,
  FileCheck2,
  BarChart3,
  Settings,
  Rocket,
} from "lucide-react"
import { openSupportWidget } from "@/components/shared/SupportWidget"

interface FaqItem {
  q: string
  a: string
}
interface FaqCategory {
  category: string
  icon: React.ElementType
  items: FaqItem[]
}

const HELP: FaqCategory[] = [
  {
    category: "Primeros pasos",
    icon: Rocket,
    items: [
      {
        q: "¿Por dónde empiezo?",
        a: "Primero cargá tus productos en Inventario (podés hacerlo a mano, importando un Excel o sacándole una foto a un ticket de tu proveedor con la IA). Después abrí la Caja del día y ya podés vender desde el POS.",
      },
      {
        q: "¿Necesito un equipo especial para usar Orvex?",
        a: "No. Funciona en cualquier celular, tablet o computadora con un navegador. Si querés, podés sumar un lector de código de barras USB y una impresora térmica, pero no son obligatorios — la cámara del celu también escanea códigos.",
      },
      {
        q: "¿Puedo instalar Orvex como una app?",
        a: "Sí. Desde el navegador te va a aparecer la opción de 'Instalar app' (o desde el menú del navegador). Queda como una app en tu pantalla de inicio y arranca más rápido.",
      },
    ],
  },
  {
    category: "Ventas y POS",
    icon: ShoppingCart,
    items: [
      {
        q: "¿Cómo hago una venta?",
        a: "Entrá al POS, buscá el producto por nombre o escaneá su código de barras, ajustá la cantidad, elegí el método de pago (efectivo, débito, crédito, MercadoPago, transferencia, etc.) y confirmá. El stock se descuenta solo y la caja se actualiza al toque.",
      },
      {
        q: "¿Qué pasa si se corta internet?",
        a: "El POS funciona offline: las ventas se guardan en el dispositivo y se sincronizan solas cuando vuelve la conexión. No perdés ninguna venta por un corte de wifi.",
      },
      {
        q: "¿Puedo vender por peso (kilo/gramo)?",
        a: "Sí. Marcá el producto como 'se vende por peso' en su ficha. En el POS, en lugar de cantidad te va a pedir el peso en kg con decimales y calcula el precio automático.",
      },
      {
        q: "¿Puedo anular o corregir una venta?",
        a: "Sí, desde la sección Ventas podés ver el detalle de cada venta y anularla. El stock se devuelve automáticamente al anular.",
      },
    ],
  },
  {
    category: "Inventario y precios",
    icon: Package,
    items: [
      {
        q: "¿Cómo cargo productos rápido?",
        a: "Tenés tres formas: a mano (el sistema te sugiere productos típicos con precios orientativos), importando un Excel de tu proveedor (la IA detecta las columnas sola), o sacándole una foto a un ticket de compra (la IA extrae los productos y precios).",
      },
      {
        q: "¿Cómo cambio precios?",
        a: "Entrá a la ficha del producto en Inventario y editá el precio. Queda actualizado en el POS al instante para todos los cajeros.",
      },
      {
        q: "¿Cómo registro mermas o roturas?",
        a: "Hacé un ajuste de stock manual en el producto con el motivo correspondiente (merma, rotura, etc.). Queda registrado con la fecha y el usuario, y después lo ves en los reportes.",
      },
      {
        q: "¿El sistema me avisa cuando se está por acabar un producto?",
        a: "Sí. Definí un stock mínimo por producto y la app te muestra alertas de stock bajo en el Inicio y en la campana de notificaciones.",
      },
    ],
  },
  {
    category: "Caja",
    icon: DollarSign,
    items: [
      {
        q: "¿Tengo que abrir la caja todos los días?",
        a: "Sí, conviene. Al abrir la caja registrás el monto inicial de efectivo. Todas las ventas del día quedan asociadas a esa sesión de caja.",
      },
      {
        q: "¿Qué pasa al cerrar la caja?",
        a: "Al cerrar, contás el efectivo real y el sistema te dice cuánto esperaba ver y la diferencia. Si tenés varios cajeros con turnos, cada uno cierra su sesión y queda el registro de quién vendió qué.",
      },
    ],
  },
  {
    category: "Facturación AFIP / ARCA",
    icon: FileCheck2,
    items: [
      {
        q: "¿Cómo conecto Orvex con AFIP?",
        a: "Andá a Configuración → AFIP y seguí el asistente guiado: genera el certificado, lo subís a ARCA, y validás. El sistema te va marcando qué falta en cada paso. La facturación electrónica está disponible en el plan Profesional.",
      },
      {
        q: "¿Cómo emito una factura?",
        a: "Al cobrar una venta podés emitir la factura A, B o C con CAE directo desde el POS. También podés activar la auto-factura para que se emita sola en cada venta.",
      },
      {
        q: "¿Cómo hago una nota de crédito?",
        a: "Desde el detalle de una venta facturada podés emitir una nota de crédito (total o parcial) o una nota de débito. Quedan registradas y podés ver el PDF con su QR.",
      },
    ],
  },
  {
    category: "Reportes",
    icon: BarChart3,
    items: [
      {
        q: "¿Qué reportes tengo?",
        a: "Ventas por día, por producto y por método de pago; productos más rentables; stock muerto (capital atrapado en mercadería que no rota); plan de compras sugerido; y el Libro IVA Ventas exportable.",
      },
      {
        q: "¿Puedo exportar el IVA para el contador?",
        a: "Sí. Desde Reportes podés exportar el resumen de IVA en CSV y el Libro IVA Ventas, listos para mandarle a tu contador.",
      },
    ],
  },
  {
    category: "Cuenta y planes",
    icon: Settings,
    items: [
      {
        q: "¿Cómo cambio de plan?",
        a: "Entrá a Configuración → Suscripción. Ahí ves la comparación de planes y podés cambiar al que necesites. Los planes pagos tienen 7 días de prueba sin cargar tarjeta.",
      },
      {
        q: "¿Cómo agrego un cajero o empleado?",
        a: "En Configuración → Usuarios podés invitar usuarios y asignarles un rol (cajero, administrador). Cada uno entra con su cuenta y queda el registro de qué hizo cada uno.",
      },
      {
        q: "¿Qué pasa si no pago o se vence la prueba?",
        a: "Tu cuenta pasa al plan Gratis con tus datos guardados. No perdés nada — podés volver a un plan pago cuando quieras.",
      },
    ],
  },
]

export default function AyudaPage() {
  const [query, setQuery] = useState("")
  const [openKey, setOpenKey] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return HELP
    return HELP.map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (it) =>
          it.q.toLowerCase().includes(q) || it.a.toLowerCase().includes(q)
      ),
    })).filter((cat) => cat.items.length > 0)
  }, [query])

  const totalResults = filtered.reduce((s, c) => s + c.items.length, 0)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-100 flex items-center gap-2">
          <LifeBuoy className="w-5 h-5 text-accent" /> Centro de ayuda
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Encontrá respuestas rápidas. Si no está lo que buscás, escribinos.
        </p>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscá tu duda… (ej: factura, stock, caja)"
          className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-accent/60"
        />
      </div>

      {query.trim() && (
        <p className="text-xs text-gray-500">
          {totalResults === 0
            ? "No encontramos nada con esa búsqueda."
            : `${totalResults} resultado${totalResults === 1 ? "" : "s"}`}
        </p>
      )}

      {/* Categorías */}
      <div className="space-y-5">
        {filtered.map((cat) => {
          const Icon = cat.icon
          return (
            <div key={cat.category}>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5" /> {cat.category}
              </h2>
              <div className="space-y-2">
                {cat.items.map((it) => {
                  const key = `${cat.category}-${it.q}`
                  const open = openKey === key
                  return (
                    <div
                      key={key}
                      className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenKey(open ? null : key)}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
                      >
                        <span className="text-sm text-gray-100 font-medium">{it.q}</span>
                        <ChevronDown
                          className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
                        />
                      </button>
                      {open && (
                        <p className="px-4 pb-3.5 text-sm text-gray-400 leading-relaxed">
                          {it.a}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* CTA a soporte */}
      <div className="bg-accent/10 border border-accent/30 rounded-xl p-5 text-center">
        <p className="text-sm text-gray-100 font-medium">
          ¿No encontraste lo que buscabas?
        </p>
        <p className="text-xs text-gray-400 mt-0.5 mb-3">
          Escribinos y te respondemos. La IA contesta al toque y, si hace falta, lo ve una persona.
        </p>
        <button
          type="button"
          onClick={() => openSupportWidget()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-accent-foreground text-sm font-semibold transition-colors"
        >
          <LifeBuoy className="w-4 h-4" /> Abrir una consulta
        </button>
      </div>
    </div>
  )
}
