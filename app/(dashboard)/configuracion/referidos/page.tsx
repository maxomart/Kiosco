"use client"

import { useEffect, useState } from "react"
import { Gift, Copy, Check, Users, Sparkles } from "lucide-react"
import toast from "react-hot-toast"

interface Stats {
  code: string
  bonusMonths: number
  referredCount: number
  recent: Array<{ name: string; createdAt: string }>
}

export default function ReferidosPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<"code" | "link" | null>(null)
  const [origin, setOrigin] = useState("")

  useEffect(() => {
    setOrigin(window.location.origin)
    fetch("/api/referidos", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setStats(d))
      .finally(() => setLoading(false))
  }, [])

  const link = stats ? `${origin}/registro?ref=${stats.code}` : ""
  const waMsg = stats
    ? `Te recomiendo Orvex para tu kiosco. Si te registrás con mi código tenés 1 mes gratis: ${link}`
    : ""

  const copy = async (text: string, kind: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(kind)
      toast.success("Copiado")
      setTimeout(() => setCopied(null), 1500)
    } catch {
      toast.error("No se pudo copiar")
    }
  }

  if (loading) {
    return <div className="p-6 max-w-4xl mx-auto"><div className="h-32 bg-gray-900 rounded-xl animate-pulse" /></div>
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-900/40 border border-emerald-700/40 flex items-center justify-center">
          <Gift className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Recomendá Orvex</h1>
          <p className="text-sm text-gray-400">
            Por cada kiosco que se sume con tu código, los dos reciben <strong className="text-emerald-400">1 mes gratis</strong>.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Users size={12} /> Referidos exitosos
          </div>
          <p className="text-3xl font-bold text-white tabular-nums">{stats?.referredCount ?? 0}</p>
        </div>
        <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl p-5">
          <div className="flex items-center gap-2 text-xs text-emerald-300 mb-1">
            <Sparkles size={12} /> Meses gratis acumulados
          </div>
          <p className="text-3xl font-bold text-emerald-300 tabular-nums">{stats?.bonusMonths ?? 0}</p>
          <p className="text-[11px] text-emerald-300/70 mt-1">Se descuentan del próximo cobro</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-xs text-gray-500 mb-1">Tu código</div>
          <div className="flex items-center gap-2">
            <code className="text-2xl font-bold text-purple-300 font-mono tracking-wider">{stats?.code}</code>
            <button
              type="button"
              onClick={() => stats && copy(stats.code, "code")}
              className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white"
              aria-label="Copiar"
            >
              {copied === "code" ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
          </div>
        </div>
      </div>

      {/* Compartir */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <h2 className="text-white font-semibold">Compartilo</h2>
        <div>
          <label className="block text-[11px] uppercase tracking-[0.1em] text-gray-400 font-bold mb-1.5">
            Tu link único
          </label>
          <div className="flex gap-2">
            <input
              readOnly value={link}
              onClick={(e) => e.currentTarget.select()}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 font-mono"
            />
            <button
              type="button"
              onClick={() => copy(link, "link")}
              className="inline-flex items-center gap-1.5 px-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm border border-gray-700"
            >
              {copied === "link" ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              {copied === "link" ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(waMsg)}`}
            target="_blank" rel="noopener"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium"
          >
            Compartir por WhatsApp
          </a>
          <a
            href={`mailto:?subject=Te recomiendo Orvex&body=${encodeURIComponent(waMsg)}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm border border-gray-700"
          >
            Mail
          </a>
        </div>
      </section>

      {/* Recientes */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
        <h2 className="text-white font-semibold">Últimos referidos</h2>
        {stats?.recent?.length ? (
          <div className="space-y-2">
            {stats.recent.map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-gray-800/50 border border-gray-800 text-sm">
                <span className="text-gray-200">{r.name}</span>
                <span className="text-[11px] text-gray-500">{new Date(r.createdAt).toLocaleDateString("es-AR")}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 py-4 text-center">Todavía nadie usó tu código. Mandalo por WhatsApp a otros kiosqueros que conozcas.</p>
        )}
      </section>

      <section className="bg-gray-900/40 border border-gray-800 rounded-xl p-5 text-sm text-gray-400 space-y-2">
        <p className="text-gray-300 font-semibold">Cómo funciona</p>
        <ol className="space-y-1.5 list-decimal list-inside">
          <li>Compartís tu código o link con otros kiosqueros</li>
          <li>Cuando se registran usándolo, el sistema lo detecta automático</li>
          <li>Apenas pagan su primer mes, vos y ellos reciben 1 mes gratis cada uno</li>
          <li>El bonus se descuenta automático del próximo cobro de MP</li>
        </ol>
      </section>
    </div>
  )
}
