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
  title: "Alternativa a Tango / Bejerman para Kiosco | POS Web | Orvex",
  description:
    "Alternativa moderna a Tango Gestión, Bejerman y sistemas viejos para comercios chicos en Argentina. Web, sin instalación, offline-first, AFIP integrado y plan gratis.",
  alternates: { canonical: "https://cobraorvex.com/alternativa-tango-bejerman" },
  openGraph: {
    title: "Alternativa a Tango Gestión / Bejerman",
    description:
      "Sistema POS web argentino, más simple y económico que Tango o Bejerman, sin instalación ni licencias por usuario.",
    type: "website",
    locale: "es_AR",
    images: [{ url: "https://cobraorvex.com/api/og?title=Alternativa+a+Tango+%2F+Bejerman&pill=Para+migrar+de+sistemas+viejos", width: 1200, height: 630, alt: "Orvex" }],
  },
}

const FAQ = [
  {
    question: "¿Tengo que migrar todos mis datos de Tango?",
    answer:
      "Podés importar tu catálogo de productos desde Excel (cualquier sistema viejo te exporta a Excel). Importás hasta 200 productos por archivo con detección de duplicados. Para clientes, mismo formato Excel. Movimientos históricos no se migran — arrancás Orvex desde cero con los datos del día.",
  },
  {
    question: "¿La facturación AFIP funciona igual que en Tango?",
    answer:
      "Sí. Orvex emite factura A, B, C con CAE de AFIP directo. El plan Profesional incluye hasta 500 facturas/mes — suficiente para la mayoría de comercios chicos. Si necesitás más, tenemos plan Empresa.",
  },
  {
    question: "¿Cuánto sale comparado con Tango?",
    answer:
      "Tango Gestión arranca en ~$80.000 ARS/mes para licencia local con módulo Gestión + Punto de Venta, y se suma costo por usuario adicional. Orvex Plan Básico es $9.999 ARS/mes con 3 usuarios incluidos, Plan Profesional $24.900 ARS/mes con 10 usuarios + AFIP + IA. Reducís 60-80% el costo manteniendo las funciones core.",
  },
  {
    question: "¿Funciona si se cae internet?",
    answer:
      "Sí, ese es uno de los puntos donde más diferencia hay vs Tango. Orvex tiene POS offline-first: vendés sin conexión, las ventas se guardan en el dispositivo y se sincronizan automático cuando vuelve la red. Tango necesita el servidor encendido sí o sí.",
  },
  {
    question: "¿Y los reportes? Tango los tiene muy detallados.",
    answer:
      "Orvex tiene los reportes que el comercio chico realmente usa: ventas por día/semana/mes, productos más vendidos, stock muerto, plan de compras semanal, IVA del período, margen por producto. Reportes específicos contables más profundos (libro IVA ventas/compras, retenciones, percepciones) están en roadmap.",
  },
  {
    question: "¿Hay que descargar e instalar?",
    answer:
      "No. Orvex corre en el navegador (Chrome, Safari, Edge). Lo abrís en cualquier compu, tablet o celu y ya estás. Si querés, lo instalás como app (PWA) en 3 toques para que quede como ícono propio sin pasar por App Store. Tango requiere instalación en cada PC + licencia por equipo.",
  },
]

