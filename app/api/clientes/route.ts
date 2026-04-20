import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { z } from "zod"

const schema = z.object({ name: z.string().min(1), phone: z.string().optional().nullable(), email: z.string().email().optional().nullable().or(z.literal("")), dni: z.string().optional().nullable(), address: z.string().optional().nullable(), notes: z.string().optional().nullable() })

export async function GET() {
  const { error, tenantId } = await getSessionTenant()
  if (error) return error
  try {
    const clients = await db.client.findMany({ where: { active: true, ...(tenantId ? { tenantId } : {}) }, orderBy: { name: "asc" } })
    return NextResponse.json({ clients })
  } catch (err) {
    console.error("[GET /api/clientes]", err)
    return NextResponse.json({ error: "Error al obtener clientes" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { error, tenantId, session } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  try {
    const client = await db.client.create({ data: { ...parsed.data, email: parsed.data.email || null, tenantId: tenantId! } })
    return NextResponse.json({ client }, { status: 201 })
  } catch (err: any) {
    if (err?.code === "P2002") return NextResponse.json({ error: "DNI ya registrado" }, { status: 400 })
    return NextResponse.json({ error: "Error al crear" }, { status: 500 })
  }
}
