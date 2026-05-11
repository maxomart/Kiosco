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
  title: "Factura Electrónica ARCA / AFIP para Monotributo y RI | Orvex",
  description:
    "Emití factura electrónica ARCA (ex AFIP) directo desde tu POS. Soporta Monotributo, Responsable Inscripto y Exento. Factura A, B y C con CAE en el momento. Plan Profesional $24.900 ARS/mes.",
  alternates: { canonical: "https://cobraorvex.com/factura-electronica-arca-monotributo" },
  openGraph: {
    title: "Factura Electrónica ARCA para Monotributistas",
    description:
      "Sin pasar por la web de ARCA, sin copiar datos a mano. Factura A/B/C con CAE directo desde el POS de Orvex.",
    type: "website",
    locale: "es_AR",
    images: [{ url: "https://cobraorvex.com/api/og?title=Factura+Electr%C3%B3nica+AFIP+%2F+ARCA&pill=Monotributo+y+RI", width: 1200, height: 630, alt: "Orvex" }],
  },
}

const FAQ = [
  {
    question: "¿Qué es ARCA y por qué cambió el nombre AFIP?",
    answer:
      "AFIP (Administración Federal de Ingresos Públicos) cambió de nombre a ARCA (Agencia de Recaudación y Control Aduanero) en 2024. Es el mismo organismo, mismas obligaciones, mismas APIs. La gente lo sigue llamando 'AFIP' por costumbre, pero la URL oficial ahora es arca.gob.ar y los servicios web tienen marca ARCA. Para los kiosqueros y comerciantes argentinos, no cambia nada de fondo: seguís facturando igual, con tu CUIT y tu clave fiscal.",
  },
  {
    question: "¿Necesito ser Monotributo o Responsable Inscripto para facturar?",
    answer:
      "Depende de cuánto facturás al año y de tu actividad. La mayoría de los kioscos chicos son Monotributistas (categorías A, B, C, D según facturación). Responsable Inscripto es para comercios con facturación más alta o que necesitan deducir IVA. Orvex soporta los tres: Monotributo, Responsable Inscripto y Exento.",
  },
  {
    question: "¿Qué tipo de factura emite Orvex?",
    answer:
      "Factura A (cuando vendés a Responsable Inscripto y vos también sos RI), Factura B (cuando vendés a Consumidor Final, Exento o Monotributo), y Factura C (cuando vos sos Monotributista vendiendo a cualquiera). El sistema te deja elegir el tipo en cada venta o aplicarlo automáticamente según la condición fiscal del cliente que cargues.",
  },
  {
    question: "¿Cuánto sale por factura?",
    answer:
      "ARCA no cobra por emitir facturas — es gratis. Lo que cobramos nosotros es el plan: $24.900 ARS/mes (Profesional) que incluye 500 facturas/mes. Si emitís más de 500 al mes, contactanos para evaluar plan Empresa.",
  },
  {
    question: "¿Cómo configuro mi CUIT en Orvex?",
    answer:
      "Vas a Configuración → AFIP. Cargás tu CUIT (lo validamos con el algoritmo oficial), elegís tu condición frente al IVA y tu punto de venta. Después tenés dos opciones: 'modo automático' (entrás tu clave fiscal nivel 3+ una vez y nosotros generamos el certificado X.509 contra ARCA por vos), o 'modo manual' (subís el certificado .crt y .key que ya tenés). En 5 minutos estás emitiendo.",
  },
  {
    question: "¿Y si AFIP / ARCA está caído?",
    answer:
      "Si el servicio web de ARCA no responde, el sistema te avisa al toque. La venta queda registrada como 'pendiente de CAE' y reintenta automáticamente cada algunos minutos. Cuando ARCA vuelve, se procesa sola. No perdés la venta, solo la factura tarda un poco más en salir.",
  },
]

