"use client"

import { motion, type Variants } from "framer-motion"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type SectionWithMockupProps = {
  title: ReactNode
  description: ReactNode
  primaryImageSrc: string
  secondaryImageSrc?: string
  reverseLayout?: boolean
  eyebrow?: string
  cta?: ReactNode
}

export default function SectionWithMockup({
  title,
  description,
  primaryImageSrc,
  secondaryImageSrc,
  reverseLayout = false,
  eyebrow,
  cta,
}: SectionWithMockupProps) {
  const container: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.18 } },
  }
  const item: Variants = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } },
  }

  return (
    <section className="relative py-20 md:py-32 app-surface overflow-hidden">
      <div className="container max-w-[1220px] w-full px-6 md:px-10 relative z-10 mx-auto">
        <motion.div
          className={cn(
            "grid grid-cols-1 gap-16 md:gap-12 items-center",
            "md:grid-cols-2",
            reverseLayout && "md:grid-flow-col-dense"
          )}
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          <motion.div
            className={cn(
              "flex flex-col items-start gap-4 max-w-[560px]",
              reverseLayout && "md:col-start-2"
            )}
            variants={item}
          >
            {eyebrow && (
              <span className="text-xs font-bold tracking-[0.18em] text-purple-300 uppercase">
                {eyebrow}
              </span>
            )}
            <h2 className="text-white text-3xl md:text-[40px] font-semibold leading-tight md:leading-[1.1] tracking-tight">
              {title}
            </h2>
            <p className="text-white/60 text-sm md:text-base leading-relaxed">
              {description}
            </p>
            {cta && <div className="mt-2">{cta}</div>}
          </motion.div>

          <motion.div
            className={cn(
              "relative mx-auto w-full max-w-[480px] aspect-[4/5]",
              reverseLayout && "md:col-start-1"
            )}
            variants={item}
          >
            {secondaryImageSrc && (
              <motion.div
                className="absolute inset-0 rounded-[28px] overflow-hidden brand-glow"
                style={{
                  transform: reverseLayout
                    ? "translate(6%, 6%)"
                    : "translate(-6%, 6%)",
                  filter: "blur(1px)",
                  opacity: 0.55,
                }}
                initial={{ y: 0 }}
                whileInView={{ y: -18 }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                viewport={{ once: true, amount: 0.5 }}
              >
                <div
                  className="w-full h-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${secondaryImageSrc})` }}
                />
              </motion.div>
            )}

            <motion.div
              className="relative w-full h-full rounded-[28px] overflow-hidden border border-white/10 card-glow"
              initial={{ y: 0 }}
              whileInView={{ y: 18 }}
              transition={{ duration: 1.2, ease: "easeOut", delay: 0.1 }}
              viewport={{ once: true, amount: 0.5 }}
            >
              <div
                className="w-full h-full bg-cover bg-center"
                style={{ backgroundImage: `url(${primaryImageSrc})` }}
              />
            </motion.div>
          </motion.div>
        </motion.div>
      </div>

      <div
        className="absolute inset-x-0 bottom-0 h-px z-0"
        style={{
          background:
            "radial-gradient(50% 50% at 50% 50%, rgba(139,92,246,0.3) 0%, rgba(255,255,255,0) 100%)",
        }}
      />
    </section>
  )
}
