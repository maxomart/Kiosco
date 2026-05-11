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
  title: "POS para Carnicería en Argentina | Venta por Kilo | Orvex",
  description:
    "Sistema POS para carnicerías: venta por kilo, control de cortes, integración con balanza electrónica, AFIP, reportes de rotación. Plan gratis sin tarjeta.",
  alternates: { canonical: "https://cobraorvex.com/pos-carniceria" },
  openGraph: {
    title: "POS para Carnicería en Argentina",
    description:
      "Punto de venta para carnicerías argentinas: venta por kilo, balanza integrada, control de stock por cortes, AFIP.",
    type: "website",
    locale: "es_AR",
  },
}

const FAQ = [
  {
    question: "¿Cómo registro venta por kilo?",
    answer:
      "Marcás cada corte (asado, vacío, matambre, etc.) como 'se vende por peso'. En el POS, tocás el corte y se abre un input grande para tipear los kilos con hasta 3 decimales. El total se calcula solo. Soporta presets de 250g/500g/1kg/2kg para acelerar.",
  },
  {
    question: "¿Funciona con balanza electrónica?",
    answer:
      "Sí, con cualquier balanza que tenga salida USB que emule teclado (los modelos económicos como Magris, Cuora, Systel suelen tenerla). Cuando pesás un corte y apretás Enter en la balanza, el peso entra automático en el modal del POS.",
  },
  {
    question: "¿Llevo stock por corte?",
    answer:
      "Sí. Cargás cada corte como producto separado (Asado, Vacío, Matambre, Bola de Lomo, etc.) con stock en kg. Cada venta descuenta los kg vendidos. El reporte de stock muerto te muestra qué corte tenés hace mucho — útil para no perder por descomposición.",
  },
  {
    question: "¿Maneja media res / cuarteo?",
    answer:
      "Cuando llega una media res, cargás el stock de cada corte por separado según cuánto te dio cada uno (ej: del cuarto trasero salen X kg de asado, Y kg de matambre, Z kg de tapa). El costo por kg de cada corte lo distribuís según lo que pagaste por la media. Reporte de margen por corte te dice qué te da más ganancia.",
  },
  {
    question: "¿Cuánto cuesta?",
    answer:
      "Plan Gratis $0 ARS/mes permanente. Plan Básico $9.999 ARS/mes (1.000 productos, ideal para carnicería chica). Plan Profesional $24.900 ARS/mes con AFIP, IA, multi-caja. 7 días de prueba en planes pagos.",
  },
]

export default function PosCarniceriaPage() {
  return (
    <>
      <JsonLd
        data={[
          organizationSchema(),
          softwareApplicationSchema(),
          breadcrumbSchema([
            { name: "Inicio", url: "https://cobraorvex.com/" },
            { name: "POS para Carnicería", url: "https://cobraorvex.com/pos-carniceria" },
          ]),
          faqPageSchema(FAQ),
        ]}
      />
      <LandingShell
        pillLabel="Para carnicerías"
        title="POS para Carnicería en Argentina"
        subtitle="Venta por kilo con balanza, control de stock por corte, reportes de rotación y AFIP. Sin instalación — corre en cualquier compu, tablet o celu."
        highlights={[
          "Venta por kilo con balanza USB",
          "Stock por corte (asado, vacío, etc.)",
          "Reportes de margen por corte",
          "AFIP / ARCA integrado",
        ]}
      >
        <h2>La carnicería no se gestiona con un POS de kiosco</h2>
        <p>
          Vos vendés cortes, no unidades. Tu margen depende del cuarteo —
          aprender que el matambre te deja más ganancia que el asado por kilo
          y vendéslo primero. Y tenés que pesar todo en tiempo real,
          imprimir etiqueta si el cliente se lleva varios paquetes, y a fin
          de mes mandarle el IVA al contador.
        </p>

        <h2>Lo que Orvex hace para vos</h2>

        <h3>Venta por kilo, peso en tiempo real</h3>
        <p>
          Cargás cada corte con su precio por kilo (Asado $8.500/kg, Vacío
          $11.200/kg, etc.). En el POS, el cliente pide 1.5 kg de asado, vos
          ponés en la balanza, mirás el display y tipeás <strong>1.5</strong>
          (o lo que diga la balanza). El sistema cobra el peso × precio sin
          errores de cuenta.
        </p>
        <p>
          Si tu balanza tiene salida USB que emula teclado, conectás al
          equipo del POS y el peso entra automático con Enter — manos
          libres para el cliente que sigue.
        </p>

        <h3>Stock por corte</h3>
        <p>
          Cargás cada corte como producto separado con stock en kg. Cuando
          comprás una media res a $X, cargás el stock de cada corte según el
          cuarteo (cuántos kg de cada corte te salieron). Cada venta descuenta
          los kg del corte específico.
        </p>
        <p>
          Stock mínimo te alerta cuando un corte se está por terminar — ej:
          quedan 2 kg de matambre y avisás al proveedor.
        </p>

        <h3>Reportes de margen por corte</h3>
        <p>
          Comprás una res a un costo total, después la fraccionás. El reporte
          te muestra cuánto te deja cada corte (precio venta − costo
          distribuido). Te ayuda a aprender que conviene más vender la tapa
          de asado que el costillar, por ejemplo.
        </p>

        <h3>Etiquetas con peso/precio</h3>
        <p>
          Si pre-pesás cortes (paquetes listos en la heladera con su precio),
          imprimís la etiqueta desde el sistema con nombre + peso + precio +
          barcode. Cualquier impresora térmica de 40-80 mm sirve. Cuando el
          cliente lleva varios paquetes, en el POS escaneás los barcodes y
          ya está.
        </p>

        <h3>AFIP integrado</h3>
        <p>
          Si vendés a restaurantes/parrillas y te piden factura A o B, en el
          plan Profesional emitís CAE desde el POS. El QR de AFIP queda en
          el ticket. Soporta Monotributo y RI.
        </p>

        <h2>Para qué tipo de carnicería</h2>
        <ul>
          <li>Carnicería de barrio</li>
          <li>Carnicería + pollería</li>
          <li>Carnicería mayorista (B2B con cuenta corriente)</li>
          <li>Frigorífico chico que también vende al público</li>
          <li>Granjas familiares que venden producción propia</li>
        </ul>

        <h2>Cuánto cuesta</h2>
        <ul>
          <li><strong>Gratis</strong>: $0 ARS/mes permanente.</li>
          <li><strong>Básico</strong>: $9.999 ARS/mes.</li>
          <li><strong>Profesional</strong>: $24.900 ARS/mes con AFIP + IA.</li>
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
