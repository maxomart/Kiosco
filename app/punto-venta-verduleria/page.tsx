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
  title: "Punto de Venta para Verdulería en Argentina | Software POS | Orvex",
  description:
    "Punto de venta para verdulería y frutería en Argentina. Vendé por peso (kg), llevá control de mermas y rotación, AFIP integrado y reportes con IA. Plan gratis para arrancar.",
  keywords: ["POS verdulería, sistema verdulería argentina, venta por kilo, frutería, software verdulería, AFIP verdulería"],
  alternates: { canonical: "https://cobraorvex.com/punto-venta-verduleria" },
  openGraph: {
    title: "Punto de Venta para Verdulería",
    description:
      "POS pensado para verdulerías argentinas: venta por kilo/gramo, control de mermas y rotación rápida de productos perecederos.",
    type: "website",
    locale: "es_AR",
    images: [{ url: "https://cobraorvex.com/api/og?title=Punto+de+Venta+Verduler%C3%ADa&pill=Para+verduler%C3%ADas+y+fruter%C3%ADas", width: 1200, height: 630, alt: "Orvex" }],
  },
}

const FAQ = [
  {
    question: "¿Soporta venta por kilo o gramos?",
    answer:
      "Sí. Cada producto se puede marcar como 'soldByWeight'. En el POS, en lugar de cantidad pedís peso (en kg con decimales). Si tenés balanza electrónica con salida USB que emula teclado, podés conectarla y el peso entra solo.",
  },
  {
    question: "¿Maneja productos que vencen rápido?",
    answer:
      "Sí. Los productos pueden tener fecha de vencimiento opcional. El reporte de stock muerto te muestra qué tenés en góndola hace mucho — útil para verdulerías porque la mercadería tiene rotación de 3-7 días y ver qué quedó parado evita tirar.",
  },
  {
    question: "¿Cómo registro las mermas?",
    answer:
      "El sistema te permite hacer ajustes de stock manuales con motivo ('merma', 'rotura', 'fin del día'). Quedan registrados con el user que lo hizo y la fecha. Después en reportes ves cuánto perdiste por mermas en el período.",
  },
  {
    question: "¿Cuánto cuesta?",
    answer:
      "Plan Gratis sin tarjeta para arrancar. Plan Básico $9.999 ARS/mes para verdulería chica (1.000 productos, 3 usuarios). Plan Profesional $24.900 ARS/mes con AFIP integrado, IA, multi-caja.",
  },
]

export default function PuntoVentaVerduleriaPage() {
  return (
    <>
      <JsonLd
        data={[
          organizationSchema(),
          softwareApplicationSchema(),
          breadcrumbSchema([
            { name: "Inicio", url: "https://cobraorvex.com/" },
            { name: "Punto de Venta para Verdulería", url: "https://cobraorvex.com/punto-venta-verduleria" },
          ]),
          faqPageSchema(FAQ),
        ]}
      />
      <LandingShell
        pillLabel="Para verdulerías y fruterías"
        title="Punto de Venta para Verdulería en Argentina"
        subtitle="POS que entiende tu negocio: venta por kilo, mermas, rotación rápida, productos perecederos. Y AFIP cuando lo necesites."
        highlights={[
          "Venta por kilo/gramo",
          "Control de mermas y vencimientos",
          "Reporte de rotación rápido",
          "AFIP / ARCA integrado",
        ]}
      >
        <h2>Una verdulería no es un kiosco</h2>
        <p>
          La verdulería tiene problemas distintos. Tu producto se vende por
          peso (no por unidad), tiene 3-7 días de vida, y los precios cambian
          a veces semanalmente porque dependen del mayorista del Mercado Central
          o de tu proveedor de fruta. Un POS pensado para kiosco no te sirve si
          no soporta venta por gramo, no te alerta de mermas, y no te muestra
          rotación rápida.
        </p>

        <h2>Lo que Orvex hace para vos</h2>

        <h3>Venta por peso</h3>
        <p>
          Cada producto se puede marcar como "se vende por peso". En el POS,
          en lugar de pedirte cantidad ("3 unidades de Coca"), te pide peso en
          kilogramos con decimales (1,250 kg de tomate cherry). El precio se
          calcula automático: peso × precio/kg. Si tenés balanza electrónica
          que emula teclado USB (modelo barato, ~$80.000-120.000 ARS), conectás
          y el peso entra solo cuando apretás <strong>Enter</strong>.
        </p>

        <h3>Mermas y ajustes de stock</h3>
        <p>
          Al final del día, parte de tu mercadería va al tacho (lo que se pasó,
          lo magullado, lo regalado al cliente fiel). En lugar de hacer la
          cuenta a ojo, le hacés ajuste de stock al producto con motivo
          "merma" / "rotura" / "regalo" y el sistema lleva el registro.
          El reporte mensual te dice cuánto perdiste por mermas — número
          que te puede sorprender.
        </p>

        <h3>Rotación y stock muerto</h3>
        <p>
          La verdulería que pierde plata es la que compra fruta que se queda
          parada. El reporte de stock muerto te muestra qué productos tenés
          hace 3-5+ días sin moverse, ordenados por capital atrapado. Crítico
          para mercadería perecedera: si no rota en 3 días, la pones en oferta
          o la regalás antes de tirarla.
        </p>

        <h3>Listas de precios variables</h3>
        <p>
          Esta semana el tomate está a $4.500/kg, la próxima sube a $5.200/kg.
          Cambiás el precio en el sistema en 3 toques (sin recargar el
          inventario entero) y queda actualizado en el POS para todos los
          cajeros al toque. El historial de precios queda guardado.
        </p>

        <h3>Cuenta corriente</h3>
        <p>
          La verdulería de barrio vive con clientes habituales que llevan
          fiado. Asignás límite de crédito por cliente (ej: $20.000 ARS para
          el vecino del 3-B), y el sistema bloquea si se pasa. Reporte
          mensual de quién te debe.
        </p>

        <h3>AFIP / ARCA integrado</h3>
        <p>
          Para verdulerías que facturan a remiserías, hoteles, restaurantes
          o consumidores finales que piden factura: emitís A, B o C con CAE
          desde el POS en el plan Profesional. Soporta Monotributo y RI.
        </p>

        <h2>Para qué tipo de negocio sirve</h2>
        <ul>
          <li>Verdulería de barrio clásica</li>
          <li>Frutería</li>
          <li>Verdulería con almacén (productos varios)</li>
          <li>Verdulería que vende a comercios (B2B con cuenta corriente)</li>
          <li>Mercado / puesto en feria con varios cajeros</li>
        </ul>

        <h2>Cuánto cuesta</h2>
        <ul>
          <li><strong>Gratis</strong>: $0 ARS/mes permanente. 100 productos. Ideal para probar.</li>
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
