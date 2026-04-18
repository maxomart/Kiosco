import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { z } from "zod"
import bcrypt from "bcryptjs"
import crypto from "crypto"

function generatePassword(length = 16): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%"
  return Array.from(crypto.randomBytes(length))
    .map(b => chars[b % chars.length])
    .join("")
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

// GET: listar todos los tenants (solo SUPER_ADMIN)
export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const tenants = await db.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { users: true, products: true, sales: true } },
    },
  })

  return NextResponse.json({ tenants })
}

// POST: crear nuevo tenant + owner user
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const body = await req.json()
  const schema = z.object({
    name: z.string().min(2).max(60),
    ownerName: z.string().min(2).max(60),
    ownerEmail: z.string().email(),
  })

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.errors }, { status: 400 })
  }

  const { name, ownerName, ownerEmail } = parsed.data

  // Verificar que el email no exista
  const existing = await db.user.findUnique({ where: { email: ownerEmail } })
  if (existing) {
    return NextResponse.json({ error: "Ya existe un usuario con ese email" }, { status: 409 })
  }

  // Generar slug único
  let slug = slugify(name)
  const slugExists = await db.tenant.findUnique({ where: { slug } })
  if (slugExists) slug = `${slug}-${Date.now().toString(36)}`

  // Generar contraseña compleja
  const plainPassword = generatePassword(18)
  const hashedPassword = await bcrypt.hash(plainPassword, 12)

  // Crear tenant + owner en una transacción
  const result = await db.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { name, slug },
    })

    const owner = await tx.user.create({
      data: {
        name: ownerName,
        email: ownerEmail,
        password: hashedPassword,
        role: "OWNER",
        tenantId: tenant.id,
      },
    })

    return { tenant, owner, plainPassword }
  })

  return NextResponse.json(
    {
      tenant: result.tenant,
      owner: { id: result.owner.id, name: result.owner.name, email: result.owner.email },
      credentials: { email: ownerEmail, password: result.plainPassword },
      message: "Guardá estas credenciales, no se vuelven a mostrar",
    },
    { status: 201 }
  )
}
