import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"
import { z } from "zod"

const productImportSchema = z.object({
  name: z.string().min(1),
  barcode: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  salePrice: z.coerce.number().min(0),
  costPrice: z.coerce.number().min(0).default(0),
  stock: z.coerce.number().default(0),
  minStock: z.coerce.number().default(5),
  unit: z.string().default("un"),
  categoryName: z.string().optional().nullable(),
})

// POST /api/productos/importar
// Acepta un array de productos para importar en masa
export async function POST(req: NextRequest) {
  const { error, tenantId, isSuperAdmin } = await getSessionTenant()
  if (error) return error

  const body = await req.json()

  if (!Array.isArray(body.productos)) {
    return NextResponse.json({ error: "Se espera un array 'productos'" }, { status: 400 })
  }

  const resolvedTenantId = !isSuperAdmin ? tenantId : null
  const results = { created: 0, updated: 0, errors: [] as string[] }

  for (let i = 0; i < body.productos.length; i++) {
    const row = body.productos[i]
    const parsed = productImportSchema.safeParse(row)

    if (!parsed.success) {
      results.errors.push(`Fila ${i + 1} (${row.name ?? "sin nombre"}): ${parsed.error.errors[0].message}`)
      continue
    }

    const data = parsed.data

    // Buscar o crear categoría si se especificó (por nombre+tenant)
    let categoryId: string | null = null
    if (data.categoryName?.trim()) {
      const catName = data.categoryName.trim()
      const existing = await db.category.findFirst({
        where: { name: catName, tenantId: resolvedTenantId },
      })
      if (existing) {
        categoryId = existing.id
      } else {
        const cat = await db.category.create({
          data: { name: catName, tenantId: resolvedTenantId },
        })
        categoryId = cat.id
      }
    }

    const profitPercent =
      data.costPrice > 0
        ? ((data.salePrice - data.costPrice) / data.costPrice) * 100
        : 0

    // Upsert por barcode+tenant si tiene, sino crear siempre
    if (data.barcode?.trim()) {
      const barcode = data.barcode.trim()
      const existing = await db.product.findFirst({
        where: { barcode, tenantId: resolvedTenantId },
      })
      if (existing) {
        await db.product.update({
          where: { id: existing.id },
          data: {
            name: data.name,
            salePrice: data.salePrice,
            costPrice: data.costPrice,
            stock: data.stock,
            minStock: data.minStock,
            unit: data.unit,
            profitPercent,
            categoryId,
          },
        })
        results.updated++
      } else {
        await db.product.create({
          data: {
            name: data.name,
            barcode,
            sku: data.sku?.trim() || null,
            salePrice: data.salePrice,
            costPrice: data.costPrice,
            stock: data.stock,
            minStock: data.minStock,
            unit: data.unit,
            profitPercent,
            categoryId,
            tenantId: resolvedTenantId,
          },
        })
        results.created++
      }
    } else {
      await db.product.create({
        data: {
          name: data.name,
          sku: data.sku?.trim() || null,
          salePrice: data.salePrice,
          costPrice: data.costPrice,
          stock: data.stock,
          minStock: data.minStock,
          unit: data.unit,
          profitPercent,
          categoryId,
          tenantId: resolvedTenantId,
        },
      })
      results.created++
    }
  }

  return NextResponse.json(results, { status: 200 })
}
