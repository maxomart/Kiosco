import type { MetadataRoute } from "next"

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.NEXTAUTH_URL ??
  "https://retailar.app"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/pricing"],
        disallow: [
          "/api/",
          "/admin",
          "/admin/",
          "/inicio",
          "/inicio/",
          "/pos",
          "/inventario",
          "/cargas",
          "/caja",
          "/gastos",
          "/clientes",
          "/proveedores",
          "/reportes",
          "/configuracion",
          "/ventas",
          "/login",
          "/signup",
          "/forgot-password",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}
