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
  title: "POS para Fiambrería en Argentina | Venta por Peso + Tara | Orvex",
  description:
    "Sistema POS para fiambrerías: venta por peso (kg), descuento de tara del envase, etiquetas con balanza, AFIP integrado y control de stock. Plan gratis para arrancar.",
  alternates: { canonical: "https://cobraorvex.com/pos-fiambreria" },
  openGraph: {
    title: "POS para Fiambrería en Argentina",
    description:
      "Punto de venta para fiambrerías con venta por peso, tara automática y control de stock de jamón, queso, salame, lechón.",
    type: "website",
    locale: "es_AR",
    images: [{ url: "https://cobraorvex.com/api/og?title=POS+para+Fiambrer%C3%ADa&pill=Para+fiambrer%C3%ADas", width: 1200, height: 630, alt: "Orvex" }],
  },
}

const FAQ = [
  {
    question: "¿Cómo funciona la venta por peso para fiambres?",
    answer:
      "Marcás cada producto (jamón, queso, salame) como 'se vende por peso'. En el POS, cuando lo seleccionás, te abre un modal pidiendo el peso en kg con hasta 3 decimales (gramos). El precio se calcula automático: peso × $/kg. Si tenés balanza electrónica con salida USB, podés conectarla y el peso entra solo.",
  },
  {
    question: "¿Tiene función de tara (descuento del envase)?",
    answer:
      "Sí. Dentro del modal de peso hay un toggle 'Agregar tara'. Tipeás el peso del envase/papel en gramos (5g, 10g, 20g preset) y el sistema muestra Bruto / Tara / Neto y cobra solamente el peso neto del fiambre. Crítico para no estar regalando 50g cada vez que vendés.",
  },
  {
    question: "¿Soporta imprimir etiquetas con balanza?",
    answer:
      "Sí. La página de Etiquetas exporta nombre + precio + código de barras en 3 tamaños (40×25, 60×35, 80×50 mm) compatibles con la mayoría de impresoras térmicas como Xprinter, Brother QL o Zebra. Imprimís y pegás la etiqueta en el paquete antes de entregarlo.",
  },
  {
    question: "¿Maneja productos pre-pesados (paquetes de 250g, 500g)?",
    answer:
      "Sí. Para los paquetes fijos podés cargar el producto como unidad normal con peso ya incluido en el nombre ('Jamón Crudo 250g') y vender por unidad. Para corte al peso usás el modo 'soldByWeight'. Los dos modos conviven en el mismo POS sin problemas.",
  },
  {
    question: "¿Y comida casera para llevar (empanadas, milanesas)?",
    answer:
      "Esos productos los cargás como unidades normales (no por peso). Empanada $X, milanesa $Y. El POS tiene búsqueda rápida + atajos de cantidad (click en el número para tipear '12' en lugar de clickear 12 veces +) que ayudan cuando armás un pedido grande de varias cosas.",
  },
  {
    question: "¿Cuánto cuesta?",
    answer:
      "Plan Gratis $0 ARS/mes permanente (sin tarjeta). Plan Básico $9.999 ARS/mes para fiambrería chica (1.000 productos). Plan Profesional $24.900 ARS/mes con AFIP integrado, multi-caja y reportes con IA. Todos los planes pagos vienen con 7 días de prueba gratis.",
  },
]

