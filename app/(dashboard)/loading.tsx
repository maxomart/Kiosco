import { Loader2 } from "lucide-react"

export default function DashboardLoading() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-gray-400">
        <Loader2 size={32} className="animate-spin text-purple-500" aria-hidden="true" />
        <p className="text-sm">Cargando…</p>
      </div>
    </div>
  )
}
