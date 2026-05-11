/**
 * Schemas Schema.org (JSON-LD) que inyectamos en las páginas públicas
 * para que Google muestre rich results y los LLMs (ChatGPT, Perplexity,
 * Claude) tengan datos estructurados al citar Orvex como fuente.
 *
 * Cada función devuelve un objeto JSON-LD listo para meter en
 * <script type="application/ld+json"> via el componente JsonLd.tsx.
 *
 * Filosofía: NO inventar ratings ni reviews que no existan. Solo datos
 * verídicos. Cuando tengamos reviews reales en G2/Capterra los traemos.
 */

import { PLAN_PRICES_ARS } from "./utils"

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.NEXTAUTH_URL ??
  "https://cobraorvex.com"

const ORG_NAME = "Orvex"
const ORG_DESCRIPTION =
  "Sistema de gestión integral para kioscos, almacenes, farmacias y minisúper en Argentina. Incluye POS, inventario, caja, facturación electrónica AFIP y reportes con IA."

/**
 * Organization schema — describe a Orvex como empresa. Va en todas las
 * páginas (es global). Le dice a Google quiénes somos, dónde estamos
 * y cómo contactarnos.
 */
export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${BASE_URL}/#organization`,
    name: ORG_NAME,
    legalName: "Orvex",
    url: BASE_URL,
    logo: `${BASE_URL}/icons/icon-512.png`,
    description: ORG_DESCRIPTION,
    foundingDate: "2025",
    areaServed: {
      "@type": "Country",
      name: "Argentina",
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "Customer Support",
      email: "soporte@cobraorvex.com",
      availableLanguage: ["Spanish"],
      areaServed: "AR",
    },
    sameAs: [
      // Cuando tengamos las URLs reales las sumamos:
      // "https://www.linkedin.com/company/orvex",
      // "https://www.instagram.com/orvex.app",
    ],
  }
}

/**
 * SoftwareApplication schema — describe el producto Orvex. Es el que
 * más mueve la aguja para SEO de SaaS: Google lo usa para mostrar la
 * card de producto en results, los LLMs para responder "¿qué es Orvex?"
 * con la descripción correcta.
 */
export function softwareApplicationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${BASE_URL}/#software`,
    name: "Orvex",
    alternateName: "Orvex POS",
    description: ORG_DESCRIPTION,
    url: BASE_URL,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Point of Sale (POS)",
    operatingSystem: "Web Browser, iOS, Android, Windows, macOS, Linux",
    inLanguage: "es-AR",
    softwareVersion: "1.0",
    image: `${BASE_URL}/orvex-og.png`,
    screenshot: `${BASE_URL}/orvex-og.png`,
    offers: [
      {
        "@type": "Offer",
        "@id": `${BASE_URL}/#offer-free`,
        name: "Plan Gratis",
        price: "0",
        priceCurrency: "ARS",
        availability: "https://schema.org/InStock",
        priceValidUntil: "2027-12-31",
        url: `${BASE_URL}/signup`,
        description: "Plan permanente sin tarjeta. 100 productos, 1 usuario, 50 ventas/mes.",
      },
      {
        "@type": "Offer",
        "@id": `${BASE_URL}/#offer-starter`,
        name: "Plan Básico",
        price: String(PLAN_PRICES_ARS.STARTER),
        priceCurrency: "ARS",
        billingIncrement: "P1M",
        availability: "https://schema.org/InStock",
        priceValidUntil: "2027-12-31",
        url: `${BASE_URL}/signup?plan=STARTER`,
        description: "1.000 productos, 3 usuarios, logo y tema custom, Excel import/export, etiquetas, history ilimitado.",
      },
      {
        "@type": "Offer",
        "@id": `${BASE_URL}/#offer-professional`,
        name: "Plan Profesional",
        price: String(PLAN_PRICES_ARS.PROFESSIONAL),
        priceCurrency: "ARS",
        billingIncrement: "P1M",
        availability: "https://schema.org/InStock",
        priceValidUntil: "2027-12-31",
        url: `${BASE_URL}/signup?plan=PROFESSIONAL`,
        description: "Todo del Básico + IA predictiva, chatbot, Loyalty, Multi-caja, AFIP 500 facturas/mes, soporte prioritario.",
      },
    ],
    featureList: [
      "POS offline-first",
      "Inventario con código de barras",
      "Caja diaria con apertura y cierre",
      "Facturación electrónica AFIP/ARCA",
      "Reportes con IA",
      "Stock muerto y plan de compras automático",
      "Multi-usuario con roles",
      "Cuenta corriente de clientes",
      "Importar / exportar Excel",
      "Catálogo de productos argentinos pre-cargado",
    ],
    publisher: {
      "@id": `${BASE_URL}/#organization`,
    },
    creator: {
      "@id": `${BASE_URL}/#organization`,
    },
  }
}

/**
 * FAQ schema — Google lo usa para mostrar las FAQs como rich snippet
 * en los resultados de búsqueda. Se aplica a /pricing y la landing.
 */
export function faqPageSchema(faqs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.answer,
      },
    })),
  }
}

/**
 * Breadcrumb schema — para sub-pages (landing por keyword, blog).
 * Le dice a Google cómo navegar y muestra la breadcrumb en results.
 */
