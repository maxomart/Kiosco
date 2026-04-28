/**
 * Cliente para los webhooks de Google Apps Script que mantienen los Sheets
 * "Orvex - Usuarios" y "Orvex - Pagos" sincronizados al toque.
 *
 * El user crea un Sheet, pega un Apps Script con un secret, lo deploya como
 * Web App y nos pasa la URL. Nosotros POSTeamos JSON con el secret + la fila.
 *
 * Las llamadas son fire-and-forget: si Sheets falla no hay que romper el
 * signup ni el webhook de billing. Loggeamos y seguimos.
 */

import { db } from "@/lib/db"

export const USERS_HEADERS = [
  "ID usuario",
  "Nombre",
  "Email",
  "Teléfono",
  "Negocio",
  "Tipo de negocio",
  "Fecha registro",
  "Fecha inicio prueba",
  "Fecha fin prueba",
] as const

export const PAYMENTS_HEADERS = [
  "ID pago",
  "ID usuario",
  "Nombre",
  "Email",
  "Negocio",
  "Fecha pago",
  "Plan",
  "Monto",
  "Método",
  "Estado",
  "Próximo vencimiento",
  "Mes correspondiente",
] as const

const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return ""
  const date = typeof d === "string" ? new Date(d) : d
  if (isNaN(date.getTime())) return ""
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const dd = String(date.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function monthLabelEs(d: Date | string | null | undefined): string {
  if (!d) return ""
  const date = typeof d === "string" ? new Date(d) : d
  if (isNaN(date.getTime())) return ""
  return `${MONTHS_ES[date.getMonth()]} ${date.getFullYear()}`
}

function methodLabel(provider: string | null | undefined): string {
  if (!provider) return ""
  const p = provider.toLowerCase()
  if (p === "mercadopago" || p === "mp") return "MP"
  if (p === "stripe") return "Tarjeta"
  if (p === "transfer" || p === "transferencia") return "Transferencia"
  if (p === "cash" || p === "efectivo") return "Efectivo"
  return provider
}

function statusLabel(s: string): string {
  const m: Record<string, string> = {
    PAID: "pagado",
    PENDING: "pendiente",
    FAILED: "fallido",
    REFUNDED: "reembolsado",
  }
  return m[s.toUpperCase()] ?? s.toLowerCase()
}

export type SheetTarget = "users" | "payments"
export type SheetAction = "append" | "upsert" | "bootstrap"

interface PushBase {
  action: SheetAction
  headers: string[]
  secret: string
}
interface PushRow extends PushBase {
  action: "append" | "upsert"
  row: (string | number)[]
}
interface PushBootstrap extends PushBase {
  action: "bootstrap"
  rows: (string | number)[][]
}

function urlFor(target: SheetTarget): string | null {
  return (target === "users"
    ? process.env.SHEETS_WEBHOOK_USERS_URL
    : process.env.SHEETS_WEBHOOK_PAYMENTS_URL) ?? null
}

function headersFor(target: SheetTarget): string[] {
  return (target === "users" ? USERS_HEADERS : PAYMENTS_HEADERS) as unknown as string[]
}

async function postWebhook(url: string, body: PushRow | PushBootstrap): Promise<{ ok: boolean; error?: string }> {
  try {
    // Apps Script web apps redirect to googleusercontent.com — fetch follows by default.
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // Apps Script puede tardar varios segundos en cold start
      signal: AbortSignal.timeout(15_000),
    })
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` }
    const data = await r.json().catch(() => ({}))
    if (data.error) return { ok: false, error: String(data.error) }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** Sincroniza una sola fila (append o upsert). Fire-and-forget desde el caller. */
export async function pushRow(target: SheetTarget, row: (string | number)[], opts?: { upsert?: boolean }): Promise<{ ok: boolean; error?: string }> {
  const url = urlFor(target)
  const secret = process.env.SHEETS_WEBHOOK_SECRET
  if (!url || !secret) {
    return { ok: false, error: "Sheets webhook no configurado" }
  }
  return postWebhook(url, {
    action: opts?.upsert ? "upsert" : "append",
    headers: headersFor(target),
    secret,
    row,
  })
}

/**
 * Construye la fila de un usuario desde la DB. ID = User.id (owner del tenant).
 * Devuelve null si el user no es owner (no se trackean cajeros).
 */
export async function buildUserRow(userId: string): Promise<(string | number)[] | null> {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      createdAt: true,
      tenant: {
        select: {
          name: true,
          createdAt: true,
          config: { select: { businessType: true, phone: true } },
          subscription: {
            select: {
              currentPeriodStart: true,
              currentPeriodEnd: true,
              createdAt: true,
            },
          },
        },
      },
    },
  })
  if (!u || u.role !== "OWNER") return null
  const sub = u.tenant?.subscription
  return [
    u.id,
    u.name,
    u.email,
    u.phone ?? u.tenant?.config?.phone ?? "",
    u.tenant?.name ?? "",
    u.tenant?.config?.businessType ?? "",
    fmtDate(u.createdAt),
    fmtDate(sub?.currentPeriodStart ?? sub?.createdAt ?? u.tenant?.createdAt ?? null),
    fmtDate(sub?.currentPeriodEnd ?? null),
  ]
}

/** Construye la fila de un invoice. ID = Invoice.number || Invoice.id. */
export async function buildPaymentRow(invoiceId: string): Promise<(string | number)[] | null> {
  const inv = await db.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      number: true,
      amount: true,
      currency: true,
      status: true,
      paidAt: true,
      createdAt: true,
      subscription: {
        select: {
          plan: true,
          paymentProvider: true,
          currentPeriodEnd: true,
          tenant: {
            select: {
              name: true,
              users: {
                where: { role: "OWNER" },
                select: { id: true, name: true, email: true },
                take: 1,
              },
            },
          },
        },
      },
    },
  })
  if (!inv) return null
  const owner = inv.subscription?.tenant?.users?.[0]
  const dateForMonth = inv.paidAt ?? inv.createdAt
  return [
    inv.number || inv.id,
    owner?.id ?? "",
    owner?.name ?? "",
    owner?.email ?? "",
    inv.subscription?.tenant?.name ?? "",
    fmtDate(inv.paidAt ?? inv.createdAt),
    inv.subscription?.plan ?? "",
    `${inv.amount.toString()} ${inv.currency}`,
    methodLabel(inv.subscription?.paymentProvider ?? null),
    statusLabel(inv.status),
    fmtDate(inv.subscription?.currentPeriodEnd ?? null),
    monthLabelEs(dateForMonth),
  ]
}

/** Disparar push de un user al sheet, swallowing errors (no romper el signup). */
export function syncUserToSheet(userId: string): void {
  if (!isConfigured("users")) return
  buildUserRow(userId)
    .then((row) => row && pushRow("users", row, { upsert: true }))
    .then((res) => {
      if (res && !res.ok) console.error("[sheets] user sync failed:", res.error)
    })
    .catch((err) => console.error("[sheets] user sync threw:", err))
}

/** Disparar push de un invoice al sheet. */
export function syncPaymentToSheet(invoiceId: string): void {
  if (!isConfigured("payments")) return
  buildPaymentRow(invoiceId)
    .then((row) => row && pushRow("payments", row, { upsert: true }))
    .then((res) => {
      if (res && !res.ok) console.error("[sheets] payment sync failed:", res.error)
    })
    .catch((err) => console.error("[sheets] payment sync threw:", err))
}

export function isConfigured(target: SheetTarget): boolean {
  return !!urlFor(target) && !!process.env.SHEETS_WEBHOOK_SECRET
}

/**
 * Bulk bootstrap: borra el sheet y reescribe todo. Usado por /admin/exportar
 * cuando el user lo pide manualmente (o la primera vez que conectó las URLs).
 */
export async function bootstrapSheet(target: SheetTarget): Promise<{ ok: boolean; count?: number; error?: string }> {
  const url = urlFor(target)
  const secret = process.env.SHEETS_WEBHOOK_SECRET
  if (!url || !secret) return { ok: false, error: "Sheets webhook no configurado" }

  let rows: (string | number)[][] = []

  if (target === "users") {
    const owners = await db.user.findMany({
      where: { role: "OWNER" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    })
    const built = await Promise.all(owners.map((o) => buildUserRow(o.id)))
    rows = built.filter((r): r is (string | number)[] => r !== null)
  } else {
    const invoices = await db.invoice.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true },
    })
    const built = await Promise.all(invoices.map((i) => buildPaymentRow(i.id)))
    rows = built.filter((r): r is (string | number)[] => r !== null)
  }

  const res = await postWebhook(url, {
    action: "bootstrap",
    headers: headersFor(target),
    secret,
    rows,
  })
  return { ...res, count: rows.length }
}
