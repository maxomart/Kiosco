"use client"

import Link from "next/link"
import { ShieldAlert, ArrowLeft } from "lucide-react"

interface NoAccessProps {
  /** Optional override of the explanation text. */
  message?: string
  /** Where the "Volver" button goes. */
  backHref?: string
  /** Label of the back button. */
  backLabel?: string
}

/**
 * Friendly page rendered when a logged-in user lacks the role needed to
 * see a page. The proxy already protects routes by login state — this is
 * the in-app role-based guard.
 */
export function NoAccess({
  message = "Tu rol no tiene permiso para acceder a esta sección. Hablá con el dueño o un administrador si necesitás acceso.",
  backHref = "/inicio",
  backLabel = "Volver al inicio",
}: NoAccessProps) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl shadow-black/30 animate-in fade-in zoom-in-95 duration-300">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
          <ShieldAlert className="w-7 h-7 text-red-400" />
        </div>

        <h2 className="text-xl font-bold text-gray-100 mb-2">Sin permisos</h2>
        <p className="text-sm text-gray-400 mb-6 leading-relaxed">{message}</p>

        <Link
          href={backHref}
          className="inline-flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium px-5 py-2.5 rounded-xl transition"
        >
          <ArrowLeft className="w-4 h-4" />
          {backLabel}
        </Link>
      </div>
    </div>
  )
}
