"use client"

import { useState } from "react"
import Link from "next/link"
import toast from "react-hot-toast"
import { Loader2, Mail, ArrowLeft, CheckCircle } from "lucide-react"

export default function ForgotPasswordPage() {
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
      // Always show success to avoid email enumeration
      setSent(true)
    } catch {
      toast.error("Ocurrió un error. Intentá de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl shadow-black/40">
        {sent ? (
          /* Success state */
          <div className="text-center py-4">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-green-400" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Revisá tu correo</h2>
            <p className="text-sm text-gray-400 leading-relaxed">
              Si el mail{" "}
              <span className="text-gray-200 font-medium">{email}</span>{" "}
              está registrado, recibirás instrucciones para restablecer tu contraseña.
            </p>
            <p className="text-xs text-gray-600 mt-3">
              No olvides revisar la carpeta de spam.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver al inicio de sesión
            </Link>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="mb-8">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors mb-6"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver
              </Link>
              <h1 className="text-2xl font-bold text-white mb-1">
                ¿Olvidaste tu contraseña?
              </h1>
              <p className="text-sm text-gray-400">
                Ingresá tu email y te enviamos instrucciones para restablecerla.
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-300 mb-1.5"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (emailError) setEmailError("")
                    }}
                    placeholder="tu@email.com"
                    className={`w-full bg-gray-950 border rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition focus:ring-2 focus:ring-purple-600/60 focus:border-purple-600 ${
                      emailError
                        ? "border-red-500/70 focus:ring-red-500/40 focus:border-red-500"
                        : "border-gray-700 hover:border-gray-600"
                    }`}
                  />
                </div>
                {emailError && (
                  <p className="mt-1.5 text-xs text-red-400">{emailError}</p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-2.5 text-sm transition-colors shadow-lg shadow-purple-900/30"
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
            </form>
          </>
        )}
      </div>
    </div>
  )
}
