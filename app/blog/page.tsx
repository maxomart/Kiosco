import type { Metadata } from "next"
import Link from "next/link"
import { OrvexLogo } from "@/components/shared/OrvexLogo"
import { ArrowRight, Clock } from "lucide-react"
import { JsonLd } from "@/components/seo/JsonLd"
import {
  organizationSchema,
  websiteSchema,
  breadcrumbSchema,
} from "@/lib/seo-schema"
import { getPostsSorted } from "@/lib/blog-posts"

export const metadata: Metadata = {
  title: "Blog Orvex — Gestión de Kioscos, Almacenes y Comercios Argentinos",
  description:
    "Guías prácticas y artículos para dueños de kioscos, almacenes y farmacias en Argentina. Control de stock, AFIP, productos más vendidos y mejores prácticas de gestión.",
  alternates: { canonical: "https://cobraorvex.com/blog" },
  openGraph: {
    title: "Blog Orvex",
    description:
      "Guías prácticas para dueños de comercios chicos en Argentina.",
    type: "website",
    locale: "es_AR",
  },
}

const POSTS_LIST_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Blog",
  "@id": "https://cobraorvex.com/blog#blog",
  name: "Blog Orvex",
  description:
    "Guías y artículos para dueños de kioscos, almacenes, farmacias y minisúper en Argentina.",
  url: "https://cobraorvex.com/blog",
  inLanguage: "es-AR",
  publisher: { "@id": "https://cobraorvex.com/#organization" },
}

export default function BlogIndexPage() {
  const posts = getPostsSorted()

  return (
    <>
      <JsonLd
        data={[
          organizationSchema(),
          websiteSchema(),
          POSTS_LIST_SCHEMA,
          breadcrumbSchema([
            { name: "Inicio", url: "https://cobraorvex.com/" },
            { name: "Blog", url: "https://cobraorvex.com/blog" },
          ]),
        ]}
      />
      <main className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-950 to-black text-white">
        {/* Header */}
        <header className="border-b border-white/5 sticky top-0 z-40 bg-gray-950/80 backdrop-blur-xl">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
            <Link href="/" className="flex items-center gap-2">
              <OrvexLogo size={28} className="flex-shrink-0" gradientId="blog-logo" />
              <span className="font-bold text-base">Orvex</span>
            </Link>
            <div className="flex items-center gap-3">
              <Link href="/pricing" className="text-sm text-gray-400 hover:text-white">Precios</Link>
              <Link
                href="/signup"
                className="px-3 sm:px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-violet-500 text-white text-sm font-medium"
              >
                Empezar gratis
              </Link>
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="px-4 sm:px-6 pt-12 sm:pt-20 pb-8 sm:pb-12">
          <div className="max-w-3xl mx-auto text-center">
            <p className="inline-flex items-center gap-2 text-[10px] sm:text-xs uppercase tracking-[0.25em] text-violet-300/80 mb-4">
              <span className="h-px w-6 bg-violet-300/40" /> blog <span className="h-px w-6 bg-violet-300/40" />
            </p>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-4">
              Guías para tu comercio
            </h1>
            <p className="text-base sm:text-lg text-gray-400 max-w-xl mx-auto">
              Artículos prácticos sobre gestión de kioscos, almacenes y farmacias chicas en Argentina. Sin marketing, sin venta encubierta.
            </p>
          </div>
        </section>

        {/* Posts grid */}
        <section className="px-4 sm:px-6 pb-16 sm:pb-24">
          <div className="max-w-3xl mx-auto space-y-4">
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="block bg-white/[0.02] border border-white/10 hover:border-violet-500/40 hover:bg-white/[0.04] rounded-2xl p-5 sm:p-6 transition-all"
              >
                <div className="flex flex-wrap gap-2 mb-3">
                  {post.tags.map((t) => (
                    <span
                      key={t}
                      className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-500/20"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-2 group-hover:text-violet-200">
                  {post.title}
                </h2>
                <p className="text-sm text-gray-400 leading-relaxed mb-4">{post.description}</p>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <time dateTime={post.publishedAt}>
                      {new Date(post.publishedAt).toLocaleDateString("es-AR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </time>
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      {post.readTime} min de lectura
                    </span>
                  </div>
                  <span className="text-violet-300 text-sm font-medium inline-flex items-center gap-1">
                    Leer <ArrowRight size={14} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <footer className="border-t border-gray-900 py-8 text-center text-sm text-gray-600">
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mb-3">
            <Link href="/" className="hover:text-gray-400">Inicio</Link>
            <Link href="/pricing" className="hover:text-gray-400">Precios</Link>
            <Link href="/blog" className="hover:text-gray-400">Blog</Link>
          </div>
          <p>&copy; {new Date().getFullYear()} Orvex</p>
        </footer>
      </main>
    </>
  )
}
