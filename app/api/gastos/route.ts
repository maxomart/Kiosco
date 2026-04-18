import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { z } from "zod"

const expenseSchema = z.object({
  description: z.string().min(1, "La descripción es requerida"),
  amount: z.number().min(0.01, "El monto debe ser mayor a 0"),
  categoryId: z.string().optional().nullable(),
  categoryName: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

// GET /api/gastos
export async function GET() {
  const { error, tenantId, isSuperAdmin } = await getSessionTenant()
  if (error) return error

  const tenantFilter = !isSuperAdmin && tenantId ? { tenantId } : {}

  try {
    const [expenses, categories] = await Promise.all([
      db.expense.findMany({
        where: tenantFilter,
        orderBy: { createdAt: "desc" },
        include: { category: true },
        take: 200,
      }),
      db.expenseCategory.findMany({ where: tenantFilter, orderBy: { name: "asc" } }),
    ])
    return NextResponse.json({ expenses, categories })
  } catch {
    return NextResponse.json({ error: "Error al obtener gastos" }, { status: 500 })
  }
}

// POST /api/gastos
export async function POST(req: NextRequest) {
  const { error, tenantId, isSuperAdmin } = await getSessionTenant()
  if (error) return error

  const body = await req.json()
  const parsed = expenseSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  const data = parsed.data
  const resolvedTenantId = !isSuperAdmin ? tenantId : null

  try {
    // Si se envió categoryName sin id, buscar/crear la categoría por nombre+tenant
    let categoryId: string | null = data.categoryId ?? null
    if (!categoryId && data.categoryName?.trim()) {
      const catName = data.categoryName.trim()
      const existing = await db.expenseCategory.findFirst({
        where: { name: catName, tenantId: resolvedTenantId },
      })
      if (existing) {
        categoryId = existing.id
      } else {
        const cat = await db.expenseCategory.create({
          data: { name: catName, tenantId: resolvedTenantId },
        })
        categoryId = cat.id
      }
    }

    const expense = await db.expense.create({
      data: {
        description: data.description,
        amount: data.amount,
        categoryId,
        notes: data.notes || null,
        tenantId: resolvedTenantId,
      },
      include: { category: true },
    })

    return NextResponse.json(expense, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Error al crear gasto" }, { status: 500 })
  }
}
