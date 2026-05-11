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
  title: "POS para Panadería en Argentina | Sistema de Caja | Orvex",
  description:
    "POS para panaderías: venta por unidad (medialunas, facturas, tortas) y por peso (galletitas, pan). Cuenta corriente, AFIP, reportes con IA. Gratis para arrancar.",
  alternates: { canonical: "https://cobraorvex.com/pos-panaderia" },
  openGraph: {
    title: "POS para Panadería en Argentina",
    description:
      "Sistema de gestión para panaderías argentinas con venta por unidad/peso, cuenta corriente, AFIP integrado.",
    type: "website",
    locale: "es_AR",
  },
}

const FAQ = [
  {
    question: "¿Puedo vender por unidad y por peso en el mismo POS?",
    answer:
      "Sí. Cada producto se marca individualmente. Medialunas → por docena (unidad). Galletitas surtidas → por peso. Pan flauta → por unidad. Pan rallado → por kg. El POS maneja los dos modos en el mismo carrito sin problema.",
  },
  {
    question: "¿Maneja productos con vencimiento corto?",
    answer:
      "Sí. Los productos pueden tener fecha de vencimiento opcional. El reporte de stock muerto te muestra qué tenés del día anterior que no se vendió — útil para decidir si haces oferta a fin de día o lo regalas.",
  },
  {
    question: "¿Y los pedidos por encargue (cumpleaños, eventos)?",
    answer:
      "Cargás al cliente con cuenta corriente (límite de crédito si querés). Cuando hace un pedido grande, lo registrás como venta con pago 'cuenta corriente' y el saldo queda pendiente. El cliente paga cuando retira o a fin de mes según acordado.",
  },
  {
    question: "¿Se pueden hacer combos?",
    answer:
      "Sí. Plan Profesional incluye Combos: armás 'Promo desayuno = 3 medialunas + 1 café' con precio especial. En el POS lo escaneás como un solo item y descuenta stock de cada componente.",
  },
  {
    question: "¿Sirve para panadería + confitería + cafetería?",
    answer:
      "Sí. Vendés productos por unidad (medialunas, café), por peso (galletitas), por encargo (tortas), y todo en un mismo POS. Si tenés mesas con servicio (modo restaurante), no es nuestro foco — para eso te conviene un sistema gastronómico tipo Maxirest. Orvex te sirve perfecto si es panadería con take-away o mostrador.",
  },
  {
    question: "¿Cuánto cuesta?",
    answer:
      "Plan Gratis $0 ARS/mes (100 productos). Plan Básico $9.999 ARS/mes (1.000 productos, perfecto para panadería chica). Plan Profesional $24.900 ARS/mes con AFIP, IA y multi-caja. 7 días de prueba gratis.",
  },
]

export default function PosPanaderiaPage() {
  return (
    <>
      <JsonLd
        data={[
          organizationSchema(),
          softwareApplicationSchema(),
          breadcrumbSchema([
            { name: "Inicio", url: "https://cobraorvex.com/" },
            { name: "POS para Panadería", url: "https://cobraorvex.com/pos-panaderia" },
          ]),
          faqPageSchema(FAQ),
        ]}
      />
      <LandingShell
        pillLabel="Para panaderías y confiterías"
        title="POS para Panadería en Argentina"
        subtitle="Vendé por unidad o por peso, controlá vencimientos del día, manejá pedidos por encargue. Sin instalar, gratis para arrancar."
        highlights={[
          "Venta por unidad + por peso",
          "Cuenta corriente de clientes",
          "Combos / promos del día",
          "AFIP / ARCA integrado",
        ]}
      >
        <h2>La panadería mezcla todo: unidades, peso, encargos</h2>
        <p>
          Una medialuna se vende por unidad. Las galletitas surtidas, por peso.
          La torta de cumpleaños, por encargo con seña. El pan del día, por
          unidad pero con stock que cambia cada mañana. Y a fin de día, lo que
          no se vendió te decide si tirás o rebajás. Necesitás un POS que
          entienda todos esos modos sin marearte.
        </p>

        <h2>Lo que Orvex hace para vos</h2>

        <h3>Venta por unidad y por peso en el mismo POS</h3>
        <p>
          Cargás los productos según cómo los vendés. La medialuna es unidad
          ($300 c/u). Las galletitas surtidas son por kg ($6.500/kg). El
          mismo carrito puede tener 12 medialunas + 0.350 kg de galletitas
          + 1 pan flauta + 0.200 kg de pan rallado. Total calculado solo.
        </p>

        <h3>Combos / promos</h3>
        <p>
          Armás "Promo Desayuno": 3 medialunas + 1 café con leche por $1.500.
          En el POS lo seleccionás como un item, y el sistema descuenta stock
          de cada componente por separado. Plan Profesional.
        </p>

        <h3>Pedidos por encargue con cuenta corriente</h3>
        <p>
          Una clienta encarga torta para el sábado, paga seña el lunes y el
          resto al retirar. La cargás con cuenta corriente, asentás la seña
          como un pago parcial, y el saldo queda pendiente. Cuando viene a
          retirar, registrás el cobro final y el sistema cierra la cuenta.
        </p>

        <h3>Stock del día / vencimientos</h3>
        <p>
          A las 6 de la mañana ponés stock 100 medialunas, 30 pan flauta, 20
          tortas. A medida que vendés se descuenta. A fin de día tenés un
          reporte exacto de qué quedó (lo del día anterior). Decidís si lo
          rebajás 50% a último momento o si lo dejás para el día siguiente.
        </p>

        <h3>Productos más vendidos arriba</h3>
        <p>
          En el POS, la grilla pone primero los productos que más vendés.
          Si la medialuna de manteca es tu hit, va arriba — el cajero no
          pierde tiempo buscando. A medida que cambian las preferencias del
          barrio, el orden se ajusta solo según ventas.
        </p>

        <h3>AFIP / ARCA cuando facturás</h3>
        <p>
          Si vendés a cafeterías o eventos que piden factura A/B, plan
          Profesional emite CAE directo desde el POS. Monotributo y RI
          soportados.
        </p>

        <h2>Para qué tipo de panadería sirve</h2>
        <ul>
          <li>Panadería tradicional de barrio</li>
          <li>Panadería + confitería</li>
          <li>Panadería con café/desayuno para llevar</li>
          <li>Pastelería de pedidos por encargue</li>
          <li>Panadería que vende a comercios (B2B)</li>
        </ul>

        <h2>Cuánto cuesta</h2>
        <ul>
          <li><strong>Gratis</strong>: $0 ARS/mes permanente. 100 productos.</li>
          <li><strong>Básico</strong>: $9.999 ARS/mes. 1.000 productos, 3 usuarios.</li>
          <li><strong>Profesional</strong>: $24.900 ARS/mes. Combos, AFIP, IA, multi-caja.</li>
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
