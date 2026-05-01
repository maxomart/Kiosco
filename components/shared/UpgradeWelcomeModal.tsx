"use client"

/**
 * Modal que se muestra una sola vez después de que el user upgrade su plan.
 * NO es el tour completo (que se reservaba a primera vez) — sólo celebra el
 * upgrade y muestra los features nuevos que desbloqueó vs su plan anterior.
 *
 * Confetti hecho con framer-motion (sin dependencias extra). 30 partículas
 * que caen con física simple y se desvanecen a los 3 segundos.
 *
 * Trigger: layout.tsx detecta `lastWelcomedPlan != plan && tourCompletedAt
 * != null` y monta este componente. Al cerrar, hace POST a /api/auth/welcome/
 * dismiss que actualiza lastWelcomedPlan al plan actual.
 */

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, Check, X } from "lucide-react"
import type { Plan } from "@/lib/utils"
import { upgradeContentFor } from "@/lib/tour-steps"

interface Props {
  from: Plan
  to: Plan
}

// Plan acá puede llegar como FREE (no incluido en lib/utils Plan type) por
// el upgradedFrom — usamos string indexing en vez de Record para flexibilidad.
const PLAN_LABELS: Record<string, string> = {
  FREE: "Gratis",
  STARTER: "Básico",
  PROFESSIONAL: "Profesional",
  BUSINESS: "Negocio",
  ENTERPRISE: "Enterprise",
}

const COLORS = ["#a855f7", "#7c3aed", "#34d399", "#fbbf24", "#f472b6", "#60a5fa"]

interface Particle {
  id: number
  x: number
  delay: number
  duration: number
  rotation: number
  color: string
  size: number
}

function makeParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 0.4,
    duration: 2.5 + Math.random() * 1.5,
    rotation: Math.random() * 720 - 360,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: 6 + Math.random() * 8,
  }))
}

export function UpgradeWelcomeModal({ from, to }: Props) {
  const [open, setOpen] = useState(true)
  const [particles] = useState(() => makeParticles(40))

  const content = upgradeContentFor(from, to)
  // Defensa: si por algún motivo no es upgrade real, no mostramos nada
  if (!content) return null

  const close = async () => {
    setOpen(false)
    // Marcar como visto en backend (best-effort, no bloquea)
    fetch("/api/auth/welcome/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: to }),
    }).catch(() => { /* ignore */ })
  }

  // Esc para cerrar
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop suave */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
            onClick={close}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Confetti — partículas que caen desde arriba */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {particles.map((p) => (
              <motion.div
                key={p.id}
                className="absolute rounded-sm"
                style={{
                  left: `${p.x}%`,
                  top: -20,
                  width: p.size,
                  height: p.size * 0.4,
                  backgroundColor: p.color,
                }}
                initial={{ y: -20, rotate: 0, opacity: 1 }}
                animate={{
                  y: typeof window !== "undefined" ? window.innerHeight + 50 : 1000,
                  rotate: p.rotation,
                  opacity: [1, 1, 0],
                }}
                transition={{
                  duration: p.duration,
                  delay: p.delay,
                  ease: "linear",
                  times: [0, 0.7, 1],
                }}
              />
            ))}
          </div>

          {/* Card */}
          <motion.div
            className="relative bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl shadow-purple-950/50 pointer-events-auto overflow-hidden"
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 20 }}
            transition={{ type: "spring", damping: 22, stiffness: 280 }}
          >
            {/* Glow decorativo */}
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 bg-purple-600/30 blur-3xl rounded-full pointer-events-none" />

            <button
              type="button"
              onClick={close}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-gray-900/80 hover:bg-gray-800 border border-gray-800 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
              aria-label="Cerrar"
            >
              <X size={14} />
            </button>

            <div className="relative p-7 space-y-5">
              {/* Header */}
              <div className="flex flex-col items-center text-center space-y-3">
                <motion.div
                  className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-lg shadow-purple-900/50"
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", damping: 14, stiffness: 280, delay: 0.2 }}
                >
                  <Sparkles className="w-8 h-8 text-white" strokeWidth={2.5} />
                </motion.div>

                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-purple-300 font-bold mb-1">
                    Plan activado
                  </p>
                  <h2 className="text-2xl font-bold text-white tracking-tight">
                    {content.title}
                  </h2>
                  <p className="text-sm text-gray-400 mt-1">
                    Pasaste de <span className="text-gray-300">{PLAN_LABELS[from]}</span> a{" "}
                    <span className="text-purple-300 font-semibold">{PLAN_LABELS[to]}</span>
                  </p>
                </div>
              </div>

              {/* Features nuevas */}
              <div className="bg-purple-950/20 border border-purple-900/30 rounded-xl p-4 space-y-2.5">
                <p className="text-[10px] uppercase tracking-[0.14em] text-purple-300/80 font-bold mb-2">
                  Lo nuevo que desbloqueaste
                </p>
                {content.bullets.slice(0, 5).map((b, i) => (
                  <motion.div
                    key={b}
                    className="flex items-start gap-2.5"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.06 }}
                  >
                    <div className="w-4 h-4 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check size={9} className="text-emerald-400" strokeWidth={3.5} />
                    </div>
                    <span className="text-[13px] text-gray-200 leading-snug">{b}</span>
                  </motion.div>
                ))}
              </div>

              {/* CTA */}
              <button
                type="button"
                onClick={close}
                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm transition-colors"
              >
                Entendido, ¡a usar!
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
