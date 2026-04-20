"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import {
  Sparkles, Send, X, Loader2, ChevronDown, ChevronUp,
  AlertTriangle, TrendingUp, Lightbulb, Lock, ArrowRight, MessageSquare,
} from "lucide-react"
import { cn, type Plan } from "@/lib/utils"

interface Insight {
  id: string
  severity: "info" | "warning" | "danger" | "success"
  title: string
  message: string
  action?: { label: string; href: string }
}

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

const SEVERITY_STYLES = {
  info:    { bg: "bg-sky-900/30",     border: "border-sky-700/40",     icon: "text-sky-400",     iconC: TrendingUp },
  warning: { bg: "bg-amber-900/30",   border: "border-amber-700/40",   icon: "text-amber-400",   iconC: AlertTriangle },
  danger:  { bg: "bg-red-900/30",     border: "border-red-700/40",     icon: "text-red-400",     iconC: AlertTriangle },
  success: { bg: "bg-emerald-900/30", border: "border-emerald-700/40", icon: "text-emerald-400", iconC: Lightbulb },
} as const

const STORAGE_KEY = "retailar:ai-chat-history"

export function AssistantWidget({ plan = "FREE" }: { plan?: Plan }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<"insights" | "chat">("insights")
  const [insights, setInsights] = useState<Insight[]>([])
  const [insightsLoading, setInsightsLoading] = useState(true)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [quotaInfo, setQuotaInfo] = useState<{ used: number; quota: number } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Restore chat from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setMessages(JSON.parse(raw))
    } catch {}
  }, [])

  // Persist chat
  useEffect(() => {
    if (typeof window === "undefined") return
    if (messages.length === 0) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)))
    } catch {}
  }, [messages])

  // Load insights
  const loadInsights = useCallback(async () => {
    setInsightsLoading(true)
    try {
      const res = await fetch("/api/ai/insights", { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        setInsights(data.insights ?? [])
      }
    } finally {
      setInsightsLoading(false)
    }
  }, [])

  // Initial + every 5 min
  useEffect(() => {
    loadInsights()
    const id = setInterval(loadInsights, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [loadInsights])

  // Refresh when opened
  useEffect(() => {
    if (open) loadInsights()
  }, [open, loadInsights])

  // Auto-scroll on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, sending])

  // Focus input when chat tab opens
  useEffect(() => {
    if (open && tab === "chat") {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open, tab])

  const send = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || sending) return
    setChatError(null)
    setSending(true)

    const newMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }]
    setMessages(newMessages)
    setInput("")

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages.slice(-20) }),
      })
      const data = await res.json()
      if (!res.ok) {
        setChatError(data?.error ?? "Error al consultar al asistente")
        if (data?.quotaReached) {
          setQuotaInfo({ used: data.used, quota: data.quota })
        }
        // Roll back the user message so they can retry
        setMessages(messages)
        return
      }
      setMessages([...newMessages, { role: "assistant", content: data.reply }])
      if (data.quota) setQuotaInfo({ used: data.used, quota: data.quota })
    } catch (e) {
      setChatError("Error de conexión")
      setMessages(messages)
    } finally {
      setSending(false)
    }
  }, [input, sending, messages])

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const clearChat = () => {
    setMessages([])
    setChatError(null)
    if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY)
  }

  const insightCount = insights.length

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full shadow-2xl transition-all duration-200",
          "bg-accent hover:bg-accent-hover text-accent-foreground",
          "px-4 py-3 hover:scale-105 active:scale-95",
          open && "scale-90 opacity-0 pointer-events-none"
        )}
        aria-label="Abrir asistente"
      >
        <Sparkles className="w-5 h-5" />
        <span className="hidden sm:inline text-sm font-semibold">Asistente IA</span>
        {insightCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center animate-in zoom-in-75 duration-200">
            {insightCount > 9 ? "9+" : insightCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-[calc(100vw-2.5rem)] sm:w-96 max-w-[420px] h-[calc(100vh-6rem)] sm:h-[600px] bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl shadow-black/60 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-2 zoom-in-95 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gradient-to-r from-accent/20 to-transparent">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-accent-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-100 truncate">Asistente IA</p>
                <p className="text-[11px] text-gray-500 truncate">Plan {plan}</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded-md text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-800 bg-gray-900/50">
            <button
              onClick={() => setTab("insights")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition border-b-2",
                tab === "insights"
                  ? "border-accent text-accent"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              )}
            >
              <Lightbulb className="w-3.5 h-3.5" />
              Recomendaciones
              {insightCount > 0 && tab !== "insights" && (
                <span className="ml-0.5 min-w-[16px] h-4 px-1 bg-accent rounded-full text-[10px] font-bold text-accent-foreground flex items-center justify-center">
                  {insightCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab("chat")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition border-b-2",
                tab === "chat"
                  ? "border-accent text-accent"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              )}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Chat
            </button>
          </div>

          {/* Content */}
          {tab === "insights" ? (
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {insightsLoading ? (
                <div className="p-8 flex items-center justify-center text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : insights.length === 0 ? (
                <div className="p-6 text-center text-gray-500 space-y-2">
                  <Lightbulb className="w-8 h-8 mx-auto text-gray-600" />
                  <p className="text-sm">Todo en orden por ahora</p>
                  <p className="text-xs text-gray-600">Cuando detecte stock bajo, ventas raras o cambios importantes, te aviso por acá.</p>
                </div>
              ) : (
                insights.map((ins) => {
                  const s = SEVERITY_STYLES[ins.severity]
                  const Icon = s.iconC
                  return (
                    <div
                      key={ins.id}
                      className={cn("rounded-xl p-3 border", s.bg, s.border, "animate-in fade-in slide-in-from-right-2 duration-200")}
                    >
                      <div className="flex items-start gap-2.5">
                        <Icon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", s.icon)} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-100">{ins.title}</p>
                          <p className="text-xs text-gray-300 mt-1 leading-relaxed">{ins.message}</p>
                          {ins.action && (
                            <Link
                              href={ins.action.href}
                              onClick={() => setOpen(false)}
                              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-hover transition"
                            >
                              {ins.action.label} <ArrowRight className="w-3 h-3" />
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}

              {/* Quick actions / suggestions */}
              <div className="pt-2 mt-2 border-t border-gray-800">
                <p className="text-[10px] uppercase tracking-wide text-gray-600 mb-2">Probá preguntar</p>
                {[
                  "¿Qué productos debería reponer urgente?",
                  "¿Cuánto vendí esta semana vs la anterior?",
                  "¿Qué precio le pongo a un producto nuevo?",
                  "¿Hay algo raro en mis ventas?",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      setTab("chat")
                      setInput(q)
                      setTimeout(() => inputRef.current?.focus(), 100)
                    }}
                    className="w-full text-left text-xs text-gray-400 hover:text-gray-100 hover:bg-gray-800/60 rounded-lg px-3 py-2 mb-1 transition"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Chat messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
                {messages.length === 0 && (
                  <div className="p-6 text-center text-gray-500 space-y-2">
                    <Sparkles className="w-8 h-8 mx-auto text-accent" />
                    <p className="text-sm font-medium text-gray-300">Hola, ¿en qué te ayudo?</p>
                    <p className="text-xs text-gray-600">
                      Tengo acceso a tus ventas, stock y productos. Preguntame lo que sea sobre tu negocio.
                    </p>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex animate-in fade-in slide-in-from-bottom-1 duration-200",
                      m.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words",
                        m.role === "user"
                          ? "bg-accent text-accent-foreground rounded-br-sm"
                          : "bg-gray-800 text-gray-100 rounded-bl-sm"
                      )}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="flex justify-start">
                    <div className="bg-gray-800 rounded-2xl rounded-bl-sm px-3.5 py-2 text-sm text-gray-400 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
                      <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse [animation-delay:300ms]" />
                    </div>
                  </div>
                )}
                {chatError && (
                  <div className="bg-red-900/30 border border-red-700/40 rounded-xl p-3 text-xs text-red-300">
                    {chatError}
                    {quotaInfo && (
                      <Link
                        href="/configuracion/suscripcion"
                        className="block mt-2 text-accent hover:text-accent-hover font-medium"
                      >
                        Mejorar plan →
                      </Link>
                    )}
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="border-t border-gray-800 p-3 bg-gray-900">
                {messages.length > 0 && (
                  <div className="flex justify-between items-center mb-1.5">
                    {quotaInfo && (
                      <p className="text-[10px] text-gray-600">
                        {quotaInfo.used}/{quotaInfo.quota} mensajes hoy
                      </p>
                    )}
                    <button
                      onClick={clearChat}
                      className="text-[10px] text-gray-600 hover:text-gray-400 ml-auto"
                    >
                      Borrar conversación
                    </button>
                  </div>
                )}
                <div className="flex items-end gap-1.5">
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value)
                      if (inputRef.current) {
                        inputRef.current.style.height = "auto"
                        inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px"
                      }
                    }}
                    onKeyDown={onKey}
                    placeholder="Preguntale al asistente…"
                    disabled={sending}
                    className="flex-1 resize-none bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-accent transition max-h-[120px]"
                  />
                  <button
                    onClick={send}
                    disabled={!input.trim() || sending}
                    className="p-2 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-accent-foreground transition flex-shrink-0"
                    aria-label="Enviar"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-gray-600 mt-1.5">
                  Powered by Claude · El asistente puede equivocarse, verificá datos importantes
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
