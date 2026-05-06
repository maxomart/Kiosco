"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { FileCheck2, AlertCircle, CheckCircle2, Loader2, Upload, Lock, Info, ExternalLink, ShieldCheck, Wand2, Eye, EyeOff } from "lucide-react"
import toast from "react-hot-toast"

/**
 * Valida un CUIT/CUIL argentino de 11 dígitos con el algoritmo del módulo 11
 * que usa AFIP. Devuelve `true` solo si el dígito verificador coincide.
 * Hacemos esta validación en el cliente para dar feedback inmediato y
 * evitar que el user mande a `/create-cert` con un CUIT mal escrito (la
 * llamada a ARCA tarda 2 minutos).
 */
function validateCuitMod11(cuit: string): boolean {
  if (!/^\d{11}$/.test(cuit)) return false
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const digits = cuit.split("").map(Number)
  const sum = digits.slice(0, 10).reduce((acc, d, i) => acc + d * weights[i], 0)
  const mod = sum % 11
  const expected = mod === 0 ? 0 : mod === 1 ? 9 : 11 - mod
  return digits[10] === expected
}

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

interface InvoiceQuota {
  plan: string
  limit: number
  used: number
  remaining: number
  percentUsed: number
  reachedLimit: boolean
  nearingLimit: boolean
  notIncluded: boolean
  periodStart: string
  periodEnd: string
}

