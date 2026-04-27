"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowRight, ArrowLeft, X, Sparkles, CheckCircle2 } from "lucide-react"
import type { Plan } from "@/lib/utils"
import {
  type TourStep,
  tourStepsFor,
  welcomeContentFor,
  upgradeContentFor,
} from "@/lib/tour-steps"

/**
 * TourOverlay — guided tour that walks a new user through the dashboard the
 * first time they arrive.
 *
 * Three things going on:
 *
 *   1. A full-screen darkening layer with a transparent "hole" cut around
 *      the highlighted element. Implemented with a single absolute-positioned
 *      div that has `box-shadow: 0 0 0 9999px rgba(0,0,0,0.78)` — that's
 *      the hole + dark area in one element, super cheap.
 *
 *   2. A tooltip card anchored next to the spotlight (or centered for the
 *      welcome step). Auto-flips placement when the element is near the
 *      viewport edges.
 *
 *   3. A controlled flow with Skip / Back / Next / Finish. Posts to
 *      /api/auth/tour/complete on Finish or Skip and unmounts.
 *
 * The dashboard layout decides whether to render this at all (only mounts
 * if the user's tourCompletedAt is null), so this component just drives
 * the flow once mounted.
 */

interface Props {
  plan: Plan
  /** When set, the welcome step shows "qué desbloqueaste" copy for this
   *  upgrade instead of the generic plan welcome. */
  upgradedFrom?: Plan | null
}

interface SpotlightRect {
  top: number
  left: number
  width: number
  height: number
}

const SPOTLIGHT_PAD = 8

export default function TourOverlay({ plan, upgradedFrom }: Props) {
  const steps = tourStepsFor(plan)
  const [stepIdx, setStepIdx] = useState(0)
  const [rect, setRect] = useState<SpotlightRect | null>(null)
  const [done, setDone] = useState(false)
  const finishedRef = useRef(false)

  const step = steps[stepIdx]
  const isLast = stepIdx === steps.length - 1

  // Re-measure the spotlight target on step change, scroll, or resize.
  // The element might be inside a scrollable sidebar so we scroll it into
  // view first.
  useEffect(() => {
    if (!step || step.type !== "spotlight") {
      setRect(null)
      return
    }
    const measure = () => {
      const el = document.querySelector<HTMLElement>(step.selector)
      if (!el) {
        setRect(null)
        return
      }
      el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" })
      const r = el.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }
    // First measure happens after a frame so the layout settles.
    const raf = requestAnimationFrame(measure)
    const onResize = () => measure()
    window.addEventListener("resize", onResize)
    window.addEventListener("scroll", onResize, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", onResize)
      window.removeEventListener("scroll", onResize, true)
    }
  }, [step])

  // Lock body scroll while the tour is up so the user can't drift away
  // from the highlighted element. Restore on unmount.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // Keyboard: → / Enter advance, ← back, Esc skip.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault()
        next()
      } else if (e.key === "ArrowLeft") {
        e.preventDefault()
        back()
      } else if (e.key === "Escape") {
        e.preventDefault()
        finish(true)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx, steps.length])

  function next() {
    if (isLast) {
      finish(false)
      return
    }
    setStepIdx((i) => Math.min(steps.length - 1, i + 1))
  }
  function back() {
    setStepIdx((i) => Math.max(0, i - 1))
  }
  async function finish(skipped: boolean) {
    if (finishedRef.current) return
    finishedRef.current = true
    setDone(true)
    try {
      await fetch("/api/auth/tour/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skipped }),
      })
    } catch {
      // best-effort; the worst case is the tour shows again next visit
    }
  }

  if (done) return null
  if (!step) return null

  return (
    <AnimatePresence>
      <motion.div
        key="tour"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-[1000]"
        aria-modal="true"
        role="dialog"
      >
        {/* Spotlight cutout — for spotlight steps. The single inset
            absolute box uses a giant box-shadow as the dark veil so we
            don't need a separate full-screen overlay layer. */}
        {step.type === "spotlight" && rect && (
          <motion.div
            key={step.id}
            initial={false}
            animate={{
              top: rect.top - SPOTLIGHT_PAD,
              left: rect.left - SPOTLIGHT_PAD,
              width: rect.width + SPOTLIGHT_PAD * 2,
              height: rect.height + SPOTLIGHT_PAD * 2,
            }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="absolute rounded-xl pointer-events-none"
            style={{
              boxShadow:
                "0 0 0 9999px rgba(2, 6, 23, 0.78), 0 0 0 2px rgba(167, 139, 250, 0.6), 0 0 30px rgba(139, 92, 246, 0.4)",
            }}
          />
        )}

        {/* Plain dark scrim for welcome (no spotlight target). */}
        {step.type === "welcome" && (
          <div className="absolute inset-0 bg-black/78 backdrop-blur-[2px]" />
        )}

        {/* Skip + step counter — always visible on top right */}
        <div className="absolute top-5 right-5 z-10 flex items-center gap-3 text-xs">
          <span className="text-gray-400 tabular-nums">
            {stepIdx + 1} / {steps.length}
          </span>
          <button
            type="button"
            onClick={() => finish(true)}
            className="text-gray-400 hover:text-white transition-colors flex items-center gap-1"
          >
            Saltar tour <X className="w-3 h-3" />
          </button>
        </div>

        {/* Tooltip card — centered for welcome, anchored for spotlight. */}
        {step.type === "welcome" ? (
          <WelcomeCard
            plan={plan}
            upgradedFrom={upgradedFrom ?? null}
            onNext={next}
            isLast={isLast}
          />
        ) : (
          <SpotlightCard
            step={step}
            rect={rect}
            stepIdx={stepIdx}
            stepCount={steps.length}
            onNext={next}
            onBack={back}
            isLast={isLast}
          />
        )}
      </motion.div>
    </AnimatePresence>
  )
}

