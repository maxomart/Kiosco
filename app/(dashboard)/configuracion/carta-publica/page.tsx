"use client"

import { useEffect, useState } from "react"
import { Globe, ExternalLink, Copy, Check, Loader2, Save, MessageCircle } from "lucide-react"
import toast from "react-hot-toast"

interface State {
  slug: string
  enabled: boolean
  hours: string
  address: string
  whatsapp: string
  description: string
  showPrices: boolean
}

export default function CartaPublicaPage() {
  const [data, setData] = useState<State | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState("")

  useEffect(() => {
    setOrigin(window.location.origin)
    fetch("/api/configuracion/carta-publica", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (!data) return
    setSaving(true)
    const r = await fetch("/api/configuracion/carta-publica", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: data.enabled,
        hours: data.hours,
        address: data.address,
        whatsapp: data.whatsapp,
        description: data.description,
        showPrices: data.showPrices,
      }),
    })
    setSaving(false)
    if (r.ok) toast.success("Guardado")
    else {
      const d = await r.json().catch(() => ({}))
      toast.error(d.error ?? "No se pudo guardar")
    }
  }

  const url = data ? `${origin}/k/${data.slug}` : ""

  const handleCopy = async () => {
    if (!url) return
    await navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success("Link copiado")
    setTimeout(() => setCopied(false), 1500)
  }

  if (loading || !data) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="h-32 bg-gray-900 rounded-xl animate-pulse" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-pink-900/40 border border-pink-700/40 flex items-center justify-center">
          <Globe className="w-5 h-5 text-pink-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Carta pública</h1>
          <p className="text-sm text-gray-400">
            Una vidriera online con tus productos. Compartila por WhatsApp, redes o ponela en el QR del kiosco.
          </p>
        </div>
      </div>

      {/* Toggle principal + URL */}
      <section className="bg-gradient-to-br from-pink-950/30 via-gray-900 to-gray-900 border border-pink-700/30 rounded-xl p-5 space-y-4 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-pink-600/20 blur-3xl rounded-full pointer-events-none" />
        <div className="relative space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-white font-semibold">Activar carta pública</h2>
              <p className="text-xs text-gray-400 mt-1">
                Cuando esté activa, cualquiera con el link puede ver tus productos disponibles.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={data.enabled}
                onChange={(e) => setData({ ...data, enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className={`w-11 h-6 rounded-full transition-colors ${data.enabled ? "bg-pink-600" : "bg-gray-700"}`}>
                <div className={`w-5 h-5 rounded-full bg-white transition-transform translate-y-0.5 ${data.enabled ? "translate-x-[22px]" : "translate-x-0.5"}`} />
              </div>
            </label>
          </div>

          <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-2">
              Tu link
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm text-pink-200 bg-black/30 px-3 py-2 rounded-md font-mono truncate">
                {url}
              </code>
              <button
                onClick={handleCopy}
                className="p-2 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-300 flex-shrink-0"
                title="Copiar"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              </button>
              <a
                href={url}
                target="_blank"
                rel="noopener"
                className="p-2 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-300 flex-shrink-0"
                title="Abrir"
              >
                <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Campos editables */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <h2 className="text-white font-semibold">Información de tu kiosco</h2>

        <Field label="Descripción corta">
          <textarea
            value={data.description}
            onChange={(e) => setData({ ...data, description: e.target.value.slice(0, 500) })}
            rows={2}
            placeholder="Kiosco familiar abierto desde 1995. Productos frescos todos los días."
            className="w-full bg-gray-800 border border-gray-700 hover:border-gray-600 focus:border-pink-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/20 resize-none"
          />
          <p className="text-[10px] text-gray-500 mt-1">{data.description.length}/500</p>
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Horarios">
            <input
              type="text"
              value={data.hours}
              onChange={(e) => setData({ ...data, hours: e.target.value.slice(0, 120) })}
              placeholder="Lun-Sáb 8:00 a 22:00"
              className="w-full bg-gray-800 border border-gray-700 hover:border-gray-600 focus:border-pink-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/20"
            />
          </Field>
          <Field label="Dirección">
            <input
              type="text"
              value={data.address}
              onChange={(e) => setData({ ...data, address: e.target.value.slice(0, 200) })}
              placeholder="Av. Siempreviva 742"
              className="w-full bg-gray-800 border border-gray-700 hover:border-gray-600 focus:border-pink-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/20"
            />
          </Field>
        </div>

        <Field label="WhatsApp (opcional)" hint="Sin +, ej: 5491123456789">
          <div className="relative">
            <MessageCircle size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400" />
            <input
              type="tel"
              inputMode="numeric"
              value={data.whatsapp}
              onChange={(e) => setData({ ...data, whatsapp: e.target.value.replace(/\D/g, "").slice(0, 20) })}
              placeholder="5491123456789"
              className="w-full bg-gray-800 border border-gray-700 hover:border-gray-600 focus:border-pink-500 rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/20"
            />
          </div>
        </Field>

        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={data.showPrices}
            onChange={(e) => setData({ ...data, showPrices: e.target.checked })}
            className="w-4 h-4 accent-pink-500"
          />
          Mostrar precios en la carta
        </label>
      </section>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-semibold disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1.5">
        {label} {hint && <span className="text-gray-600 font-normal normal-case">— {hint}</span>}
      </label>
      {children}
    </div>
  )
}
