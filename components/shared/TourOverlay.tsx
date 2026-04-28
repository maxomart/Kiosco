"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
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
  const router = useRouter()
  const pathname = usePathname()
  // Tracks navigations the tour itself triggered, so we don't mistake
  // the user for "left the tour" when we just pushed them to /pos.
  const programmaticNavRef = useRef(false)
  // The set of URLs the tour intends to visit during its run. Lets us
  // distinguish "user clicked Inventario in the sidebar (legit navigation,
  // tour should follow)" from "user opened the URL bar and went to Google".
  const tourPathsRef = useRef(new Set<string>())
  useEffect(() => {
    tourPathsRef.current = new Set(
      steps
        .filter((s): s is Extract<TourStep, { type: "spotlight" }> => s.type === "spotlight")
        .map((s) => s.navigateTo)
        .filter((p): p is string => !!p),
    )
    // Also include the path where the tour started so a "back to /inicio"
    // step is allowed.
    tourPathsRef.current.add(pathname)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const step = steps[stepIdx]
  const isLast = stepIdx === steps.length - 1

  // Pathname watcher: only finish the tour if the user lands somewhere
  // we didn't expect. Programmatic navigations (next() calls below) and
  // navigations to a URL the tour will visit anyway are fine.
  useEffect(() => {
    if (programmaticNavRef.current) {
      programmaticNavRef.current = false
      return
    }
    if (tourPathsRef.current.has(pathname)) return
    finish(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Re-measure the spotlight target on step change, scroll, resize, or
  // pathname change. After router.push for navigateTo steps, the new
  // page DOM may not be present on the very first frame — we retry up
  // to ~600ms (~36 frames) until the selector resolves, then give up
  // and let the tooltip render centered as a fallback.
  useEffect(() => {
    if (!step || step.type !== "spotlight") {
      setRect(null)
      return
    }
    let cancelled = false
    let attempts = 0
    const MAX_ATTEMPTS = 36

    const measure = () => {
      if (cancelled) return
      const el = document.querySelector<HTMLElement>(step.selector)
      if (!el) {
        if (attempts++ < MAX_ATTEMPTS) {
          requestAnimationFrame(measure)
        } else {
          setRect(null)
        }
        return
      }
      el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" })
      const r = el.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }

    const raf = requestAnimationFrame(measure)
    const onResize = () => measure()
    window.addEventListener("resize", onResize)
    window.addEventListener("scroll", onResize, true)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", onResize)
      window.removeEventListener("scroll", onResize, true)
    }
  }, [step, pathname])

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
    const nextIdx = Math.min(steps.length - 1, stepIdx + 1)
    const nextStep = steps[nextIdx]
    // If the next step has its own URL, push it BEFORE updating stepIdx
    // so the spotlight doesn't try to measure on the old DOM. We mark
    // the navigation as programmatic so the pathname-watcher above
    // doesn't misread it as the user leaving the tour.
    if (
      nextStep.type === "spotlight" &&
      nextStep.navigateTo &&
      nextStep.navigateTo !== pathname
    ) {
      programmaticNavRef.current = true
      router.push(nextStep.navigateTo)
    }
    setStepIdx(nextIdx)
  }
  function back() {
    const prevIdx = Math.max(0, stepIdx - 1)
    const prevStep = steps[prevIdx]
    if (
      prevStep.type === "spotlight" &&
      prevStep.navigateTo &&
      prevStep.navigateTo !== pathname
    ) {
      programmaticNavRef.current = true
      router.push(prevStep.navigateTo)
    }
    setStepIdx(prevIdx)
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
        // pointer-events-none so the spotlighted area underneath is
        // clickable (the user can tap "Inventario" and actually navigate).
        // Children that need clicks (tooltip, skip button, dark veils
        // outside the spotlight) opt back in with pointer-events-auto.
        className="fixed inset-0 z-[1000] pointer-events-none"
        aria-modal="true"
        role="dialog"
      >
        {/* Spotlight steps: four veils around the highlighted rect leave
            it transparent + clickable. Replaces the old single-element
            box-shadow trick because that captured all clicks on the dark
            area. With four rects we can pointer-events-auto only on the
            dark parts, so the hole is genuinely interactive. */}
        {step.type === "spotlight" && rect && (
          <Veil rect={rect} />
        )}

        {/* Plain dark scrim for welcome (no spotlight target). */}
        {step.type === "welcome" && (
          <div className="absolute inset-0 bg-black/78 backdrop-blur-[2px] pointer-events-auto" />
        )}

        {/* Skip + step counter — always visible on top right. pointer-
            events-auto so the user can actually click them (the parent
            container is none for the spotlight click-through). */}
        <div className="absolute top-5 right-5 z-10 flex items-center gap-3 text-xs pointer-events-auto">
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
      className="absolute inset-0 flex items-center justify-center p-6 pointer-events-auto"
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
      className="absolute w-[320px] sm:w-[360px] pointer-events-auto"
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

/* ============================================================================
   Veil — four absolute rectangles around the spotlight rect that together
   darken the screen and capture clicks, leaving the spotlight area
   transparent and pointer-events:auto so the highlighted button/link is
   actually clickable. Replaces the old box-shadow trick which captured
   all clicks on the dark area too.

       ┌──────────────────────────┐
       │           top            │
       ├────┬──────────────┬──────┤
       │left│   spotlight  │right │   ← spotlight is the gap
       │    │   (no veil)  │      │
       ├────┴──────────────┴──────┤
       │          bottom          │
       └──────────────────────────┘
   ========================================================================== */

const VEIL_BG = "rgba(2, 6, 23, 0.78)"
const SPOTLIGHT_BORDER =
  "0 0 0 2px rgba(167, 139, 250, 0.6), 0 0 30px rgba(139, 92, 246, 0.4)"

function Veil({ rect }: { rect: SpotlightRect }) {
  const top = Math.max(0, rect.top - SPOTLIGHT_PAD)
  const left = Math.max(0, rect.left - SPOTLIGHT_PAD)
  const width = rect.width + SPOTLIGHT_PAD * 2
  const height = rect.height + SPOTLIGHT_PAD * 2
  const right = left + width
  const bottom = top + height

  // Each rect is pointer-events-auto so clicks anywhere on the dark area
  // are absorbed (don't accidentally click stuff under the veil). The
  // spotlight gap has no rect → clicks pass through to the underlying
  // sidebar link / button → user navigates.
  const rectStyle = {
    background: VEIL_BG,
    pointerEvents: "auto" as const,
  }
  return (
    <>
      {/* top */}
      <motion.div
        layout
        className="absolute"
        style={{ ...rectStyle, top: 0, left: 0, right: 0, height: top }}
      />
      {/* left */}
      <motion.div
        layout
        className="absolute"
        style={{ ...rectStyle, top, left: 0, width: left, height }}
      />
      {/* right */}
      <motion.div
        layout
        className="absolute"
        style={{ ...rectStyle, top, left: right, right: 0, height }}
      />
      {/* bottom */}
      <motion.div
        layout
        className="absolute"
        style={{ ...rectStyle, top: bottom, left: 0, right: 0, bottom: 0 }}
      />
      {/* Spotlight border + glow — purely visual, no interaction */}
      <motion.div
        layout
        className="absolute rounded-xl pointer-events-none"
        style={{
          top,
          left,
          width,
          height,
          boxShadow: SPOTLIGHT_BORDER,
        }}
      />
    </>
  )
}
