import { notFound } from "next/navigation"
import type { Metadata } from "next"
import Image from "next/image"
import { db } from "@/lib/db"
import { formatCurrency } from "@/lib/utils"
import { MapPin, Clock, Phone, MessageCircle, Store, Sparkles } from "lucide-react"

export const dynamic = "force-dynamic"
export const revalidate = 60

interface PageProps {
  params: Promise<{ slug: string }>
}

async function loadStorefront(slug: string) {
  const tenant = await db.tenant.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      config: {
        select: {
          businessName: true,
          logoUrl: true,
          publicStorefrontEnabled: true,
          publicHours: true,
          publicAddress: true,
          publicWhatsapp: true,
          publicDescription: true,
          publicShowPrices: true,
          themeColor: true,
        } as any,
      },
    },
  })
  if (!tenant) return null
  const cfg = tenant.config as any
  if (!cfg?.publicStorefrontEnabled) return null

  const products = await db.product.findMany({
    where: { tenantId: tenant.id, active: true, stock: { gt: 0 } },
    select: {
      id: true,
      name: true,
      salePrice: true,
      image: true,
      category: { select: { name: true } },
    },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    take: 200,
  })
  return { tenant, cfg, products }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const data = await loadStorefront(slug)
  if (!data) return { title: "Kiosco no encontrado · Orvex" }
  const name = data.cfg?.businessName ?? data.tenant.name
  return {
    title: `${name} — Carta digital`,
    description: data.cfg?.publicDescription ?? `Productos disponibles en ${name}.`,
    openGraph: {
      title: `${name} — Carta digital`,
      description: data.cfg?.publicDescription ?? `Productos disponibles en ${name}.`,
      images: data.cfg?.logoUrl ? [{ url: data.cfg.logoUrl }] : [],
    },
  }
}

export default async function StorefrontPage({ params }: PageProps) {
  const { slug } = await params
  const data = await loadStorefront(slug)
  if (!data) notFound()

  const { tenant, cfg, products } = data
  const name = cfg.businessName ?? tenant.name
  const accent = cfg.themeColor ?? "#7C3AED"

  // Group by category
  const byCategory = new Map<string, typeof products>()
  for (const p of products) {
    const key = p.category?.name ?? "Otros"
    const arr = byCategory.get(key) ?? []
    arr.push(p)
    byCategory.set(key, arr)
  }
  const categories = Array.from(byCategory.entries()).sort(([a], [b]) => a.localeCompare(b))

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-950 to-black text-white">
      {/* Hero */}
      <header className="relative overflow-hidden border-b border-white/10">
        <div
          className="absolute inset-0 opacity-30 blur-3xl pointer-events-none"
          style={{ background: `radial-gradient(circle at 30% 20%, ${accent}, transparent 60%)` }}
          aria-hidden
        />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
          <div className="flex items-start gap-5">
            {cfg.logoUrl ? (
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border border-white/10 bg-white/5 flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cfg.logoUrl} alt={name} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${accent}33`, border: `1px solid ${accent}66` }}
              >
                <Store className="w-10 h-10" style={{ color: accent }} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-none mb-2">
                {name}
              </h1>
              {cfg.publicDescription && (
                <p className="text-base sm:text-lg text-gray-300 leading-relaxed">
                  {cfg.publicDescription}
                </p>
              )}
            </div>
          </div>

          {/* Info chips */}
          <div className="flex flex-wrap gap-2 mt-5">
            {cfg.publicAddress && (
              <Chip icon={<MapPin size={13} />}>{cfg.publicAddress}</Chip>
            )}
            {cfg.publicHours && (
              <Chip icon={<Clock size={13} />}>{cfg.publicHours}</Chip>
            )}
            {cfg.publicWhatsapp && (
              <a
                href={`https://wa.me/${cfg.publicWhatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs hover:bg-emerald-500/20 transition-colors"
              >
                <MessageCircle size={13} />
                WhatsApp
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Catálogo */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {products.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p>Sin productos disponibles ahora.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {categories.map(([catName, items]) => (
              <div key={catName}>
                <h2 className="text-xs uppercase tracking-[0.2em] text-gray-500 font-bold mb-4">
                  {catName}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {items.map((p) => (
                    <article
                      key={p.id}
                      className="group bg-white/[0.03] border border-white/10 rounded-2xl p-3 hover:bg-white/[0.06] hover:border-white/20 transition-all"
                    >
                      {p.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.image}
                          alt={p.name}
                          className="w-full aspect-square object-cover rounded-xl mb-3 bg-gray-900"
                        />
                      ) : (
                        <div className="w-full aspect-square rounded-xl mb-3 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                          <Store className="w-8 h-8 text-gray-700" />
                        </div>
                      )}
                      <h3 className="text-sm font-medium text-white line-clamp-2 leading-tight min-h-[2.5em]">
                        {p.name}
                      </h3>
                      {cfg.publicShowPrices && (
                        <p
                          className="text-base font-bold tabular-nums mt-1"
                          style={{ color: accent }}
                        >
                          {formatCurrency(Number(p.salePrice))}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 mt-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 text-center">
          <a
            href="https://cobraorvex.com"
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Hecho con <span className="text-purple-400">Orvex</span> — gestión de kioscos
          </a>
        </div>
      </footer>
    </main>
  )
}

function Chip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-gray-300 text-xs">
      {icon}
      {children}
    </span>
  )
}
