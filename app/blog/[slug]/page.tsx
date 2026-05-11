import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { OrvexLogo } from "@/components/shared/OrvexLogo"
import { ArrowLeft, ArrowRight, Clock } from "lucide-react"
import { JsonLd } from "@/components/seo/JsonLd"
import {
  organizationSchema,
  articleSchema,
  breadcrumbSchema,
  howToSchema,
} from "@/lib/seo-schema"
import { BLOG_POSTS, getPostBySlug } from "@/lib/blog-posts"

// Pre-rendero todos los posts en build time. Nuevo post = sumar al array
// y rebuild. Para cuando tengas 50+ posts, considerá ISR.
export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) return { title: "Post no encontrado | Orvex" }
  return {
    title: `${post.title} | Blog Orvex`,
    description: post.description,
    alternates: { canonical: `https://cobraorvex.com/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      locale: "es_AR",
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt ?? post.publishedAt,
      tags: post.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  }
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) notFound()

  return (
    <>
      <JsonLd
        data={[
          organizationSchema(),
          articleSchema({
            title: post.title,
            description: post.description,
            slug: post.slug,
            publishedAt: post.publishedAt,
            updatedAt: post.updatedAt,
          }),
          breadcrumbSchema([
            { name: "Inicio", url: "https://cobraorvex.com/" },
            { name: "Blog", url: "https://cobraorvex.com/blog" },
            { name: post.title, url: `https://cobraorvex.com/blog/${post.slug}` },
          ]),
          // HowTo schema sólo si el post tiene pasos estructurados —
          // Google muestra los pasos como rich snippet expandible.
          ...(post.howToSteps && post.howToSteps.length > 0
            ? [
                howToSchema({
                  slug: post.slug,
                  name: post.title,
                  description: post.description,
                  totalTime: post.howToTotalTime,
                  steps: post.howToSteps,
                }),
              ]
            : []),
        ]}
      />
      <main className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-950 to-black text-white">
        {/* Header */}
        <header className="border-b border-white/5 sticky top-0 z-40 bg-gray-950/80 backdrop-blur-xl">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
            <Link href="/" className="flex items-center gap-2">
              <OrvexLogo size={28} className="flex-shrink-0" gradientId="post-logo" />
              <span className="font-bold text-base">Orvex</span>
            </Link>
            <div className="flex items-center gap-3">
              <Link href="/blog" className="hidden sm:inline text-sm text-gray-400 hover:text-white inline-flex items-center gap-1">
                <ArrowLeft size={14} /> Todos los posts
              </Link>
              <Link
                href="/signup"
                className="px-3 sm:px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-violet-500 text-white text-sm font-medium"
              >
                Empezar gratis
              </Link>
            </div>
          </div>
        </header>

        {/* Article header */}
        <section className="px-4 sm:px-6 pt-12 sm:pt-16 pb-6">
          <div className="max-w-3xl mx-auto">
            <div className="flex flex-wrap gap-2 mb-4">
              {post.tags.map((t) => (
                <span
                  key={t}
                  className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-500/20"
                >
                  {t}
                </span>
              ))}
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-[1.1] mb-4">
              {post.title}
            </h1>
            <p className="text-base sm:text-lg text-gray-400 leading-relaxed mb-5">
              {post.description}
            </p>
            <div className="flex items-center gap-4 text-xs text-gray-500">
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
          </div>
        </section>

        {/* Article body */}
        <article className="max-w-3xl mx-auto px-4 sm:px-6 pb-12 article-prose">
          {post.body}
        </article>

        {/* CTA final */}
        <section className="px-4 sm:px-6 pb-16 sm:pb-20">
          <div className="max-w-3xl mx-auto bg-gradient-to-br from-violet-900/40 to-blue-900/30 rounded-3xl p-6 sm:p-10 text-center border border-violet-700/30">
            <h2 className="text-2xl sm:text-3xl font-black mb-3 tracking-tight">
              ¿Listo para profesionalizar tu negocio?
            </h2>
            <p className="text-gray-300 mb-6 text-sm sm:text-base max-w-xl mx-auto">
              Probá Orvex gratis. Plan permanente sin tarjeta. Si te sirve, pasás a un plan pago. Si no, lo dejás.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-white text-black font-semibold transition-transform hover:scale-[1.02]"
            >
              Empezar gratis <ArrowRight size={16} />
            </Link>
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