export default function AfipConfigClient(_props: { initial?: any }) {
  const [config, setConfig] = useState<AfipConfig | null>(null)
  const [quota, setQuota] = useState<InvoiceQuota | null>(null)
  const [cryptoConfigured, setCryptoConfigured] = useState(false)
  const [sdkConfigured, setSdkConfigured] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [creatingCert, setCreatingCert] = useState(false)
  const [claveFiscal, setClaveFiscal] = useState("")
  const [showClaveFiscal, setShowClaveFiscal] = useState(false)

  const [cuit, setCuit] = useState("")
  const [pointOfSale, setPointOfSale] = useState<number>(1)
  const [condicionIVA, setCondicionIVA] = useState<"RI" | "MONOTRIBUTO" | "EXENTO">("MONOTRIBUTO")
  const [mode, setMode] = useState<"HOMOLOGACION" | "PRODUCCION">("HOMOLOGACION")
  const [businessName, setBusinessName] = useState("")
  const [enabled, setEnabled] = useState(false)

  const certRef = useRef<HTMLInputElement>(null)
  const keyRef = useRef<HTMLInputElement>(null)

  // Validación CUIT en vivo: si tiene 11 dígitos chequeamos el dígito
  // verificador. Mientras tipea (<11 dígitos) no decimos nada.
  const cuitValid = useMemo(() => {
    if (cuit.length === 0) return null
    if (cuit.length < 11) return null
    return validateCuitMod11(cuit)
  }, [cuit])

  const fetchConfig = async () => {
    try {
      const [r, ru] = await Promise.all([
        fetch("/api/configuracion/afip", { cache: "no-store" }),
        fetch("/api/configuracion/afip/usage", { cache: "no-store" }),
      ])
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
      if (ru.ok) {
        setQuota(await ru.json())
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
    if (!validateCuitMod11(cuit)) {
      toast.error("El CUIT no pasa la validación oficial de ARCA. Revisalo en tu DNI o en la web de ARCA.")
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

  const handleCreateCert = async () => {
    if (!cuit.match(/^\d{11}$/)) {
      toast.error("Primero completá un CUIT válido (11 dígitos)")
      return
    }
    if (!validateCuitMod11(cuit)) {
      toast.error("El CUIT no pasa la validación oficial de ARCA. Revisalo antes de generar el certificado (la operación tarda 2 minutos).")
      return
    }
    if (claveFiscal.length < 4) {
      toast.error("Entrá la clave fiscal de AFIP")
      return
    }
    if (!confirm("¿Generar el certificado en modo " + (mode === "PRODUCCION" ? "PRODUCCIÓN" : "Homologación") + "?\n\nLa clave fiscal sólo se usa para esta operación. No se guarda.")) {
      return
    }
    setCreatingCert(true)
    const tid = toast.loading("Generando certificado en ARCA. Puede tardar hasta 2 minutos…")
    try {
      const r = await fetch("/api/configuracion/afip/create-cert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cuit,
          claveFiscal,
          mode,
          businessName: businessName || undefined,
          condicionIVA,
          pointOfSale,
        }),
      })
      const d = await r.json()
      if (!r.ok || !d.ok) {
        toast.error(d.error ?? "No se pudo crear el certificado", { id: tid, duration: 8000 })
        return
      }
      setClaveFiscal("")
      if (d.connectionOk) {
        toast.success("¡Certificado creado y conexión a ARCA OK!", { id: tid, duration: 5000 })
      } else {
        toast(`Certificado creado, pero la conexión falló: ${d.connectionMessage ?? "(sin detalle)"}`, {
          id: tid, duration: 8000, icon: "⚠️",
        })
      }
      await fetchConfig()
    } catch (e: any) {
      toast.error(e?.message ?? "Error de red", { id: tid })
    } finally {
      setCreatingCert(false)
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

      {/* Cuota mensual */}
      {quota && !quota.notIncluded && (
        <section className={`rounded-xl border p-5 space-y-3 ${
          quota.reachedLimit
            ? "bg-red-950/30 border-red-800/40"
            : quota.nearingLimit
            ? "bg-amber-950/30 border-amber-800/40"
            : "bg-gray-900 border-gray-800"
        }`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-white font-semibold">Facturas este mes</h2>
              <p className="text-xs text-gray-500 mt-1">
                Tu plan {quota.plan} incluye{" "}
                {quota.limit === Number.POSITIVE_INFINITY ? "facturación ilimitada" : `${quota.limit} facturas/mes`}.
                {quota.limit !== Number.POSITIVE_INFINITY && quota.limit > 0 && (
                  <> Resetea el 1° del próximo mes.</>
                )}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-3xl font-bold text-white tabular-nums">
                {quota.used}
                {quota.limit !== Number.POSITIVE_INFINITY && (
                  <span className="text-gray-500 text-base font-normal">/{quota.limit}</span>
                )}
              </p>
              {quota.limit !== Number.POSITIVE_INFINITY && (
                <p className={`text-xs mt-0.5 ${
                  quota.reachedLimit ? "text-red-300" : quota.nearingLimit ? "text-amber-300" : "text-gray-500"
                }`}>
                  {quota.remaining} restantes
                </p>
              )}
            </div>
          </div>

          {quota.limit !== Number.POSITIVE_INFINITY && quota.limit > 0 && (
            <div className="space-y-1">
              <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    quota.reachedLimit ? "bg-red-500" : quota.nearingLimit ? "bg-amber-500" : "bg-purple-500"
                  }`}
                  style={{ width: `${quota.percentUsed}%` }}
                />
              </div>
              <p className="text-[11px] text-gray-500 text-right">{quota.percentUsed}% usado</p>
            </div>
          )}

          {quota.reachedLimit && (
            <div className="flex items-start gap-2 text-xs text-red-200 bg-red-950/40 rounded-lg p-3">
              <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p>
                Llegaste al límite del mes. Esperá al 1° del próximo mes o
                <a href="/configuracion/suscripcion" className="text-red-300 underline ml-1">subí de plan</a>.
              </p>
            </div>
          )}
          {quota.nearingLimit && !quota.reachedLimit && (
            <div className="flex items-start gap-2 text-xs text-amber-200 bg-amber-950/30 rounded-lg p-3">
              <AlertCircle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <p>Te quedan {quota.remaining} facturas este mes. Considerá pasar a un plan superior si vas a facturar más.</p>
            </div>
          )}
        </section>
      )}

      {quota?.notIncluded && (
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <p className="text-sm text-gray-300">
            Tu plan <strong>Gratis</strong> no incluye facturación electrónica.
            <a href="/configuracion/suscripcion" className="text-purple-300 underline ml-1">Mirá los planes</a> para activarla.
          </p>
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
          <Field
            label="CUIT (sin guiones)"
            help="Tu CUIT/CUIL personal o de la empresa. 11 dígitos, sin guiones ni espacios."
          >
            <div className="relative">
              <input
                type="text" inputMode="numeric"
                value={cuit}
                onChange={(e) => setCuit(e.target.value.replace(/\D/g, "").slice(0, 11))}
                placeholder="20123456789"
                aria-invalid={cuitValid === false}
                className={`w-full bg-gray-800 border rounded-lg px-3 py-2 pr-9 text-white text-sm focus:outline-none focus:ring-2 transition-colors ${
                  cuitValid === false
                    ? "border-red-500/60 focus:border-red-500 focus:ring-red-500/20"
                    : cuitValid === true
                    ? "border-emerald-500/60 focus:border-emerald-500 focus:ring-emerald-500/20"
                    : "border-gray-700 hover:border-gray-600 focus:border-purple-500 focus:ring-purple-500/20"
                }`}
              />
              {cuitValid === true && (
                <CheckCircle2 size={16} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-400" />
              )}
              {cuitValid === false && (
                <AlertCircle size={16} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-red-400" />
              )}
            </div>
            {cuitValid === false && (
              <p className="text-[11px] text-red-300 mt-1">
                El dígito verificador no coincide. Revisalo antes de generar el certificado.
              </p>
            )}
          </Field>
          <Field label="Razón social (opcional)" help="Nombre del negocio que aparece en la factura. Si lo dejás vacío usamos el nombre que ARCA tiene asociado a tu CUIT.">
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Kiosco Don Pepe SRL"
              className="w-full bg-gray-800 border border-gray-700 hover:border-gray-600 focus:border-purple-500 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
          </Field>
          <Field
            label="Condición frente al IVA"
            help="El régimen tributario en el que estás inscripto en ARCA. La gran mayoría de kioscos son Monotributistas. Si no sabés, consultalo en ARCA → Constancia de Inscripción."
          >
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
          <Field
            label="Punto de venta"
            help="Número de sucursal/punto de emisión que tenés dado de alta en ARCA. Si tenés una sola sucursal y nunca lo configuraste, dejá 1."
          >
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
              onClick={() => {
                if (mode === "PRODUCCION") return
                const ok = window.confirm(
                  "¿Pasar a modo PRODUCCIÓN?\n\nLas próximas facturas que emitas van a tener valor fiscal real ante ARCA. " +
                  "Solo activá producción si ya probaste el flow en homologación."
                )
                if (ok) setMode("PRODUCCION")
              }}
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

      {/* ─── Modo automático (uno-click) ─── */}
      <section className="bg-gradient-to-br from-purple-950/40 via-gray-900 to-gray-950 border border-purple-700/40 rounded-xl p-5 space-y-4 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-purple-600/20 blur-3xl rounded-full pointer-events-none" />
        <div className="relative space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-white font-semibold flex items-center gap-2">
                <Wand2 size={16} className="text-purple-400" />
                Modo automático <span className="text-[10px] bg-purple-500/20 text-purple-200 border border-purple-500/30 rounded-full px-2 py-0.5 ml-1">Recomendado</span>
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Generamos el certificado por vos en ARCA. Sólo necesitás tu CUIT y tu clave fiscal nivel 3+.
              </p>
            </div>
          </div>

          <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-3 flex gap-2 text-xs">
            <ShieldCheck size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="text-gray-300 space-y-1">
              <p>
                <strong className="text-emerald-300">Tu clave fiscal nunca se guarda</strong> — sólo viaja una vez al SDK para hacer el alta del cert en ARCA.
              </p>
              <p className="text-gray-500">
                El certificado generado queda encriptado con AES-256-GCM en nuestra base.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="CUIT (lo tomamos de arriba)">
              <input
                type="text" readOnly
                value={cuit || "(completá el CUIT arriba)"}
                className="w-full bg-gray-800/50 border border-gray-800 rounded-lg px-3 py-2 text-gray-400 text-sm cursor-not-allowed"
              />
            </Field>
            <Field label="Clave fiscal (nivel 3 o más)">
              <div className="relative">
                <input
                  type={showClaveFiscal ? "text" : "password"}
                  value={claveFiscal}
                  onChange={(e) => setClaveFiscal(e.target.value)}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="w-full bg-gray-800 border border-gray-700 hover:border-gray-600 focus:border-purple-500 rounded-lg pl-3 pr-10 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowClaveFiscal((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-200"
                  aria-label={showClaveFiscal ? "Ocultar clave" : "Mostrar clave"}
                >
                  {showClaveFiscal ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleCreateCert}
              disabled={creatingCert || !setupOk || !cuit || claveFiscal.length < 4}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm disabled:opacity-50 shadow-lg shadow-purple-900/40"
            >
              {creatingCert ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              {creatingCert ? "Generando…" : "Generar certificado"}
            </button>
            <p className="text-[11px] text-gray-500">
              Tarda hasta 2 minutos. Después probamos la conexión solos.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <h2 className="text-white font-semibold flex items-center gap-2">
          <Lock size={16} className="text-purple-400" />
          Certificado digital <span className="text-[10px] text-gray-500 font-normal ml-1">(modo manual)</span>
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

function Field({
  label,
  children,
  help,
}: {
  label: string
  children: React.ReactNode
  help?: string
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.1em] text-gray-400 font-bold mb-1.5">
        <span>{label}</span>
        {help && (
          <span className="relative inline-flex items-center group" tabIndex={0}>
            <Info size={11} className="text-gray-500 group-hover:text-gray-300 group-focus:text-gray-300 transition-colors cursor-help" />
            <span
              role="tooltip"
              className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-20 w-64 rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-[11px] normal-case font-normal tracking-normal leading-relaxed text-gray-200 shadow-xl opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity"
            >
              {help}
            </span>
          </span>
        )}
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
