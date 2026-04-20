import Link from "next/link"
import { ArrowLeft, Receipt } from "lucide-react"

export default function VentaDetallePage({ params }: { params: { id: string } }) {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link
        href="/ventas"
        className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors mb-6"
      >
        <ArrowLeft size={14} /> Volver a ventas
      </Link>

      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-12 text-center">
        <div className="w-14 h-14 rounded-full bg-purple-900/30 flex items-center justify-center mx-auto mb-4">
          <Receipt className="w-6 h-6 text-purple-400" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Detalle de venta</h1>
        <p className="text-gray-400 text-sm">
          La vista detallada de la venta <span className="font-mono text-purple-300">#{params.id}</span> estará disponible pronto.
        </p>
        <p className="text-gray-500 text-xs mt-2">
          Mientras tanto, expandí la fila desde el listado de ventas para ver sus items.
        </p>
      </div>
    </div>
  )
}
