// Centralized role-based + plan-based permissions.
//
// USAGE:
//   import { can, requiresPlan } from "@/lib/permissions"
//   if (can(role, "products:create")) { ... }
//   if (requiresPlan(plan, "feature:reports")) { ... show paywall ... }

import type { Plan } from "@/lib/utils"

export type Role = "SUPER_ADMIN" | "OWNER" | "ADMIN" | "CASHIER"

// Granular permissions. Add more as the app grows.
export type Permission =
  // Inventario
  | "products:read"
  | "products:create"
  | "products:edit"
  | "products:delete"
  | "products:import"
  | "products:export"
  | "categories:manage"
  | "suppliers:manage"
  // POS / Ventas
  | "sales:create"
  | "sales:read"
  | "sales:cancel"
  | "sales:discount"
  // Caja
  | "cash:open"
  | "cash:close"
  | "cash:read"
  // Gastos / Cargas
  | "expenses:read"
  | "expenses:create"
  | "expenses:delete"
  | "recharges:read"
  | "recharges:create"
  | "recharges:delete"
  // Clientes
  | "clients:read"
  | "clients:create"
  | "clients:edit"
  | "clients:delete"
  // Reportes
  | "reports:read"
  | "reports:export"
  // Configuración
  | "settings:read"
  | "settings:edit"
  | "users:manage"
  | "billing:manage"
  | "theme:edit"

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: [], // SUPER_ADMIN bypasses all checks via `can()`
  OWNER: [
    "products:read", "products:create", "products:edit", "products:delete", "products:import", "products:export",
    "categories:manage", "suppliers:manage",
    "sales:create", "sales:read", "sales:cancel", "sales:discount",
    "cash:open", "cash:close", "cash:read",
    "expenses:read", "expenses:create", "expenses:delete",
    "recharges:read", "recharges:create", "recharges:delete",
    "clients:read", "clients:create", "clients:edit", "clients:delete",
    "reports:read", "reports:export",
    "settings:read", "settings:edit",
    "users:manage", "billing:manage", "theme:edit",
  ],
  ADMIN: [
    "products:read", "products:create", "products:edit", "products:delete", "products:import", "products:export",
    "categories:manage", "suppliers:manage",
    "sales:create", "sales:read", "sales:cancel", "sales:discount",
    "cash:open", "cash:close", "cash:read",
    "expenses:read", "expenses:create", "expenses:delete",
    "recharges:read", "recharges:create", "recharges:delete",
    "clients:read", "clients:create", "clients:edit", "clients:delete",
    "reports:read", "reports:export",
    "settings:read", "settings:edit",
    // ADMIN cannot manage users (only OWNER can) nor billing nor theme
  ],
  CASHIER: [
    // Cashiers can sell, see inventory, see clients, manage cash — nothing else.
    "products:read",
    "sales:create", "sales:read",
    "cash:open", "cash:close", "cash:read",
    "clients:read", "clients:create",
  ],
}

/** True if the role has the given permission. SUPER_ADMIN bypasses everything. */
export function can(role: string | undefined | null, permission: Permission): boolean {
  if (!role) return false
  if (role === "SUPER_ADMIN") return true
  const r = role as Role
  return ROLE_PERMISSIONS[r]?.includes(permission) ?? false
}

/** True if any of the given permissions is held. */
export function canAny(role: string | undefined | null, perms: Permission[]): boolean {
  return perms.some((p) => can(role, p))
}

// =============================================================================
// Plan gating — features locked behind paid plans
// =============================================================================

export type PlanFeature =
  | "feature:reports"        // Detailed analytics & charts
  | "feature:expenses"        // Expense tracking
  | "feature:recharges"       // Supplier recharges
  | "feature:multiple_users"  // Multi-user (any user beyond the owner)
  | "feature:api"             // API access
  | "feature:csv_import"      // Bulk CSV import
  | "feature:csv_export"      // CSV export
  | "feature:loyalty"         // Loyalty points
  | "feature:theme_picker"    // Custom brand color
  | "feature:advanced_pos"    // POS discounts, multiple payment methods, etc.

type PlanGate = Record<PlanFeature, Plan[]>

// Which plans UNLOCK each feature. If a plan is in the list, it has access.
const PLAN_FEATURES: PlanGate = {
  "feature:reports":         ["STARTER", "PROFESSIONAL", "BUSINESS", "ENTERPRISE"],
  "feature:expenses":        ["STARTER", "PROFESSIONAL", "BUSINESS", "ENTERPRISE"],
  "feature:recharges":       ["STARTER", "PROFESSIONAL", "BUSINESS", "ENTERPRISE"],
  "feature:multiple_users":  ["STARTER", "PROFESSIONAL", "BUSINESS", "ENTERPRISE"],
  "feature:api":             ["BUSINESS", "ENTERPRISE"],
  "feature:csv_import":      ["STARTER", "PROFESSIONAL", "BUSINESS", "ENTERPRISE"],
  "feature:csv_export":      ["FREE", "STARTER", "PROFESSIONAL", "BUSINESS", "ENTERPRISE"],
  "feature:loyalty":         ["PROFESSIONAL", "BUSINESS", "ENTERPRISE"],
  "feature:theme_picker":    ["FREE", "STARTER", "PROFESSIONAL", "BUSINESS", "ENTERPRISE"],
  "feature:advanced_pos":    ["FREE", "STARTER", "PROFESSIONAL", "BUSINESS", "ENTERPRISE"],
}

/** True if the plan unlocks the feature. */
export function hasFeature(plan: Plan | undefined | null, feature: PlanFeature): boolean {
  if (!plan) return false
  return PLAN_FEATURES[feature].includes(plan)
}

/** Returns the cheapest plan that unlocks the feature (for upsell messaging). */
export function minimumPlanFor(feature: PlanFeature): Plan {
  return PLAN_FEATURES[feature][0] as Plan
}

/** True if the feature is gated for this plan (i.e., should show paywall). */
export function requiresPlan(plan: Plan | undefined | null, feature: PlanFeature): boolean {
  return !hasFeature(plan, feature)
}
