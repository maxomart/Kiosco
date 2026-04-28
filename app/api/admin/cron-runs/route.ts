import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * Devuelve las últimas 50 ejecuciones del cron interno — útil para verificar
 * que los emails programados se están disparando en horario.
 */
export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const runs = await db.cronExecution.findMany({
    orderBy: { startedAt: "desc" },
    take: 50,
    select: {
      id: true,
      name: true,
      runDate: true,
      startedAt: true,
      finishedAt: true,
      result: true,
    },
  })

  return NextResponse.json({ runs })
}
