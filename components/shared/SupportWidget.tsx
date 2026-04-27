"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import toast from "react-hot-toast"
import { LifeBuoy, X, Send, Loader2, ArrowLeft, UserCheck, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * SupportWidget — slide-over panel where the user opens tickets, gets AI
 * help, and escalates to a human if needed.
 *
 * Two views:
 *
 *   1. List view — all tickets the user has opened. "Nuevo" button →
 *      switches to thread view with empty state asking for subject + msg.
 *
 *   2. Thread view — full conversation. User-bubble right, AI-bubble left
 *      with a ✦ IA marker, admin-bubble left with a "Equipo Orvex" tag.
 *      Composer at the bottom. "Hablar con humano" button on AI threads.
 *
 * Mounted as a sibling of the AssistantWidget in the dashboard layout.
 * The trigger is a separate button in the user dropdown menu (Header.tsx)
 * that fires a custom event we listen for here.
 */

const OPEN_EVENT = "orvex:open-support"

interface TicketSummary {
  id: string
  subject: string
  status: string
  unreadByUser: boolean
  lastMessageAt: string
  createdAt: string
}

interface Message {
  id: string
  role: "user" | "ai" | "admin"
  content: string
  createdAt: string
}

export default function SupportWidget() {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<"list" | "thread" | "new">("list")
  const [tickets, setTickets] = useState<TicketSummary[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [subject, setSubject] = useState("")
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [ticketStatus, setTicketStatus] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Listen for the global open trigger fired from anywhere (header
  // dropdown, FAQ "ask us" link, etc.) so we don't have to thread props.
  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_EVENT, onOpen)
  }, [])

  // Esc closes the panel.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open])

  // Reset transient state on close so the next open lands on the list
  // view instead of a stale thread. We delay the reset until after the
  // exit animation finishes so the user doesn't see the panel flicker
  // back to the list while it's leaving.
  useEffect(() => {
    if (open) return
    const id = window.setTimeout(() => {
      setView("list")
      setActiveId(null)
      setMessages([])
      setSubject("")
      setDraft("")
      setTicketStatus(null)
    }, 400)
    return () => window.clearTimeout(id)
  }, [open])

  // Lazy-load tickets the first time the panel opens
  useEffect(() => {
    if (open && view === "list") void loadTickets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, view])

  async function loadTickets() {
    setLoading(true)
    try {
      const res = await fetch("/api/soporte/tickets")
      if (!res.ok) {
        toast.error("No pudimos cargar tus tickets. Probá refrescar.")
        return
      }
      const data = await res.json()
      setTickets(data.tickets ?? [])
    } catch {
      toast.error("Sin conexión.")
    } finally {
      setLoading(false)
    }
  }

  async function openThread(id: string) {
    setActiveId(id)
    setView("thread")
    setLoading(true)
    try {
      const res = await fetch(`/api/soporte/tickets/${id}`)
      if (!res.ok) {
        toast.error("No pudimos abrir esta consulta.")
        return
      }
      const data = await res.json()
      setMessages(data.ticket.messages)
      setTicketStatus(data.ticket.status)
      setSubject(data.ticket.subject)
    } catch {
      toast.error("Sin conexión.")
    } finally {
      setLoading(false)
      // scroll to bottom after a frame so the layout settles
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
      })
    }
  }

  function backToList() {
    setActiveId(null)
    setMessages([])
    setSubject("")
    setDraft("")
    setView("list")
    setTicketStatus(null)
    void loadTickets()
  }

  async function createTicket() {
    if (!subject.trim() || !draft.trim() || busy) return
    setBusy(true)
    try {
      const res = await fetch("/api/soporte/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message: draft }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? "No pudimos crear el ticket. Probá de nuevo.")
        return
      }
      const data = await res.json()
      setActiveId(data.ticket.id)
      setView("thread")
      setDraft("")
      void openThread(data.ticket.id)
    } catch {
      toast.error("Sin conexión.")
    } finally {
      setBusy(false)
    }
  }

  async function sendMessage() {
    if (!activeId || !draft.trim() || busy) return
    const text = draft
    setDraft("")
    // Optimistic: append the user message immediately. Tag the temp id
    // so we can roll it back if the request fails — without rollback,
    // the bubble would stay forever as a phantom.
    const tempId = `tmp-${Date.now()}`
    const optimistic: Message = {
      id: tempId,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    }
    setMessages((m) => [...m, optimistic])
    setBusy(true)
    try {
      const res = await fetch(`/api/soporte/tickets/${activeId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      })
      if (!res.ok) {
        // Roll back optimistic UI and restore the draft
        setMessages((m) => m.filter((msg) => msg.id !== tempId))
        setDraft(text)
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? "No pudimos enviar tu mensaje.")
        return
      }
      await openThread(activeId)
    } catch {
      setMessages((m) => m.filter((msg) => msg.id !== tempId))
      setDraft(text)
      toast.error("Sin conexión.")
    } finally {
      setBusy(false)
    }
  }

  async function escalate() {
    if (!activeId || busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/soporte/tickets/${activeId}/escalate`, { method: "POST" })
      if (!res.ok) {
        toast.error("No pudimos pasar a soporte humano.")
        return
      }
      toast.success("Te paso con Joaco.")
      await openThread(activeId)
    } catch {
      toast.error("Sin conexión.")
    } finally {
      setBusy(false)
    }
  }

  async function closeTicket() {
    if (!activeId || busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/soporte/tickets/${activeId}/close`, { method: "POST" })
      if (!res.ok) {
        toast.error("No se pudo cerrar.")
        return
      }
      backToList()
    } catch {
      toast.error("Sin conexión.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="bd"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
          />
          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ x: 480, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 480, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-0 right-0 bottom-0 z-[70] w-full sm:w-[440px] bg-gray-950 border-l border-gray-800 flex flex-col shadow-2xl"
            role="dialog"
            aria-label="Soporte"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
              {view !== "list" && (
                <button
                  type="button"
                  onClick={backToList}
                  className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                  aria-label="Volver"
                >
                  <ArrowLeft size={16} />
                </button>
              )}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <LifeBuoy className="w-4 h-4 text-violet-300 shrink-0" />
                <p className="text-sm font-semibold text-white truncate">
                  {view === "list" ? "Soporte" : view === "new" ? "Nueva consulta" : subject || "Conversación"}
                </p>
              </div>
              {view === "thread" && ticketStatus && (
                <span
                  className={cn(
                    // Hidden on tiny screens because the back-arrow + title
                    // + close-X already eat the row at 320px. Status is
                    // visible inside the thread anyway.
                    "hidden sm:inline-flex text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider whitespace-nowrap",
                    ticketStatus === "ESCALATED"
                      ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                      : ticketStatus === "ANSWERED"
                        ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                        : ticketStatus === "CLOSED"
                          ? "bg-gray-500/15 text-gray-400 border border-gray-500/30"
                          : "bg-violet-500/15 text-violet-300 border border-violet-500/30",
                  )}
                >
                  {ticketStatus === "ESCALATED"
                    ? "Con humano"
                    : ticketStatus === "ANSWERED"
                      ? "Respondido"
                      : ticketStatus === "CLOSED"
                        ? "Cerrado"
                        : "IA"}
                </span>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                aria-label="Cerrar"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto">
              {view === "list" && (
                <ListView
                  tickets={tickets}
                  loading={loading}
                  onOpen={openThread}
                  onNew={() => {
                    setView("new")
                    setSubject("")
                    setDraft("")
                  }}
                />
              )}
              {view === "new" && (
                <NewView
                  subject={subject}
                  draft={draft}
                  busy={busy}
                  onChangeSubject={setSubject}
                  onChangeDraft={setDraft}
                  onSubmit={createTicket}
                />
              )}
              {view === "thread" && (
                <ThreadView messages={messages} loading={loading} />
              )}
            </div>

            {/* Composer or actions */}
            {view === "thread" && ticketStatus !== "CLOSED" && (
              <div className="border-t border-gray-800">
                <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800/60 text-xs">
                  {ticketStatus !== "ESCALATED" && (
                    <button
                      type="button"
                      onClick={escalate}
                      disabled={busy}
                      className="flex items-center gap-1.5 text-gray-400 hover:text-amber-300 transition-colors disabled:opacity-50"
                      title="Que te responda Joaco directamente"
                    >
                      <UserCheck size={12} /> Hablar con humano
                    </button>
                  )}
                  <span className="ml-auto" />
                  <button
                    type="button"
                    onClick={closeTicket}
                    disabled={busy}
                    className="flex items-center gap-1.5 text-gray-500 hover:text-emerald-300 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 size={12} /> Marcar resuelto
                  </button>
                </div>
                <Composer draft={draft} setDraft={setDraft} busy={busy} onSend={sendMessage} />
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

/** Helper to open the widget from anywhere in the app. */
export function openSupportWidget() {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

/* ---------------------------- subviews ---------------------------- */

function ListView({
  tickets,
  loading,
  onOpen,
  onNew,
}: {
  tickets: TicketSummary[]
  loading: boolean
  onOpen: (id: string) => void
  onNew: () => void
}) {
  return (
    <div className="p-4 space-y-3">
      <button
        type="button"
        onClick={onNew}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-400 hover:to-violet-400 text-white font-semibold text-sm transition-all"
      >
        Nueva consulta
      </button>
      {loading ? (
        <div className="py-8 flex items-center justify-center text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-500">
          Sin tickets todavía. Si tenés un problema, abrí uno acá arriba.
          <br />
          La IA responde al toque y si no puede te paso a un humano.
        </div>
      ) : (
        <ul className="space-y-2">
          {tickets.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onOpen(t.id)}
                className="w-full text-left rounded-xl border border-gray-800 hover:border-violet-500/40 bg-gray-900 hover:bg-gray-900/80 p-3 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-sm font-medium text-white truncate">{t.subject}</p>
                  {t.unreadByUser && (
                    <span className="w-2 h-2 rounded-full bg-violet-400 shrink-0" aria-label="No leído" />
                  )}
                </div>
                <p className="text-[11px] text-gray-500">
                  <StatusLabel status={t.status} /> · {relativeTime(t.lastMessageAt)}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function NewView({
  subject,
  draft,
  busy,
  onChangeSubject,
  onChangeDraft,
  onSubmit,
}: {
  subject: string
  draft: string
  busy: boolean
  onChangeSubject: (v: string) => void
  onChangeDraft: (v: string) => void
  onSubmit: () => void
}) {
  return (
    <div className="p-4 space-y-3">
      <p className="text-sm text-gray-400">
        Contanos qué pasa. La IA va a tirarte una respuesta al toque. Si necesita
        meterse Joaco, te lo paso.
      </p>
      <input
        value={subject}
        onChange={(e) => onChangeSubject(e.target.value)}
        placeholder="Asunto · ej: «No me carga el POS»"
        maxLength={120}
        className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/60"
      />
      <textarea
        value={draft}
        onChange={(e) => onChangeDraft(e.target.value)}
        placeholder="Detalles..."
        rows={6}
        maxLength={4000}
        className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/60 resize-none"
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={busy || !subject.trim() || !draft.trim()}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-400 hover:to-violet-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Enviar consulta <Send className="w-3.5 h-3.5" /></>}
      </button>
    </div>
  )
}

function ThreadView({ messages, loading }: { messages: Message[]; loading: boolean }) {
  if (loading && messages.length === 0) {
    return (
      <div className="py-10 flex items-center justify-center text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    )
  }
  return (
    <div className="p-4 space-y-3">
      {messages.map((m) => (
        <Bubble key={m.id} message={m} />
      ))}
    </div>
  )
}

function Bubble({ message }: { message: Message }) {
  const isUser = message.role === "user"
  const isAi = message.role === "ai"
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-snug whitespace-pre-wrap",
          isUser
            ? "bg-blue-500/15 border border-blue-400/25 text-blue-50 rounded-br-md"
            : isAi
              ? "bg-gradient-to-br from-violet-500/[0.08] to-fuchsia-500/[0.04] border border-violet-400/20 text-gray-100 rounded-bl-md"
              : "bg-emerald-500/[0.08] border border-emerald-400/25 text-emerald-50 rounded-bl-md",
        )}
      >
        {!isUser && (
          <p
            className={cn(
              "text-[9px] uppercase tracking-[0.2em] font-bold mb-1",
              isAi ? "text-violet-300" : "text-emerald-300",
            )}
          >
            {isAi ? "✦ IA" : "Equipo Orvex"}
          </p>
        )}
        {message.content}
      </div>
    </div>
  )
}

function Composer({
  draft,
  setDraft,
  busy,
  onSend,
}: {
  draft: string
  setDraft: (v: string) => void
  busy: boolean
  onSend: () => void
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSend()
      }}
      className="p-3 flex items-end gap-2"
    >
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            onSend()
          }
        }}
        placeholder="Tu mensaje... (Enter para enviar)"
        rows={2}
        maxLength={4000}
        className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-[13px] text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/60 resize-none"
      />
      <button
        type="submit"
        disabled={busy || !draft.trim()}
        className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-400 hover:to-violet-400 disabled:opacity-50 disabled:cursor-not-allowed text-white flex items-center justify-center"
        aria-label="Enviar"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
      </button>
    </form>
  )
}

function StatusLabel({ status }: { status: string }) {
  const map: Record<string, string> = {
    OPEN: "Pendiente",
    AI_REPLIED: "IA respondió",
    ESCALATED: "Con humano",
    ANSWERED: "Respondido",
    CLOSED: "Cerrado",
  }
  return <span>{map[status] ?? status}</span>
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return "ahora"
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  return `hace ${d} d`
}
