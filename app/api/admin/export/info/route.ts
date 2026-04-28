import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export const dynamic = "force-dynamic"

/**
 * Devuelve el SHEETS_EXPORT_TOKEN al admin para mostrarlo en /admin/exportar.
 * Sólo accesible por SUPER_ADMIN — el token es secreto y nunca se cachea.
 */
export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }
  const token = process.env.SHEETS_EXPORT_TOKEN ?? null
  return NextResponse.json({ token: token && token.length >= 16 ? token : null })
}
