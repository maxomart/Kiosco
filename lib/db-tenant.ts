/**
 * Cliente Prisma scoped a un tenant. Inyecta `tenantId` en los WHERE de las
 * queries más sensibles (productos, ventas, clientes, etc.) así una query
 * que se olvide de filtrar no puede leer/escribir data de otros kioscos.
 *
 * USO:
 *   import { tenantDb } from "@/lib/db-tenant"
 *
 *   const products = await tenantDb(tenantId).product.findMany({
 *     where: { active: true }   // → automáticamente { active: true, tenantId }
 *   })
 *
 * QUÉ HACE:
 *   - findMany / findFirst / findUnique / count / aggregate / groupBy →
 *     inyecta tenantId en el where (merge con AND)
 *   - create / createMany → inyecta tenantId en data si no estaba
 *   - update / updateMany / delete / deleteMany → inyecta tenantId en where
 *
 * QUÉ NO HACE:
 *   - findUnique({ where: { id } }) sigue funcionando como antes para PKs.
 *     Prisma rechaza inyectar tenantId en where con PK único, así que si
 *     necesitás scope, usá findFirst({ where: { id, ... } }).
 *
 * Compatible con queries existentes que ya pasaban tenantId — el merge
 * deja el explícito y agrega el implícito, no rompe nada.
 */

import { db } from "./db"
import type { Prisma } from "@prisma/client"

// Modelos que tienen `tenantId` y deben filtrarse. Si agregás un modelo
// nuevo con tenantId al schema, agregalo acá también.
const TENANT_MODELS = [
  "product",
  "category",
  "supplier",
  "sale",
  "saleItem",
  "stockMovement",
  "client",
  "loyaltyTransaction",
  "cashSession",
  "cashMovement",
  "expense",
  "recharge",
  "auditLog",
  "promoCode",
  "promoRedemption",
  "combo",
  "productLoss",
  "supportTicket",
  "clientPayment",
] as const

type TenantModel = (typeof TENANT_MODELS)[number]

/**
 * Devuelve un proxy de `db` con tenantId aplicado a los modelos sensibles.
 * Las llamadas que NO son sobre tenant-models (ej. user, subscription)
 * pasan directo sin modificar.
 */
export function tenantDb(tenantId: string) {
  return db.$extends({
    name: "tenant-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model) return query(args)
          const modelKey = model.charAt(0).toLowerCase() + model.slice(1)
          if (!TENANT_MODELS.includes(modelKey as TenantModel)) {
            return query(args)
          }

          // Operaciones de lectura/update/delete con `where`
          if (
            operation === "findMany" ||
            operation === "findFirst" ||
            operation === "findFirstOrThrow" ||
            operation === "count" ||
            operation === "aggregate" ||
            operation === "groupBy" ||
            operation === "updateMany" ||
            operation === "deleteMany"
          ) {
            const a = (args ?? {}) as { where?: Prisma.JsonObject }
            a.where = { ...(a.where ?? {}), tenantId }
            return query(a as typeof args)
          }

          // findUnique / update / delete: si el where tiene tenantId
          // compuesto, lo respetamos. Si sólo trae PK (id), no lo tocamos
          // — Prisma rechaza el mix. Para esos casos el caller debe usar
          // findFirst en su lugar.
          if (
            operation === "update" ||
            operation === "delete"
          ) {
            const a = args as { where?: Prisma.JsonObject }
            if (a?.where && !("id" in a.where) && !("AND" in a.where)) {
              a.where = { ...a.where, tenantId }
            }
            return query(args)
          }

          // create / createMany: inyectar tenantId en data si falta
          if (operation === "create") {
            const a = args as { data?: Prisma.JsonObject }
            if (a?.data && !("tenantId" in a.data) && !("tenant" in a.data)) {
              a.data = { ...a.data, tenantId }
            }
            return query(args)
          }
          if (operation === "createMany") {
            const a = args as { data?: Prisma.JsonObject | Prisma.JsonObject[] }
            if (Array.isArray(a?.data)) {
              a.data = a.data.map((d) =>
                "tenantId" in d ? d : { ...d, tenantId }
              )
            } else if (a?.data && !("tenantId" in a.data)) {
              a.data = { ...a.data, tenantId }
            }
            return query(args)
          }

          return query(args)
        },
      },
    },
  })
}

/** Versión typesafe del cliente tenant-scoped */
export type TenantDb = ReturnType<typeof tenantDb>
