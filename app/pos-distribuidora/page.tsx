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
  title: "POS para Distribuidora Mayorista | Cuenta Corriente | Orvex",
  description:
    "Sistema de gestión para distribuidoras y mayoristas argentinos: cuenta corriente con límite de crédito, lista de precios por cliente, AFIP A/B, reportes con IA.",
  keywords: ["POS distribuidora, sistema distribuidora argentina, software mayorista, cuenta corriente B2B, factura A mayorista, ruteo entregas, multi-vendedor"],
  alternates: { canonical: "https://cobraorvex.com/pos-distribuidora" },
  openGraph: {
    title: "POS para Distribuidora Mayorista",
    description:
      "POS B2B argentino: cuenta corriente, listas de precios, facturación AFIP A/B, ruteo de cobranza.",
    type: "website",
    locale: "es_AR",
    images: [{ url: "https://cobraorvex.com/api/og?title=POS+para+Distribuidora&pill=Para+mayoristas+B2B", width: 1200, height: 630, alt: "Orvex" }],
  },
}

const FAQ = [
  {
    question: "¿Maneja cuenta corriente con límite de crédito?",
    answer:
      "Sí. Cada cliente B2B tiene un límite de crédito que vos configurás (ej: $500.000 al kiosco del barrio, $2.000.000 a la cadena chica). Cuando hacés una venta a cuenta corriente, el sistema chequea que no se pase del límite — si se pasa, te alerta antes de cerrar. Reporte mensual te dice quién te debe y desde hace cuánto.",
  },
  {
    question: "¿Soporta listas de precios por cliente?",
    answer:
      "Cada cliente puede tener un descuento porcentual global aplicado automático en cada venta. Para listas de precios independientes (Lista A, B, C con precios distintos por producto), está en roadmap para Q2 2026. Hoy lo manejás con el descuento global por cliente.",
  },
  {
    question: "¿Facturación A para clientes Responsables Inscriptos?",
    answer:
      "Sí. Plan Profesional emite factura A con CAE directo desde el POS para clientes RI. Detección automática del tipo de factura según condición IVA del cliente (RI → A, Monotributo/CF → B, Exento → C).",
  },
  {
    question: "¿Y los repartos / ruteo de entregas?",
    answer:
      "El sistema marca ventas como 'pendiente de entrega' y podés filtrar el listado por zona/cliente para armar la ruta del día. Ruteo automatizado con mapas está en roadmap pero todavía no. Hoy se hace listado manual.",
  },
  {
    question: "¿Multi-vendedor con comisiones?",
    answer:
      "Cada vendedor es un usuario del sistema con sus propias ventas atribuidas. Reporte por vendedor te dice cuánto vendió cada uno y su margen. Cálculo automático de comisiones por porcentaje está en roadmap. Hoy lo hacés con el dato del reporte.",
  },
  {
    question: "¿Cuánto cuesta?",
    answer:
      "Para distribuidora chica/mediana el Plan Profesional $24.900 ARS/mes es lo que te sirve (5.000 productos, 10 usuarios, AFIP, IA). Si tenés más de 5.000 SKUs o 10 vendedores, hablamos un plan Empresa custom.",
  },
]

export default function PosDistribuidoraPage() {
  return (
    <>
      <JsonLd
        data={[
          organizationSchema(),
          softwareApplicationSchema(),
          breadcrumbSchema([
            { name: "Inicio", url: "https://cobraorvex.com/" },
            { name: "POS para Distribuidora", url: "https://cobraorvex.com/pos-distribuidora" },
          ]),
          faqPageSchema(FAQ),
        ]}
      />
      <LandingShell
        pillLabel="Para distribuidoras y mayoristas"
        title="POS para Distribuidora Mayorista en Argentina"
        subtitle="Cuenta corriente con límite de crédito, facturación AFIP A/B/C, reportes por vendedor y cliente. Pensado para B2B argentino."
        highlights={[
          "Cuenta corriente con límite",
          "Facturación A/B/C con CAE",
          "Multi-vendedor + reportes",
          "Plan Empresa para 5.000+ productos",
        ]}
      >
        <h2>La distribuidora no es una boutique de barrio</h2>
        <p>
          Vos vendés a otros comercios. Cada cliente te debe plata, te paga a
          30/60 días, te pide factura A, y a fin de mes querés saber: quién
          se atrasó con el pago, qué vendedor cerró más ventas, qué producto
          es el que mueve más caja. Un POS de mostrador no te da nada de eso.
        </p>

        <h2>Lo que Orvex hace para vos</h2>

        <h3>Cuenta corriente real, con límite</h3>
        <p>
          Cada cliente B2B tiene un límite de crédito que vos definís según su
          historial. El kiosco "Don José" tiene $300.000 de límite porque
          siempre paga puntual. La cadena nueva arranca con $100.000 y la
          vamos subiendo a medida que cumple. Cuando una venta haría pasar
          el límite, el sistema te avisa antes de cerrar y vos decidís si la
          aprobás igual o pedís pago.
        </p>

        <h3>Facturación AFIP A/B/C con CAE</h3>
        <p>
          La distribuidora factura A a casi todos sus clientes (son RI). Plan
          Profesional emite el CAE directo desde el POS, con el QR de AFIP
          (RG 4892/2020) en cada ticket. Detecta el tipo de factura según la
          condición IVA del cliente y elige A, B o C automático.
        </p>

        <h3>Reportes por vendedor</h3>
        <p>
          Cada vendedor en la ruta es un user del sistema. Cuando hace una
          venta, queda atribuida a su nombre. El reporte mensual te dice:
          cuánto vendió cada uno, cuánto en cuenta corriente vs efectivo,
          qué margen dejó. Datos para decidir comisiones, ascensos o cambios
          de zona.
        </p>

        <h3>Stock con velocidad de rotación</h3>
        <p>
          El reporte "Plan de Compras" usa la velocidad de venta de cada
          producto para decirte cuánto comprar la próxima semana. No es "tu
          stock está bajo" genérico — es "este producto vende 50 unidades/
          semana, te quedan 80, comprá 200 para la próxima entrega".
        </p>

        <h3>Insights con IA</h3>
        <p>
          El asistente AI (Plan Profesional) te dice cosas tipo "Las ventas
          al cliente X bajaron 40% este mes — capaz cambió de proveedor",
          o "El producto Y subió 30% en demanda, considerá subir el pedido
          al mayorista". Análisis narrativo, no sólo gráficos.
        </p>

        <h3>Multi-caja para varios cajeros</h3>
        <p>
          Si tenés mostrador con varios cajeros (mayorista que también atiende
          retail), cada uno abre su propia caja con su monto inicial. Las
          ventas se atribuyen a quien las hizo, el cierre de caja se hace por
          sesión.
        </p>

        <h2>Para qué tipo de distribuidora sirve</h2>
        <ul>
          <li>Distribuidora de bebidas / golosinas / limpieza</li>
          <li>Mayorista de almacén</li>
          <li>Distribuidora de fiambres / lácteos</li>
          <li>Importador chico que vende a comercios</li>
          <li>Productor que vende a su red de minoristas</li>
        </ul>

        <h2>Cuánto cuesta</h2>
        <ul>
          <li><strong>Profesional</strong>: $24.900 ARS/mes. 5.000 productos, 10 usuarios, AFIP, IA. Lo más usual para distribuidora chica/mediana.</li>
          <li><strong>Empresa</strong>: planes custom para más SKUs/usuarios. Hablar con soporte.</li>
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
