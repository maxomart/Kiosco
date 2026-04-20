"use client"

import { motion, type Variants } from "framer-motion"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Wrappers client-side para dar entrada con stagger a secciones de páginas
 * que son mayormente SSR. Uso:
 *
 *   <AnimatedStagger className="space-y-6">
 *     <AnimatedItem>...</AnimatedItem>
 *     <AnimatedItem>...</AnimatedItem>
 *   </AnimatedStagger>
 *
 * Respeta prefers-reduced-motion automáticamente vía framer-motion.
 */

const container: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
}

const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" },
  },
}

export function AnimatedStagger({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <motion.div
      className={cn(className)}
      variants={container}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  )
}

export function AnimatedItem({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <motion.div variants={item} className={cn(className)}>
      {children}
    </motion.div>
  )
}
