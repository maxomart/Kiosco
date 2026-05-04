"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Lock, Sparkles, Crown, ArrowRight, LogOut } from "lucide-react"
import { signOut } from "next-auth/react"

/**
 * Pantalla bloqueante full-screen — aparece cuando el trial venció o se
 * agotó el período de gracia post-fallo de pago. El usuario sólo puede:
 *   - Suscribirse (link a /configuracion/suscripcion)
 *   - Ver el catálogo público (carta /k/<slug> sigue activa)
 *   - Cerrar sesión
 *
 * Bloquea el resto del dashboard pero NO bloquea /configuracion/suscripcion
 * (eso lo decide el layout server-side antes de renderizar este componente).
 */
export function SubscriptionBlockScreen({
  reason,
  ownerEmail,
}: {
  reason: "trial-expired" | "payment-failed"
  ownerEmail?: string | null
}) {
  return (
    <div className="fixed inset-0 z-[200] bg-gray-950/95 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", damping: 22 }}
        className="relative w-full max-w-md bg-gradient-to-br from-gray-900 to-gray-950 border border-purple-700/40 rounded-3xl shadow-2xl shadow-purple-900/40 overflow-hidden"
      >
        {/* Glow */}
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-purple-600/20 blur-3xl rounded-full pointer-events-none" />

        <div className="relative p-8 text-center">
          {/* Icon */}
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center">
            <Lock className="w-8 h-8 text-purple-300" />
          </div>

          <h1 className="text-2xl font-black text-white mb-2 tracking-tight">
            {reason === "trial-expired"
              ? "Se terminó tu prueba"
              : "Tu suscripción está pausada"}
          </h1>
          <p className="text-sm text-gray-400 mb-6 leading-relaxed">
            {reason === "trial-expired"
              ? "Pasaron los 7 días de prueba gratis. Para seguir usando Orvex, elegí un plan."
              : "Mercado Pago no pudo cobrar y se acabó el período de gracia. Suscribite de nuevo para recuperar el acceso."}
          </p>

          {/* Plans summary */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 mb-5 text-left space-y-2">
            <PlanRow icon={<Sparkles size={14} className="text-purple-400" />} name="Básico" price="$9.999" />
            <PlanRow icon={<Crown size={14} className="text-amber-400" />} name="Profesional" price="$24.900" highlight />
            <PlanRow icon={<Crown size={14} className="text-emerald-400" />} name="Empresa" price="$59.900" />
          </div>

          {/* CTA primario */}
          <Link
            href="/configuracion/suscripcion"
            className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-bold text-base shadow-lg shadow-purple-900/40 transition-all hover:scale-[1.02] active:scale-[0.99]"
          >
            Elegir plan y suscribirme
            <ArrowRight size={16} />
          </Link>

          {ownerEmail && (
            <p className="text-[11px] text-gray-500 mt-4">
              Sesión: <span className="text-gray-400">{ownerEmail}</span>
            </p>
          )}

          {/* Salir */}
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            <LogOut size={12} />
            Cerrar sesión
          </button>
        </div>

        {/* Footer */}
        <div className="bg-black/40 border-t border-gray-800 px-6 py-3 text-center">
          <p className="text-[11px] text-gray-500">
            ¿Dudas? Escribinos a{" "}
            <a href="mailto:cobraorvex@gmail.com" className="text-purple-300 hover:text-purple-200">
              cobraorvex@gmail.com
            </a>
          </p>
        </div>
      </motion.div>
    </div>
  )
}

function PlanRow({
  icon,
  name,
  price,
  highlight,
}: {
  icon: React.ReactNode
  name: string
  price: string
  highlight?: boolean
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg ${
        highlight ? "bg-purple-500/10 border border-purple-500/30" : ""
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {icon}
        <span className="text-sm text-gray-200 font-medium truncate">{name}</span>
        {highlight && (
          <span className="text-[9px] bg-purple-500/30 text-purple-200 border border-purple-500/40 rounded px-1.5 py-0.5 font-bold uppercase">
            Recomendado
          </span>
        )}
      </div>
      <span className="text-sm font-bold text-white tabular-nums flex-shrink-0">
        {price}<span className="text-gray-500 text-[10px] font-normal">/mes</span>
      </span>
    </div>
  )
}
