import { PrismaClient, Prisma } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof makeClient> | undefined
}

const toNum = (v: Prisma.Decimal | number | null | undefined): number => {
  if (v === null || v === undefined) return 0
  if (typeof v === "number") return v
  return Number(v)
}
const toNumOrNull = (v: Prisma.Decimal | number | null | undefined): number | null => {
  if (v === null || v === undefined) return null
  if (typeof v === "number") return v
  return Number(v)
}

function makeClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  }).$extends({
    result: {
      product: {
        stock: {
          needs: { stock: true } as { stock: true },
          compute(p: { stock: Prisma.Decimal | number }) { return toNum(p.stock) },
        },
        minStock: {
          needs: { minStock: true } as { minStock: true },
          compute(p: { minStock: Prisma.Decimal | number }) { return toNum(p.minStock) },
        },
        maxStock: {
          needs: { maxStock: true } as { maxStock: true },
          compute(p: { maxStock: Prisma.Decimal | number | null }) { return toNumOrNull(p.maxStock) },
        },
      },
      saleItem: {
        quantity: {
          needs: { quantity: true } as { quantity: true },
          compute(s: { quantity: Prisma.Decimal | number }) { return toNum(s.quantity) },
        },
      },
      stockMovement: {
        quantity: {
          needs: { quantity: true } as { quantity: true },
          compute(s: { quantity: Prisma.Decimal | number }) { return toNum(s.quantity) },
        },
        stockBefore: {
          needs: { stockBefore: true } as { stockBefore: true },
          compute(s: { stockBefore: Prisma.Decimal | number }) { return toNum(s.stockBefore) },
        },
        stockAfter: {
          needs: { stockAfter: true } as { stockAfter: true },
          compute(s: { stockAfter: Prisma.Decimal | number }) { return toNum(s.stockAfter) },
        },
      },
      productLoss: {
        quantity: {
          needs: { quantity: true } as { quantity: true },
          compute(s: { quantity: Prisma.Decimal | number }) { return toNum(s.quantity) },
        },
      },
    },
  })
}

export const db = globalForPrisma.prisma ?? makeClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db
