import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { z } from "zod"

const VALID_TYPES = [
  "CELULAR_CLARO",
  "CELULAR_MOVISTAR",
  "CELULAR_PERSONAL",
  "CELULAR_TUENTI",
  "SUBE",
  "SERVICIOS",
  "TARJETA_PREPAGA",
  "OTROS",
] as const

const rechargeSchema = z.object({
  type: z.enum(VALID_TYPES),
  phoneNumber: z.string().optional(),
  amount: z.number().min(0),
  commission: z.number().min(0).default(0),
  profit: z.number().min(0).default(0),
  reference: z.string().optional(),
  notes: z.string().optional(),
})

// GET /api/cargas
export async function GET(req: NextRequest) {
  const { error, tenantId, isSuperAdmin } = await getSessionTenant()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200)

  const where: any = {}
  if (!isSuperAdmin) {
    where.tenantId = tenantId ?? undefined
  }

  try {
    const recharges = await db.recharge.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    })
    return NextResponse.json(recharges)
  } catch (err) {
    console.error("Error en cargas GET:", err)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

// POST /api/cargas
export async function POST(req: NextRequest) {
  const { error, tenantId } = await getSessionTenant()
  if (error) return error

  const body = await req.json()
  const parsed = rechargeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.errors }, { status: 400 })
  }

  try {
    const recharge = await db.recharge.create({
      data: {
        type: parsed.data.type,
        phoneNumber: parsed.data.phoneNumber || null,
        amount: parsed.data.amount,
        commission: parsed.data.commission,
        profit: parsed.data.profit,
        reference: parsed.data.reference || null,
        notes: parsed.data.notes || null,
        status: "COMPLETED",
        tenantId: tenantId ?? null,
      },
    })
    return NextResponse.json(recharge, { status: 201 })
  } catch (err) {
    console.error("Error en cargas POST:", err)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
