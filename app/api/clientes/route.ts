import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { z } from "zod"

const clientSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  phone: z.string().optional().nullable(),
  email: z.string().email("Email inválido").optional().nullable().or(z.literal("")),
  dni: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

// GET /api/clientes
export async function GET() {
  try {
    const clients = await db.client.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    })
    return NextResponse.json(clients)
  } catch {
    return NextResponse.json({ error: "Error al obtener clientes" }, { status: 500 })
  }
}

// POST /api/clientes
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 })

  const body = await req.json()
  const parsed = clientSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  const data = parsed.data
  try {
    const client = await db.client.create({
      data: {
        name: data.name,
        phone: data.phone || null,
        email: data.email || null,
        dni: data.dni || null,
        address: data.address || null,
        notes: data.notes || null,
      },
    })
    return NextResponse.json(client, { status: 201 })
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "El DNI ya está registrado" }, { status: 400 })
    }
    return NextResponse.json({ error: "Error al crear cliente" }, { status: 500 })
  }
}
