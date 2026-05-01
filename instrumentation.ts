/**
 * Next.js instrumentation hook — corre una sola vez al boot del proceso.
 * Lo usamos para arrancar el cron interno (lib/internal-cron.ts) que
 * dispara los emails programados sin necesidad de un servicio externo.
 *
 * Sólo en runtime nodejs (no edge) y sólo en producción para no spammear
 * envíos durante dev.
 */

export async function register(): Promise<void> {
  // Sentry per runtime
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config")
  } else if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config")
  }

  if (process.env.NEXT_RUNTIME !== "nodejs") return
  if (process.env.NODE_ENV !== "production") {
    console.log("[instrumentation] skipping internal cron in non-prod")
    return
  }

  try {
    const { startInternalCron } = await import("./lib/internal-cron")
    startInternalCron()
  } catch (e) {
    console.error("[instrumentation] failed to start internal cron:", e)
  }
}

export async function onRequestError(err: unknown, request: any, context: any): Promise<void> {
  const Sentry = await import("@sentry/nextjs")
  Sentry.captureRequestError(err, request, context)
}
