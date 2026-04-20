"use client"

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"

interface Props {
  label: string
  field: string
  sort: string
  dir: "asc" | "desc"
  onSort: (field: string) => void
  align?: "left" | "right" | "center"
}

export default function SortHeader({ label, field, sort, dir, onSort, align = "left" }: Props) {
  const active = sort === field
  return (
    <th className={`p-4 font-medium text-gray-400 text-${align}`}>
      <button
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1 hover:text-white transition-colors ${active ? "text-purple-300" : ""}`}
      >
        {label}
        {active ? (
          dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />
        ) : (
          <ArrowUpDown size={12} className="opacity-40" />
        )}
      </button>
    </th>
  )
}
