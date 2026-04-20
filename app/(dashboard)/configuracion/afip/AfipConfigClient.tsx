"use client"

import { useState } from "react"
import Link from "next/link"
import toast from "react-hot-toast"
import { ArrowLeft, FileCheck2, ShieldCheck, ShieldAlert, Zap, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"

interface InitialConfig {
  afipEnabled: boolean
  afipMode: "HOMOLOGACION" | "PRODUCCION"
  afipCondicionIVA: "RI" | "MONOTRIBUTO" | "EXENTO" | null
  afipPointOfSale: number
  afipCertProvider: "mock" | "tusfacturas"
  afipCertCuit: string
  afipCertSecret: string
  afipLastSyncAt: string | null
  afipLastError: string | null
}

export default function AfipConfigClient({ initial }: { initial: InitialConfig }) {
  const [cfg, setCfg] = useState<InitialConfig>(initial)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  // Parse TusFacturas credentials from JSON-encoded secret
  const parsedCreds = (() => {
    try {
      return JSON.parse(cfg.afipCertSecret || "{}") as { apitoken?: string; apikey?: string; usertoken?: string }
    } catch {
      return {}
    }
  })()
  const [tf, setTf] = useState({
    apitoken: parsedCreds.apitoken ?? "",
    apikey: parsedCreds.apikey ?? "",
    usertoken: parsedCreds.usertoken ?? "",
  })

  const set = <K extends keyof InitialConfig>(key: K, val: InitialConfig[K]) =>
    setCfg((c) => ({ ...c, [key]: val }))

  const handleSave = async () => {
    setSaving(true)
    const secret = cfg.afipCertProvider === "tusfacturas" ? JSON.stringify(tf) : ""
    const res = await fetch("/api/afip/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        afipEnabled: cfg.afipEnabled,
        afipMode: cfg.afipMode,
        afipCondicionIVA: cfg.afipCondicionIVA,
        afipPointOfSale: Number(cfg.afipPointOfSale) || 1,
        afipCertProvider: cfg.afipCertProvider,
        afipCertCuit: cfg.afipCertCuit || null,
        afipCertSecret: secret || null,
      }),
    })
    setSaving(false)
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      toast.success("Configuración AFIP guardada")
      setCfg((c) => ({ ...c, afipCertSecret: secret }))
    } else {
      toast.error(data?.error ?? "No se pudo guardar")
    }
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      const res = await fetch("/api/afip/test", { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (data.ok) toast.success(data.message ?? "Conexión OK")
      else toast.error(data.message ?? "Falló el test")
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl space-y-6 animate-in fade-in duration-300">
      <Link href="/configuracion" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 mb-2">
        <ArrowLeft size={14} /> Volver a configuración
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileCheck2 className="text-accent" size={22} /> Facturación electrónica AFIP
        </h1>
        <p className="text-gray-400 text-sm mt-1">Emití facturas A, B y C con CAE directo de AFIP.</p>
      </div>

      {/* Status card */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-start gap-4">
        {cfg.afipEnabled ? (
          <ShieldCheck className="text-green-400 flex-shrink-0" size={24} />
        ) : (
          <ShieldAlert className="text-amber-400 flex-shrink-0" size={24} />
        )}
        <div className="flex-1">
          {cfg.afipEnabled ? (
            <>
              <p className="text-white text-sm font-medium">
                AFIP activo en modo <span className="text-accent">{cfg.afipMode}</span>
              </p>
              <p className="text-gray-500 text-xs mt-0.5">
                Proveedor: {cfg.afipCertProvider} · CUIT: {cfg.afipCertCuit || "—"} · Punto de venta: {cfg.afipPointOfSale}
              </p>
              {cfg.afipLastError && (
                <p className="text-red-400 text-xs mt-2">Último error: {cfg.afipLastError}</p>
              )}
            </>
          ) : (
            <>
              <p className="text-white text-sm font-medium">AFIP desactivado</p>
              <p className="text-gray-500 text-xs mt-0.5">Activá el interruptor para empezar a emitir comprobantes.</p>
            </>
          )}
        </div>
      </div>

      {/* Main form */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 space-y-5">
        <label className="flex items-center justify-between gap-3 p-3 rounded-lg bg-gray-800/40 hover:bg-gray-800/60 transition cursor-pointer">
          <div>
            <p className="text-sm font-medium text-gray-100">Activar facturación electrónica</p>
            <p className="text-xs text-gray-500 mt-0.5">Al activarlo, las ventas podrán solicitar CAE a AFIP.</p>
          </div>
          <input
            type="checkbox"
            checked={cfg.afipEnabled}
            onChange={(e) => set("afipEnabled", e.target.checked)}
            className="w-5 h-5 rounded accent-accent flex-shrink-0"
          />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Modo"
            value={cfg.afipMode}
            onChange={(e) => set("afipMode", e.target.value as "HOMOLOGACION" | "PRODUCCION")}
          >
            <option value="HOMOLOGACION">Homologación (testing)</option>
            <option value="PRODUCCION">Producción (real)</option>
          </Select>

          <Select
            label="Condición IVA del emisor"
            value={cfg.afipCondicionIVA ?? ""}
            onChange={(e) => set("afipCondicionIVA", (e.target.value || null) as any)}
          >
            <option value="">Seleccioná…</option>
            <option value="RI">Responsable Inscripto</option>
            <option value="MONOTRIBUTO">Monotributo</option>
            <option value="EXENTO">Exento</option>
          </Select>

          <Input
            label="CUIT del emisor"
            value={cfg.afipCertCuit}
            onChange={(e) => set("afipCertCuit", e.target.value)}
            placeholder="20-12345678-9"
            hint="11 dígitos. Validamos el checksum."
          />

          <Input
            label="Punto de venta"
            type="number"
            min={1}
            value={cfg.afipPointOfSale}
            onChange={(e) => set("afipPointOfSale", Number(e.target.value) || 1)}
            hint="Usalo tal como lo configuraste en AFIP (habitualmente 1, 2, 3…)."
          />

          <div className="sm:col-span-2">
            <Select
              label="Proveedor de facturación"
              value={cfg.afipCertProvider}
              onChange={(e) => set("afipCertProvider", e.target.value as "mock" | "tusfacturas")}
            >
              <option value="mock">Mock — para testear sin AFIP real</option>
              <option value="tusfacturas">TusFacturas.app — integración productiva</option>
            </Select>
          </div>
        </div>

        {cfg.afipCertProvider === "tusfacturas" && (
          <div className="space-y-3 pt-2 border-t border-gray-800">
            <p className="text-sm font-medium text-gray-200">Credenciales TusFacturas.app</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="API Key"
                value={tf.apikey}
                onChange={(e) => setTf({ ...tf, apikey: e.target.value })}
                placeholder="xxxxxxxx"
              />
              <Input
                label="API Token"
                value={tf.apitoken}
                onChange={(e) => setTf({ ...tf, apitoken: e.target.value })}
                placeholder="xxxxxxxx"
              />
              <Input
                label="User Token"
                value={tf.usertoken}
                onChange={(e) => setTf({ ...tf, usertoken: e.target.value })}
                placeholder="xxxxxxxx"
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-800">
          <Button onClick={handleSave} loading={saving} size="md">
            {saving ? "Guardando..." : "Guardar configuración"}
          </Button>
          <Button
            variant="secondary"
            onClick={handleTest}
            loading={testing}
            leftIcon={<Zap size={14} />}
          >
            Probar conexión
          </Button>
        </div>
      </div>

      {/* Docs block */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 space-y-3">
        <h2 className="text-white font-semibold">Cómo dar de alta tu cuenta en TusFacturas</h2>
        <ol className="text-sm text-gray-400 space-y-2 list-decimal pl-5">
          <li>
            Creá una cuenta gratuita en{" "}
            <a href="https://www.tusfacturas.app/registro" target="_blank" rel="noreferrer" className="text-accent hover:underline inline-flex items-center gap-1">
              tusfacturas.app/registro <ExternalLink size={11} />
            </a>
          </li>
          <li>
            En tu cuenta AFIP (<a className="text-accent hover:underline" href="https://auth.afip.gob.ar/" target="_blank" rel="noreferrer">Administrador de Relaciones</a>)
            delegale a TusFacturas el rol <code className="bg-gray-800 px-1 rounded text-xs">Webservices Facturación Electrónica</code>.
          </li>
          <li>Desde el panel de TusFacturas, copiá tu <b>API Key</b>, <b>API Token</b> y <b>User Token</b> (Configuración → API).</li>
          <li>Pegalos arriba y probá la conexión.</li>
          <li>Empezá en modo <b>Homologación</b>. Una vez que AFIP te habilite la producción, cambialo a <b>Producción</b>.</li>
        </ol>
        <p className="text-xs text-gray-500 pt-2 border-t border-gray-800">
          Documentación de la API:{" "}
          <a href="https://developers.tusfacturas.app/" target="_blank" rel="noreferrer" className="text-accent hover:underline">developers.tusfacturas.app</a>
          {" · "}Spec del QR AFIP:{" "}
          <a href="https://www.afip.gob.ar/fe/qr/especificaciones.asp" target="_blank" rel="noreferrer" className="text-accent hover:underline">RG 4892/2020</a>
        </p>
      </div>
    </div>
  )
}
