/**
 * Email helpers using Resend.
 * Falls back to no-op + console.log if RESEND_API_KEY is not configured
 * (so dev environments don't break and we can preview the HTML in logs).
 */
import { Resend } from "resend"

let cachedResend: Resend | null = null

export function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  if (!cachedResend) cachedResend = new Resend(key)
  return cachedResend
}

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  /** Plain text fallback. Optional but recommended for deliverability. */
  text?: string
  /** Reply-to override. */
  replyTo?: string
}

export async function sendEmail(opts: SendEmailOptions): Promise<{ ok: boolean; id?: string; error?: string }> {
  const resend = getResend()
  const from = process.env.EMAIL_FROM ?? "Orvex <onboarding@resend.dev>"
  // Default reply-to from env (e.g. cobraorvex@gmail.com) so responses
  // land in a real inbox even when sent from a noreply@ address.
  const defaultReplyTo = process.env.EMAIL_REPLY_TO

  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping send. Subject:", opts.subject)
    return { ok: false, error: "Email no configurado en el servidor (falta RESEND_API_KEY)" }
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: Array.isArray(opts.to) ? opts.to : [opts.to],
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      replyTo: opts.replyTo ?? defaultReplyTo,
    })

    if (error) {
      console.error("[email] Resend error:", error)
      return { ok: false, error: error.message ?? "Error al enviar el email" }
    }
    return { ok: true, id: data?.id }
  } catch (err) {
    console.error("[email] unexpected error:", err)
    return { ok: false, error: "Error inesperado al enviar el email" }
  }
}
