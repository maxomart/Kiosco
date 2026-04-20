"use client"

import { createContext, useCallback, useContext, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { AlertTriangle, X } from "lucide-react"
import { cn } from "@/lib/utils"

type Tone = "danger" | "warning" | "accent"

interface ConfirmOptions {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  tone?: Tone
}

interface ConfirmContextValue {
  confirm: (opts: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const [resolver, setResolver] = useState<((v: boolean) => void) | null>(null)

  const confirm = useCallback((o: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setOpts(o)
      setResolver(() => resolve)
    })
  }, [])

  const close = (result: boolean) => {
    resolver?.(result)
    setOpts(null)
    setResolver(null)
  }

  const tone: Tone = opts?.tone ?? "danger"

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <AnimatePresence>
        {opts && (
          <>
            <motion.div
              className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => close(false)}
            />
            <motion.div
              className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                role="dialog"
                aria-modal="true"
                initial={{ scale: 0.94, y: 12, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.96, opacity: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className={cn(
                  "pointer-events-auto w-full max-w-sm rounded-2xl bg-gray-950 border border-gray-800 shadow-2xl overflow-hidden"
                )}
              >
                <div className="flex items-start gap-3 p-5">
                  <div
                    className={cn(
                      "shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
                      tone === "danger" && "bg-red-500/15 text-red-400",
                      tone === "warning" && "bg-amber-500/15 text-amber-400",
                      tone === "accent" && "bg-accent-soft text-accent"
                    )}
                  >
                    <AlertTriangle size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white">{opts.title}</h3>
                    {opts.description && (
                      <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                        {opts.description}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => close(false)}
                    className="text-gray-500 hover:text-white transition-colors -m-1 p-1"
                    aria-label="Cerrar"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-800 bg-gray-900/50">
                  <button
                    type="button"
                    onClick={() => close(false)}
                    className="px-4 py-2 rounded-lg text-xs font-medium text-gray-300 hover:bg-gray-800 transition"
                  >
                    {opts.cancelText ?? "Cancelar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => close(true)}
                    autoFocus
                    className={cn(
                      "px-4 py-2 rounded-lg text-xs font-semibold transition shadow",
                      tone === "danger" &&
                        "bg-red-500 hover:bg-red-400 text-white",
                      tone === "warning" &&
                        "bg-amber-500 hover:bg-amber-400 text-gray-900",
                      tone === "accent" &&
                        "bg-accent hover:bg-accent-hover text-accent-foreground"
                    )}
                  >
                    {opts.confirmText ?? "Confirmar"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) {
    throw new Error("useConfirm must be used inside <ConfirmProvider>")
  }
  return ctx.confirm
}
