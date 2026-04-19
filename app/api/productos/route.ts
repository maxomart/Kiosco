import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { z } from "zod"
import { calcProfitPercent } from "@/lib/utils"

const productSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  barcode: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  costPrice: z.number().min(0),
  salePrice: z.number().min(0),
  profitPercent: z.number().optional(),
  stock: z.number().min(0).default(0),
  minStock: z.number().min(0).default(5),
  idealStock: z.number().min(0).default(20),
  unit: z.string().default("un"),
  taxRate: z.enum(["ZERO", "REDUCED", "STANDARD"]).default("STANDARD"),
  soldByWeight: z.boolean().default(false),
  hasExpiry: z.boolean().default(false),
  categoryId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  active: z.boolean().default(true),
})

// GET /api/productos - Buscar productos
export async function GET(req: NextRequest) {
  const { error, tenantId, isSuperAdmin } = await getSessionTenant()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q")
  const barcode = searchParams.get("barcode")
  const categoryId = searchParams.get("categoryId")
  const lowStock = searchParams.get("lowStock") === "true"
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 100)
  const page = parseInt(searchParams.get("page") ?? "1")

  const where: any = { active: true }

  // Filtrar por tenant (SUPER_ADMIN puede ver todo si no especifica tenantId)
  if (!isSuperAdmin) {
    where.tenantId = tenantId ?? undefined
  }

  if (barcode) {
    where.barcode = barcode
  } else if (q) {
    // PostgreSQL: usar mode insensitive para búsqueda case-insensitive
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { barcode: { contains: q } },
      { sku: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ]
  }

  if (categoryId) where.categoryId = categoryId

  const [products, total] = await Promise.all([
    db.product.findMany({
      where,
      include: { category: true, supplier: { select: { id: true, name: true } } },
      orderBy: q ? undefined : { name: "asc" },
      take: limit,
      skip: (page - 1) * limit,
    }),
    db.product.count({ where }),
  ])

  // Transformar para el POS (agregar campo categoryName)
  const transformed = products.map(p => ({
    ...p,
    categoryName: p.category?.name,
  }))

  return NextResponse.json({
    products: transformed,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  })
}

// POST /api/productos - Crear producto
export async function POST(req: NextRequest) {
  const { error, tenantId, session, isSuperAdmin } = await getSessionTenant()
  if (error) return error

  const body = await req.json()
  const parsed = productSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.errors }, { status: 400 })
  }

  const data = parsed.data
  const profitPercent = data.profitPercent ?? calcProfitPercent(data.costPrice, data.salePrice)

  try {
    const product = await db.product.create({
      data: {
        ...data,
        profitPercent,
        categoryId: data.categoryId || null,
        supplierId: data.supplierId || null,
        barcode: data.barcode || null,
        sku: data.sku || null,
        tenantId: tenantId ?? null,
      },
      include: { category: true, supplier: true },
    })

    // Registrar movimiento de stock inicial
    if (data.stock > 0) {
      await db.stockMovement.create({
        data: {
          productId: product.id,
          type: "INITIAL",
          quantity: data.stock,
          stockBefore: 0,
          stockAfter: data.stock,
          userId: session!.user.id!,
          reason: "Stock inicial",
        },
      })
    }

    // Auditoría
    await db.auditLog.create({
      data: {
        userId: session!.user.id!,
        action: "CREATE_PRODUCT",
        entity: "Product",
        entityId: product.id,
        newValue: JSON.stringify(product),
        tenantId: tenantId ?? null,
      },
    })

    return NextResponse.json({ product }, { status: 201 })
  } catch (err: any) {
    if (err.code === "P2002") {
      const field = err.meta?.target?.[0]
      return NextResponse.json(
        { error: `Ya existe un producto con ese ${field === "barcode" ? "código de barras" : "SKU"}` },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
