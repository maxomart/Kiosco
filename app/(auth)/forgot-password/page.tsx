"use client"

import { useId, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import toast from "react-hot-toast"
import { ArrowLeft, CheckCircle, KeyRound, Loader2 } from "lucide-react"

export default function ForgotPasswordPage() {
  const emailId = useId()
  const [email, setEmail] = useState("")
  const [emailError, setEmailError] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  function validate() {
    if (!email) {
      setEmailError("El email es requerido.")
      return false
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Ingresá un email válido.")
      return false
    }
    setEmailError("")
    return true
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      setSent(true)
    } catch {
      toast.error("Ocurrió un error. Intentá de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
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
        <div className="relative bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-2xl p-7 sm:p-9 shadow-2xl shadow-black/60 overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)",
            }}
          />

          {sent ? (
            <div className="text-center">
              <div className="flex justify-center mb-5">
                <div
                  className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center shadow-lg shadow-emerald-500/20"
                  aria-hidden
                >
                  <CheckCircle className="w-7 h-7 text-emerald-400" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Revisá tu correo</h2>
              <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                Si el mail{" "}
                <span className="text-white font-medium">{email}</span> está
                registrado, recibirás instrucciones para restablecer tu contraseña.
              </p>
              <p className="text-xs text-gray-600 mt-3">
                No olvides revisar la carpeta de spam.
              </p>
              <Link
                href="/login"
                className="mt-6 inline-flex items-center gap-1.5 text-sm text-blue-300 hover:text-blue-200 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver al inicio de sesión
              </Link>
            </div>
          ) : (
            <>
              <div className="flex justify-center mb-5">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-blue-400/30"
                  aria-hidden
                >
                  <KeyRound className="w-6 h-6 text-blue-300" strokeWidth={2} />
                </div>
              </div>

              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Recuperar contraseña
                </h1>
                <p className="text-sm text-gray-400 mt-2">
                  Ingresá tu email y te mandamos instrucciones.
                </p>
              </div>

              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <div>
                  <label
                    htmlFor={emailId}
                    className="block text-[11px] uppercase tracking-wider font-medium text-gray-400 mb-1.5"
                  >
                    Email
                  </label>
                  <input
                    id={emailId}
                    type="email"
                    autoComplete="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (emailError) setEmailError("")
                    }}
                    className={`w-full bg-black/40 border rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 outline-none transition focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/60 ${
                      emailError
                        ? "border-red-500/60"
                        : "border-white/10 hover:border-white/20"
                    }`}
                  />
                  {emailError && (
                    <p className="mt-1.5 text-xs text-red-400">{emailError}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-400 hover:to-violet-400 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 text-sm transition-all shadow-lg shadow-blue-500/30 hover:scale-[1.01] active:scale-[0.99]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Enviando…
                    </>
                  ) : (
                    "Enviar instrucciones"
                  )}
                </button>

                <div className="pt-4 border-t border-white/10 text-center">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-blue-300 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Volver al inicio de sesión
                  </Link>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </motion.div>
  )
}
