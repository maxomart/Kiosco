import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { z } from "zod"

const schema = z.object({
  name: z.string().min(1),
  barcode: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  costPrice: z.number().min(0),
  salePrice: z.number().min(0),
  stock: z.number().int().min(0).default(0),
  minStock: z.number().int().min(0).default(5),
  maxStock: z.number().int().optional().nullable(),
  description: z.string().optional().nullable(),
  image: z.string().optional().nullable(),
  soldByWeight: z.boolean().default(false),
  categoryId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
})

export async function GET(req: NextRequest) {
  const { error, tenantId, isSuperAdmin } = await getSessionTenant()
  if (error) return error
  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q") ?? ""
  const categoryId = searchParams.get("categoryId")
  const page = parseInt(searchParams.get("page") ?? "1")
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200)
  const lowStock = searchParams.get("lowStock") === "true"

  const where: any = { active: true, ...(tenantId ? { tenantId } : {}) }
  if (q) where.OR = [
    { name: { contains: q, mode: "insensitive" } },
    { barcode: { contains: q } },
    { sku: { contains: q, mode: "insensitive" } },
  ]
  if (categoryId) where.categoryId = categoryId

  try {
    const [products, total] = await Promise.all([
      db.product.findMany({ where, include: { category: { select: { id: true, name: true } }, supplier: { select: { id: true, name: true } } }, orderBy: { name: "asc" }, take: limit, skip: (page - 1) * limit }),
      db.product.count({ where }),
    ])

    const result = lowStock ? products.filter(p => p.stock <= p.minStock) : products
    return NextResponse.json({ products: result, total, page, totalPages: Math.ceil(total / limit) })
  } catch (err) {
    console.error("[GET /api/productos]", err)
    return NextResponse.json({ error: "Error al obtener productos" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { error, tenantId, session, isSuperAdmin } = await getSessionTenant()
  if (error || !session) return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  if (!["ADMIN", "OWNER", "SUPER_ADMIN"].includes(session.user.role ?? ""))
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const d = parsed.data
  const tid = tenantId!
  try {
    const product = await db.$transaction(async (tx) => {
      const p = await tx.product.create({ data: { ...d, tenantId: tid } })
      if (d.stock > 0) {
        await tx.stockMovement.create({ data: { productId: p.id, type: "PURCHASE", quantity: d.stock, stockBefore: 0, stockAfter: d.stock, reason: "Stock inicial", userId: session.user.id! } })
      }
      await tx.auditLog.create({ data: { userId: session.user.id!, action: "CREATE", entity: "Product", entityId: p.id, newValue: JSON.stringify(d) } })
      return p
    })
    return NextResponse.json({ product }, { status: 201 })
  } catch (err: any) {
    if (err?.code === "P2002") return NextResponse.json({ error: "Barcode o SKU ya existe" }, { status: 400 })
    return NextResponse.json({ error: "Error al crear" }, { status: 500 })
  }
}
