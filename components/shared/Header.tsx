"use client"

import { signOut } from "next-auth/react"
import { LogOut, Bell, User, Clock, Sun, Moon } from "lucide-react"
import { formatDateTime } from "@/lib/utils"
import { useState, useEffect, useRef } from "react"
import { useTheme } from "next-themes"

interface HeaderProps {
  user: {
    name?: string | null
    email?: string | null
    role?: string | null
  }
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  OWNER: "Dueño",
  CASHIER: "Cajero/a",
  SUPER_ADMIN: "Super Admin",
}

interface Notification {
  id: string
  type: string
  title: string
  message: string
  createdAt: string
  read: boolean
}

export default function Header({ user }: HeaderProps) {
  // mounted evita hydration mismatches en el reloj y el botón de tema
  const [mounted, setMounted] = useState(false)
  const [now, setNow] = useState<Date | null>(null)
  const { theme, setTheme } = useTheme()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [notifCount, setNotifCount] = useState(0)
  const notifRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Fetch notifications after mount
  useEffect(() => {
    if (!mounted) return
    fetch("/api/notifications")
      .then(r => r.json())
      .then(data => {
        setNotifications(data.notifications ?? [])
        setNotifCount(data.count ?? 0)
      })
      .catch(() => {})
  }, [mounted])

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showNotifs) return
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [showNotifs])

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between">
      {/* Reloj — solo client-side para evitar hydration mismatch */}
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
        <Clock size={16} />
        <span className="text-sm font-mono">
          {mounted && now ? formatDateTime(now) : ""}
        </span>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-4">
        {/* Notificaciones */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="relative p-2 text-gray-400 dark:text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition"
          >
            <Bell size={20} />
            {notifCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
                {notifCount > 9 ? "9+" : notifCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="absolute right-0 top-12 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <h3 className="font-bold text-gray-800 dark:text-white text-sm">Notificaciones</h3>
                {notifCount > 0 && (
                  <span className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs px-2 py-0.5 rounded-full font-medium">
                    {notifCount} nueva{notifCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-gray-400 text-sm">
                    <Bell size={24} className="mx-auto mb-2 opacity-40" />
                    Sin notificaciones
                  </div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      className="px-4 py-3 border-b border-gray-50 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <div className="flex items-start gap-2">
                        <div
                          className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                            n.type === "warning" ? "bg-orange-400" : "bg-blue-400"
                          }`}
                        />
                        <div>
                          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{n.title}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{n.message}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Toggle dark/light mode — renderizar solo client-side para evitar hydration mismatch con <circle> del ícono Sun */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="p-2 text-gray-400 dark:text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition"
          title="Cambiar tema"
        >
          {mounted ? (theme === "dark" ? <Sun size={20} /> : <Moon size={20} />) : <Moon size={20} />}
        </button>

        {/* Usuario */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
            <User size={18} className="text-blue-600" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{user.name}</p>
            <p className="text-xs text-gray-400 dark:text-gray-400">
              {ROLE_LABELS[user.role as string] ?? user.role}
            </p>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="p-2 text-gray-400 dark:text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-gray-800 rounded-xl transition"
          title="Cerrar sesión"
        >
          <LogOut size={20} />
        </button>
      </div>
    </header>
  )
}
