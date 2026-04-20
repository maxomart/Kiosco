import { NextResponse } from "next/server"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { slugify } from "@/lib/utils"

const VALID_BUSINESS_TYPES = [
  "KIOSCO",
  "VERDULERIA",
  "MINISUPER",
  "FARMACIA",
  "OTRO",
] as const

const signupSchema = z.object({
  businessName: z
    .string()
    .min(2, "El nombre del negocio debe tener al menos 2 caracteres.")
    .max(100, "El nombre del negocio es demasiado largo."),
  businessType: z.enum(VALID_BUSINESS_TYPES, {
    errorMap: () => ({ message: "Tipo de negocio inválido." }),
  }),
  ownerName: z
    .string()
    .min(2, "El nombre debe tener al menos 2 caracteres.")
    .max(100, "El nombre es demasiado largo."),
  email: z
    .string()
    .email("Ingresá un email válido.")
    .max(200, "El email es demasiado largo."),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres.")
    .max(128, "La contraseña es demasiado larga."),
})

function randomSuffix(len = 4): string {
  return Math.random()
    .toString(36)
    .slice(2, 2 + len)
    .padEnd(len, "0")
}

export async function POST(req: Request) {
  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        { message: "Cuerpo de la solicitud inválido." },
        { status: 400 }
      )
    }

    // Validate with Zod
    const parsed = signupSchema.safeParse(body)
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => ({
        path: e.path,
        message: e.message,
      }))
      return NextResponse.json({ errors }, { status: 422 })
    }

    const { businessName, businessType, ownerName, email, password } = parsed.data

    // Check if email already exists
    const existing = await db.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (existing) {
      return NextResponse.json(
        { message: "Este email ya está registrado." },
        { status: 409 }
      )
    }

    // Generate a unique tenant slug
    const baseSlug = slugify(businessName)
    let slug = `${baseSlug}-${randomSuffix(4)}`

    // Ensure slug uniqueness (retry once on collision)
    const slugExists = await db.tenant.findUnique({
      where: { slug },
      select: { id: true },
    })
    if (slugExists) {
      slug = `${baseSlug}-${randomSuffix(6)}`
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Trial period: 30 days from now
    const now = new Date()
    const trialEnd = new Date(now)
    trialEnd.setDate(trialEnd.getDate() + 30)

    // Create everything in a transaction
    await db.$transaction(async (tx) => {
      // 1. Create Tenant
      const tenant = await tx.tenant.create({
        data: {
          name: businessName,
          slug,
        },
      })

      // 2. Create User (OWNER role)
      await tx.user.create({
        data: {
          name: ownerName,
          email,
          password: hashedPassword,
          role: "OWNER",
          tenantId: tenant.id,
        },
      })

      // 3. Create Subscription (FREE plan, trial period)
      await tx.subscription.create({
        data: {
          plan: "FREE",
          status: "TRIALING",
          tenantId: tenant.id,
          currentPeriodStart: now,
          currentPeriodEnd: trialEnd,
        },
      })

      // 4. Create TenantConfig with businessType
      await tx.tenantConfig.create({
        data: {
          businessName,
          businessType,
          tenantId: tenant.id,
        },
      })
    })

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error("[SIGNUP_ERROR]", error)
    return NextResponse.json(
      { message: "Error interno del servidor. Intentá de nuevo." },
      { status: 500 }
    )
  }
}
