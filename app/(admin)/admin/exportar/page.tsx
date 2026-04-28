"use client"

import { useState, useEffect } from "react"
import { FileSpreadsheet, Copy, Check, AlertTriangle, ExternalLink } from "lucide-react"
import toast from "react-hot-toast"

export default function ExportarPage() {
  const [token, setToken] = useState<string | null>(null)
  const [origin, setOrigin] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    setOrigin(window.location.origin)
    fetch("/api/admin/export/info")
      .then(r => r.json())
      .then(d => {
        setToken(d.token ?? null)
      })
      .finally(() => setLoading(false))
  }, [])

  const usersUrl = token ? `${origin}/api/admin/export/users?token=${token}` : ""
  const paymentsUrl = token ? `${origin}/api/admin/export/payments?token=${token}` : ""
  const usersFormula = usersUrl ? `=IMPORTDATA("${usersUrl}")` : ""
  const paymentsFormula = paymentsUrl ? `=IMPORTDATA("${paymentsUrl}")` : ""

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      toast.success("Copiado")
      setTimeout(() => setCopied(null), 1500)
    } catch {
      toast.error("No se pudo copiar")
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-900/40 border border-emerald-700/40 flex items-center justify-center">
          <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Exportar a Google Sheets</h1>
          <p className="text-sm text-gray-400">Sincronización automática de usuarios y pagos.</p>
        </div>
      </div>

      {loading ? (
        <div className="h-32 bg-gray-900 rounded-xl animate-pulse" />
      ) : !token ? (
        <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-5 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-3 text-sm">
            <p className="text-amber-200 font-semibold">Falta configurar el token</p>
            <p className="text-amber-200/80">
              Agregá la variable <code className="bg-gray-900 px-1.5 py-0.5 rounded text-amber-300">SHEETS_EXPORT_TOKEN</code>{" "}
              en Railway → Variables. Generá un string aleatorio de al menos 32 caracteres y pegalo ahí.
            </p>
            <p className="text-amber-200/80">
              Por ejemplo en la terminal:
              <code className="block mt-2 bg-gray-900 p-2 rounded text-amber-300 text-xs">
                openssl rand -hex 24
              </code>
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Step 1: URLs */}
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
            <div>
              <h2 className="text-white font-semibold">1. URLs de tus planillas</h2>
              <p className="text-sm text-gray-500 mt-1">Estas URLs sirven CSV. Google Sheets las refresca cada hora.</p>
            </div>

            <div className="space-y-3">
              <UrlRow
                label="Usuarios"
                url={usersUrl}
                copied={copied === "users"}
                onCopy={() => copy(usersUrl, "users")}
              />
              <UrlRow
                label="Pagos"
                url={paymentsUrl}
                copied={copied === "payments"}
                onCopy={() => copy(paymentsUrl, "payments")}
              />
            </div>
          </section>

          {/* Step 2: Sheets formula */}
          <section className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
            <div>
              <h2 className="text-white font-semibold">2. Pegar en Google Sheets</h2>
              <p className="text-sm text-gray-500 mt-1">
                Creá una planilla nueva, dos hojas (Usuarios y Pagos). Pegá esta fórmula en la celda{" "}
                <code className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-300">A1</code> de cada una.
              </p>
            </div>

            <div className="space-y-3">
              <FormulaRow
                label="Hoja Usuarios — A1"
                formula={usersFormula}
                copied={copied === "uf"}
                onCopy={() => copy(usersFormula, "uf")}
              />
              <FormulaRow
                label="Hoja Pagos — A1"
                formula={paymentsFormula}
                copied={copied === "pf"}
                onCopy={() => copy(paymentsFormula, "pf")}
              />
            </div>

            <a
              href="https://sheets.new"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300"
            >
              Crear planilla nueva en Google Sheets <ExternalLink size={13} />
            </a>
          </section>

          {/* Step 3: notes */}
          <section className="bg-gray-900/40 border border-gray-800 rounded-xl p-5 space-y-2 text-sm text-gray-400">
            <p className="text-gray-300 font-semibold">Notas</p>
            <ul className="space-y-1.5 list-disc list-inside">
              <li>Sheets refresca <strong>=IMPORTDATA</strong> cada ~1h. Si querés forzar, borrá la fórmula y volvé a pegarla.</li>
              <li>Los datos vienen siempre completos — Sheets reemplaza la hoja entera, no acumula filas viejas.</li>
              <li>El token va en la URL: tratalo como una contraseña, no compartas el link de la planilla con gente que no debe ver pagos.</li>
              <li>Si necesitás rotar el token, cambiá <code className="bg-gray-800 px-1 py-0.5 rounded text-gray-300">SHEETS_EXPORT_TOKEN</code> en Railway y volvé a pegar las fórmulas.</li>
            </ul>
          </section>
        </>
      )}
    </div>
  )
}

function UrlRow({ label, url, copied, onCopy }: { label: string; url: string; copied: boolean; onCopy: () => void }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <div className="flex gap-2">
        <input
          readOnly
          value={url}
          onClick={(e) => e.currentTarget.select()}
          className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-300 font-mono"
        />
        <button
          type="button"
          onClick={onCopy}
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-200 border border-gray-700"
        >
          {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  )
}

function FormulaRow({ label, formula, copied, onCopy }: { label: string; formula: string; copied: boolean; onCopy: () => void }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <div className="flex gap-2">
        <input
          readOnly
          value={formula}
          onClick={(e) => e.currentTarget.select()}
          className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-xs text-emerald-300 font-mono"
        />
        <button
          type="button"
          onClick={onCopy}
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-sm text-white"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  )
}
