import type { MetadataRoute } from "next"

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.NEXTAUTH_URL ??
  "https://cobraorvex.com"

/**
 * Política de crawl: dejamos abiertas todas las URLs públicas (landing
 * principal, /pricing, /descargar, /blog y blog posts, landing pages
 * por keyword tipo /sistema-pos-kiosco). Bloqueamos las privadas del
 * dashboard y cualquier endpoint API.
 *
 * Nota: /login y /signup también las bloqueamos porque no aportan
 * a SEO (son forms internos) y queremos que Google priorice el
 * contenido marketinero (landing + blog).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin",
          "/admin/",
          "/inicio",
          "/inicio/",
          "/pos",
          "/pos-app",
          "/inventario",
          "/cargas",
          "/caja",
          "/gastos",
          "/clientes",
          "/proveedores",
          "/reportes",
          "/configuracion",
          "/ventas",
          "/etiquetas",
          "/pedidos-proveedor",
          "/tv",
          "/login",
          "/signup",
          "/forgot-password",
          "/verificar-email",
          "/onboarding",
          "/sync",
          "/soporte",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}
