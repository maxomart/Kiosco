/**
 * Mapea un nombre de categoría (o cualquier string) a una paleta de color
 * determinística. Usado en las cards del POS sin foto: en lugar de mostrar
 * una letra gigante de fallback, el card usa el color de la categoría con
 * el nombre del producto centrado.
 *
 * La función es estable: la misma categoría siempre devuelve el mismo color,
 * así "Bebidas" se ve igual cada vez aunque el orden de productos cambie.
 */

const PALETTE = [
  // Cada entrada: gradiente + color de texto que contraste sobre el gradiente
  { bg: "bg-gradient-to-br from-orange-500/40 to-orange-700/30 border-orange-600/30", text: "text-orange-50" },
  { bg: "bg-gradient-to-br from-sky-500/40 to-sky-700/30 border-sky-600/30", text: "text-sky-50" },
  { bg: "bg-gradient-to-br from-emerald-500/40 to-emerald-700/30 border-emerald-600/30", text: "text-emerald-50" },
  { bg: "bg-gradient-to-br from-purple-500/40 to-purple-700/30 border-purple-600/30", text: "text-purple-50" },
  { bg: "bg-gradient-to-br from-pink-500/40 to-pink-700/30 border-pink-600/30", text: "text-pink-50" },
  { bg: "bg-gradient-to-br from-amber-500/40 to-amber-700/30 border-amber-600/30", text: "text-amber-50" },
  { bg: "bg-gradient-to-br from-red-500/40 to-red-700/30 border-red-600/30", text: "text-red-50" },
  { bg: "bg-gradient-to-br from-cyan-500/40 to-cyan-700/30 border-cyan-600/30", text: "text-cyan-50" },
  { bg: "bg-gradient-to-br from-rose-500/40 to-rose-700/30 border-rose-600/30", text: "text-rose-50" },
  { bg: "bg-gradient-to-br from-teal-500/40 to-teal-700/30 border-teal-600/30", text: "text-teal-50" },
  { bg: "bg-gradient-to-br from-indigo-500/40 to-indigo-700/30 border-indigo-600/30", text: "text-indigo-50" },
  { bg: "bg-gradient-to-br from-lime-500/40 to-lime-700/30 border-lime-600/30", text: "text-lime-50" },
] as const

const FALLBACK = {
  bg: "bg-gradient-to-br from-gray-700/40 to-gray-900/30 border-gray-700",
  text: "text-gray-100",
}

export function categoryColor(name: string | null | undefined): { bg: string; text: string } {
  if (!name) return FALLBACK
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  return PALETTE[hash % PALETTE.length]
}
