"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Lock, Mail, Monitor, ShieldCheck, ArrowRight } from "lucide-react"

/**
 * Device verification flow.
 *
 * Step 1 — on mount, compute a fingerprint signal in the browser and
 *          POST it to /api/admin/device/start. Server tells us whether
 *          this device is already trusted (sets cookie, redirects),
 *          whether we just bootstrap-trusted it (same), or whether we
 *          need to verify a code.
 *
 * Step 2 — if a code is required, show the input. POST it to /verify.
 *          On success, redirect to /admin.
 */
function buildFingerprintSignal(): string {
  // Stable signals: UA, screen, timezone, platform, languages, hardware.
  const ua = navigator.userAgent ?? ""
  const screen = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? ""
  const lang = (navigator.languages ?? [navigator.language]).join(",")
  const platform = (navigator as any).platform ?? ""
  const hc = (navigator.hardwareConcurrency ?? 0).toString()
  const dm = ((navigator as any).deviceMemory ?? 0).toString()

  // Tiny canvas fingerprint — small but useful diff for same OS/browser
  // on different machines.
  let canvasHash = "no-canvas"
  try {
    const c = document.createElement("canvas")
    c.width = 240
    c.height = 60
    const ctx = c.getContext("2d")
    if (ctx) {
      ctx.textBaseline = "top"
      ctx.font = "14px 'Arial'"
      ctx.fillStyle = "#f60"
      ctx.fillRect(0, 0, 200, 30)
      ctx.fillStyle = "#069"
      ctx.fillText("Orvex.dev fingerprint 🔒", 2, 4)
      ctx.fillStyle = "rgba(102,204,0,0.7)"
      ctx.fillText("Orvex.dev fingerprint 🔒", 4, 17)
      canvasHash = c.toDataURL().slice(-64) // last 64 chars are enough
    }
  } catch {
    // canvas blocked — fingerprinting still works without it
  }

  return [ua, screen, tz, lang, platform, hc, dm, canvasHash].join("||")
}

type StartResp =
  | { trusted: true; deviceId: string; bootstrap?: boolean }
  | { trusted: false; challengeId: string; sentTo: string }
  | { error: string }

export default function AdminDevicePage() {
  const router = useRouter()
  const [phase, setPhase] = useState<"checking" | "verify" | "trusted" | "error">("checking")
  const [bootstrap, setBootstrap] = useState(false)
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [code, setCode] = useState("")
  const [label, setLabel] = useState("")
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true
    void start()
  }, [])

  async function start() {
    setError(null)
    try {
      const signal = buildFingerprintSignal()
      const res = await fetch("/api/admin/device/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signal }),
      })
      const data: StartResp = await res.json()
      if ("error" in data) {
        setError(data.error)
        setPhase("error")
        return
      }
      if (data.trusted) {
        setBootstrap(!!data.bootstrap)
        setPhase("trusted")
        // Slight delay so the user sees "OK"
        setTimeout(() => router.replace("/admin"), 900)
        return
      }
      setChallengeId(data.challengeId)
      setSentTo(data.sentTo)
      setPhase("verify")
    } catch (e) {
      setError(String(e))
      setPhase("error")
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    if (!challengeId) return
    setVerifying(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/device/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, code, label: label.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "No pudimos verificar el código")
        setVerifying(false)
        return
      }
      setPhase("trusted")
      setTimeout(() => router.replace("/admin"), 700)
    } catch (e) {
      setError(String(e))
      setVerifying(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-md p-7 shadow-2xl shadow-black/60">
        <div className="flex items-center justify-center mb-5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-blue-400/30 flex items-center justify-center">
            <Lock className="w-5 h-5 text-blue-300" strokeWidth={2} />
          </div>
        </div>

        {phase === "checking" && (
          <div className="text-center">
            <h1 className="text-xl font-bold text-white mb-1">Verificando tu compu…</h1>
            <p className="text-sm text-gray-400 mb-5">Esto tarda un segundo.</p>
            <Loader2 className="w-5 h-5 animate-spin text-gray-400 mx-auto" />
          </div>
        )}

        {phase === "trusted" && (
          <div className="text-center">
            <ShieldCheck className="w-7 h-7 text-emerald-400 mx-auto mb-2" />
            <h1 className="text-xl font-bold text-white mb-1">
              {bootstrap ? "Listo — esta es tu compu" : "Dispositivo confiable"}
            </h1>
            <p className="text-sm text-gray-400">
              {bootstrap
                ? "La marcamos como confiable. Cualquier login desde otra te va a pedir código."
                : "Te llevamos al panel."}
            </p>
          </div>
        )}

        {phase === "verify" && (
          <form onSubmit={verify} noValidate>
            <h1 className="text-xl font-bold text-white text-center mb-1">Compu nueva detectada</h1>
            <p className="text-sm text-gray-400 text-center mb-5">
              Te mandamos un código a <span className="text-blue-300">{sentTo}</span>.
              Tiene 6 dígitos y vence en 10 minutos.
            </p>

            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/10 mb-3 text-xs text-gray-400">
              <Mail className="w-4 h-4 text-blue-300 shrink-0" />
              Revisá tu mail (también en spam)
            </div>

            <label className="block text-[11px] uppercase tracking-wider font-medium text-gray-400 mb-1.5">
              Código
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-full bg-black/40 border border-white/10 hover:border-white/20 rounded-xl px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] text-white outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/60"
              placeholder="······"
            />

            <label className="block text-[11px] uppercase tracking-wider font-medium text-gray-400 mt-4 mb-1.5">
              Nombre del dispositivo (opcional)
            </label>
            <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-3">
              <Monitor className="w-4 h-4 text-gray-500 shrink-0" />
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ej: MacBook personal"
                className="flex-1 bg-transparent py-3 text-sm text-white placeholder-gray-600 outline-none"
              />
            </div>

            {error && <p className="mt-3 text-xs text-red-400 text-center">{error}</p>}

            <button
              type="submit"
              disabled={verifying || code.length !== 6}
              className="mt-5 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-400 hover:to-violet-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 text-sm transition-all"
            >
              {verifying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Confirmar y entrar <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={start}
              disabled={verifying}
              className="mt-3 w-full text-xs text-gray-500 hover:text-blue-300 transition-colors"
            >
              Reenviar código
            </button>
          </form>
        )}

        {phase === "error" && (
          <div className="text-center">
            <h1 className="text-xl font-bold text-white mb-1">Algo salió mal</h1>
            <p className="text-sm text-gray-400 mb-4">{error ?? "Reintentá en un rato."}</p>
            <button
              onClick={start}
              className="px-5 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm text-white"
            >
              Reintentar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
