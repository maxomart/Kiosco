"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import toast from "react-hot-toast"
import { ArrowRight, CheckCircle2, Loader2, Mail, RefreshCw } from "lucide-react"

/**
 * /verificar-email — entry point for new users right after signup, and
 * for any logged-in user whose emailVerified is still null (the dashboard
 * layout bounces them here).
 *
 * Two states:
 *  - We have ?uid=… in the URL: post-signup case, we use that userId
 *    to confirm. After success → /login.
 *  - No uid: existing logged-in user, the API uses the session. After
 *    success → /inicio.
 */

function VerifyEmailInner() {
  const router = useRouter()
  const params = useSearchParams()
  const uidFromUrl = params.get("uid")

  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(60)
  const [success, setSuccess] = useState(false)
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    intervalRef.current = window.setInterval(() => {
      setResendCooldown((s) => (s > 0 ? s - 1 : 0))
    }, 1000)
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current)
    }
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (code.length !== 6 || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/auth/email-verify/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, userId: uidFromUrl ?? undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "No pudimos verificar el código.")
        setBusy(false)
        return
      }
      setSuccess(true)
      toast.success("Email verificado")
      // Always send them to /inicio. Signup auto-logged-in already, so
      // the session is in place; the dashboard layout was only blocking
      // because emailVerified was null, and that flipped just now.
      // window.location.href forces a fresh server-side render so the
      // dashboard layout re-reads the user row instead of the cached
      // (still-unverified) one.
      setTimeout(() => {
        window.location.href = "/inicio"
      }, 700)
    } catch (e: any) {
      setError(e?.message ?? "Algo falló. Probá de nuevo.")
      setBusy(false)
    }
  }

  async function resend() {
    if (resendCooldown > 0) return
    try {
      const res = await fetch("/api/auth/email-verify/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uidFromUrl ?? undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo reenviar.")
        if (data.retryInSec) setResendCooldown(data.retryInSec)
        return
      }
      if (data.alreadyVerified) {
        toast.success("Tu email ya estaba verificado")
        setSuccess(true)
        setTimeout(() => router.replace(uidFromUrl ? "/login" : "/inicio"), 900)
        return
      }
      toast.success(`Código reenviado a ${data.sentTo}`)
      setResendCooldown(60)
    } catch (e: any) {
      toast.error(e?.message ?? "Algo falló")
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-md"
    >
      <div className="relative">
        <div
          aria-hidden
          className="absolute -inset-px rounded-2xl opacity-60 blur-xl"
          style={{
            background:
              "linear-gradient(135deg, rgba(59,130,246,0.35), rgba(139,92,246,0.35))",
          }}
        />
        <div className="relative bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-2xl p-5 sm:p-9 shadow-2xl shadow-black/60 overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)",
            }}
          />

          {success ? (
            <div className="text-center py-6">
              <div className="inline-flex w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 items-center justify-center mb-4">
                <CheckCircle2 className="w-6 h-6 text-emerald-300" />
              </div>
              <h1 className="text-2xl font-bold text-white">Email verificado</h1>
              <p className="text-sm text-gray-400 mt-2">Te llevamos al login…</p>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <div className="text-center mb-6">
                <div className="inline-flex w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-400/30 items-center justify-center mb-4">
                  <Mail className="w-5 h-5 text-blue-300" />
                </div>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Confirmá tu email
                </h1>
                <p className="text-sm text-gray-400 mt-2">
                  Te mandamos un código de 6 dígitos. Si no lo encontrás, revisá la carpeta de spam.
                </p>
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
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  if (error) setError(null)
                }}
                className="w-full bg-black/40 border border-white/10 hover:border-white/20 rounded-xl px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] text-white outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/60"
                placeholder="······"
              />
              {error && <p className="mt-2 text-xs text-red-400 text-center">{error}</p>}

              <button
                type="submit"
                disabled={busy || code.length !== 6}
                className="mt-5 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-400 hover:to-violet-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 text-sm transition-all"
              >
                {busy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Verificar y entrar <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="mt-4 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={resend}
                  disabled={resendCooldown > 0}
                  className="flex items-center gap-1.5 text-gray-400 hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {resendCooldown > 0
                    ? `Reenviar en ${resendCooldown}s`
                    : "Reenviar código"}
                </button>
                <Link href="/login" className="text-gray-500 hover:text-blue-300 transition-colors">
                  Volver
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-md h-[420px]" />}>
      <VerifyEmailInner />
    </Suspense>
  )
}
