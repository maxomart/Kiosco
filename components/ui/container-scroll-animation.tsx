"use client"

import * as React from "react"
import { motion, useScroll, useTransform, type MotionValue } from "framer-motion"

export function ContainerScroll({
  titleComponent,
  children,
}: {
  titleComponent: React.ReactNode
  children: React.ReactNode
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: containerRef })
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  const scaleDimensions = () => (isMobile ? [0.8, 0.95] : [1.05, 1])
  const rotate = useTransform(scrollYProgress, [0, 1], [18, 0])
  const scale = useTransform(scrollYProgress, [0, 1], scaleDimensions())
  const translate = useTransform(scrollYProgress, [0, 1], [0, -100])

  return (
    <div
      className="h-[60rem] md:h-[80rem] flex items-center justify-center relative p-2 md:p-20 app-surface"
      ref={containerRef}
    >
      <div className="py-10 md:py-40 w-full relative" style={{ perspective: "1000px" }}>
        <Header translate={translate} titleComponent={titleComponent} />
        <Card rotate={rotate} translate={translate} scale={scale}>
          {children}
        </Card>
      </div>
    </div>
  )
}

const Header = ({
  translate,
  titleComponent,
}: {
  translate: MotionValue<number>
  titleComponent: React.ReactNode
}) => (
  <motion.div style={{ translateY: translate }} className="max-w-5xl mx-auto text-center">
    {titleComponent}
  </motion.div>
)

const Card = ({
  rotate,
  scale,
  children,
}: {
  rotate: MotionValue<number>
  scale: MotionValue<number>
  translate: MotionValue<number>
  children: React.ReactNode
}) => (
  <motion.div
    style={{
      rotateX: rotate,
      scale,
      boxShadow:
        "0 0 #0000004d, 0 9px 20px #0000004a, 0 37px 37px #00000042, 0 84px 50px rgba(139,92,246,0.15), 0 149px 60px #0000000a",
    }}
    className="max-w-5xl -mt-12 mx-auto h-[30rem] md:h-[40rem] w-full rounded-[30px] p-2 md:p-4 border border-white/10 bg-[#0a0a18]/80 backdrop-blur"
  >
    <div className="h-full w-full overflow-hidden rounded-2xl bg-[#05050c]">
      {children}
    </div>
  </motion.div>
)
