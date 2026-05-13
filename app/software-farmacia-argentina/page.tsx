import type { Metadata } from "next"
import { LandingShell } from "@/components/landings/LandingShell"
import { JsonLd } from "@/components/seo/JsonLd"
import {
  organizationSchema,
  softwareApplicationSchema,
  breadcrumbSchema,
  faqPageSchema,
} from "@/lib/seo-schema"

export const metadata: Metadata = {
  title: "Software para Farmacia en Argentina | POS, Stock y AFIP | Orvex",
  description:
    "Software de gestión para farmacias chicas y barriales en Argentina. POS, control de stock, vencimientos, cuenta corriente, AFIP integrado y reportes con IA. Plan gratis para arrancar.",
  keywords: ["software farmacia, sistema farmacia argentina, POS farmacia, trazabilidad farmacia, gestión farmacia barrial"],
  alternates: { canonical: "https://cobraorvex.com/software-farmacia-argentina" },
  openGraph: {
    title: "Software para Farmacia en Argentina",
    description:
      "Para farmacias chicas que necesitan control de stock, vencimientos y AFIP sin contratar un sistema corporativo.",
    type: "website",
    locale: "es_AR",
    images: [{ url: "https://cobraorvex.com/api/og?title=Software+para+Farmacia&pill=Para+farmacias+chicas", width: 1200, height: 630, alt: "Orvex" }],
  },
}

const FAQ = [
  {
    question: "¿Sirve para farmacia con receta y obras sociales?",
    answer:
      "Orvex es ideal para la parte de venta libre y artículos OTC, perfumería, dermocosmética y productos generales de farmacia. NO está pensado para gestión de receta magistral ni convenios con obras sociales — para eso necesitás un sistema específico farmacéutico (Estructura Stock, Posnet farmacia, etc.). Muchas farmacias usan Orvex en paralelo con un sistema de obras sociales: Orvex para la caja general, el específico para los convenios.",
  },
  {
    question: "¿Controla vencimientos?",
    answer:
      "Sí. Cada producto puede tener fecha de vencimiento y el sistema te alerta cuando se acerca. Podés generar un reporte de productos por vencer en los próximos 30/60/90 días para liquidar antes de perder esa plata.",
  },
  {
    question: "¿Maneja cuenta corriente?",
    answer:
      "Sí. Cada cliente puede tener un límite de crédito y el sistema bloquea ventas si lo supera. Útil para vecinos habituales que pagan a fin de mes o quincena.",
  },
  {
    question: "¿Cuánto cuesta?",
    answer:
      "Plan Gratis sin tarjeta para arrancar (100 productos, 50 ventas/mes). Plan Básico $9.999 ARS/mes para farmacia chica (1.000 productos, 3 usuarios). Plan Profesional $24.900 ARS/mes para farmacia con AFIP integrado, multi-caja e IA predictiva.",
  },
]

export default function SoftwareFarmaciaPage() {
  return (
    <>
      <JsonLd
        data={[
          organizationSchema(),
          softwareApplicationSchema(),
          breadcrumbSchema([
            { name: "Inicio", url: "https://cobraorvex.com/" },
            { name: "Software para Farmacia", url: "https://cobraorvex.com/software-farmacia-argentina" },
          ]),
          faqPageSchema(FAQ),
        ]}
      />
      <LandingShell
        pillLabel="Para farmacias argentinas"
        title="Software para Farmacias chicas en Argentina"
        subtitle="Control de stock con vencimientos, cuenta corriente para clientes habituales, AFIP integrado y reportes claros. Sin sistema corporativo carísimo."
        highlights={[
          "Alertas de vencimiento",
          "Cuenta corriente con límite",
          "AFIP / ARCA integrado",
          "Hasta 5.000 productos",
        ]}
      >
        <h2>Las farmacias chicas no necesitan un sistema corporativo</h2>
        <p>
          Si tenés una farmacia barrial, perfumería con artículos farmacia o
          almacén con perfumería, los sistemas de cadena (los que cuestan
          $80.000 - $200.000 ARS/mes y necesitan instalación local) son matar
          un mosquito a cañonazos. Orvex es la opción para el 80% de las
          farmacias chicas que necesitan: <strong>control de stock con
          vencimientos</strong>, <strong>cuenta corriente para vecinos</strong>,
          <strong>AFIP integrado</strong> y <strong>reportes claros</strong>,
          sin pagar por features que nunca van a usar.
        </p>

        <h2>Lo que sí cubrimos</h2>

        <h3>Productos OTC, perfumería, dermocosmética</h3>
        <p>
          Cargá tu catálogo con códigos de barras EAN, precios, costos y stock
          actual. Si tenés Excel del distribuidor (Disprofarma, Drocien,
          Suizo Argentina, Monroe Americana), lo subís y la IA detecta las
          columnas sola. Soporta hasta 5.000 productos en el plan Profesional.
        </p>

        <h3>Vencimientos</h3>
        <p>
          Cada producto puede tener fecha de vencimiento. El sistema te tira
          alertas cuando un producto está por vencer en los próximos 30/60/90
          días para que lo pongas en oferta antes de tener que tirarlo o
          devolverlo al laboratorio. Si tenés muchos productos, esto solo te
          paga el plan en stock recuperado.
        </p>

        <h3>Cuenta corriente</h3>
        <p>
          La farmacia de barrio vive de la fiabilidad. El vecino que compra
          el remedio "anótalo y te lo pago el viernes" es real. Orvex te deja
          asignar límite de crédito por cliente, ver el saldo en tiempo real
          y bloquear ventas cuando se pasa del tope. También sacás un reporte
          de quién te debe cuánto al fin del mes.
        </p>

        <h3>AFIP / ARCA integrado</h3>
        <p>
          Emitís factura A, B y C con CAE directo desde el POS. Soporta
          Monotributo, Responsable Inscripto y Exento. El plan Básico
          incluye 50 facturas/mes y el Profesional 2.000/mes con auto-factura
          al cobrar, NC parciales y Libro IVA Ventas exportable.
        </p>

        <h3>Reportes accionables</h3>
        <p>
          No solo gráficos. Te dice qué productos tenés con stock parado más
          de 60 días, qué reponer esta semana según velocidad de venta, y
          cuánto IVA pasarle al contador a fin de mes en CSV listo.
        </p>

        <h2>Lo que NO cubrimos (no te miento)</h2>
        <ul>
          <li>Receta magistral y elaboración propia</li>
          <li>Convenios con obras sociales (PAMI, OSDE, Swiss Medical, etc.)</li>
          <li>Validación de recetas electrónicas</li>
          <li>Trazabilidad ANMAT de medicamentos</li>
        </ul>
        <p>
          Para esos casos necesitás un sistema farmacéutico específico
          (Estructura Stock, Quantio, etc.). Muchas farmacias usan los dos:
          el específico para obras sociales, Orvex para la caja general y
          venta libre.
        </p>

        <h2>Cuánto cuesta</h2>
        <ul>
          <li><strong>Gratis</strong>: $0 ARS/mes permanente. 100 productos. Para probar.</li>
          <li><strong>Básico</strong>: $9.999 ARS/mes. 1.000 productos, 3 usuarios.</li>
          <li><strong>Profesional</strong>: $24.900 ARS/mes. 5.000 productos, AFIP, IA, multi-caja.</li>
        </ul>

        <h2>Preguntas frecuentes</h2>
        {FAQ.map((f) => (
          <div key={f.question}>
            <h3>{f.question}</h3>
            <p>{f.answer}</p>
          </div>
        ))}
      </LandingShell>
    </>
  )
}
