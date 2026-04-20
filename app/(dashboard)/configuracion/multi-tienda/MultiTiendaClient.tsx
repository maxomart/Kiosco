"use client"

import { useState } from "react"
import { Store, Mail, BellRing, Check } from "lucide-react"

export default function MultiTiendaClient() {
  const [notified, setNotified] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleNotify = async () => {
    setSubmitting(true)
    // No backend yet — just acknowledge locally. When the feature ships we
    // can swap this for a real /api/configuracion/multi-tienda/notify route
    // that records interest in a TenantConfig column.
    await new Promise((r) => setTimeout(r, 400))
    setNotified(true)
    setSubmitting(false)
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Store className="w-6 h-6 text-accent" />
          Multi-tienda
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Gestión de varias sucursales bajo una misma cuenta.
        </p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-2xl">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium mb-4">
          Próximamente
        </div>
        <h2 className="text-xl font-bold text-white mb-3">Estamos terminando esta función</h2>
        <p className="text-gray-300 text-sm leading-relaxed mb-4">
          Vamos a permitir que tengas varias sucursales bajo una misma cuenta, con stock
          independiente, reportes consolidados y permisos por tienda. Si necesitás esto ya,
          escribinos y te ayudamos a configurarlo manualmente mientras tanto.
        </p>

        <div className="bg-gray-800/50 rounded-lg p-4 mb-6 flex items-center gap-3">
          <Mail className="w-5 h-5 text-accent" />
          <a href="mailto:soporte@retailar.app" className="text-accent hover:underline text-sm font-medium">
            soporte@retailar.app
          </a>
        </div>

        <button
          onClick={handleNotify}
          disabled={notified || submitting}
          className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-accent-foreground font-medium px-5 py-2.5 rounded-lg shadow-lg shadow-accent/20 disabled:opacity-60"
        >
          {notified ? (
            <>
              <Check className="w-4 h-4" />
              Te avisamos cuando esté listo
            </>
          ) : (
            <>
              <BellRing className="w-4 h-4" />
              {submitting ? "Anotándote..." : "Notificarme cuando esté listo"}
            </>
          )}
        </button>
      </div>

      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 max-w-2xl">
        <h3 className="text-white font-medium text-sm mb-2">¿Qué va a incluir?</h3>
        <ul className="text-sm text-gray-400 space-y-1.5">
          <li>· Stock independiente por sucursal con transferencias entre tiendas</li>
          <li>· Reportes consolidados (todas las sucursales) o por tienda individual</li>
          <li>· Usuarios asignados a una o varias sucursales</li>
          <li>· Caja por sucursal con cierres independientes</li>
          <li>· Catálogo compartido o personalizado por tienda</li>
        </ul>
      </div>
    </div>
  )
}