/* ============================================================================
   Welcome card — first step. Centered. Plan-specific bullets.
   ========================================================================== */

function WelcomeCard({
  plan,
  upgradedFrom,
  onNext,
  isLast,
}: {
  plan: Plan
  upgradedFrom: Plan | null
  onNext: () => void
  isLast: boolean
}) {
  const upgrade = upgradedFrom ? upgradeContentFor(upgradedFrom, plan) : null
  const content = welcomeContentFor(plan)
  const title = upgrade?.title ?? content.title
  const bullets = upgrade?.bullets ?? content.bullets

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="absolute inset-0 flex items-center justify-center p-6"
    >
      <div className="relative w-full max-w-md">
        <div
          aria-hidden
          className="absolute -inset-px rounded-3xl opacity-70 blur-xl"
          style={{
            background:
              "linear-gradient(135deg, rgba(59,130,246,0.4), rgba(139,92,246,0.4))",
          }}
        />
        <div className="relative bg-gray-950/90 backdrop-blur-xl border border-white/10 rounded-3xl p-7 shadow-2xl shadow-black/60">
          <div className="flex items-center justify-center mb-5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-blue-400/30 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-blue-300" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white text-center tracking-tight mb-2">
            {title}
          </h2>
          {!upgrade && (
            <p className="text-sm text-gray-400 text-center mb-5 leading-relaxed">
              {welcomeContentFor(plan).subtitle}
            </p>
          )}
          {upgrade && (
            <p className="text-sm text-gray-400 text-center mb-5 leading-relaxed">
              Esto es lo nuevo que desbloqueaste:
            </p>
          )}
          <ul className="space-y-2.5 mb-6">
            {bullets.map((b, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.06, duration: 0.35 }}
                className="flex items-start gap-2.5 text-sm text-gray-200"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{b}</span>
              </motion.li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onNext}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-400 hover:to-violet-400 text-white font-semibold text-sm transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            {isLast ? "Empezar a usar Orvex" : "Mostrame el panel"}{" "}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

/* ============================================================================
   Spotlight card — subsequent steps. Anchored next to the highlighted
   element with auto-flip when there's not enough room.
   ========================================================================== */

function SpotlightCard({
  step,
  rect,
  stepIdx,
  stepCount,
  onNext,
  onBack,
  isLast,
}: {
  step: Extract<TourStep, { type: "spotlight" }>
  rect: SpotlightRect | null
  stepIdx: number
  stepCount: number
  onNext: () => void
  onBack: () => void
  isLast: boolean
}) {
  // If the target wasn't found (selector mismatch), still show the tooltip
  // centered so the user isn't stuck.
  const placement = rect ? resolvePlacement(rect, step.placement ?? "auto") : "center"
  const cardStyle = rect
    ? positionCard(rect, placement)
    : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }

  return (
    <motion.div
      key={step.id}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="absolute w-[320px] sm:w-[360px]"
      style={cardStyle}
    >
      <div className="bg-gray-950/95 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl shadow-black/60">
        <p className="text-[10px] uppercase tracking-[0.25em] text-violet-300/80 mb-2">
          paso {stepIdx + 1} de {stepCount}
        </p>
        <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
        <p className="text-sm text-gray-300 leading-relaxed mb-5">{step.body}</p>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBack}
            disabled={stepIdx === 0}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft className="w-3 h-3" /> Atrás
          </button>
          <button
            type="button"
            onClick={onNext}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-400 hover:to-violet-400 text-white font-semibold text-sm transition-all"
          >
            {isLast ? "Listo" : "Siguiente"} <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

/* ============================================================================
   Card placement logic — pick the side with most room.
   ========================================================================== */

type Placement = "top" | "bottom" | "left" | "right" | "center"

function resolvePlacement(rect: SpotlightRect, hint: Placement | "auto"): Placement {
  if (hint !== "auto") return hint
  const vw = window.innerWidth
  const vh = window.innerHeight
  const room = {
    top: rect.top,
    bottom: vh - (rect.top + rect.height),
    left: rect.left,
    right: vw - (rect.left + rect.width),
  }
  // Prefer right > left > bottom > top — most layouts have spotlight on
  // the left rail (sidebar) so right has room, and right is most natural
  // for ltr reading order.
  if (room.right >= 380) return "right"
  if (room.left >= 380) return "left"
  if (room.bottom >= 220) return "bottom"
  if (room.top >= 220) return "top"
  return "center"
}

function positionCard(rect: SpotlightRect, placement: Placement): React.CSSProperties {
  const gap = 16
  switch (placement) {
    case "right":
      return {
        top: clampCardY(rect.top + rect.height / 2),
        left: rect.left + rect.width + gap,
        transform: "translateY(-50%)",
      }
    case "left":
      return {
        top: clampCardY(rect.top + rect.height / 2),
        left: rect.left - gap,
        transform: "translate(-100%, -50%)",
      }
    case "bottom":
      return {
        top: rect.top + rect.height + gap,
        left: clampCardX(rect.left + rect.width / 2),
        transform: "translateX(-50%)",
      }
    case "top":
      return {
        top: rect.top - gap,
        left: clampCardX(rect.left + rect.width / 2),
        transform: "translate(-50%, -100%)",
      }
    case "center":
    default:
      return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }
  }
}

function clampCardX(x: number): number {
  const half = 180
  return Math.max(half + 16, Math.min(window.innerWidth - half - 16, x))
}
function clampCardY(y: number): number {
  return Math.max(120, Math.min(window.innerHeight - 120, y))
}
