"use client"

import { useId, useState } from "react"
import Link from "next/link"
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
    <div className="w-full max-w-md">
      <div className="relative bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-2xl p-7 sm:p-8 shadow-2xl shadow-black/50">
        {sent ? (
          <div className="text-center">
            <div className="flex justify-center mb-5">
              <div
                className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center"
                aria-hidden
              >
                <CheckCircle className="w-7 h-7 text-emerald-400" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-white">Revisá tu correo</h2>
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
              className="mt-6 inline-flex items-center gap-1.5 text-sm text-white hover:text-gray-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver al inicio de sesión
            </Link>
          </div>
        ) : (
          <>
            <div className="flex justify-center mb-5">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))",
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,0.08), 0 10px 30px -10px rgba(0,0,0,0.8)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
                aria-hidden
              >
                <KeyRound className="w-6 h-6 text-white" strokeWidth={2} />
              </div>
            </div>

            <div className="text-center mb-6">
              <h1 className="text-2xl font-semibold text-white tracking-tight">
                Recuperar contraseña
              </h1>
              <p className="text-sm text-gray-400 mt-1.5">
                Ingresá tu email y te mandamos instrucciones.
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div>
                <label
                  htmlFor={emailId}
                  className="block text-xs font-medium text-gray-300 mb-1.5"
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
                  className={`w-full bg-black/40 border rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition focus:ring-2 focus:ring-white/20 focus:border-white/30 ${
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
                className="w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-200 disabled:opacity-60 disabled:cursor-not-allowed text-black font-semibold rounded-lg py-2.5 text-sm transition-colors"
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
                  className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
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
  )
}
