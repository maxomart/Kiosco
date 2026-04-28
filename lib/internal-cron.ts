/**
 * Cron interno que corre dentro del proceso Next.js — evita la necesidad de
 * un servicio externo (cron-job.org / Railway Cron). Se arranca una sola vez
 * al boot del servidor desde `instrumentation.ts` y mantiene un setInterval
 * que cada 5 minutos chequea la hora y dispara los jobs pendientes.
 *
 * Idempotencia: cada run trata de crear una fila en `CronExecution` con
 * unique([name, runDate]). Si ya existe (otra réplica, redeploy en la misma
 * ventana, etc), el create falla por constraint y se salta el job.
 *
 * Horarios (Buenos Aires UTC-3, sin DST):
 *   - daily:    todos los días a las 22:00
 *   - lowstock: todos los días a las 09:00
 *   - weekly:   los lunes a las 09:00
 *   - monthly:  el día 1 de cada mes a las 09:00
 */

import { db } from "./db"
import { sendDigestForTenant, sendLowStockAlert, type DigestPeriod } from "./digest-generator"

let timerStarted = false
let intervalRef: NodeJS.Timeout | null = null

const CHECK_INTERVAL_MS = 5 * 60 * 1000 // 5 min
const AR_OFFSET_HOURS = -3

export function startInternalCron(): void {
  if (timerStarted) return
  timerStarted = true
  console.log("[internal-cron] starting (checks every 5min)")

  // Primera corrida 30s después del boot — por si el server arrancó cerca
  // de la hora exacta y queremos atrapar el slot.
  setTimeout(() => { void checkAndRun() }, 30_000)
  intervalRef = setInterval(() => { void checkAndRun() }, CHECK_INTERVAL_MS)
}

export function stopInternalCron(): void {
  if (intervalRef) clearInterval(intervalRef)
  intervalRef = null
  timerStarted = false
}

interface ARDateInfo {
  hour: number
  minute: number
  dayOfWeek: number // 0=domingo, 1=lunes, ..., 6=sábado
  dayOfMonth: number
  dateKey: string // YYYY-MM-DD en horario Argentina
}

function getArgentinaTime(now: Date): ARDateInfo {
  // Convertir UTC actual a horario Argentina (UTC-3) restando 3hs.
  // Después leemos los UTC* del Date corrido — eso nos da los componentes
  // en horario AR sin tocar tz nativos del runtime (que pueden variar).
  const ar = new Date(now.getTime() + AR_OFFSET_HOURS * 60 * 60 * 1000)
  return {
    hour: ar.getUTCHours(),
    minute: ar.getUTCMinutes(),
    dayOfWeek: ar.getUTCDay(),
    dayOfMonth: ar.getUTCDate(),
    dateKey: ar.toISOString().split("T")[0],
  }
}

async function checkAndRun(): Promise<void> {
  try {
    const ar = getArgentinaTime(new Date())

    // Daily summary @ 22:00 AR (ventana de 22:00-22:04 inclusive — el check
    // corre cada 5 min, así que con esto siempre lo agarramos).
    if (ar.hour === 22 && ar.minute < 5) {
      await runOnce("daily", ar.dateKey, async () => sendForFlag("daily"))
    }

    if (ar.hour === 9 && ar.minute < 5) {
      // Lowstock todos los días @ 09:00
      await runOnce("lowstock", ar.dateKey, async () => sendLowstock())

      // Weekly los lunes @ 09:00
      if (ar.dayOfWeek === 1) {
        await runOnce("weekly", ar.dateKey, async () => sendForFlag("weekly"))
      }

      // Monthly el día 1 @ 09:00
      if (ar.dayOfMonth === 1) {
        await runOnce("monthly", ar.dateKey, async () => sendForFlag("monthly"))
      }
    }
  } catch (e) {
    console.error("[internal-cron] check failed:", e)
  }
}

async function sendForFlag(period: DigestPeriod): Promise<{ tenants: number; sent: number; skipped: number }> {
  const filterField =
    period === "daily" ? "emailDailySummary" :
    period === "weekly" ? "emailWeeklySummary" :
    "emailMonthlySummary"

  const tenants = await db.tenant.findMany({
    where: {
      active: true,
      config: { [filterField]: true } as any,
    },
    select: { id: true },
  })

  let sent = 0
  let skipped = 0
  for (const t of tenants) {
    try {
      const r = await sendDigestForTenant(t.id, period)
      if (r.sent) sent++
      else skipped++
    } catch (e) {
      console.error(`[internal-cron ${period}] tenant ${t.id} failed:`, e)
      skipped++
    }
  }
  return { tenants: tenants.length, sent, skipped }
}

async function sendLowstock(): Promise<{ tenants: number; sent: number; skipped: number }> {
  const tenants = await db.tenant.findMany({
    where: {
      active: true,
      config: { emailLowStockAlerts: true },
    },
    select: { id: true },
  })

  let sent = 0
  let skipped = 0
  for (const t of tenants) {
    try {
      const r = await sendLowStockAlert(t.id)
      if (r.sent) sent++
      else skipped++
    } catch (e) {
      console.error(`[internal-cron lowstock] tenant ${t.id} failed:`, e)
      skipped++
    }
  }
  return { tenants: tenants.length, sent, skipped }
}

async function runOnce(name: string, dateKey: string, fn: () => Promise<unknown>): Promise<void> {
  // Reservar el slot creando la fila — si ya existe (otro proceso, redeploy
  // dentro de la misma ventana), el create falla por unique constraint y
  // no corremos el job de nuevo.
  let row
  try {
    row = await db.cronExecution.create({
      data: { name, runDate: dateKey },
    })
  } catch {
    return // ya se ejecutó hoy
  }

  console.log(`[internal-cron] running ${name} for ${dateKey}...`)
  try {
    const result = await fn()
    await db.cronExecution.update({
      where: { id: row.id },
      data: { finishedAt: new Date(), result: result as any },
    })
    console.log(`[internal-cron] ${name} OK:`, result)
  } catch (e) {
    console.error(`[internal-cron] ${name} failed:`, e)
    await db.cronExecution.update({
      where: { id: row.id },
      data: { finishedAt: new Date(), result: { error: String(e) } as any },
    })
  }
}
