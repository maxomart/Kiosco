"use client"

import { useEffect, useState } from "react"
import { Smartphone, ExternalLink, Check, X, Copy, Terminal, Download, Upload, FileWarning } from "lucide-react"
import toast from "react-hot-toast"

interface AppInfo { available: boolean; version?: string; sizeMB?: number; lastModified?: string }

export default function AppAndroidPage() {
  const [origin, setOrigin] = useState("")
  const [assetLinks, setAssetLinks] = useState<any[] | null>(null)
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    setOrigin(window.location.origin)
    fetch("/.well-known/assetlinks.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setAssetLinks(Array.isArray(d) ? d : []))
      .catch(() => setAssetLinks([]))
    fetch("/api/app/latest", { cache: "no-store" })
      .then((r) => r.json())
      .then(setAppInfo)
      .catch(() => setAppInfo({ available: false }))
  }, [])

  const configured = assetLinks && assetLinks.length > 0
  const apkAvailable = !!appInfo?.available

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    toast.success("Copiado")
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-900/40 border border-emerald-700/40 flex items-center justify-center">
          <Smartphone className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">App de Android (Play Store)</h1>
          <p className="text-sm text-gray-400">
            Empaquetá Orvex como app nativa para Android usando un TWA.
          </p>
        </div>
      </div>

      {/* Distribución directa (sideload) — la opción rápida */}
      <section className="bg-gradient-to-br from-emerald-950/30 via-gray-900 to-gray-900 border border-emerald-700/30 rounded-xl p-5 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/20 blur-3xl rounded-full pointer-events-none" />
        <div className="relative">
          <div className="flex items-start gap-3 mb-4">
            <Download className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-white font-semibold">Distribución directa</h2>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-200 border border-emerald-500/30 rounded-full px-2 py-0.5 font-bold uppercase tracking-wider">
                  Recomendado
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Subís el APK acá → tus clientes lo descargan desde{" "}
                <a href="/descargar" target="_blank" rel="noopener" className="text-emerald-300 underline">
                  cobraorvex.com/descargar
                </a>. Sin Play Store, sin USD 25, sin esperar 5 días de revisión.
              </p>
            </div>
          </div>

          <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-3 mb-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-2">
              Estado del APK
            </p>
            {apkAvailable ? (
              <div className="space-y-1">
                <p className="text-sm text-emerald-200 flex items-center gap-2">
                  <Check size={14} className="text-emerald-400" />
                  <strong>v{appInfo?.version}</strong> disponible · {appInfo?.sizeMB} MB
                </p>
                <p className="text-[11px] text-gray-500">
                  Subido {appInfo?.lastModified ? new Date(appInfo.lastModified).toLocaleString("es-AR") : "—"}
                </p>
                <a
                  href="/descargar"
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-1 mt-2 text-xs text-emerald-300 hover:text-emerald-200"
                >
                  Ver página pública <ExternalLink size={11} />
                </a>
              </div>
            ) : (
              <p className="text-sm text-amber-200 flex items-center gap-2">
                <FileWarning size={14} className="text-amber-400" />
                APK aún no subido
              </p>
            )}
          </div>

          <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-4 space-y-2">
            <p className="text-xs text-gray-300 font-semibold flex items-center gap-1.5">
              <Upload size={12} className="text-emerald-400" />
              Cómo subir el APK
            </p>
            <ol className="space-y-1 text-xs text-gray-400 list-decimal list-inside">
              <li>Generá el APK con bubblewrap (sección "Cómo armar el APK" abajo)</li>
              <li>Renombrá el archivo a <code className="text-emerald-300 bg-black/40 px-1.5 py-0.5 rounded">orvex.apk</code></li>
              <li>Subilo a <code className="text-emerald-300 bg-black/40 px-1.5 py-0.5 rounded">public/downloads/orvex.apk</code> en el repo de Railway</li>
              <li>Opcionalmente seteá la env var <code className="text-emerald-300 bg-black/40 px-1.5 py-0.5 rounded">APP_ANDROID_VERSION=1.0.0</code></li>
              <li>Push a main → Railway redeploya solo → la página de descarga muestra el archivo</li>
            </ol>
            <p className="text-[11px] text-gray-500 pt-2 border-t border-gray-800">
              💡 Para futuras versiones: regenerás el APK, lo reemplazás en <code className="text-emerald-300">orvex.apk</code> y bumpeás <code className="text-emerald-300">APP_ANDROID_VERSION</code>.
            </p>
          </div>
        </div>
      </section>

      {/* Estado de Play Store / TWA assetlinks */}
      <section className={`rounded-xl border p-5 ${
        configured ? "bg-emerald-950/30 border-emerald-700/30" : "bg-amber-950/30 border-amber-700/30"
      }`}>
        <div className="flex items-start gap-3">
          {configured ? (
            <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          ) : (
            <X className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <p className={`font-semibold ${configured ? "text-emerald-200" : "text-amber-200"}`}>
              {configured ? "TWA configurado" : "TWA pendiente de setup"}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {configured
                ? `${assetLinks?.length} fingerprint(s) registrado(s) en /.well-known/assetlinks.json`
                : "Faltan setear las env vars TWA_PACKAGE_NAME y TWA_SHA256_FINGERPRINTS en Railway."}
            </p>
            <a
              href="/.well-known/assetlinks.json"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1 mt-2 text-xs text-purple-300 hover:text-purple-200"
            >
              Ver assetlinks.json <ExternalLink size={11} />
            </a>
          </div>
        </div>
      </section>

      {/* Pasos */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
        <h2 className="text-white font-semibold">Cómo armar el APK</h2>
        <ol className="space-y-4 text-sm text-gray-300">
          <Step n={1} title="Instalar bubblewrap (CLI de Google para TWAs)">
            <CodeBlock value="npm install -g @bubblewrap/cli" onCopy={copy} />
          </Step>

          <Step n={2} title="Inicializar el proyecto desde el manifest">
            <CodeBlock value={`bubblewrap init --manifest ${origin}/manifest.json`} onCopy={copy} />
            <p className="text-xs text-gray-500 mt-1">
              Te va a pedir el package name (ej: <code className="text-purple-300">com.orvex.app</code>) y datos del firmador.
            </p>
          </Step>

          <Step n={3} title="Generar el APK firmado">
            <CodeBlock value="bubblewrap build" onCopy={copy} />
          </Step>

          <Step n={4} title="Copiar el SHA-256 fingerprint del keystore">
            <CodeBlock value="keytool -list -v -keystore android.keystore -alias android" onCopy={copy} />
          </Step>

          <Step n={5} title="Setear las env vars en Railway">
            <div className="space-y-1 mt-1">
              <CodeBlock value="TWA_PACKAGE_NAME=com.orvex.app" onCopy={copy} />
              <CodeBlock value="TWA_SHA256_FINGERPRINTS=AA:BB:CC:..." onCopy={copy} />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Después de redeploy, verificá que <code className="text-purple-300">/.well-known/assetlinks.json</code> devuelva el fingerprint.
            </p>
          </Step>

          <Step n={6} title="Subir el APK a Play Store">
            <p className="text-xs text-gray-400">
              Necesitás cuenta de Google Play Developer (USD 25 una vez). Subí el APK desde el dashboard de Play Console.
            </p>
          </Step>
        </ol>
      </section>

      {/* Links útiles */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-3 text-sm">Links útiles</h3>
        <ul className="space-y-2 text-sm">
          <Link href="https://github.com/GoogleChromeLabs/bubblewrap">Bubblewrap (GitHub)</Link>
          <Link href="https://www.pwabuilder.com/">PWABuilder (alternativa visual)</Link>
          <Link href="https://developer.chrome.com/docs/android/trusted-web-activity">Docs oficiales de TWA</Link>
          <Link href="https://play.google.com/console">Play Console</Link>
        </ul>
      </section>
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-center">
        {n}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium mb-1.5">{title}</p>
        {children}
      </div>
    </li>
  )
}

function CodeBlock({ value, onCopy }: { value: string; onCopy: (s: string) => void }) {
  return (
    <div className="flex items-center gap-2 bg-black/40 border border-gray-800 rounded-md px-2 py-1.5">
      <Terminal size={12} className="text-gray-500 flex-shrink-0" />
      <code className="text-xs text-emerald-200 font-mono flex-1 truncate">{value}</code>
      <button
        onClick={() => onCopy(value)}
        className="p-1 text-gray-500 hover:text-gray-200 flex-shrink-0"
        title="Copiar"
      >
        <Copy size={12} />
      </button>
    </div>
  )
}

function Link({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noopener"
        className="text-purple-300 hover:text-purple-200 inline-flex items-center gap-1 text-sm"
      >
        {children} <ExternalLink size={11} />
      </a>
    </li>
  )
}