export default function FacturaElectronicaArcaPage() {
  return (
    <>
      <JsonLd
        data={[
          organizationSchema(),
          softwareApplicationSchema(),
          breadcrumbSchema([
            { name: "Inicio", url: "https://cobraorvex.com/" },
            { name: "Factura Electrónica ARCA", url: "https://cobraorvex.com/factura-electronica-arca-monotributo" },
          ]),
          faqPageSchema(FAQ),
        ]}
      />
      <LandingShell
        pillLabel="Facturación electrónica AFIP / ARCA"
        title="Factura Electrónica ARCA para Monotributo y RI"
        subtitle="Emití factura A, B o C con CAE directo desde el POS. Sin pasar por la web de ARCA, sin copiar datos a mano. Setup en 5 minutos."
        highlights={[
          "Factura A, B y C con CAE",
          "Monotributo, RI y Exento",
          "Setup en 5 minutos",
          "500 facturas/mes",
        ]}
      >
        <h2>El dolor: facturar por la web de ARCA</h2>
        <p>
          Si sos Monotributista y todavía facturás manualmente entrando a la
          web de ARCA cada vez que un cliente te pide factura, sabés que es
          un infierno: cargar el CUIT del cliente, tipear los items, esperar
          a que el sistema responda, copiar el CAE a mano. Para una venta
          de $5.000 perdés 3-4 minutos de mostrador. Para una farmacia o
          minisúper que factura 30-50 veces por día, son <strong>2 horas
          diarias</strong> regaladas a la burocracia.
        </p>

        <h2>Lo que hace Orvex</h2>
        <p>
          En el plan Profesional ($24.900 ARS/mes), Orvex se conecta con
          ARCA usando el certificado X.509 oficial. Cada vez que emitís una
          factura desde el POS, el sistema:
        </p>
        <ol>
          <li>Detecta el tipo de factura según condición fiscal del cliente</li>
          <li>Manda los datos a ARCA</li>
          <li>Recibe el CAE (Código de Autorización Electrónico)</li>
          <li>Genera el comprobante con QR oficial</li>
          <li>Lo guarda en la venta y lo imprime / lo manda por email</li>
        </ol>
        <p>
          Todo en 2-3 segundos en condiciones normales. El cajero no se
          entera de nada — solo aprieta "facturar" en el POS y sigue con la
          próxima venta.
        </p>

        <h2>Tipos de factura que soporta</h2>
        <ul>
          <li><strong>Factura A</strong>: vendés a un Responsable Inscripto y vos también sos RI. Discrimina IVA.</li>
          <li><strong>Factura B</strong>: vendés a Consumidor Final, Exento, o Monotributo siendo vos RI. No discrimina IVA en el comprobante.</li>
          <li><strong>Factura C</strong>: la que emiten los Monotributistas a cualquier tipo de cliente. Sin discriminación de IVA porque el monotributo es un régimen simplificado.</li>
          <li><strong>Notas de crédito y débito</strong>: anulaciones y ajustes con el mismo flow.</li>
        </ul>

        <h2>Setup: 5 minutos</h2>
        <p>
          Vas a Configuración → AFIP en Orvex. Llenás 3 campos:
        </p>
        <ol>
          <li><strong>CUIT</strong> (11 dígitos sin guiones — validamos al toque)</li>
          <li><strong>Condición frente al IVA</strong> (Monotributo / RI / Exento)</li>
          <li><strong>Punto de venta</strong> (1 si tenés una sola sucursal)</li>
        </ol>
        <p>
          Después elegís entre dos modos:
        </p>
        <ul>
          <li><strong>Modo automático (recomendado)</strong>: entrás tu clave fiscal nivel 3+ una sola vez. Nosotros generamos el certificado X.509 directo en ARCA. Nunca guardamos tu clave fiscal — solo la usamos para esa operación.</li>
          <li><strong>Modo manual</strong>: si ya tenés certificado .crt y .key (porque te lo dio tu contador), lo subís directo.</li>
        </ul>

        <h2>Seguridad</h2>
        <p>
          Tu certificado privado se encripta en nuestra base con AES-256-GCM.
          Solo el server lo desencripta en el momento de emitir factura. La
          clave de encriptación está en variables de entorno separadas de
          la base de datos. En el peor caso de una breach, el atacante no
          puede emitir facturas en tu nombre.
        </p>

        <h2>Cuánto cuesta</h2>
        <ul>
          <li><strong>Gratis y Básico</strong>: NO incluyen facturación electrónica. Para emitir necesitás Profesional.</li>
          <li><strong>Profesional</strong>: $24.900 ARS/mes. 500 facturas/mes incluidas. Las facturas no consumidas no se acumulan — empezás cada mes con 500 nuevas.</li>
        </ul>
        <p>
          Si necesitás más de 500 facturas por mes (caso de minisúper grande
          o farmacia con mucho volumen B2B), escribinos a soporte@cobraorvex.com
          para evaluar plan custom.
        </p>

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
