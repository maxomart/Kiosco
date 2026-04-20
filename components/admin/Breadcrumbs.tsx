"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"

interface Crumb {
  label: string
  href?: string
}

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="flex items-center gap-1 text-sm text-gray-500">
      {items.map((c, i) => (
        <span key={i} className="flex items-center gap-1">
          {c.href ? (
            <Link href={c.href} className="hover:text-purple-300 transition-colors">
              {c.label}
            </Link>
          ) : (
            <span className="text-gray-300">{c.label}</span>
          )}
          {i < items.length - 1 && <ChevronRight size={14} className="text-gray-600" />}
        </span>
      ))}
    </nav>
  )
}
