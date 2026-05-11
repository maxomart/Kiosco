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
        // IMPORTANTE: `$` al final hace match EXACTO. Sin él, `/pos` también
        // bloquearía `/pos-fiambreria`, `/pos-carniceria`, etc. — y esas son
        // landings públicas que sí queremos que Google indexe.
        disallow: [
          "/api/",
          "/admin$",
          "/admin/",
          "/inicio$",
          "/inicio/",
          "/pos$",
          "/pos/",
          "/pos-app$",
          "/pos-app/",
          "/inventario$",
          "/inventario/",
          "/cargas$",
          "/cargas/",
          "/caja$",
          "/caja/",
          "/gastos$",
          "/gastos/",
          "/clientes$",
          "/clientes/",
          "/proveedores$",
          "/proveedores/",
          "/reportes$",
          "/reportes/",
          "/configuracion$",
          "/configuracion/",
          "/ventas$",
          "/ventas/",
          "/etiquetas$",
          "/etiquetas/",
          "/pedidos-proveedor$",
          "/pedidos-proveedor/",
          "/tv$",
          "/tv/",
          "/login$",
          "/login/",
          "/signup$",
          "/signup?",
          "/forgot-password$",
          "/forgot-password/",
          "/verificar-email$",
          "/verificar-email/",
          "/onboarding$",
          "/onboarding/",
          "/sync$",
          "/sync/",
          "/soporte$",
          "/soporte/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}
