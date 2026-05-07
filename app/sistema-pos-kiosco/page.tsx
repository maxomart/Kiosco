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
  title: "Sistema POS para Kioscos en Argentina | Orvex",
  description:
    "Sistema POS para kioscos argentinos: ventas, inventario, caja, AFIP y reportes con IA. Funciona offline, se actualiza solo. Plan gratis sin tarjeta. Pago desde $9.999/mes.",
  alternates: { canonical: "https://cobraorvex.com/sistema-pos-kiosco" },
  openGraph: {
    title: "Sistema POS para Kioscos en Argentina",
    description:
      "Reemplazá el cuaderno y el Excel. Vendé, controlá stock y emití facturas AFIP desde una app que funciona offline.",
    type: "website",
    locale: "es_AR",
  },
}

const FAQ = [
  {
    question: "¿Qué es un sistema POS para kioscos?",
    answer:
      "Un sistema POS (Point of Sale, punto de venta) es un software que reemplaza la calculadora, el cuaderno y la caja registradora. Te permite cobrar ventas, descontar stock automáticamente, emitir facturas o tickets, controlar tu caja diaria y ver reportes. Para un kiosco argentino lo más importante es que funcione rápido en el mostrador, integre con AFIP/ARCA para facturación electrónica, y soporte todos los métodos de pago locales (efectivo, débito, crédito, MercadoPago, Cuenta DNI, MODO).",
  },
  {
    question: "¿Cuánto cuesta un sistema POS para kiosco en Argentina?",
    answer:
      "Los precios varían mucho. Los sistemas tradicionales arrancan en $30.000-50.000 ARS/mes y suben según features. Orvex tiene un plan Gratis permanente sin tarjeta (100 productos, 50 ventas/mes), un plan Básico de $9.999 ARS/mes con 1.000 productos y 3 usuarios, y un plan Profesional de $24.900 ARS/mes con IA, AFIP integrado y multi-caja.",
  },
  {
    question: "¿Qué hardware necesito para usar Orvex?",
    answer:
      "Cualquier celular, tablet o computadora con un navegador moderno. No necesitás equipos específicos. Si querés escanear códigos de barras, podés usar la cámara del celular o un lector USB barato (~$15.000-25.000 ARS). Si querés imprimir tickets, una impresora térmica de 58mm o 80mm (~$40.000-80.000 ARS).",
  },
  {
    question: "¿Funciona si se cae internet?",
    answer:
      "Sí. El POS de Orvex es offline-first: las ventas se guardan en el dispositivo y se sincronizan solas cuando vuelve la conexión. No perdés ninguna venta por un corte de wifi.",
  },
  {
    question: "¿Emite factura electrónica para AFIP?",
    answer:
      "Sí, en el plan Profesional ($24.900 ARS/mes). Integramos directo con ARCA (ex AFIP) y emitimos factura A, B y C con CAE en el momento de la venta. Soporta Monotributo, Responsable Inscripto y Exento.",
  },
]

