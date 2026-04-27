"use client"

import { useEffect, useRef, useState } from "react"
import toast from "react-hot-toast"
import { LifeBuoy, Loader2, Send, RefreshCw, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface TicketSummary {
  id: string
  subject: string
  status: string
  plan: string | null
  unreadByAdmin: boolean
  escalatedAt: string | null
  closedAt: string | null
  lastMessageAt: string
  createdAt: string
  user: { id: string; name: string; email: string; tenant: { id: string; name: string } | null } | null
}

interface Message {
  id: string
  role: "user" | "ai" | "admin"
  content: string
  createdAt: string
}

interface FullTicket {
  id: string
  subject: string
  status: string
  planSnapshot: string | null
  createdAt: string
  lastMessageAt: string
  messages: Message[]
}

const FILTERS = [
  { id: "active", label: "Activos" },
  { id: "escalated", label: "Escalados" },
  { id: "closed", label: "Cerrados" },
  { id: "all", label: "Todos" },
] as const

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<TicketSummary[]>([])
  const [counts, setCounts] = useState<{ open: number; escalated: number; closed: number } | null>(null)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("active")
  const [activeId, setActiveId] = useState<string | null>(null)
  const [active, setActive] = useState<{ ticket: FullTicket; user: any } | null>(null)
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  // We track the in-flight request id so a slow response from a
  // previously-clicked ticket can't overwrite the current selection
  // (classic stale-response race when the admin clicks A, then B before
  // A resolves).
  const loadOneSeq = useRef(0)

  async function loadList() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/support/tickets?filter=${filter}`)
      if (!res.ok) {
        toast.error("No pudimos cargar la lista.")
        return
      }
      const data = await res.json()
      setTickets(data.tickets ?? [])
      setCounts(data.counts ?? null)
    } catch {
      toast.error("Sin conexión.")
    } finally {
      setLoading(false)
    }
  }

  async function loadOne(id: string) {
    const seq = ++loadOneSeq.current
    setActiveId(id)
    setActive(null)
    setDraft("")
    try {
      const res = await fetch(`/api/admin/support/tickets/${id}`)
      // Bail if the user clicked another ticket in the meantime — this
      // response is stale and would clobber the newer selection.
      if (seq !== loadOneSeq.current) return
      if (!res.ok) {
        toast.error("No se pudo abrir el ticket.")
        return
      }
      const data = await res.json()
      if (seq !== loadOneSeq.current) return
      setActive({ ticket: data.ticket, user: data.user })
    } catch {
      if (seq === loadOneSeq.current) toast.error("Sin conexión.")
    }
  }

  async function reply(close = false) {
    if (!activeId || !draft.trim() || busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/support/tickets/${activeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft, close }),
      })
      if (!res.ok) {
        toast.error("No se pudo enviar la respuesta.")
        return
      }
      setDraft("")
      toast.success(close ? "Respondido y cerrado" : "Respuesta enviada")
      await loadOne(activeId)
      await loadList()
    } catch {
      toast.error("Sin conexión.")
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    void loadList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <LifeBuoy className="w-6 h-6 text-violet-400" /> Soporte
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Tickets de los usuarios — la IA contesta primero y los que escala caen acá.
          </p>
        </div>
        <button
          onClick={() => void loadList()}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-200 transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Refrescar
        </button>
      </div>

      {counts && (
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Abiertos / IA" value={counts.open} accent="text-violet-300" />
          <Stat label="Escalados" value={counts.escalated} accent="text-amber-300" />
          <Stat label="Cerrados" value={counts.closed} accent="text-gray-400" />
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm transition-colors",
              filter === f.id
                ? "bg-violet-500/20 text-violet-200 border border-violet-500/40"
                : "bg-gray-800 text-gray-300 border border-transparent hover:border-gray-700",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[600px]">
        {/* List */}
        <div className="lg:col-span-5 rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : tickets.length === 0 ? (
            <p className="p-10 text-center text-sm text-gray-500">Sin tickets para este filtro.</p>
          ) : (
            <ul className="divide-y divide-gray-800 max-h-[calc(100vh-280px)] overflow-y-auto">
              {tickets.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => loadOne(t.id)}
                    className={cn(
                      "w-full text-left p-3 hover:bg-white/[0.02] transition-colors",
                      activeId === t.id && "bg-violet-500/[0.06]",
                    )}
                  >
                    <div className="flex items-start gap-2 mb-1">
                      {t.unreadByAdmin && (
                        <span className="w-2 h-2 rounded-full bg-violet-400 mt-1.5 shrink-0" />
                      )}
                      <p className="text-sm text-white font-medium flex-1 truncate">{t.subject}</p>
                      <StatusBadge status={t.status} />
                    </div>
                    <p className="text-[11px] text-gray-500 truncate">
                      {t.user?.name ?? "—"} · {t.user?.email ?? ""}
                      {t.plan && ` · ${t.plan}`}
                    </p>
                    <p className="text-[10px] text-gray-600 mt-0.5">
                      {relativeTime(t.lastMessageAt)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Thread */}
        <div className="lg:col-span-7 rounded-xl border border-gray-800 bg-gray-900 flex flex-col min-h-[400px]">
          {!active ? (
            <p className="m-auto text-sm text-gray-500">Elegí un ticket de la lista.</p>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-gray-800 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-white font-semibold truncate">{active.ticket.subject}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {active.user?.name ?? "—"} · {active.user?.email ?? ""}
                    {active.user?.tenant && ` · ${active.user.tenant.name}`}
                    {active.ticket.planSnapshot && ` · Plan ${active.ticket.planSnapshot}`}
                  </p>
                </div>
                <StatusBadge status={active.ticket.status} />
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {active.ticket.messages.map((m) => (
                  <AdminBubble key={m.id} m={m} />
                ))}
              </div>
              {active.ticket.status !== "CLOSED" && (
                <div className="border-t border-gray-800 p-3">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Tu respuesta..."
                    rows={3}
                    maxLength={4000}
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/60 resize-none"
                  />
                  <div className="flex items-center justify-between gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => reply(true)}
                      disabled={busy || !draft.trim()}
                      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-emerald-300 disabled:opacity-40 transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Enviar y cerrar
                    </button>
                    <button
                      type="button"
                      onClick={() => reply(false)}
                      disabled={busy || !draft.trim()}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-400 hover:to-violet-400 disabled:opacity-50 text-white text-sm font-semibold"
                    >
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-3.5 h-3.5" /> Enviar</>}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={cn("text-2xl font-bold tabular-nums mt-0.5", accent)}>{value}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    OPEN: { label: "Abierto", cls: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
    AI_REPLIED: { label: "IA", cls: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
    ESCALATED: { label: "Esperando vos", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
    ANSWERED: { label: "Respondido", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
    CLOSED: { label: "Cerrado", cls: "bg-gray-500/15 text-gray-400 border-gray-500/30" },
  }
  const v = map[status] ?? { label: status, cls: "bg-gray-500/15 text-gray-400 border-gray-500/30" }
  return (
    <span className={cn("text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider whitespace-nowrap border", v.cls)}>
      {v.label}
    </span>
  )
}

function AdminBubble({ m }: { m: Message }) {
  const isUser = m.role === "user"
  const isAi = m.role === "ai"
  return (
    <div className={cn("flex", isUser ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3 py-2 text-[13px] leading-snug whitespace-pre-wrap",
          isUser
            ? "bg-blue-500/10 border border-blue-400/25 text-blue-50 rounded-bl-md"
            : isAi
              ? "bg-violet-500/[0.08] border border-violet-400/20 text-gray-100 rounded-br-md"
              : "bg-emerald-500/[0.08] border border-emerald-400/25 text-emerald-50 rounded-br-md",
        )}
      >
        <p className={cn("text-[9px] uppercase tracking-[0.2em] font-bold mb-1", isUser ? "text-blue-300" : isAi ? "text-violet-300" : "text-emerald-300")}>
          {isUser ? "Usuario" : isAi ? "✦ IA" : "Vos"}
        </p>
        {m.content}
      </div>
    </div>
  )
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
