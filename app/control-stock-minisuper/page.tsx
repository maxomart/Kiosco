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
  title: "Control de Stock para Minisúper | Software de Inventario | Orvex",
  description:
    "Control de stock para minisúper, autoservicio y almacén grande en Argentina. Hasta 5.000 productos, código de barras, plan de compras automático, alertas de stock bajo. Plan gratis para arrancar.",
  alternates: { canonical: "https://cobraorvex.com/control-stock-minisuper" },
  openGraph: {
    title: "Control de Stock para Minisúper",
    description:
      "Inventario digital con código de barras, alertas de stock bajo y plan de compras semanal automático según velocidad de venta.",
    type: "website",
    locale: "es_AR",
    images: [{ url: "https://cobraorvex.com/api/og?title=Control+de+Stock+Minis%C3%BAper&pill=Para+autoservicios", width: 1200, height: 630, alt: "Orvex" }],
  },
}

const FAQ = [
  {
    question: "¿Hasta cuántos productos soporta?",
    answer:
      "El plan Profesional soporta 5.000 productos activos. Para minisúper típico de barrio (1.000-3.000 SKUs) sobra. Si tenés autoservicio más grande con 10.000+ productos, contactanos para evaluar plan Empresa custom.",
  },
  {
    question: "¿Cómo cargo todos los productos al inicio?",
    answer:
      "Tres formas. (1) Excel: si tenés tu inventario en Excel/CSV, lo subís y la IA detecta las columnas sola. (2) Foto de ticket de mayorista: le sacás foto al ticket de Maxiconsumo/Vital/Diarco y la IA extrae los productos con sus precios. (3) A mano con autocomplete: tipeás el nombre y aparecen sugerencias del catálogo argentino con precios orientativos.",
  },
  {
    question: "¿Lee códigos de barras?",
    answer:
      "Sí, con la cámara del celular o tablet sin hardware extra. Si querés un lector USB profesional para el mostrador, cualquier scanner barato (~$15-25K ARS) funciona — se conecta como teclado y el sistema lo detecta solo.",
  },
  {
    question: "¿Me dice qué reponer cada semana?",
    answer:
      "Sí. El reporte 'Plan de compras' analiza la velocidad de venta de los últimos 14 días, calcula días de cobertura por producto y te genera un CSV con cantidades sugeridas para los próximos 14 días, ordenado por urgencia (productos que se quedan sin stock primero).",
  },
]

export default function ControlStockMinisuperPage() {
  return (
    <>
      <JsonLd
        data={[
          organizationSchema(),
          softwareApplicationSchema(),
          breadcrumbSchema([
            { name: "Inicio", url: "https://cobraorvex.com/" },
            { name: "Control de Stock para Minisúper", url: "https://cobraorvex.com/control-stock-minisuper" },
          ]),
          faqPageSchema(FAQ),
        ]}
      />
      <LandingShell
        pillLabel="Para minisúper y autoservicios"
        title="Control de Stock para Minisúper en Argentina"
        subtitle="Inventario digital con código de barras, plan de compras automático y alertas de stock bajo. Para 1.000 a 5.000 productos sin sistema corporativo."
        highlights={[
          "Hasta 5.000 productos",
          "Código de barras (cámara o scanner USB)",
          "Plan de compras automático",
          "Alertas de stock bajo",
        ]}
      >
        <h2>El problema del minisúper: sabés que algo no cierra</h2>
        <p>
          Tu mujer/marido/hijo te dice "se está vendiendo poco la Coca". Vos
          le decís "no, se vende re bien". Ninguno tiene los datos. Sacás un
          producto que iba bien porque te parecía que no, dejás 4 cajas de
          algo que ya no se mueve. Compraste 8 atados de Marlboro Lights
          porque no te acordabas que el último pedido te quedó stock. La
          plata que se te va en stock muerto y compras mal hechas, en un
          minisúper de 1.500-3.000 productos, se cuenta en cientos de miles
          de pesos al mes.
        </p>
        <p>
          Orvex resuelve eso con dos features simples: <strong>te muestra
          qué se vende y qué no</strong>, y <strong>te dice qué comprar
          esta semana</strong> según los datos reales.
        </p>

        <h2>Lo que vas a tener funcionando</h2>

        <h3>Inventario con códigos de barras</h3>
        <p>
          Cada producto tiene su nombre, código de barras EAN, precio de
          costo, precio de venta, stock actual y stock mínimo. Cargás el
          catálogo una vez (Excel, foto de ticket o a mano con autocomplete
          del catálogo argentino) y después escaneás en cada movimiento.
        </p>
        <p>
          Para un minisúper típico de Buenos Aires/CABA con 1.500 productos,
          la carga inicial te lleva un fin de semana si vas con foto-de-ticket
          + autocomplete. Si ya tenías Excel, una tarde.
        </p>

        <h3>Movimientos de stock</h3>
        <p>
          Cada vez que vendés (POS), el stock se descuenta. Cada vez que
          recibís un pedido del proveedor, lo cargás como "carga" o "compra"
          y el stock se suma. Cada movimiento queda auditado: fecha, cantidad
          antes, cantidad después, costo unitario, quién lo hizo. Si hay
          discrepancia con la realidad, hay log para investigar.
        </p>

        <h3>Alertas de stock bajo</h3>
        <p>
          Definís un mínimo por producto. El dashboard te avisa qué productos
          están bajo el mínimo en este momento. Le mandás el listado al
          comprador con un click.
        </p>

        <h3>Plan de compras semanal automático</h3>
        <p>
          Esta es la feature que más usan los minisúper. El sistema mira los
          últimos 14 días de venta, calcula la velocidad por producto
          (unidades/día), y genera un CSV con qué reponer y cuánto para
          cubrir las próximas 2 semanas. Ordenado por urgencia: primero los
          productos que se te van a acabar en 3 días, después los que se
          te van a acabar en 7 días, después los que tenés cobertura para
          15 días pero conviene reponer.
        </p>
        <p>
          Le mandás ese CSV directo a tu mayorista por WhatsApp y armás el
          pedido en 5 minutos en lugar de 2 horas.
        </p>

        <h3>Reporte de stock muerto</h3>
        <p>
          La otra cara de la moneda: productos que tenés en góndola pero
          no se vendieron en 60 días. Cada uno con cuánto capital tenés
          atrapado ahí. Total al final. Si nunca lo miraste, te vas a
          encontrar con $200.000-500.000 ARS en productos que conviene
          liquidar antes de vencimiento.
        </p>

        <h3>Multi-usuario con roles</h3>
        <p>
          El dueño ve todo. El cajero solo ve POS y caja. El repositor
          tiene permiso para mover stock pero no para ver márgenes. Roles
          granulares vienen incluidos.
        </p>

        <h2>Cuánto cuesta</h2>
        <ul>
          <li><strong>Gratis</strong>: hasta 100 productos. Para probar.</li>
          <li><strong>Básico</strong>: $9.999 ARS/mes. 1.000 productos, 3 usuarios. Sirve para minisúper chico.</li>
          <li><strong>Profesional</strong>: $24.900 ARS/mes. 5.000 productos, 10 usuarios, IA, AFIP, multi-caja. Lo que usa la mayoría.</li>
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
