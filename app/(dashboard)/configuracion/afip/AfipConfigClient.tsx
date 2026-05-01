"use client"

import { useState, useEffect, useRef } from "react"
import { FileCheck2, AlertCircle, CheckCircle2, Loader2, Upload, Lock, Info, ExternalLink, ShieldCheck } from "lucide-react"
import toast from "react-hot-toast"

interface AfipConfig {
  enabled: boolean
  ready: boolean
  mode: "HOMOLOGACION" | "PRODUCCION"
  condicionIVA: "RI" | "MONOTRIBUTO" | "EXENTO" | null
  pointOfSale: number | null
  cuit: string | null
  businessName: string | null
  hasCert: boolean
  hasPrivateKey: boolean
  lastSyncAt: string | null
  lastError: string | null
}

export default function AfipConfigClient(_props: { initial?: any }) {
  const [config, setConfig] = useState<AfipConfig | null>(null)
  const [cryptoConfigured, setCryptoConfigured] = useState(false)
  const [sdkConfigured, setSdkConfigured] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  const [cuit, setCuit] = useState("")
  const [pointOfSale, setPointOfSale] = useState<number>(1)
  const [condicionIVA, setCondicionIVA] = useState<"RI" | "MONOTRIBUTO" | "EXENTO">("MONOTRIBUTO")
  const [mode, setMode] = useState<"HOMOLOGACION" | "PRODUCCION">("HOMOLOGACION")
  const [businessName, setBusinessName] = useState("")
  const [enabled, setEnabled] = useState(false)

  const certRef = useRef<HTMLInputElement>(null)
  const keyRef = useRef<HTMLInputElement>(null)

  const fetchConfig = async () => {
    try {
      const r = await fetch("/api/configuracion/afip", { cache: "no-store" })
      if (r.ok) {
        const d = await r.json()
        if (d.config) {
          setConfig(d.config)
          setCuit(d.config.cuit ?? "")
          setPointOfSale(d.config.pointOfSale ?? 1)
          setCondicionIVA(d.config.condicionIVA ?? "MONOTRIBUTO")
          setMode(d.config.mode)
          setBusinessName(d.config.businessName ?? "")
          setEnabled(d.config.enabled)
        }
        setCryptoConfigured(!!d.cryptoConfigured)
        setSdkConfigured(!!d.sdkConfigured)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchConfig() }, [])

  const readFile = (input: HTMLInputElement | null): Promise<string | null> => {
    const file = input?.files?.[0]
    if (!file) return Promise.resolve(null)
    return file.text()
  }

  const handleSave = async () => {
    if (!cuit.match(/^\d{11}$/)) {
      toast.error("CUIT inválido — tiene que ser 11 dígitos sin guiones")
      return
    }
    setSaving(true)
    try {
      const cert = certRef.current?.files?.[0] ? await readFile(certRef.current) : undefined
      const key = keyRef.current?.files?.[0] ? await readFile(keyRef.current) : undefined

      const r = await fetch("/api/configuracion/afip", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cuit, pointOfSale, condicionIVA, mode, businessName, enabled,
          ...(cert ? { cert } : {}),
          ...(key ? { privateKey: key } : {}),
        }),
      })
      const d = await r.json()
      if (!r.ok) {
        toast.error(d.error ?? "Error al guardar")
        return
      }
      toast.success("Configuración guardada")
      if (certRef.current) certRef.current.value = ""
      if (keyRef.current) keyRef.current.value = ""
      await fetchConfig()
    } catch (e: any) {
      toast.error(e?.message ?? "Error de red")
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      const r = await fetch("/api/configuracion/afip/test", { method: "POST" })
      const d = await r.json()
      if (d.ok) toast.success("Conexión con ARCA OK", { duration: 4000 })
      else toast.error(d.message ?? "No se pudo conectar", { duration: 6000 })
      await fetchConfig()
    } catch (e: any) {
      toast.error(e?.message ?? "Error de red")
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="h-32 bg-gray-900 rounded-xl animate-pulse" />
      </div>
    )
  }

  const setupOk = cryptoConfigured && sdkConfigured

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-900/40 border border-amber-700/40 flex items-center justify-center">
          <FileCheck2 className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Facturación electrónica ARCA</h1>
          <p className="text-sm text-gray-400">
            Emití facturas A/B/C con CAE directo de ARCA (ex AFIP) desde tu POS.
          </p>
        </div>
      </div>

      {!setupOk && (
        <section className="bg-amber-950/40 border border-amber-800/40 rounded-xl p-5 space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-200 space-y-2">
              <p className="font-semibold">Setup del servidor pendiente</p>
              {!cryptoConfigured && (
                <p>Falta <code className="bg-gray-900 px-1 py-0.5 rounded">AFIP_ENCRYPTION_KEY</code> en Railway. Generala con <code className="bg-gray-900 px-1 py-0.5 rounded">openssl rand -hex 32</code>.</p>
              )}
              {!sdkConfigured && (
                <p>Falta <code className="bg-gray-900 px-1 py-0.5 rounded">AFIP_SDK_ACCESS_TOKEN</code>. Conseguilo gratis en <a href="https://afipsdk.com" target="_blank" rel="noopener" className="text-purple-300 underline inline-flex items-center gap-1">afipsdk.com<ExternalLink size={11} /></a>.</p>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
        <h2 className="text-white font-semibold">Estado</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <StatusCard label="Conexión a ARCA" ok={config?.ready ?? false} text={config?.ready ? "Verificada" : "Sin probar"} />
          <StatusCard label="Certificado X.509" ok={config?.hasCert ?? false} text={config?.hasCert ? "Cargado" : "Falta subir"} />
          <StatusCard label="Private key" ok={config?.hasPrivateKey ?? false} text={config?.hasPrivateKey ? "Cargada" : "Falta subir"} />
        </div>
        {config?.lastError && (
          <div className="bg-red-950/40 border border-red-800/40 rounded-lg p-3 text-xs text-red-200">
            <p className="font-semibold mb-1">Último error:</p>
            <code className="text-red-300 break-all">{config.lastError}</code>
          </div>
        )}
      </section>

      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <h2 className="text-white font-semibold">Datos fiscales</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="CUIT (sin guiones)">
            <input
              type="text" inputMode="numeric"
              value={cuit}
              onChange={(e) => setCuit(e.target.value.replace(/\D/g, "").slice(0, 11))}
              placeholder="20123456789"
              className="w-full bg-gray-800 border border-gray-700 hover:border-gray-600 focus:border-purple-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
          </Field>
          <Field label="Razón social (opcional)">
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Kiosco Don Pepe SRL"
              className="w-full bg-gray-800 border border-gray-700 hover:border-gray-600 focus:border-purple-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
          </Field>
          <Field label="Condición frente al IVA">
            <select
              value={condicionIVA}
              onChange={(e) => setCondicionIVA(e.target.value as any)}
              className="w-full bg-gray-800 border border-gray-700 hover:border-gray-600 focus:border-purple-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 cursor-pointer"
            >
              <option value="MONOTRIBUTO">Monotributista</option>
              <option value="RI">Responsable Inscripto</option>
              <option value="EXENTO">Exento</option>
            </select>
          </Field>
          <Field label="Punto de venta">
            <input
              type="number"
              value={pointOfSale}
              onChange={(e) => setPointOfSale(Math.max(1, parseInt(e.target.value || "1")))}
              min={1} max={99999}
              className="w-full bg-gray-800 border border-gray-700 hover:border-gray-600 focus:border-purple-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
          </Field>
        </div>

        <div className="bg-gray-800/40 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-400 mb-2">Ambiente</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("HOMOLOGACION")}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === "HOMOLOGACION"
                  ? "bg-amber-600/20 border border-amber-500/40 text-amber-200"
                  : "bg-gray-800 border border-gray-700 text-gray-400 hover:text-white"
              }`}
            >
              Pruebas (Homologación)
            </button>
            <button
              type="button"
              onClick={() => setMode("PRODUCCION")}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === "PRODUCCION"
                  ? "bg-emerald-600/20 border border-emerald-500/40 text-emerald-200"
                  : "bg-gray-800 border border-gray-700 text-gray-400 hover:text-white"
              }`}
            >
              Producción
            </button>
          </div>
          <p className="text-[11px] text-gray-500 mt-2">
            {mode === "HOMOLOGACION"
              ? "Modo testing — facturas contra ambiente de pruebas, sin valor fiscal."
              : "Modo real — facturas con valor fiscal. Probá primero en homologación."}
          </p>
        </div>
      </section>

      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <h2 className="text-white font-semibold flex items-center gap-2">
          <Lock size={16} className="text-purple-400" />
          Certificado digital
        </h2>
        <div className="bg-purple-950/30 border border-purple-900/40 rounded-lg p-3 flex gap-2 text-xs">
          <Info size={14} className="text-purple-300 flex-shrink-0 mt-0.5" />
          <div className="text-purple-100/90 space-y-1">
            <p>El certificado lo generás en el portal de ARCA con tu clave fiscal:</p>
            <ol className="list-decimal list-inside space-y-0.5 text-purple-200/80">
              <li>Entrá a ARCA con clave fiscal nivel 3</li>
              <li>Buscá "Administración de Certificados Digitales"</li>
              <li>Generá uno nuevo asociado al servicio "Facturación Electrónica" (wsfe)</li>
              <li>Descargás el .crt y .key</li>
              <li>Subilos acá. Los guardamos encriptados con AES-256.</li>
            </ol>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Certificado X.509 (.crt o .pem)">
            <input
              ref={certRef} type="file" accept=".crt,.pem,.cer,.txt"
              className="block w-full text-xs text-gray-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-purple-600/20 file:text-purple-200 file:text-xs file:font-medium hover:file:bg-purple-600/30"
            />
            {config?.hasCert && (
              <p className="text-[11px] text-emerald-400 mt-1.5 flex items-center gap-1">
                <CheckCircle2 size={11} /> Ya hay un certificado guardado
              </p>
            )}
          </Field>
          <Field label="Private Key (.key o .pem)">
            <input
              ref={keyRef} type="file" accept=".key,.pem,.txt"
              className="block w-full text-xs text-gray-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-purple-600/20 file:text-purple-200 file:text-xs file:font-medium hover:file:bg-purple-600/30"
            />
            {config?.hasPrivateKey && (
              <p className="text-[11px] text-emerald-400 mt-1.5 flex items-center gap-1">
                <CheckCircle2 size={11} /> Ya hay una key guardada
              </p>
            )}
          </Field>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-gray-500 pt-2">
          <ShieldCheck size={12} className="text-emerald-400" />
          Encriptados con AES-256-GCM. Ni nosotros vemos tus certificados.
        </div>
      </section>

      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-white font-semibold">Activar facturación electrónica</h2>
            <p className="text-xs text-gray-500 mt-1">
              Cuando esté activo, cada venta del POS puede emitir factura ARCA automática.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
            <input
              type="checkbox" checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              disabled={!config?.ready}
              className="sr-only peer"
            />
            <div className={`w-11 h-6 rounded-full transition-colors ${enabled && config?.ready ? "bg-purple-600" : "bg-gray-700"}`}>
              <div className={`w-5 h-5 rounded-full bg-white transition-transform translate-y-0.5 ${enabled && config?.ready ? "translate-x-[22px]" : "translate-x-0.5"}`} />
            </div>
          </label>
        </div>
        {!config?.ready && (
          <p className="text-[11px] text-amber-400 flex items-center gap-1">
            <AlertCircle size={12} /> Para activar, primero probá la conexión y que sea exitosa.
          </p>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="button" onClick={handleSave} disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
        <button
          type="button" onClick={handleTest} disabled={testing || !setupOk}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 font-medium text-sm disabled:opacity-50"
        >
          {testing ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
          {testing ? "Probando..." : "Probar conexión"}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-[0.1em] text-gray-400 font-bold mb-1.5">
        {label}
      </label>
      {children}
    </div>
  )
}

function StatusCard({ label, ok, text }: { label: string; ok: boolean; text: string }) {
  return (
    <div className={`rounded-lg border p-3 ${ok ? "bg-emerald-950/40 border-emerald-800/40" : "bg-gray-800/50 border-gray-800"}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400">{label}</span>
        {ok ? <CheckCircle2 size={14} className="text-emerald-400" /> : <AlertCircle size={14} className="text-gray-500" />}
      </div>
      <p className={`text-sm ${ok ? "text-emerald-200" : "text-gray-400"}`}>{text}</p>
    </div>
  )
}
