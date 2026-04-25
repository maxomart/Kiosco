"use client"

import { useEffect, useState } from "react"
import toast from "react-hot-toast"
import Link from "next/link"
import { QrCode, ExternalLink, Loader2 } from "lucide-react"

interface MPConfig {
  mpAccessToken: string
  mpAccessTokenConfigured: boolean
  mpPublicKey: string
  mpUserId: string
  mpStoreId: string
}

export default function MercadoPagoClient() {
  const [config, setConfig] = useState<MPConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testQr, setTestQr] = useState<string | null>(null)
  const [testInit, setTestInit] = useState<string | null>(null)
  const [tokenInput, setTokenInput] = useState("")

  useEffect(() => {
    fetch("/api/mercadopago/config")
      .then((r) => r.json())
      .then((d) => {
        if (d.config) setConfig(d.config)
      })
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    if (!config) return
    setSaving(true)
    const body: any = {
      mpPublicKey: config.mpPublicKey,
      mpUserId: config.mpUserId,
      mpStoreId: config.mpStoreId,
    }
    if (tokenInput) body.mpAccessToken = tokenInput
    const res = await fetch("/api/mercadopago/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (res.ok) {
      toast.success("Configuración de Mercado Pago guardada")
      setTokenInput("")
      // refresh
      const r = await fetch("/api/mercadopago/config")
      const d = await r.json()
      if (d.config) setConfig(d.config)
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error(d?.error ?? "No se pudo guardar")
    }
  }

  const runTest = async () => {
    setTesting(true)
    setTestQr(null)
    setTestInit(null)
    const res = await fetch("/api/mercadopago/preference", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ title: "Prueba Orvex", quantity: 1, unit_price: 1 }],
        externalReference: `test-${Date.now()}`,
      }),
    })
    setTesting(false)
    const d = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(d?.error ?? "Falló la prueba")
      return
    }
    setTestQr(d.qrUrl)
    setTestInit(d.initPoint)
    toast.success("QR generado. Escaneálo con la app de Mercado Pago.")
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[40vh] text-gray-500">
        <Loader2 className="animate-spin mr-2" size={18} /> Cargando...
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl space-y-6 animate-in fade-in duration-300">
      <div>
        <div className="flex items-center gap-2">
          <Link href="/configuracion" className="text-gray-500 hover:text-gray-300 text-sm">← Configuración</Link>
        </div>
        <h1 className="text-2xl font-bold text-white mt-2">Mercado Pago</h1>
        <p className="text-gray-400 text-sm mt-1">Cobrá con QR desde el POS. Las ventas se confirman automáticamente cuando el cliente paga.</p>
      </div>

      {/* Onboarding */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5 text-sm text-blue-200 space-y-2">
        <p className="font-semibold text-blue-100">Cómo obtener tu Access Token</p>
        <ol className="list-decimal list-inside space-y-1 text-blue-200/90">
          <li>
            Entrá a{" "}
            <a href="https://www.mercadopago.com.ar/developers/panel/app" target="_blank" rel="noreferrer"
              className="underline inline-flex items-center gap-1">
              Developers de Mercado Pago <ExternalLink size={12} />
            </a>
          </li>
          <li>Creá una aplicación (tipo "Pagos online")</li>
          <li>En "Credenciales de producción", copiá el <span className="font-mono bg-blue-900/40 px-1 rounded">Access Token</span></li>
          <li>Pegalo abajo y guardá</li>
        </ol>
      </div>

      {config && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <h2 className="text-white font-semibold">Credenciales</h2>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">
              Access Token {config.mpAccessTokenConfigured && <span className="text-green-400">· Configurado</span>}
            </label>
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder={config.mpAccessTokenConfigured ? config.mpAccessToken : "APP_USR-..."}
              className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-purple-500"
            />
            <p className="text-xs text-gray-500 mt-1">El token se guarda encriptado. Dejalo vacío para mantener el actual.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Public Key (opcional)</label>
              <input
                value={config.mpPublicKey}
                onChange={(e) => setConfig({ ...config, mpPublicKey: e.target.value })}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">User ID (opcional)</label>
              <input
                value={config.mpUserId}
                onChange={(e) => setConfig({ ...config, mpUserId: e.target.value })}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm text-gray-400 mb-1.5">Store ID (solo para QR Pro, opcional)</label>
              <input
                value={config.mpStoreId}
                onChange={(e) => setConfig({ ...config, mpStoreId: e.target.value })}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-800">
            <button onClick={save} disabled={saving}
              className="px-5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-semibold transition">
              {saving ? "Guardando..." : "Guardar"}
            </button>
            <button onClick={runTest} disabled={testing || !config.mpAccessTokenConfigured}
              className="px-5 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-100 text-sm font-semibold transition flex items-center gap-2">
              <QrCode size={15} /> {testing ? "Generando..." : "Probar (genera QR de $1)"}
            </button>
          </div>
        </div>
      )}

      {testQr && testInit && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center space-y-3">
          <p className="text-white font-semibold">QR de prueba</p>
          <p className="text-xs text-gray-500">Si lo escaneás con la app de MP, se cobra $1 a tu propia cuenta.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={testQr} alt="QR test" className="mx-auto rounded-lg bg-white p-2" width={256} height={256} />
          <a href={testInit} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-purple-400 hover:underline">
            Abrir en Mercado Pago <ExternalLink size={12} />
          </a>
        </div>
      )}
    </div>
  )
}
