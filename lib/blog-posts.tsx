/**
 * Posts del blog de Orvex. Pequeño CMS interno: cada post es un objeto
 * con metadata + body en JSX. Sin MDX/markdown para no sumar dependency
 * — todo TypeScript validado en build time.
 *
 * Cuando agregás un post:
 *   1. Sumás un objeto a este array (slug, title, description, etc.)
 *   2. Sumás el slug + updatedAt a app/sitemap.ts → BLOG_POSTS
 *   3. Listo. Aparece en /blog y se renderiza en /blog/[slug] solo.
 */

import type { ReactNode } from "react"

export interface BlogPost {
  slug: string
  title: string
  /** ~140-160 caracteres para meta description y card del index. */
  description: string
  /** ISO date — se usa para schema.org Article y orden cronológico. */
  publishedAt: string
  updatedAt?: string
  /** Lectura estimada en minutos. */
  readTime: number
  /** Tags para clasificar (no es taxonomía, solo para mostrar). */
  tags: string[]
  /** Render del cuerpo del post — JSX completo con headings, listas, etc. */
  body: ReactNode
  /**
   * Pasos estructurados para Schema.org/HowTo. Sólo aplica a posts
   * tipo "cómo hacer X paso a paso". Google muestra estos pasos como
   * rich snippet expandible en los resultados, aumentando CTR.
   * Si está presente, también `howToTotalTime` (ISO 8601, ej "PT15M").
   */
  howToSteps?: Array<{ name: string; text: string }>
  howToTotalTime?: string
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "cuanto-cuesta-abrir-kiosco-argentina-2026",
    title: "¿Cuánto cuesta abrir un kiosco en Argentina en 2026?",
    description:
      "Análisis honesto de la inversión inicial, mercadería, alquiler y trámites para arrancar un kiosco en CABA o Gran Buenos Aires en 2026.",
    publishedAt: "2026-04-15",
    readTime: 7,
    tags: ["kiosco", "negocio", "presupuesto"],
    body: (
      <>
        <p>
          Si estás pensando en arrancar un kiosco en Argentina en 2026, este
          post te tira los números reales de qué te va a costar y qué tenés
          que tener en cuenta. No es una guía mágica — es la realidad: con
          inflación, alquileres caros y mayoristas que ajustan precios cada
          dos semanas.
        </p>

        <h2>Inversión inicial: $4 a 8 millones de pesos</h2>
        <p>
          Para un kiosco mediano en barrio residencial de CABA o Gran Buenos
          Aires, en 2026 estás mirando entre <strong>$4.000.000 y
          $8.000.000 ARS</strong> de inversión inicial. El rango depende
          mucho de si arrancás de cero o si comprás un fondo de comercio.
        </p>

        <h3>Si arrancás de cero (local vacío)</h3>
        <ul>
          <li><strong>Mercadería inicial</strong>: $1.500.000 - $3.000.000 ARS. Para tener una góndola surtida con bebidas (Coca, Pepsi, aguas, cervezas), cigarrillos (8-10 marcas), golosinas (chocolates, alfajores, chicles, caramelos), galletitas y algunos productos varios. Si además vas a tener cargas SUBE, recargas y servicios, sumá $200.000-300.000 ARS de capital de trabajo.</li>
          <li><strong>Mobiliario</strong>: $800.000 - $1.500.000 ARS. Heladera exhibidora (las nuevas de 400 litros andan en $700K), góndola de cigarrillos, mostrador, cajón para guardar, balanza si vendés productos pesables.</li>
          <li><strong>Tecnología</strong>: $200.000 - $400.000 ARS. Tablet o computadora, lectora de código de barras, impresora térmica de tickets, posnet (Naranja X / Mercado Pago Point / Modo o el del banco).</li>
          <li><strong>Habilitaciones y trámites</strong>: $150.000 - $300.000 ARS. Habilitación municipal, libreta sanitaria, libro de quejas, alta en AFIP/ARCA (Monotributo), seguro de responsabilidad civil.</li>
          <li><strong>Reserva de capital</strong>: ahorrá al menos $1.000.000 ARS de colchón para los primeros 2-3 meses sin generar plata.</li>
        </ul>

        <h3>Si comprás un fondo de comercio</h3>
        <p>
          Lo barato son fondos de $3.000.000 - $5.000.000 ARS por kioscos
          chicos en barrios residenciales. Lo caro: $15.000.000 - $30.000.000
          ARS por kioscos en zonas comerciales con alto tráfico (av. Córdoba,
          esquinas concurridas en Avellaneda, La Plata centro). Antes de
          comprar, pedí 3 meses de tickets de venta y verificá que la cifra
          que te dicen sea real — la trampa más común es que el dueño infla
          la facturación.
        </p>

        <h2>Costos mensuales: $1 a 3 millones</h2>
        <p>
          Una vez funcionando, tus costos mensuales típicos son:
        </p>
        <ul>
          <li><strong>Alquiler</strong>: $300.000 - $1.200.000 ARS según zona y tamaño. Una buena esquina en CABA puede pasar los $1.5M.</li>
          <li><strong>Servicios</strong>: $100.000 - $200.000 ARS (luz, agua, internet, ABL).</li>
          <li><strong>Reposición mercadería</strong>: 60-70% de lo que vendés. Es el costo más grande pero también es lo que genera tu plata.</li>
          <li><strong>Empleado/s</strong> (si no atendés solo): $400.000 - $700.000 ARS por cada uno (sueldo + cargas).</li>
          <li><strong>Sistema de gestión</strong>: $0 a $25.000 ARS. <a href="/">Orvex</a> tiene plan gratis para arrancar y planes pagos desde $9.999/mes con AFIP integrado.</li>
          <li><strong>Comisiones de pago</strong>: 1-3% sobre lo que cobrás con tarjeta o MercadoPago. Si vendés $3M/mes y 70% son tarjeta, perdés $40K-90K en comisiones.</li>
        </ul>

        <h2>Cuánto facturás (lo realista)</h2>
        <p>
          Un kiosco mediano de barrio residencial en 2026 factura entre
          <strong>$3.000.000 y $7.000.000 ARS por mes</strong>. Con margen
          bruto del 25-35% (después de costo de mercadería), te queda
          <strong>$750.000 - $2.500.000 ARS de ingreso bruto antes de
          gastos fijos</strong>.
        </p>
        <p>
          Después de descontar alquiler, servicios, sistema y comisiones, el
          ingreso neto del dueño está en el rango de <strong>$300.000 a
          $1.500.000 ARS/mes</strong>. La gran diferencia la hace la
          ubicación, los rubros que sumes (cigarrillos tienen márgenes
          chicos pero alta rotación, golosinas tienen márgenes mejores),
          y cuánto control tengas del stock muerto.
        </p>

        <h2>El error #1 que mata kioscos chicos</h2>
        <p>
          Comprar mercadería sin saber qué se vende. El kiosquero típico
          compra al mayorista lo que <em>cree</em> que se va a vender
          basándose en la intuición. Después se encuentra con $300.000-
          500.000 ARS en stock parado que se vence o que tiene que liquidar
          al costo. Es la fuga de plata más grande y la menos visible.
        </p>
        <p>
          Por eso el primer mes te conviene tener algún sistema (aunque sea
          gratis) para registrar cada venta. Después de 30 días tenés datos
          reales de qué se vende y qué no, y ahí podés ajustar el pedido
          al mayorista.
        </p>

        <h2>Resumen rápido</h2>
        <ul>
          <li>Inversión inicial: $4M-$8M ARS si arrancás de cero, más si comprás fondo de comercio.</li>
          <li>Costos mensuales: $1M-$3M ARS según zona y empleados.</li>
          <li>Facturación esperable: $3M-$7M ARS/mes en barrio residencial.</li>
          <li>Ingreso neto del dueño: $300K-$1.5M ARS/mes.</li>
          <li>Llevá un sistema desde el día 1 para no acumular stock muerto.</li>
        </ul>

        <p>
          Si vas a arrancar y querés empezar con el sistema desde el día 1,
          podés probar <a href="/">Orvex gratis</a> sin cargar tarjeta — el
          plan Gratis cubre 100 productos y 50 ventas al mes, más que
          suficiente para los primeros días mientras vas viendo qué tal.
        </p>
      </>
    ),
  },
  {
    slug: "factura-a-b-c-afip-monotributista",
    title: "Factura A, B y C de AFIP: cuál emite cada negocio",
    description:
      "Guía rápida para entender qué tipo de factura electrónica AFIP/ARCA emite tu kiosco, almacén o farmacia según tu condición fiscal.",
    publishedAt: "2026-04-22",
    readTime: 5,
    tags: ["AFIP", "facturación", "monotributo"],
    body: (
      <>
        <p>
          Si tenés un comercio en Argentina y te confundís entre Factura A,
          B y C, no sos el único. Es algo que el contador te explica una vez
          y después te olvidás. Acá va la versión corta y clara.
        </p>

        <h2>La regla de oro</h2>
        <p>
          El tipo de factura depende de <strong>dos cosas</strong>:
        </p>
        <ol>
          <li>Tu condición fiscal (vendedor)</li>
          <li>La condición fiscal del que te compra (cliente)</li>
        </ol>

        <h2>Factura A — Entre Responsables Inscriptos</h2>
        <p>
          La emite un Responsable Inscripto (RI) cuando le vende a otro RI.
          Discrimina IVA en el comprobante (10,5% o 21% según producto). El
          comprador puede tomar ese IVA como crédito fiscal.
        </p>
        <p>
          <strong>Ejemplo</strong>: una distribuidora mayorista (RI) le
          vende mercadería a un minisúper (RI). El mini quiere descontar el
          IVA de su declaración mensual, así que pide Factura A.
        </p>

        <h2>Factura B — RI vendiendo a Consumidor Final, Exento o Monotributo</h2>
        <p>
          La emite un Responsable Inscripto cuando le vende a alguien que NO
          es RI: consumidor final, exento de IVA, o monotributista. NO
          discrimina el IVA en el comprobante (porque al cliente no le sirve
          tomarlo).
        </p>
        <p>
          <strong>Ejemplo</strong>: una farmacia RI le factura a un cliente
          común que paga con tarjeta o le pide la factura para reembolso de
          su obra social.
        </p>

        <h2>Factura C — Para Monotributistas</h2>
        <p>
          Si vos sos Monotributista, emitís Factura C a cualquier tipo de
          cliente (RI, consumidor final, exento, otro monotributista). El
          monotributo es un régimen simplificado y no discrimina IVA, así
          que la factura es más simple.
        </p>
        <p>
          <strong>Ejemplo</strong>: el kiosco de la esquina, la verdulería
          del barrio, el almacén familiar. La gran mayoría de los comercios
          chicos en Argentina son Monotributistas.
        </p>

        <h2>¿Qué condición fiscal te conviene?</h2>
        <p>
          Depende de cuánto facturás al año y a qué clientes le vendés.
        </p>
        <ul>
          <li><strong>Monotributo</strong> es lo más simple y barato. Si tu facturación anual está dentro de los topes (en 2026 las categorías van desde A hasta K, con topes que se ajustan por inflación cada 6 meses), te conviene. Pagás un único monto mensual fijo que incluye impuestos + jubilación + obra social.</li>
          <li><strong>Responsable Inscripto</strong> te conviene si tu facturación supera los topes del Monotributo, o si tus clientes son mayoritariamente RI y necesitan Factura A para deducir IVA.</li>
        </ul>

        <h2>¿Estoy obligado a facturar?</h2>
        <p>
          Sí, en Argentina toda venta tiene que estar respaldada con un
          comprobante. La excepción es que muchos kioscos chicos venden a
          consumidor final que no pide factura, y entregan ticket no fiscal
          (tipo "X"). Eso está bien siempre que registres la venta de alguna
          manera y declares la facturación correcta.
        </p>
        <p>
          Sin embargo, ARCA exige factura electrónica con CAE en la mayoría
          de los casos. Si querés operar formal y evitarte problemas, mejor
          emitir factura desde el día 1.
        </p>

        <h2>¿Cómo emito factura electrónica sin pasar por la web de ARCA?</h2>
        <p>
          La web de ARCA es lenta y cargás los datos a mano. Lo que hace la
          mayoría de los comercios profesionales es usar un sistema de
          gestión que se conecta directo con ARCA por web service y emite
          la factura desde el POS en 2-3 segundos.
        </p>
        <p>
          <a href="/factura-electronica-arca-monotributo">Orvex</a> tiene
          esa integración en el plan Profesional ($24.900 ARS/mes). Cargás
          tu CUIT, tu clave fiscal nivel 3+ una sola vez, y a partir de ahí
          emitís factura A, B o C con CAE directo desde el mostrador. 500
          facturas/mes incluidas.
        </p>

        <h2>Resumen</h2>
        <ul>
          <li>Si sos Monotributista: emitís Factura C a todo el mundo. Punto.</li>
          <li>Si sos RI: emitís A a otros RI, B al resto.</li>
          <li>Toda venta debe tener comprobante; la mayoría de los casos requieren factura electrónica con CAE.</li>
          <li>Para evitar la web lenta de ARCA, usá un sistema con integración directa.</li>
        </ul>
      </>
    ),
  },
  {
    slug: "productos-mas-vendidos-kiosco-argentino",
    title: "Productos más vendidos en kioscos argentinos: ranking 2026",
    description:
      "Análisis del top 30 productos que más venden los kioscos argentinos en 2026 según datos agregados de comercios chicos. Por categoría: bebidas, cigarrillos, golosinas, snacks.",
    publishedAt: "2026-04-29",
    readTime: 6,
    tags: ["kiosco", "ranking", "productos"],
    body: (
      <>
        <p>
          Si estás armando el surtido de tu kiosco o querés comparar tus
          ventas contra el promedio de otros kioscos argentinos, este
          ranking es para vos. Datos basados en lo que típicamente más se
          vende en kioscos de barrio en CABA y GBA en 2026.
        </p>

        <h2>Bebidas — top 10</h2>
        <ol>
          <li><strong>Coca-Cola 2.25L</strong> — la reina indiscutida. Si solo podés tener 5 bebidas, la primera es esta.</li>
          <li><strong>Coca-Cola 1.5L</strong> — el formato ideal para una persona o dos.</li>
          <li><strong>Coca-Cola 600ml individual</strong> — alta rotación, márgen mejor que las grandes.</li>
          <li><strong>Coca-Cola Zero 2.25L</strong> — creció mucho los últimos 2 años.</li>
          <li><strong>Sprite 2.25L</strong> — la segunda gaseosa más vendida.</li>
          <li><strong>Quilmes 1L</strong> — el clásico del fin de semana.</li>
          <li><strong>Manaos 2.25L</strong> — opción económica que aprieta cuando hay inflación.</li>
          <li><strong>Villavicencio 1.5L</strong> — el agua mineral líder.</li>
          <li><strong>Pepsi 2.25L</strong> — segunda detrás de Coca pero firme.</li>
          <li><strong>Fanta Naranja 2.25L</strong> — la fruta más vendida.</li>
        </ol>

        <h2>Cigarrillos — top 5</h2>
        <ol>
          <li><strong>Marlboro Box 20</strong> — el más vendido en CABA y GBA.</li>
          <li><strong>Marlboro Lights 20</strong> — alternativa light del mismo line.</li>
          <li><strong>Philip Morris 20</strong> — el "económico" entre los premium.</li>
          <li><strong>Lucky Strike 20</strong> — fans de toda la vida.</li>
          <li><strong>Camel 20</strong> — sigue firme entre fumadores tradicionales.</li>
        </ol>
        <p>
          Los cigarrillos tienen márgenes regulados muy chicos (5-10% bruto)
          pero rotación brutal — son el ancla del kiosco. Si no los tenés,
          perdés tráfico.
        </p>

        <h2>Golosinas y chocolates — top 10</h2>
        <ol>
          <li><strong>Bon o Bon individual</strong> — el chocolate más vendido del país.</li>
          <li><strong>Cofler Aireado</strong> — clásico de toda la vida.</li>
          <li><strong>Sugus</strong> — la pastilla líder.</li>
          <li><strong>Beldent x10</strong> — chicle dominante.</li>
          <li><strong>Topline Pellets</strong> — el otro chicle que rota fuerte.</li>
          <li><strong>Halls Mentol</strong> — caramelo clásico.</li>
          <li><strong>Tita</strong> — alfajor chico de Bagley.</li>
          <li><strong>Rhodesia</strong> — alternativa a Tita.</li>
          <li><strong>Marroc</strong> — el tradicional con maní.</li>
          <li><strong>Águila Felfort 100g</strong> — chocolate en barra.</li>
        </ol>

        <h2>Galletitas y snacks — top 10</h2>
        <ol>
          <li><strong>Oreo</strong> — la galletita más vendida.</li>
          <li><strong>Pepitos</strong> — segundo lugar firme.</li>
          <li><strong>Lay's clásicas 137g</strong> — papas líder.</li>
          <li><strong>Doritos Queso 80g</strong> — snack más vendido en formato individual.</li>
          <li><strong>Chocolinas</strong> — el clásico para postres.</li>
          <li><strong>Toddy 200g</strong> — galletita con chocolate de toda la vida.</li>
          <li><strong>3D snacks 90g</strong> — versión gomosa que va bien con chicos.</li>
          <li><strong>Pringles tubo 124g</strong> — alta gama, rotación menor pero margen alto.</li>
          <li><strong>Cheetos 80g</strong> — competencia directa de Doritos.</li>
          <li><strong>Mantecol</strong> — el snack tradicional.</li>
        </ol>

        <h2>Cómo usar este ranking</h2>
        <p>
          Si arrancás un kiosco, esta lista es tu surtido base — los 35-40
          productos que sí o sí necesitás tener desde el día 1. Después de
          un mes de operación, mirás tus propios datos y ajustás según tu
          zona específica (un kiosco frente a una escuela vende más
          golosinas; uno cerca de oficinas vende más bebidas grandes y
          cigarrillos).
        </p>
        <p>
          <a href="/">Orvex</a> tiene este catálogo argentino pre-cargado:
          cuando tipeás "coca" en el inventario, te aparecen las 7 variantes
          (Coca-Cola, Zero, Light, en 2.25L/1.5L/600ml/lata) con precios
          orientativos basados en lo que cargan otros kioscos. Carga rápida
          en lugar de tipear todo a mano.
        </p>
      </>
    ),
  },
  {
    slug: "cuaderno-vs-excel-vs-sistema-kiosco",
    title: "Cuaderno vs Excel vs sistema: cuál te conviene para tu kiosco",
    description:
      "Comparación honesta entre llevar las cuentas en cuaderno, Excel o un sistema POS para kioscos chicos en Argentina. Pros, contras y cuándo conviene cada uno.",
    publishedAt: "2026-05-03",
    readTime: 6,
    tags: ["gestión", "kiosco", "comparativa"],
    body: (
      <>
        <p>
          Tres formas de llevar la gestión de un comercio chico en Argentina:
          cuaderno, Excel, sistema. Cada una tiene su lugar dependiendo del
          volumen y la antigüedad del negocio. Acá va una comparación sin
          marketing ni venta encubierta.
        </p>

        <h2>El cuaderno</h2>
        <p>
          Lo que usaba mi viejo, mi abuelo y miles de kiosqueros argentinos.
          Anotás las ventas del día, la caja al cerrar, lo que le debe el
          vecino del 3-B.
        </p>
        <p><strong>Lo bueno</strong>:</p>
        <ul>
          <li>Cero costo.</li>
          <li>Cero curva de aprendizaje.</li>
          <li>Funciona sin internet ni luz.</li>
        </ul>
        <p><strong>Lo malo</strong>:</p>
        <ul>
          <li>No sabés qué producto te deja plata realmente.</li>
          <li>El stock se desbalancea solo: comprás de más o de menos sin darte cuenta.</li>
          <li>Si el cuaderno se pierde o se moja, perdiste todo.</li>
          <li>Para AFIP/contador, tenés que reescribir todo a Excel o a mano cada mes.</li>
          <li>Cero análisis: no podés ver tendencias, comparar meses, detectar problemas.</li>
        </ul>
        <p><strong>Cuándo conviene</strong>: si arrancaste hace una semana, vendés menos de 30 cosas por día y tu surtido tiene menos de 50 productos. En cualquier otro escenario, te quedás corto rápido.</p>

        <h2>Excel</h2>
        <p>
          El upgrade típico cuando el cuaderno empieza a no alcanzar. Hojas
          con productos, ventas, caja diaria, cuenta corriente.
        </p>
        <p><strong>Lo bueno</strong>:</p>
        <ul>
          <li>Casi gratis (Excel viene con Microsoft, Google Sheets es gratis).</li>
          <li>Te permite ordenar, filtrar, sumar — algo de análisis básico.</li>
          <li>Si tenés que pasarle datos al contador, ya están en formato útil.</li>
          <li>Funciona offline (Excel desktop) o online (Sheets).</li>
        </ul>
        <p><strong>Lo malo</strong>:</p>
        <ul>
          <li>Cargás todo a mano en cada venta, o llenás el Excel a fin de día (pierde precisión y te lleva tiempo).</li>
          <li>No descuenta stock automático.</li>
          <li>No emite factura AFIP.</li>
          <li>No te avisa de stock bajo.</li>
          <li>Si tenés varios cajeros, los Excels se duplican y se desincronizan.</li>
          <li>El archivo se corrompe o lo borrás por error y no hay backup automático.</li>
          <li>No tenés control de quién hizo qué cambio.</li>
        </ul>
        <p><strong>Cuándo conviene</strong>: si vendés 30-100 cosas por día, manejás 100-300 productos, sos vos solo o como mucho con un ayudante. Y si te animás a planillas con fórmulas — sino se vuelve un Excel de copy-paste que no escala.</p>

        <h2>Sistema POS</h2>
        <p>
          Software diseñado específicamente para gestión de comercio. Hay
          desde sistemas corporativos caros (Calipso, Bejerman, Holístico)
          hasta opciones para comercios chicos como Orvex, Tienda Nube POS,
          Tango Caja, Defontana.
        </p>
        <p><strong>Lo bueno</strong>:</p>
        <ul>
          <li>Cargás el producto una vez. Cada venta descuenta stock automático.</li>
          <li>Reportes reales: qué vendés, qué no, márgenes por producto, comparativas históricas.</li>
          <li>AFIP integrado en los sistemas más completos: emitís factura A/B/C con CAE desde el POS.</li>
          <li>Multi-usuario con roles. El cajero solo ve POS, el dueño ve todo.</li>
          <li>Backup automático en la nube. Si se rompe la tablet, abrís en el celular y sigue todo.</li>
          <li>Funciona offline en los buenos (Orvex, por ejemplo): vendés sin internet y se sincroniza solo.</li>
          <li>Reportes accionables: qué reponer, qué tenés en stock muerto, IVA del mes.</li>
        </ul>
        <p><strong>Lo malo</strong>:</p>
        <ul>
          <li>Costo mensual recurrente. Va de $0 (planes free como el de Orvex) a $80.000+ ARS/mes en sistemas corporativos.</li>
          <li>Curva de aprendizaje inicial: 1-3 días para dominarlo.</li>
          <li>Si elegís un sistema malo, terminás peleando con el software.</li>
        </ul>
        <p><strong>Cuándo conviene</strong>: si vendés más de 50 cosas por día, tenés 100+ productos, querés tener AFIP integrado, o si querés crecer y profesionalizar el negocio. La inversión se paga sola con la plata que recuperás de stock muerto + tiempo ahorrado.</p>

        <h2>Recomendación honesta según tu situación</h2>
        <ul>
          <li><strong>Recién arrancás (semana 1)</strong>: cuaderno está OK. No te pongas a configurar sistema antes de tener ventas reales.</li>
          <li><strong>Mes 1-3 con ventas reales</strong>: sistema gratis. Como el plan Gratis de <a href="/">Orvex</a> que cubre 100 productos y 50 ventas/mes — más que suficiente para arrancar y empezar a tener datos.</li>
          <li><strong>Negocio establecido (más de 3 meses)</strong>: sistema pago. $9.999 ARS/mes (plan Básico) es nada comparado con la plata que perdés en stock muerto sin un sistema.</li>
          <li><strong>Comercio formal con AFIP</strong>: sistema con AFIP integrado. $24.900 ARS/mes (plan Profesional) y emitís facturas en 3 segundos en lugar de 4 minutos vía web ARCA.</li>
        </ul>

        <h2>El error que veo en kiosqueros que crecen</h2>
        <p>
          Los que se quedan atrás son los que defienden el cuaderno o el
          Excel hasta el final, "porque siempre lo hicieron así". Después
          se enteran a fin de año que ganaron menos plata de lo que pensaban
          porque tenían $400.000 ARS de stock parado, o tiraron mercadería
          vencida, o vendieron al costo sin saberlo. La plata que pierden
          paga el sistema 10 veces.
        </p>
      </>
    ),
  },
  {
    slug: "control-stock-minorista-mejores-practicas",
    title: "Control de stock para comercios chicos: 7 prácticas que funcionan",
    description:
      "Las 7 mejores prácticas de control de stock para kioscos, almacenes, farmacias y minisúper en Argentina. Cómo evitar quiebres, stock muerto y pérdidas por mala gestión.",
    publishedAt: "2026-05-06",
    readTime: 8,
    tags: ["stock", "gestión", "minorista"],
    body: (
      <>
        <p>
          El control de stock es la diferencia entre un comercio que crece
          y uno que apenas sobrevive. No es complicado, pero hay que ser
          consistente. Acá las 7 prácticas que más impacto tienen en
          comercios chicos argentinos según lo que vemos en datos
          agregados de Orvex.
        </p>

        <h2>1. Definir stock mínimo por producto</h2>
        <p>
          Para cada producto, definí cuántas unidades es lo mínimo que
          querés tener en góndola. Cuando el stock baja del mínimo, te
          tiene que aparecer una alerta automática.
        </p>
        <p>
          <strong>Cómo definir el mínimo</strong>: velocidad diaria × días
          que tarda tu mayorista en entregar × 1.5 (margen de seguridad).
        </p>
        <p>
          <strong>Ejemplo</strong>: vendés 5 Coca-Cola 2.25L por día y tu
          mayorista entrega en 2 días. Mínimo = 5 × 2 × 1.5 = 15 unidades.
        </p>
        <p>
          La mayoría de los kiosqueros pone el mínimo "a ojo". Después se
          quedan sin Coca un fin de semana de 35 grados y pierden el día.
        </p>

        <h2>2. Usar código de barras siempre que se pueda</h2>
        <p>
          Cargar el código EAN-13 de cada producto. Eso te ahorra:
        </p>
        <ul>
          <li>Tiempo en el mostrador (escanear es 5x más rápido que tipear).</li>
          <li>Errores: no podés cobrar Coca por Pepsi por equivocación.</li>
          <li>Permite usar la cámara del celular o un lector USB barato.</li>
        </ul>
        <p>
          Para cargar los códigos, sistemas como Orvex tienen catálogo
          argentino pre-cargado con códigos EAN reales de productos típicos
          (Coca, Marlboro, Bon o Bon, etc.). El resto los escaneás directo
          al recibir mercadería del mayorista.
        </p>

        <h2>3. Conteo periódico (inventario físico)</h2>
        <p>
          El stock que el sistema te dice y el stock real divergen siempre.
          Por roturas, mermas, robos hormiga, errores de carga, productos
          regalados al cliente fiel. Una vez al mes (o cada 15 días si tu
          rotación es muy alta), hacé un conteo físico y ajustá el stock
          en el sistema.
        </p>
        <p>
          No tenés que contar todo de una. Podés hacerlo por categoría:
          esta semana bebidas, la próxima cigarrillos, la siguiente
          golosinas. Así no parás la operación.
        </p>

        <h2>4. Detectar stock muerto cada mes</h2>
        <p>
          Productos que tenés en góndola pero NO se vendieron en los
          últimos 60 días. Es plata atrapada. En un kiosco de 1.000
          productos, encontrás típicamente $200.000-500.000 ARS en stock
          muerto que el dueño nunca vio.
        </p>
        <p>
          La acción: liquidarlo (15-25% de descuento), bonificarlo con
          otra compra, o si tiene fecha de vencimiento corta, devolverlo
          al mayorista (algunos lo aceptan).
        </p>
        <p>
          <a href="/">Orvex</a> tiene un reporte directo de stock muerto
          que te muestra esos productos ordenados por capital atrapado.
        </p>

        <h2>5. Plan de compras semanal basado en datos</h2>
        <p>
          En lugar de pedir al mayorista lo que TE PARECE que necesitás,
          mirá los datos: qué vendiste los últimos 14 días, qué velocidad
          tiene cada producto, cuánto stock tenés ahora, cuántos días te
          quedás cubierto.
        </p>
        <p>
          La fórmula: cantidad a pedir = (velocidad/día × días deseados de
          cobertura) − stock actual. Para una cobertura de 14 días, sumás
          el cálculo por producto y le mandás eso al mayorista.
        </p>
        <p>
          Hacer esto a mano para 1.500 productos es imposible. Por eso los
          sistemas modernos generan el "plan de compras" automático.
        </p>

        <h2>6. Separar el costo del precio de venta y mirar el margen</h2>
        <p>
          Cargá el costo y el precio de venta de cada producto. El sistema
          te calcula el margen automáticamente. Vas a tener sorpresas:
        </p>
        <ul>
          <li>Productos que crees que dan plata y tienen 5% de margen.</li>
          <li>Productos que parecen caros y tienen 40%.</li>
          <li>Productos donde el costo subió pero te olvidaste de subir el precio — estás vendiendo al costo o por debajo.</li>
        </ul>
        <p>
          Revisá los márgenes una vez al mes. En un comercio que vende
          $4M/mes, ajustar 10 productos con margen mal puede sumar
          $30K-50K ARS al fin de mes.
        </p>

        <h2>7. Movimientos de stock con motivo</h2>
        <p>
          Cada vez que ajustás stock manualmente (porque rompiste, perdiste,
          regalaste, o conté y faltaba), registrá el motivo. Eso te permite:
        </p>
        <ul>
          <li>A fin de mes ver cuánto perdiste por mermas, roturas, regalos.</li>
          <li>Detectar patrones: si un producto tiene siempre "merma", revisá si hay robo.</li>
          <li>Tener la trazabilidad para hacerle reclamos al mayorista por mercadería rota.</li>
        </ul>

        <h2>Resumen ejecutable</h2>
        <p>
          Las 7 prácticas en orden de impacto:
        </p>
        <ol>
          <li>Stock mínimo por producto (evita quiebres).</li>
          <li>Plan de compras basado en datos (evita comprar mal).</li>
          <li>Detectar stock muerto cada mes (recupera plata atrapada).</li>
          <li>Costos cargados + revisión de margen mensual (mejora rentabilidad).</li>
          <li>Conteo físico periódico (mantiene datos confiables).</li>
          <li>Código de barras siempre que se pueda (ahorra tiempo y errores).</li>
          <li>Movimientos con motivo (entendés por qué pierdes plata).</li>
        </ol>
        <p>
          Hacer todas estas a mano en Excel es factible pero te lleva 4-6
          horas semanales. Con un sistema como <a href="/">Orvex</a>, son
          casi todas automáticas.
        </p>
      </>
    ),
  },

  // ============================================================================
  // Batch mayo 2026 — 5 posts adicionales para crecer SEO orgánico
  // ============================================================================
  {
    slug: "como-emitir-factura-b-afip-paso-a-paso",
    title: "Cómo emitir factura B de AFIP paso a paso (2026)",
    description:
      "Guía práctica para emitir factura B con CAE de AFIP/ARCA desde un comercio chico. Requisitos, cómo configurar el sistema y los errores comunes.",
    publishedAt: "2026-05-10",
    readTime: 6,
    tags: ["AFIP", "facturación", "monotributo"],
    howToTotalTime: "PT20M",
    howToSteps: [
      { name: "Confirmá si necesitás facturar", text: "Si vendés sólo a consumidor final y no te piden factura, podés emitir ticket no fiscal. La factura B es obligatoria cuando el cliente la pide expresamente." },
      { name: "Pedí permiso en AFIP", text: "Inscribite en Monotributo o RI. Sacá certificado digital con clave fiscal nivel 3. Definí punto de venta (típicamente 0001)." },
      { name: "Configurá tu sistema de facturación", text: "Mis Comprobantes (gratis, lento), app de factura electrónica, o un POS integrado con AFIP que genera el CAE automático al cobrar." },
      { name: "Cargá los datos obligatorios", text: "Razón social, CUIT, domicilio, condición IVA, punto de venta, número correlativo, fecha, datos del cliente, productos, total, CAE y QR de AFIP (RG 4892/2020)." },
      { name: "Evitá los errores comunes", text: "Cuidado con CAE vencido, categorización incorrecta del cliente (RI necesita A, no B), y punto de venta no habilitado en AFIP." },
      { name: "Conservá copias y declará mensualmente", text: "AFIP guarda las facturas, pero conservá copia local por 10 años. Las facturas se reflejan automático en la declaración mensual." },
    ],
    body: (
      <>
        <p>
          Si vendés a consumidor final (la mayoría de los kioscos, almacenes y
          comercios chicos) y sos Monotributista, la factura que tenés que
          emitir es la <strong>factura B</strong>. Es la versión "para el
          público general" que no discrimina IVA. Acá te tiro el paso a paso
          de cómo se hace en 2026.
        </p>

        <h2>1. Confirmá que necesitás facturar</h2>
        <p>
          No todo comercio chico necesita emitir factura. Si vendés sólo a
          consumidor final y tu cliente no te la pide, podés emitir un{" "}
          <strong>ticket no fiscal</strong> sin pasar por AFIP. AFIP no te
          obliga a emitir factura B en ese caso — pero sí te obliga a llevar
          el registro de ventas y declararlas al final del mes.
        </p>
        <p>
          La factura B es obligatoria cuando el cliente la pide expresamente
          (ej: una empresa que la necesita para su contabilidad como
          consumidor final).
        </p>

        <h2>2. Pedí permiso para facturar en AFIP</h2>
        <p>
          Antes de emitir cualquier factura electrónica necesitás:
        </p>
        <ol>
          <li>Estar inscripto en Monotributo (o RI).</li>
          <li>
            Tener un <strong>certificado digital</strong> de AFIP. Se saca con
            tu CUIT y clave fiscal nivel 3 desde el sitio de AFIP, en{" "}
            <em>Administrador de Relaciones → Adherir servicio →
            Facturación electrónica</em>.
          </li>
          <li>Definir un punto de venta. El primero suele ser el 0001.</li>
        </ol>

        <h2>3. Configurá tu sistema de facturación</h2>
        <p>
          Tenés 3 opciones:
        </p>
        <ul>
          <li>
            <strong>Mis Comprobantes</strong> de AFIP — gratis, pero tenés que
            cargar cada factura a mano desde su web. Lento si tenés volumen.
          </li>
          <li>
            <strong>App de factura electrónica</strong> — varias en el
            mercado, vos cargás la venta y el sistema genera la factura.
            Mejora la velocidad pero seguís haciendo doble carga (venta en POS,
            factura en otra app).
          </li>
          <li>
            <strong>POS integrado con AFIP</strong> — vendés en el POS y el
            sistema genera la factura B con CAE automático en el mismo paso.
            Es lo que hace Orvex (Plan Profesional) y otros sistemas modernos.
            Sin doble carga.
          </li>
        </ul>

        <h2>4. Datos que tiene que tener la factura B</h2>
        <ul>
          <li>Razón social del emisor (tu nombre/empresa).</li>
          <li>CUIT del emisor.</li>
          <li>Domicilio fiscal.</li>
          <li>Condición frente al IVA (Monotributo, etc.).</li>
          <li>Punto de venta + número correlativo.</li>
          <li>Fecha de emisión.</li>
          <li>Datos del cliente (si los tenés — DNI/CUIT y nombre).</li>
          <li>Detalle de productos con precio.</li>
          <li>Total final (sin discriminar IVA).</li>
          <li><strong>CAE</strong> (Código de Autorización Electrónico) y fecha de vencimiento del CAE.</li>
          <li><strong>QR de AFIP</strong> (obligatorio desde RG 4892/2020).</li>
        </ul>

        <h2>5. Errores comunes y cómo evitarlos</h2>
        <h3>"CAE vencido"</h3>
        <p>
          Cuando obtenés un CAE, AFIP te da una fecha de vencimiento (~7 días
          desde la emisión). Si la factura es para una operación futura, podés
          tener problemas si la fecha de pago se pasa del CAE. Mejor emitir el
          día que efectivamente cobrás.
        </p>

        <h3>"Falta categorización del cliente"</h3>
        <p>
          Si el cliente es Responsable Inscripto, le tenés que emitir factura
          A (no B). El POS debería detectarlo automático según el CUIT que
          cargues. Si emitiste B a un RI, anulás y reemitís A.
        </p>

        <h3>"Punto de venta no habilitado"</h3>
        <p>
          Cada punto de venta tiene que estar dado de alta en AFIP antes de
          usarlo. Si querés un segundo punto de venta (ej: otra sucursal), lo
          das de alta en AFIP → Punto de Venta → Nuevo.
        </p>

        <h2>6. Guarda copias y declara mensualmente</h2>
        <p>
          AFIP guarda todas las facturas que emitís en su sistema, pero igual
          conservá copia (PDF, papel, etc.) por 10 años por si te audita
          eventualmente. Las facturas emitidas se reflejan automático en tu
          declaración de monotributo / IVA mensual.
        </p>

        <h2>Conclusión</h2>
        <p>
          Emitir factura B en 2026 es muchísimo más fácil que hace 5 años,
          siempre que uses un sistema integrado con AFIP. Si todavía cargás
          ventas a mano y después facturas aparte en Mis Comprobantes, estás
          perdiendo 1-2 horas por día. Probá un POS con AFIP integrado como{" "}
          <a href="/factura-electronica-arca-monotributo">Orvex</a> y vas a
          recuperar ese tiempo el primer día.
        </p>
      </>
    ),
  },
  {
    slug: "controlar-stock-sin-excel-comercio-chico",
    title: "Cómo controlar stock sin Excel: 5 alternativas para 2026",
    description:
      "Excel funciona pero te roba tiempo. Te muestro 5 alternativas reales para llevar el stock de tu comercio chico en 2026, ordenadas de gratis a paga.",
    publishedAt: "2026-05-10",
    readTime: 5,
    tags: ["stock", "inventario", "herramientas"],
    body: (
      <>
        <p>
          La planilla de Excel es lo que casi todo comerciante chico arranca
          usando. Funciona — hasta que no funciona. Cuando llegás a 200+
          productos o tenés varios cajeros que cargan ventas, Excel se rompe
          en silencio: el stock real no coincide con la planilla y nunca
          sabés dónde está la pérdida.
        </p>

        <h2>Por qué Excel falla a los 6 meses</h2>
        <ul>
          <li>
            <strong>No hay control de cambios</strong>. Si el cajero se olvida
            de descontar una venta, no te enterás hasta el próximo inventario
            físico.
          </li>
          <li>
            <strong>Una sola planilla = un solo usuario</strong>. Si abrís la
            planilla en tu compu y el cajero la abre en la suya, una de las
            dos sobreescribe.
          </li>
          <li>
            <strong>No tenés histórico</strong>. ¿Cuánto vendiste de Coca el
            martes pasado? Excel no te lo va a decir si no anotás cada venta.
          </li>
          <li>
            <strong>No hay alertas</strong>. Cuando te quedás sin stock de un
            producto, te enterás cuando un cliente lo pide y no tenés.
          </li>
        </ul>

        <h2>Alternativa 1: Cuaderno físico (gratis)</h2>
        <p>
          Sí, todavía hay comercios que lo usan. Sirve si tenés menos de 50
          productos y vendés 10-15 unidades por día. Pero no sabés cuánto
          ganaste hasta hacer cuenta a fin de mes, y un cuaderno mojado/
          perdido = histórico perdido.
        </p>

        <h2>Alternativa 2: Google Sheets (gratis)</h2>
        <p>
          Mejor que Excel porque varios usuarios pueden editarlo a la vez y
          se guarda solo en la nube. Pero seguís teniendo que cargar cada
          venta y cada compra a mano. Para comercio con 1-2 personas atendiendo,
          sirve.
        </p>

        <h2>Alternativa 3: App de inventario (gratis-bajo costo)</h2>
        <p>
          Hay apps simples (Stock&Go, Inventory App, Lightspeed Inventory) que
          son sólo eso: lista de productos con cantidad. No cobran ventas. Te
          sirven para hacer recuento físico desde el celu, pero no resuelve
          el problema de descontar stock al vender.
        </p>

        <h2>Alternativa 4: POS con inventario integrado (recomendado)</h2>
        <p>
          Un POS moderno hace el descuento de stock automáticamente con cada
          venta. Vos no te ocupás. Cuando un producto se está agotando, el
          sistema te alerta. Ejemplos en Argentina:
        </p>
        <ul>
          <li>
            <strong>Orvex</strong>: plan gratis permanente para hasta 100
            productos, AFIP en Profesional. Web, sin instalación.
          </li>
          <li>
            <strong>Tango Gestión</strong>: el clásico, pero local, caro y con
            curva de aprendizaje fuerte.
          </li>
          <li>
            <strong>Bizneo / Geopagos</strong>: opciones más caras enfocadas
            en cadenas medianas.
          </li>
        </ul>

        <h2>Alternativa 5: ERP completo (para comercios medianos+)</h2>
        <p>
          Si ya tenés 5+ empleados, 5.000+ productos o sucursales, considerar
          un ERP como SAP Business One o Holded. Costos arrancan en
          $200.000+ ARS/mes. Sólo conviene si te queda chico el POS.
        </p>

        <h2>Mi recomendación honesta</h2>
        <p>
          Si tenés un comercio chico con hasta 1.000 productos, un POS con
          inventario integrado te resuelve 95% de los dolores de Excel sin
          gastar fortuna. Plan gratis o $9.999 ARS/mes están al alcance del
          kiosco más chico. La diferencia con Excel se nota la primera
          semana — y te liberás de 4-6 horas semanales que dedicabas a
          cuadrar planillas.
        </p>
        <p>
          Si querés probar sin compromiso, <a href="/signup">arrancá con
          Orvex gratis</a> — no pide tarjeta, te quedás con el plan gratis
          permanente si te alcanza.
        </p>
      </>
    ),
  },
  {
    slug: "como-abrir-caja-kiosco-protocolo",
    title: "Cómo abrir la caja de tu kiosco: protocolo paso a paso",
    description:
      "El protocolo de apertura y cierre de caja que evita diferencias y problemas con los cajeros. Pasos reales que aplican kioscos exitosos en Argentina.",
    publishedAt: "2026-05-10",
    readTime: 5,
    tags: ["caja", "operaciones", "kiosco"],
    howToTotalTime: "PT10M",
    howToSteps: [
      { name: "Contar el fondo fijo", text: "Empezás el turno con un monto base ($30.000-50.000 ARS típicos) para dar cambio. Billetes y monedas chicas. Ese fondo NO se toca para depósitos." },
      { name: "Registrar la apertura en el sistema", text: "Anotás el monto exacto del fondo fijo en el POS. Si no usás sistema, anotás fecha + hora + monto + nombre del cajero en un cuaderno." },
      { name: "Quien abre se hace responsable", text: "El cajero que abre se hace cargo de su turno. Si entra un segundo, hacés un cierre intermedio (cierra el primero, abre el segundo)." },
      { name: "Pasar todas las ventas por el sistema", text: "Sin excepciones, hasta el caramelo de $200. Esto es lo único que permite cuadrar el turno al final del día." },
      { name: "Registrar movimientos manuales con motivo", text: "Cualquier egreso (compra de pan, propina) o ingreso (dueño pone $20.000 más) se registra con motivo. Sin esto, las diferencias son inevitables." },
      { name: "Conteo intermedio (opcional)", text: "A media tarde contás y verificás que coincida con el sistema. Si hay diferencia, la podés investigar antes que se te complique." },
      { name: "Contar todo al cierre", text: "Efectivo, vouchers de tarjeta, transferencias. Sumás todo y comparás contra lo que el sistema dice que debería haber." },
      { name: "Depositar el sobrante", text: "Lo que excede el fondo fijo va al sobre del día. El fondo se queda para el siguiente turno. Si hubo diferencia, queda registrada." },
    ],
    body: (
      <>
        <p>
          Abrir y cerrar la caja parece trivial — agarrás el cajón, contás la
          plata, listo. Pero cuando tenés 2-3 cajeros rotando y un mes cerrás
          con $50.000 menos de lo esperado, te das cuenta que necesitás un
          protocolo. Acá te tiro el que usan los kioscos que NO tienen
          diferencias.
        </p>

        <h2>Apertura de caja</h2>

        <h3>1. Contar el fondo fijo</h3>
        <p>
          Empezás cada turno con un monto base que se queda en la caja para
          dar cambio. Lo típico en Argentina es <strong>$30.000-50.000
          ARS</strong> dividido en billetes y monedas chicas (5 de $10.000,
          15 de $1.000, monedas y billetes de $100/200/500). Ese es tu fondo
          fijo y no se toca para depósitos.
        </p>

        <h3>2. Registrar la apertura en el sistema</h3>
        <p>
          Si usás un POS, registrás la apertura con el monto exacto del fondo
          ($35.000, por ejemplo). El sistema lo deja como referencia para el
          cierre. Si tenés cuaderno, anotás fecha + hora + monto + nombre del
          cajero que abre.
        </p>

        <h3>3. Quién abre, firma</h3>
        <p>
          El cajero que abre se hace responsable de ese turno. Si en el medio
          del día entra un segundo cajero, hacés un cierre intermedio (cierra
          el primero, abre el segundo). Cada uno se hace responsable de su
          parte.
        </p>

        <h2>Durante el turno</h2>

        <h3>4. Todas las ventas pasan por el sistema</h3>
        <p>
          Sin excepción. Hasta la venta de un caramelo de $200 se carga.
          Si el cliente pide factura, se emite. Si no, se registra como
          ticket no fiscal. Esto es lo que después te permite cuadrar el
          turno.
        </p>

        <h3>5. Movimientos manuales con motivo</h3>
        <p>
          Si el cajero saca plata de la caja para comprar algo (un café, pan,
          carga de proveedor), lo registra como egreso de caja con motivo.
          No es plata que "le sobra" o "le falta" — está registrada.
        </p>
        <p>
          Lo mismo con ingresos: si el dueño pone $20.000 más para dar
          cambio, se registra como ingreso manual.
        </p>

        <h3>6. Conteo intermedio (opcional pero recomendado)</h3>
        <p>
          A media tarde, mientras el comercio está más tranquilo, contás la
          plata y verificás que coincida con lo que el sistema dice. Si hay
          diferencia, podés revisar mientras está fresco en lugar de
          descubrirlo a fin de día.
        </p>

        <h2>Cierre de caja</h2>

        <h3>7. Contar todo</h3>
        <p>
          Al final del turno contás:
        </p>
        <ul>
          <li>Efectivo en caja (billetes + monedas)</li>
          <li>Vouchers de tarjeta (si todavía manejás físicos)</li>
          <li>Comprobantes de transferencia recibida</li>
        </ul>

        <h3>8. Comparar con el sistema</h3>
        <p>
          El POS te dice cuánto deberías tener: fondo fijo + ventas en
          efectivo − egresos manuales. Si lo contado es igual, perfecto.
          Si hay diferencia, hay 4 causas comunes:
        </p>
        <ul>
          <li>Se cobró mal el cambio en alguna venta.</li>
          <li>Una venta no se cargó en el sistema.</li>
          <li>Se sacó plata sin registrarlo.</li>
          <li>Hubo un error de tipeo en el sistema.</li>
        </ul>

        <h3>9. Depositar el sobrante</h3>
        <p>
          Lo que excede el fondo fijo va al sobre del día. Lo guardás en una
          caja fuerte o lo depositás. El fondo fijo se queda para el día
          siguiente.
        </p>

        <h3>10. Cerrar la sesión en el sistema</h3>
        <p>
          Registrás el cierre con el monto contado. Si hubo diferencia,
          también la dejás registrada. Eso queda en el histórico — si una
          diferencia se repite con un cajero específico, vas a tener el
          patrón.
        </p>

        <h2>Errores comunes que vacían tu caja</h2>
        <ol>
          <li>
            <strong>Cajeros que no usan el sistema</strong> — "después lo
            cargo" termina siendo "nunca lo cargué". Regla: si no pasó por
            el sistema, no se hizo.
          </li>
          <li>
            <strong>Fondo fijo que se mezcla con depósitos</strong> — si
            sacás del fondo para depositar y olvidás reponerlo, al día
            siguiente arranca corto y todas las cuentas dan mal.
          </li>
          <li>
            <strong>No registrar el cambio chico</strong> — propinas, regalos
            de $50 al vecino, todo eso sale de la caja. Si no lo registrás,
            "falta plata" a fin de día.
          </li>
          <li>
            <strong>Conteo apurado</strong> — contar el cierre con la
            persiana media bajada y prisa por irse a casa = diferencias
            inventadas por mal conteo.
          </li>
        </ol>

        <h2>Conclusión</h2>
        <p>
          Un protocolo de caja claro elimina el 90% de las diferencias. Si
          además usás un POS que registra automático cada movimiento (como{" "}
          <a href="/sistema-pos-kiosco">Orvex</a>), el otro 10% lo pillás
          rápido.
        </p>
      </>
    ),
  },
  {
    slug: "que-es-un-pos-y-para-que-sirve",
    title: "¿Qué es un POS y para qué sirve en un comercio chico?",
    description:
      "Explicación clara de qué es un POS (Point of Sale), qué diferencia hay con una caja registradora, y cuándo conviene a un comercio chico argentino.",
    publishedAt: "2026-05-10",
    readTime: 4,
    tags: ["pos", "básico", "tecnología"],
    body: (
      <>
        <p>
          POS son las siglas de <strong>Point of Sale</strong> ("Punto de
          Venta" en inglés). En la práctica argentina, cuando alguien dice
          "POS" se refiere al software que usás para cobrar las ventas — la
          versión moderna de la vieja caja registradora.
        </p>

        <h2>¿Qué hace un POS?</h2>
        <p>
          Las cosas básicas que hace cualquier POS:
        </p>
        <ul>
          <li>
            <strong>Cobrar ventas</strong>: armás el carrito con los productos
            del cliente, calculás el total, registrás el método de pago
            (efectivo, tarjeta, transferencia).
          </li>
          <li>
            <strong>Descontar stock</strong>: cada venta resta automático las
            cantidades del inventario. No tenés que llevarlo aparte.
          </li>
          <li>
            <strong>Imprimir ticket</strong>: con detalle de lo vendido,
            total, método de pago y QR de AFIP si es factura electrónica.
          </li>
          <li>
            <strong>Cerrar caja</strong>: al final del día (o turno) te dice
            cuánto vendiste, en qué medios de pago, y cuánto efectivo
            debería haber en el cajón.
          </li>
        </ul>

        <h2>POS vs caja registradora vieja</h2>
        <p>
          La caja registradora clásica (esa cosa con teclas grandes y cinta
          de papel que todavía se ve en kioscos viejos) suma totales y
          imprime ticket. Eso es lo que hace.
        </p>
        <p>
          Un POS moderno también suma y cobra, pero además:
        </p>
        <ul>
          <li>Lleva inventario (sabés cuánto te queda de cada producto)</li>
          <li>Maneja clientes con cuenta corriente</li>
          <li>Saca reportes (qué vendiste, cuándo, a quién)</li>
          <li>Emite factura electrónica AFIP</li>
          <li>Funciona en cualquier dispositivo (celu, tablet, compu)</li>
        </ul>

        <h2>¿Necesito un POS si tengo un kiosco chico?</h2>
        <p>
          Honestamente, si vendés menos de 20 ventas por día con 30 productos,
          podés zafar con cuaderno o Excel. Pero apenas pasás esos números,
          un POS te paga solo:
        </p>
        <ul>
          <li>
            Te ahorra 4-6 horas semanales en cuadres de caja y cargas de
            inventario.
          </li>
          <li>
            Te muestra cuáles son tus productos más rentables (no siempre
            son los que más vendés).
          </li>
          <li>
            Te alerta de quiebres de stock antes de que el cliente te pida un
            producto que no tenés.
          </li>
          <li>
            Si tenés cajeros empleados, ves quién hace qué y reducís el robo
            interno (que en Argentina es un problema real en comercio chico).
          </li>
        </ul>

        <h2>Tipos de POS</h2>

        <h3>POS hardware</h3>
        <p>
          Es la "cajita" física con software propio (Lightspeed, Geopagos
          Box, etc.). Te la venden con scanner + impresora + cajón
          incorporados. Cuesta $300.000-800.000 ARS de inversión inicial +
          suscripción mensual. Tiene la ventaja de venir todo listo, pero
          si se te rompe la cajita no podés vender hasta que la repongan.
        </p>

        <h3>POS software (web/PWA)</h3>
        <p>
          Es un software que corre en cualquier dispositivo que tengas
          (compu vieja, tablet, celu). Vos ponés el hardware. Costo de
          entrada bajísimo ($0-25.000 ARS/mes), y si se te rompe un
          dispositivo, agarrás otro y seguís. <a href="/">Orvex</a> entra
          en esta categoría — corre en navegador, lo instalás como app
          PWA si querés.
        </p>

        <h3>POS móvil</h3>
        <p>
          Es para vendedores ambulantes o ferias — el POS corre en el celu
          y cobrás con app de pago QR o lector de tarjetas Bluetooth.
        </p>

        <h2>¿Por dónde arrancar?</h2>
        <p>
          Si tenés un kiosco, almacén, farmacia o comercio chico en
          Argentina, te recomendaría probar un POS web gratis primero. <a
          href="/signup">Orvex tiene plan gratis permanente</a>: sin
          tarjeta, cargás tu inventario, vendés, y si te alcanza con el
          plan gratis te quedás ahí. Si necesitás más productos o AFIP,
          subís a un plan pago de $9.999 a $24.900 ARS/mes.
        </p>
        <p>
          La inversión cero te permite probar si te sirve antes de
          comprometerte.
        </p>
      </>
    ),
  },
  {
    slug: "vender-comida-sin-barcode-empanadas-milanesas",
    title: "Cómo vender comida sin código de barras (empanadas, milanesas, fiambres)",
    description:
      "Si vendés comida casera, fiambres o productos que no tienen barcode, te muestro cómo gestionarlo en un POS sin complicarte la vida.",
    publishedAt: "2026-05-10",
    readTime: 5,
    tags: ["fiambrería", "comida casera", "POS"],
    body: (
      <>
        <p>
          La mayoría de los sistemas POS están pensados para productos
          envasados con código de barras. Pero si tu negocio vende
          empanadas hechas por vos, milanesas al peso, fiambres cortados al
          momento, pizzas para llevar — esos productos no tienen un barcode
          que escanear. ¿Cómo se manejan?
        </p>

        <h2>Opción 1: Catálogo visual + búsqueda</h2>
        <p>
          Cargás cada producto con nombre y precio (sin código). En el POS,
          en lugar de escanear, tipeás el inicio del nombre y autocompleta:
          "emp" → te muestra todas las variedades de empanada que tenés.
          Click → al carrito.
        </p>
        <p>
          POS modernos como <a href="/pos-fiambreria">Orvex</a> tienen
          además ranking automático por más vendido. Si la empanada de
          carne es tu hit, aparece arriba sin tipear nada.
        </p>

        <h2>Opción 2: Grilla con fotos (ideal para comida)</h2>
        <p>
          En lugar de buscar por texto, mostrás la grilla completa con foto
          de cada producto. El cajero ve "empanada de carne", "empanada de
          jamón y queso", "milanesa napolitana", y toca la que el cliente
          pidió. Mucho más rápido y errores cero.
        </p>
        <p>
          Para esto el sistema necesita soportar fotos de productos. Las
          sacás desde el celu, las subís y se ven en el grid como menú de
          delivery. Si no tenés foto en un producto, el sistema le pone
          un color de fondo según la categoría para que igual se
          identifique visualmente.
        </p>

        <h2>Opción 3: Venta por peso (fiambres, milanesa al kg)</h2>
        <p>
          Los productos al peso (jamón crudo, queso, milanesa, asado) los
          cargás con precio por kilo. En el POS, cuando el cliente pide
          200g de jamón, marcás el producto y se abre un modal pidiendo
          el peso. Tipeás 0.200 (o leés de la balanza), el sistema cobra
          el peso × precio/kg.
        </p>
        <p>
          Función importante para fiambrerías: <strong>tara</strong>. Le
          decís al sistema cuánto pesa el envase/papel (ej: 15 gramos) y
          el sistema descuenta eso del peso bruto antes de cobrar. Sin
          esto, todos los días le regalás 10-30g al cliente.
        </p>

        <h2>Opción 4: Generar barcode propio (avanzado)</h2>
        <p>
          Si querés agilizar pedidos grandes, podés generar barcodes
          internos para tus productos. Imprimís etiquetas con barcode +
          nombre + precio en una impresora térmica y las pegás en cada
          paquete pre-armado. Después escaneás el barcode propio para
          cobrar. Es más vuelta pero ayuda si vendés a comercios mayoristas
          o tenés muchos pedidos pre-armados.
        </p>

        <h2>Cantidad rápida para pedidos grandes</h2>
        <p>
          Una clienta pide 24 empanadas surtidas. ¿Vas a clickear 24 veces
          el botón "+"? No. Un POS moderno te deja:
        </p>
        <ul>
          <li>
            Tocar el producto una vez → aparece en el carrito con cantidad 1.
          </li>
          <li>
            Tocar la cantidad → se abre un input numérico → tipeás 24 →
            Enter.
          </li>
        </ul>
        <p>
          12 segundos en vez de 30. Para comercios con pedidos grandes
          (rotisería, fiambrería con bandejas para fiestas, panadería con
          encargos), es una diferencia real.
        </p>

        <h2>Combos / promos del día</h2>
        <p>
          Las pizzerías y rotiserías arman combos: "Empanadas + Coca + cerveza
          = $6.500". En el POS lo cargás como un combo con precio fijo y
          el sistema descuenta el stock de cada componente. Más rápido para
          el cajero y más fácil para el cliente.
        </p>

        <h2>Conclusión</h2>
        <p>
          Vender comida sin barcode es totalmente posible y hasta más
          rápido que escanear, si tenés un POS pensado para eso. La
          combinación que mejor funciona:
        </p>
        <ul>
          <li>Grilla con fotos de los productos más vendidos arriba.</li>
          <li>Búsqueda por texto con autocompletado.</li>
          <li>Modal de peso con tara para productos al kg.</li>
          <li>Cantidad rápida para pedidos grandes.</li>
          <li>Combos para promos.</li>
        </ul>
        <p>
          <a href="/pos-fiambreria">Orvex tiene todas estas funciones</a> y
          arranca gratis para que pruebes si te sirve para tu local de
          comida.
        </p>
      </>
    ),
  },
]

export function getPostBySlug(slug: string): BlogPost | null {
  return BLOG_POSTS.find((p) => p.slug === slug) ?? null
}

/** Posts ordenados de más nuevo a más viejo, para el index. */
export function getPostsSorted(): BlogPost[] {
  return [...BLOG_POSTS].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )
}
