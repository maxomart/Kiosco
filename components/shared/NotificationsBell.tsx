"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { Bell, AlertTriangle, Package, Clock, Sparkles, Receipt, X, Loader2, Inbox } from "lucide-react"
import { cn } from "@/lib/utils"

interface Notification {
  id: string
  type: "LOW_STOCK" | "OUT_STOCK" | "CASH_OPEN" | "TRIAL_ENDING" | "RECENT_SALE"
  title: string
  message: string
  href?: string
  createdAt: string
  severity: "info" | "warning" | "danger" | "success"
}

const ICONS: Record<Notification["type"], React.ComponentType<{ className?: string }>> = {
  LOW_STOCK: AlertTriangle,
  OUT_STOCK: Package,
  CASH_OPEN: Clock,
  TRIAL_ENDING: Sparkles,
  RECENT_SALE: Receipt,
}

const SEVERITY_STYLES: Record<Notification["severity"], { dot: string; iconBg: string; iconText: string }> = {
  info: { dot: "bg-sky-500", iconBg: "bg-sky-900/40", iconText: "text-sky-400" },
  warning: { dot: "bg-amber-500", iconBg: "bg-amber-900/40", iconText: "text-amber-400" },
  danger: { dot: "bg-red-500", iconBg: "bg-red-900/40", iconText: "text-red-400" },
  success: { dot: "bg-emerald-500", iconBg: "bg-emerald-900/40", iconText: "text-emerald-400" },
}

export default function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const [unread, setUnread] = useState(0)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const panelRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/notificaciones", { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        setItems(data.notifications ?? [])
        setUnread(data.unread ?? 0)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // Load on mount + every 60s
  useEffect(() => {
    load()
    const id = setInterval(load, 60000)
    return () => clearInterval(id)
  }, [load])

  // Restore dismissed list from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = localStorage.getItem("retailar:notif-dismissed")
      if (raw) setDismissed(new Set(JSON.parse(raw)))
    } catch {}
  }, [])

  // Persist dismissed list
  const persistDismissed = (next: Set<string>) => {
    setDismissed(next)
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("retailar:notif-dismissed", JSON.stringify(Array.from(next)))
      } catch {}
    }
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    document.addEventListener("keydown", esc)
    return () => {
      document.removeEventListener("mousedown", handler)
      document.removeEventListener("keydown", esc)
    }
  }, [open])

  const visible = items.filter((n) => !dismissed.has(n.id))
  const unreadCount = visible.length

  const dismiss = (id: string) => {
    const next = new Set(dismissed)
    next.add(id)
    persistDismissed(next)
  }

  const dismissAll = () => {
    const next = new Set(dismissed)
    visible.forEach((n) => next.add(n.id))
    persistDismissed(next)
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-1.5 rounded-md text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors"
        aria-label="Notificaciones"
        aria-expanded={open}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 bg-purple-600 rounded-full text-[10px] font-bold text-white flex items-center justify-center animate-in zoom-in-75 duration-200">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl shadow-black/50 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-gray-100">Notificaciones</h3>
            {visible.length > 0 && (
              <button
                onClick={dismissAll}
                className="text-xs text-gray-500 hover:text-purple-300 transition"
              >
                Marcar todas como leídas
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="p-8 flex items-center justify-center text-gray-500">
                <Loader2 size={18} className="animate-spin" />
              </div>
            ) : visible.length === 0 ? (
              <div className="p-8 flex flex-col items-center justify-center text-center text-gray-500 gap-2">
                <Inbox size={28} className="text-gray-600" />
                <p className="text-sm">Sin notificaciones nuevas</p>
                <p className="text-xs text-gray-600">Te avisamos cuando haya stock bajo, ventas nuevas o cambios en tu cuenta.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-800">
                {visible.map((n) => {
                  const Icon = ICONS[n.type] ?? Bell
                  const styles = SEVERITY_STYLES[n.severity]
                  const Wrapper: any = n.href ? Link : "div"
                  const wrapperProps = n.href
                    ? { href: n.href, onClick: () => setOpen(false) }
                    : {}
                  return (
                    <li key={n.id} className="group relative">
                      <Wrapper
                        {...wrapperProps}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-gray-800/50 transition cursor-pointer"
                      >
                        <div className={cn("flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center", styles.iconBg)}>
                          <Icon className={cn("w-4 h-4", styles.iconText)} />
                        </div>
                        <div className="flex-1 min-w-0 pr-6">
                          <p className="text-sm font-medium text-gray-100 truncate">{n.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{n.message}</p>
                        </div>
                      </Wrapper>
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          dismiss(n.id)
                        }}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded text-gray-500 hover:text-gray-200 hover:bg-gray-700 transition"
                        aria-label="Descartar"
                      >
                        <X size={12} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
