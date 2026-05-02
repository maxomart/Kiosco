"use client"

import { useEffect, useState } from "react"
import { Smartphone, ExternalLink, Check, X, Copy, Terminal } from "lucide-react"
import toast from "react-hot-toast"

export default function AppAndroidPage() {
  const [origin, setOrigin] = useState("")
  const [assetLinks, setAssetLinks] = useState<any[] | null>(null)

  useEffect(() => {
    setOrigin(window.location.origin)
    fetch("/.well-known/assetlinks.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setAssetLinks(Array.isArray(d) ? d : []))
      .catch(() => setAssetLinks([]))
  }, [])

  const configured = assetLinks && assetLinks.length > 0

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

      {/* Estado */}
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