export default function SistemaPosKioscoPage() {
  return (
    <>
      <JsonLd
        data={[
          organizationSchema(),
          softwareApplicationSchema(),
          breadcrumbSchema([
            { name: "Inicio", url: "https://cobraorvex.com/" },
            { name: "Sistema POS para Kioscos", url: "https://cobraorvex.com/sistema-pos-kiosco" },
          ]),
          faqPageSchema(FAQ),
        ]}
      />
      <LandingShell
        pillLabel="Para kioscos argentinos"
        title="Sistema POS para Kioscos en Argentina"
        subtitle="Vendé, controlá tu stock y emití facturas AFIP desde el celu, la tablet o la compu del mostrador. Funciona offline, sin papel, sin Excel del 2009."
        highlights={[
          "Ventas en 3 toques",
          "Stock al toque por código de barras",
          "AFIP / ARCA integrado",
          "Funciona offline",
        ]}
      >
        <h2>El cuaderno se quedó sin espacio</h2>
        <p>
          Un kiosco argentino mueve entre 80 y 300 ventas por día, dependiendo de
          la zona y la hora. Si lo seguís llevando en cuaderno, calculadora o un
          Excel que llenás a la noche, cualquiera de estas tres cosas te debe estar
          pasando: <strong>vas tarde a contar la caja</strong>, <strong>te
          equivocás con el vuelto</strong> y <strong>nunca sabés cuál producto
          realmente te deja plata</strong>. Orvex es el sistema pensado para
          resolver eso sin pelear con un software hecho para empresas grandes.
        </p>

        <h2>Qué incluye Orvex</h2>

        <h3>Punto de venta (POS)</h3>
        <p>
          Buscás el producto por nombre o le pasás el código de barras con la
          cámara del celular. El precio aparece, sumás cantidad, elegís método de
          pago (efectivo, débito, crédito, MercadoPago, Cuenta DNI, MODO, Naranja
          X, Ualá, transferencia, mixto), confirmás. Listo. La venta queda
          registrada, el stock se descuenta solo, y la caja se actualiza al toque.
          Todo en menos de 10 segundos por venta.
        </p>

        <h3>Inventario inteligente</h3>
        <p>
          Cargás tus productos una vez. Si tenés Excel de tu proveedor, lo subís
          y la IA detecta las columnas sola. Si tenés un ticket de
          Maxiconsumo/Vital/Diarco, le sacás foto y la IA extrae los productos
          con sus precios. Si querés cargar a mano, el sistema te sugiere
          productos típicos (Coca-Cola 2.25L, Marlboro Box, Bon o Bon, Quilmes
          1L, etc.) con precios orientativos basados en lo que cargan otros
          kioscos.
        </p>

        <h3>Caja diaria</h3>
        <p>
          Apertura, cierre, conteo de efectivo. Al cerrar, te dice cuánto
          esperaba ver y la diferencia. Si tenés varios cajeros con turnos, cada
          uno cierra su sesión y queda el rastro de quién vendió qué.
        </p>

        <h3>Facturación electrónica AFIP</h3>
        <p>
          En el plan Profesional, integrás tu CUIT y emitís factura A, B o C con
          CAE directo desde el POS. Sin pasar por la web de ARCA, sin copiar
          datos a mano. Soporta Monotributo y Responsable Inscripto.
        </p>

        <h3>Reportes accionables</h3>
        <p>
          Ventas por día, por producto, por método de pago. Pero más importante:
          te dice <strong>qué producto tiene stock pero no se vende hace 60
          días</strong> (capital atrapado), <strong>qué reponer esta semana
          según la velocidad de venta</strong>, y <strong>cuánto IVA tenés que
          pasarle al contador este mes</strong> en CSV listo para mandar.
        </p>

        <h2>Para qué tipo de kiosco sirve</h2>
        <ul>
          <li>Kiosco de barrio clásico (golosinas, bebidas, cigarrillos)</li>
          <li>Maxikiosco con productos varios (almacén + cigarrillos + bebidas)</li>
          <li>Kiosco-polirubro con cargas SUBE, recargas y servicios</li>
          <li>Kiosco con cuenta corriente para vecinos habituales</li>
          <li>Kiosco-almacén / despensa de barrio</li>
          <li>Kiosco con varios turnos de cajeros</li>
        </ul>

        <h2>Cuánto cuesta</h2>
        <ul>
          <li><strong>Gratis</strong>: $0 ARS/mes permanente. 100 productos, 1 usuario, 50 ventas/mes. Ideal para arrancar y ver si te sirve.</li>
          <li><strong>Básico</strong>: $9.999 ARS/mes. 1.000 productos, 3 usuarios, logo y tema custom, importar Excel, etiquetas con código de barras, history ilimitado.</li>
          <li><strong>Profesional</strong>: $24.900 ARS/mes. 5.000 productos, 10 usuarios, IA predictiva, AFIP 500 facturas/mes, multi-caja, soporte prioritario.</li>
        </ul>
        <p>
          Todos los planes pagos tienen <strong>7 días de prueba sin cargar
          tarjeta</strong>. Si no te sirve, no pasa nada — tu cuenta queda en
          plan Gratis con tus datos guardados.
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
