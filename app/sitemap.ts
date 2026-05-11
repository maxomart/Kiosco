import type { MetadataRoute } from "next"

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.NEXTAUTH_URL ??
  "https://cobraorvex.com"

/**
 * Sitemap completo de páginas públicas. Cuando agregamos una landing
 * por keyword o un blog post, lo sumamos acá para que Google lo
 * descubra rápido en lugar de esperar al crawl orgánico.
 *
 * Las URLs privadas (dashboard) están bloqueadas en robots.ts.
 */

// Landing pages por keyword (commit 2). Cada una es una página
// optimizada para una búsqueda específica de Google.
const KEYWORD_LANDINGS = [
  "sistema-pos-kiosco",
  "software-farmacia-argentina",
  "control-stock-minisuper",
  "punto-venta-verduleria",
  "factura-electronica-arca-monotributo",
  "pos-fiambreria",
  "pos-carniceria",
  "pos-panaderia",
  "pos-distribuidora",
  "alternativa-tango-bejerman",
]

// Blog posts (commit 3). Slug + última actualización.
const BLOG_POSTS = [
  { slug: "cuanto-cuesta-abrir-kiosco-argentina-2026", updatedAt: "2026-05-01" },
  { slug: "factura-a-b-c-afip-monotributista", updatedAt: "2026-05-01" },
  { slug: "productos-mas-vendidos-kiosco-argentino", updatedAt: "2026-05-01" },
  { slug: "cuaderno-vs-excel-vs-sistema-kiosco", updatedAt: "2026-05-01" },
  { slug: "control-stock-minorista-mejores-practicas", updatedAt: "2026-05-01" },
  { slug: "como-emitir-factura-b-afip-paso-a-paso", updatedAt: "2026-05-10" },
  { slug: "controlar-stock-sin-excel-comercio-chico", updatedAt: "2026-05-10" },
  { slug: "como-abrir-caja-kiosco-protocolo", updatedAt: "2026-05-10" },
  { slug: "que-es-un-pos-y-para-que-sirve", updatedAt: "2026-05-10" },
  { slug: "vender-comida-sin-barcode-empanadas-milanesas", updatedAt: "2026-05-10" },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const core: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${baseUrl}/descargar`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
  ]

  const landings: MetadataRoute.Sitemap = KEYWORD_LANDINGS.map((slug) => ({
    url: `${baseUrl}/${slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.8,
  }))

  const posts: MetadataRoute.Sitemap = BLOG_POSTS.map((p) => ({
    url: `${baseUrl}/blog/${p.slug}`,
    lastModified: new Date(p.updatedAt),
    changeFrequency: "monthly",
    priority: 0.6,
  }))

  return [...core, ...landings, ...posts]
}