export default function AlternativaTangoBejermanPage() {
  return (
    <>
      <JsonLd
        data={[
          organizationSchema(),
          softwareApplicationSchema(),
          breadcrumbSchema([
            { name: "Inicio", url: "https://cobraorvex.com/" },
            { name: "Alternativa a Tango / Bejerman", url: "https://cobraorvex.com/alternativa-tango-bejerman" },
          ]),
          faqPageSchema(FAQ),
        ]}
      />
      <LandingShell
        pillLabel="Para comercios que vienen de sistemas viejos"
        title="Alternativa a Tango Gestión y Bejerman"
        subtitle="Si tu comercio quedó chico para Tango o el costo se te volvió grande, Orvex es una alternativa moderna: web, sin instalación, offline-first, AFIP integrado, plan gratis para arrancar."
        highlights={[
          "60-80% más económico que Tango",
          "Sin instalación, corre en cualquier dispositivo",
          "Offline-first (vendés sin internet)",
          "AFIP / ARCA integrado",
        ]}
      >
        <h2>¿Por qué cambiar de Tango o Bejerman?</h2>
        <p>
          Tango Gestión y Bejerman fueron los referentes de software de
          gestión en Argentina durante 20+ años. Funcionan, pero hoy están
          desfasados para el comercio chico que arrancó después del 2020:
        </p>
        <ul>
          <li><strong>Costo creciente</strong>: licencias por usuario, módulos extra, soporte y actualizaciones suman. Para un kiosco o almacén chico, terminás pagando $80.000+ por mes en algo que usás al 20%.</li>
          <li><strong>Instalación local</strong>: necesitás una PC dedicada como "servidor", backups manuales, IT que sepa. Si se cae la PC, no vendés.</li>
          <li><strong>Sin offline real</strong>: si se cae internet o el servidor, perdés ventas o las anotás en papel.</li>
          <li><strong>UI pesada</strong>: pensada para contadores y administrativos, no para el dueño que también atiende mostrador.</li>
          <li><strong>Móvil flojo</strong>: las versiones web son patches, no fueron pensadas para usar en el celu mientras atendés.</li>
        </ul>

        <h2>Lo que Orvex hace distinto</h2>

        <h3>Es web pura, no es instalación</h3>
        <p>
          Abrís el navegador en cualquier compu, tablet o celu, te logueás y
          ya. Si querés que quede como app, lo instalás como PWA en 3 toques.
          No hay servidor local, no hay backups manuales, no hay PC dedicada.
          Si se te rompe la compu, agarrás otra y entrás con tus credenciales
          — todo lo tuyo está intacto.
        </p>

        <h3>Offline-first de verdad</h3>
        <p>
          El POS funciona sin internet. Las ventas se guardan en el dispositivo
          y se sincronizan automático cuando vuelve la conexión. No perdés una
          venta porque se cayó el Wi-Fi.
        </p>

        <h3>Costo realista para comercio chico</h3>
        <p>
          Plan Gratis $0 ARS/mes permanente. Plan Básico $9.999 ARS/mes con
          3 usuarios. Plan Profesional $24.900 ARS/mes con AFIP integrado,
          IA, 10 usuarios. Compará con los $80.000+/mes que cuesta Tango
          básico con módulos.
        </p>

        <h3>AFIP / ARCA directo</h3>
        <p>
          Plan Profesional emite factura A, B, C con CAE directo desde el POS.
          Hasta 500 facturas/mes incluidas. Manejo automático de Monotributo
          y Responsable Inscripto. QR de AFIP en el ticket.
        </p>

        <h3>IA que te ayuda en el día a día</h3>
        <p>
          Chatbot integrado al que le preguntás "cuánto vendí ayer", "qué
          tengo bajo stock", "cuál es mi margen". Insights automáticos te
          alertan caídas de venta o productos que conviene reponer. Pedidos
          a proveedor sugeridos según patrones reales de tu comercio. Cosa
          que Tango no tiene.
        </p>

        <h3>Pensado para Argentina, mantenido en Argentina</h3>
        <p>
          Catálogo argentino pre-cargado (Coca, Quilmes, Marlboro, etc).
          Soporte en español rioplatense. Precios en pesos. Integración con
          MercadoPago. Equipo argentino que entiende cómo es vender en un
          kiosco de acá.
        </p>

        <h2>Cuándo Tango sigue siendo mejor opción</h2>
        <p>
          Honestidad: Orvex no es para todo el mundo. Si tu comercio es:
        </p>
        <ul>
          <li>Una empresa mediana/grande con +10.000 productos</li>
          <li>Necesitás libro IVA ventas/compras certificado, retenciones, percepciones a nivel detallado</li>
          <li>Cadena con 10+ sucursales centralizadas</li>
          <li>Integración compleja con sistemas contables externos (Bejerman Contable, etc.)</li>
        </ul>
        <p>
          ...para esos casos Tango sigue siendo más completo. Orvex está
          enfocado en kioscos, almacenes, farmacias, verdulerías, fiambrerías
          y comercios chicos en general — donde la simplicidad y el costo
          importan más que la profundidad contable.
        </p>

        <h2>Migrar es fácil</h2>
        <ol>
          <li>Exportás tu catálogo de Tango a Excel.</li>
          <li>Te registrás en Orvex (gratis, sin tarjeta).</li>
          <li>Importás el Excel en Inventario → Importar. El sistema detecta duplicados.</li>
          <li>Configurás AFIP en Configuración → AFIP (subís certificados).</li>
          <li>Empezás a vender el lunes.</li>
        </ol>

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