export default function PosFiambreriaPage() {
  return (
    <>
      <JsonLd
        data={[
          organizationSchema(),
          softwareApplicationSchema(),
          breadcrumbSchema([
            { name: "Inicio", url: "https://cobraorvex.com/" },
            { name: "POS para Fiambrería", url: "https://cobraorvex.com/pos-fiambreria" },
          ]),
          faqPageSchema(FAQ),
        ]}
      />
      <LandingShell
        pillLabel="Para fiambrerías y comida al peso"
        title="POS para Fiambrería en Argentina"
        subtitle="Venta por peso con tara, etiquetas para imprimir, control de stock de jamón/queso/salame, AFIP cuando lo necesites. Sin instalar nada."
        highlights={[
          "Venta por peso (kg) con tara",
          "Etiquetas térmicas listas para imprimir",
          "Control de stock por kilo",
          "AFIP / ARCA integrado",
        ]}
      >
        <h2>La fiambrería tiene problemas distintos al kiosco</h2>
        <p>
          Vos no vendés unidades, vendés peso. El cliente te pide 200 gramos de
          jamón crudo, vos cortás, lo pesás en la balanza, le ponés papel, y
          tenés que cobrar lo justo — ni darle 20g de más gratis ni cobrarle
          el peso del papel. Sumale que el jamón que tenés en el mostrador
          tiene fecha de vencimiento, y que cuando el cliente pide factura
          tenés que emitir CAE a AFIP. Un POS de kiosco no te sirve.
        </p>

        <h2>Lo que Orvex hace para vos</h2>

        <h3>Venta por peso con tara</h3>
        <p>
          Marcás cada fiambre como "se vende por peso". Cuando el cliente pide
          jamón, en el POS tocás el producto y se abre un modal grande pidiendo
          el peso. Tipeás <strong>0.200</strong> (o tocás el preset "250g") y
          el precio sale calculado automático.
        </p>
        <p>
          Si querés descontar el envase, activás <strong>tara</strong> y tipeás
          el peso del papel en gramos. El modal te muestra:
        </p>
        <ul>
          <li>Bruto: 0.220 kg (lo que marca la balanza)</li>
          <li>Tara: −0.020 kg (papel + bolsita)</li>
          <li>Neto: 0.200 kg (lo que cobrás)</li>
        </ul>
        <p>
          Con 10g de papel × 30 ventas por día × 30 días, son 9 kg al mes que
          regalabas. A $8.000/kg de jamón crudo, son $72.000 ARS que recuperás
          al mes solo activando tara.
        </p>

        <h3>Stock por kilo, no por unidad</h3>
        <p>
          La horma de queso pesa 4,5 kg, no es "1 unidad". Vos cargás
          <strong> stock = 4.500</strong> kg y cada venta descuenta el peso
          exacto vendido. Cuando llegás al stock mínimo (ej: 0.5 kg), el sistema
          te alerta — perfecto para no quedarte sin el queso que más sale.
        </p>

        <h3>Etiquetas para imprimir con tu impresora térmica</h3>
        <p>
          Vas a Inventario → Etiquetas, elegís cuántas querés de cada producto,
          tamaño (40×25, 60×35 o 80×50 mm — los típicos rollos de Xprinter,
          Brother o Zebra) y mandás a imprimir. Cada etiqueta sale con nombre,
          precio y código de barras. Se las pegás al paquete pre-pesado o al
          mostrador.
        </p>

        <h3>Comida casera para llevar</h3>
        <p>
          Empanadas, milanesas, ravioles, viandas — todo lo que vendés por
          unidad va en el catálogo normal. El POS tiene búsqueda con
          autocompletado y los productos más vendidos aparecen primero. Si
          el cliente pide "12 de carne y 6 de jamón y queso", click + tipeo
          rápido y ya.
        </p>

        <h3>AFIP / ARCA cuando vendés a restaurantes</h3>
        <p>
          Si vendés mayorista a restaurantes o pizzerías y te piden factura A o
          B, en el plan Profesional emitís CAE directo desde el POS. Soporta
          Monotributo y Responsable Inscripto. El QR de AFIP queda en el ticket
          según RG 4892/2020.
        </p>

        <h3>Cuenta corriente para clientes habituales</h3>
        <p>
          Los habitué que pagan a fin de mes los cargás con cuenta corriente y
          límite de crédito. El sistema bloquea si se pasan. Reporte mensual te
          dice quién te debe y cuánto.
        </p>

        <h2>Para qué tipo de fiambrería sirve</h2>
        <ul>
          <li>Fiambrería de barrio clásica</li>
          <li>Rotisería con fiambres + comida casera</li>
          <li>Almacén con fiambrería</li>
          <li>Fiambrería mayorista (B2B con cuenta corriente)</li>
          <li>Quesería artesanal</li>
        </ul>

        <h2>Cuánto cuesta</h2>
        <ul>
          <li><strong>Gratis</strong>: $0 ARS/mes permanente. 100 productos. Para arrancar.</li>
          <li><strong>Básico</strong>: $9.999 ARS/mes. 1.000 productos, 3 usuarios.</li>
          <li><strong>Profesional</strong>: $24.900 ARS/mes. AFIP, IA, multi-caja, 5.000 productos.</li>
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