export function breadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  }
}

/**
 * Article schema — para blog posts. Permite mostrar autor, fecha,
 * imagen destacada en results y citar correctamente desde LLMs.
 */
export interface ArticleSchemaInput {
  title: string
  description: string
  slug: string
  publishedAt: string // ISO
  updatedAt?: string
  image?: string
}

export function articleSchema(a: ArticleSchemaInput) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${BASE_URL}/blog/${a.slug}#article`,
    headline: a.title,
    description: a.description,
    image: a.image ?? `${BASE_URL}/orvex-og.png`,
    datePublished: a.publishedAt,
    dateModified: a.updatedAt ?? a.publishedAt,
    inLanguage: "es-AR",
    url: `${BASE_URL}/blog/${a.slug}`,
    author: { "@id": `${BASE_URL}/#organization` },
    publisher: { "@id": `${BASE_URL}/#organization` },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${BASE_URL}/blog/${a.slug}`,
    },
    // Speakable — le dice a Google Assistant qué partes del artículo
    // leer en voz alta cuando un usuario hace una búsqueda por voz.
    // Marcamos el primer h1 (título) y el primer párrafo (intro) que
    // son los que mejor responden la query del usuario.
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: ["h1", "article > p:first-of-type"],
    },
  }
}

/**
 * WebSite schema con sitelinks searchbox — habilita la barra de
 * búsqueda interna de Google directo en los resultados.
 */
export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${BASE_URL}/#website`,
    name: ORG_NAME,
    url: BASE_URL,
    inLanguage: "es-AR",
    publisher: { "@id": `${BASE_URL}/#organization` },
    description: ORG_DESCRIPTION,
    // SearchAction → Google muestra una caja de búsqueda debajo de
    // cobraorvex.com en los resultados ("sitelinks searchbox"). El user
    // tipea en Google y pasa directo a /blog?q=... — más tráfico desde
    // SERP. Apuntamos al blog porque es el contenido buscable público.
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${BASE_URL}/blog?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  }
}

/**
 * OfferCatalog schema — lista los planes de pricing como Products con
 * Offers individuales. Complementa al softwareApplicationSchema (que ya
 * tiene los offers embebidos) listándolos como item-level Products para
 * que Google los muestre en SERP como "Orvex desde $9.999/mes · Plan
 * Básico · Plan Profesional".
 */
interface OfferCatalogPlan {
  id: string
  name: string
  description: string
  price: number
  priceCurrency: string
  url: string
}
export function offerCatalogSchema(plans: OfferCatalogPlan[]) {
  return {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    "@id": `${BASE_URL}/pricing#offers`,
    name: "Planes y precios de Orvex",
    url: `${BASE_URL}/pricing`,
    itemListElement: plans.map((p, i) => ({
      "@type": "Offer",
      "@id": `${BASE_URL}/pricing#offer-${p.id.toLowerCase()}`,
      position: i + 1,
      name: p.name,
      description: p.description,
      price: String(p.price),
      priceCurrency: p.priceCurrency,
      availability: "https://schema.org/InStock",
      url: p.url,
      priceValidUntil: "2027-12-31",
      itemOffered: {
        "@type": "SoftwareApplication",
        name: `Orvex ${p.name}`,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web Browser",
      },
    })),
  }
}

/**
 * ItemList schema — usado en /blog para que Google muestre el listado
 * de posts como una lista navegable en SERP. Cada item es un BlogPosting
 * con su URL, título y fecha.
 */
interface ItemListPost {
  slug: string
  title: string
  description: string
  publishedAt: string
}
export function blogItemListSchema(posts: ItemListPost[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${BASE_URL}/blog#itemlist`,
    name: "Blog de Orvex",
    url: `${BASE_URL}/blog`,
    numberOfItems: posts.length,
    itemListElement: posts.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${BASE_URL}/blog/${p.slug}`,
      name: p.title,
      item: {
        "@type": "BlogPosting",
        "@id": `${BASE_URL}/blog/${p.slug}#article`,
        headline: p.title,
        description: p.description,
        url: `${BASE_URL}/blog/${p.slug}`,
        datePublished: p.publishedAt,
        inLanguage: "es-AR",
      },
    })),
  }
}

/**
 * HowTo schema — para artículos que enseñan un proceso paso a paso.
 * Google muestra estos como rich snippets con los pasos numerados en
 * el resultado de búsqueda, lo que aumenta el CTR contra un resultado
 * de texto plano. Sólo usar en posts genuinamente "cómo hacer X".
 */
interface HowToStep {
  name: string
  text: string
  url?: string
}
export function howToSchema(input: {
  slug: string
  name: string
  description: string
  totalTime?: string // ISO 8601 (ej. "PT15M")
  steps: HowToStep[]
  image?: string
}) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "@id": `${BASE_URL}/blog/${input.slug}#howto`,
    name: input.name,
    description: input.description,
    image: input.image ?? `${BASE_URL}/orvex-og.png`,
    inLanguage: "es-AR",
    ...(input.totalTime ? { totalTime: input.totalTime } : {}),
    step: input.steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.name,
      text: s.text,
      ...(s.url ? { url: s.url } : {}),
    })),
  }
}
