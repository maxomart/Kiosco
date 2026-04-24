"use client"

import { useState, useRef, useEffect } from "react"
import { Sparkles, Send, Loader2, Bot, User, RefreshCw } from "lucide-react"
import toast from "react-hot-toast"

interface Message {
  role: "user" | "assistant"
  content: string
  timestamp: number
}

const SUGGESTED_QUESTIONS = [
  "¿Cuánto vendí en los últimos 7 días?",
  "¿Cuál es mi producto más rentable?",
  "¿A qué hora vendo más?",
  "¿Qué día de la semana rinde mejor?",
  "¿Cuánto es mi ticket promedio?",
  "¿Qué producto debería dejar de vender?",
  "Compará esta semana con la anterior",
  "¿Qué método de pago usan más?",
]

export function SalesAIChat({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [days, setDays] = useState(30)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, loading])

  const send = async (q: string) => {
    const question = q.trim()
    if (!question) return
    const userMsg: Message = { role: "user", content: question, timestamp: Date.now() }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setLoading(true)
    try {
      const res = await fetch("/api/ventas/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, days }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "No pude responder")
        setMessages((prev) => prev.slice(0, -1)) // undo the user msg
        return
      }
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer, timestamp: Date.now() },
      ])
    } catch {
      toast.error("Error de red")
    } finally {
      setLoading(false)
    }
  }

  const clear = () => {
    setMessages([])
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-stretch justify-center p-4 md:items-center" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl shadow-black/50 max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-800 flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent to-accent/60 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-accent-foreground" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-gray-100">Preguntá a tu negocio</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Tu asistente de ventas — consultá lo que quieras sobre tus números
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value))}
              className="text-xs bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-gray-300 focus:outline-none focus:border-accent"
              title="Rango de análisis"
            >
              <option value={7}>Últimos 7 días</option>
              <option value={30}>Últimos 30 días</option>
              <option value={90}>Últimos 90 días</option>
              <option value={365}>Último año</option>
            </select>
            {messages.length > 0 && (
              <button
                onClick={clear}
                className="p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-gray-800"
                title="Limpiar conversación"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="text-gray-500 hover:text-gray-200 text-xl leading-none px-1">
              ×
            </button>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-5 space-y-4 min-h-[280px]"
        >
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <div className="inline-flex w-12 h-12 rounded-xl bg-accent-soft items-center justify-center mb-3">
                <Bot className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-white font-semibold mb-1">¿Qué querés saber?</h3>
              <p className="text-xs text-gray-400 mb-5 max-w-sm mx-auto">
                Hacé preguntas en lenguaje natural. Analizo tus ventas reales y te respondo con números concretos.
              </p>
              <div className="grid gap-2 max-w-md mx-auto">
                {SUGGESTED_QUESTIONS.slice(0, 5).map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="text-left text-sm text-gray-300 bg-gray-800/60 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-lg px-3 py-2 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    m.role === "user" ? "bg-gray-800" : "bg-accent-soft"
                  }`}
                >
                  {m.role === "user" ? (
                    <User className="w-3.5 h-3.5 text-gray-400" />
                  ) : (
                    <Bot className="w-3.5 h-3.5 text-accent" />
                  )}
                </div>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-accent/20 border border-accent/30 text-gray-100"
                      : "bg-gray-800 border border-gray-700 text-gray-100"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))
          )}

          {loading && (
            <div className="flex gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-accent-soft flex items-center justify-center flex-shrink-0">
                <Bot className="w-3.5 h-3.5 text-accent" />
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
                <span className="text-xs text-gray-400">Analizando tus ventas...</span>
              </div>
            </div>
          )}
        </div>

        {/* Quick suggestions when there are messages */}
        {messages.length > 0 && !loading && (
          <div className="px-5 py-2 border-t border-gray-800 flex gap-1.5 overflow-x-auto">
            {SUGGESTED_QUESTIONS.slice(0, 4).map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="flex-shrink-0 text-[11px] text-gray-400 hover:text-accent bg-gray-800/50 hover:bg-accent-soft/30 border border-gray-800 rounded-full px-2.5 py-1 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-gray-800">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              send(input)
            }}
            className="flex gap-2 items-end"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  send(input)
                }
              }}
              placeholder="Ej: ¿Cuánto gané esta semana?"
              rows={1}
              disabled={loading}
              className="flex-1 resize-none bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-accent max-h-32"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="flex-shrink-0 bg-accent hover:bg-accent-hover disabled:opacity-40 text-accent-foreground rounded-xl p-2.5 transition-colors"
              aria-label="Enviar"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <p className="text-[10px] text-gray-500 mt-1.5">
            Analizo los últimos {days} días. Enter para enviar, Shift+Enter para nueva línea.
          </p>
        </div>
      </div>
    </div>
  )
}
