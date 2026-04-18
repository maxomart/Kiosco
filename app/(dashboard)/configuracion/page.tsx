"use client"

import { useEffect, useState } from "react"
import { Settings, Save, CheckCircle, AlertCircle } from "lucide-react"
import toast from "react-hot-toast"

interface ConfigField {
  key: string
  label: string
  description?: string
  placeholder?: string
  type?: "text" | "textarea"
}

const CONFIG_FIELDS: ConfigField[] = [
  {
    key: "business_name",
    label: "Nombre del negocio",
    description: "Aparece en el encabezado del ticket",
    placeholder: "Ej: Kiosco El Pibe",
  },
  {
    key: "business_address",
    label: "Dirección",
    description: "Dirección completa del local",
    placeholder: "Ej: Av. Corrientes 1234, CABA",
  },
  {
    key: "business_phone",
    label: "Teléfono",
    description: "Teléfono de contacto",
    placeholder: "Ej: 011-4567-8901",
  },
  {
    key: "business_cuit",
    label: "CUIT",
    description: "CUIT del negocio para facturación",
    placeholder: "Ej: 20-12345678-9",
  },
  {
    key: "ticket_footer",
    label: "Pie del ticket",
    description: "Mensaje que aparece al final de cada ticket",
    placeholder: "Ej: ¡Gracias por su compra! Vuelva pronto.",
    type: "textarea",
  },
]

export default function ConfiguracionPage() {
  const [config, setConfig] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch("/api/configuracion")
      .then((r) => r.json())
      .then((data) => {
        const map: Record<string, string> = {}
        if (Array.isArray(data)) {
          data.forEach((item: { key: string; value: string }) => {
            map[item.key] = item.value
          })
        }
        setConfig(map)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleChange = (key: string, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const r = await fetch("/api/configuracion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          Object.entries(config).map(([key, value]) => ({ key, value }))
        ),
      })
      if (r.ok) {
        toast.success("Configuración guardada")
        setSaved(true)
      } else {
        const err = await r.json()
        toast.error(err.error ?? "Error al guardar la configuración")
      }
    } catch {
      toast.error("Error de conexión")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Configuración</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">Datos del negocio y preferencias</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl transition text-sm font-bold"
        >
          {saved ? <CheckCircle size={16} /> : <Save size={16} />}
          {saving ? "Guardando..." : saved ? "Guardado" : "Guardar"}
        </button>
      </div>

      {/* Business config section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden mb-6">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
            <Settings size={16} className="text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="font-bold text-gray-800 dark:text-white">Información del negocio</h2>
        </div>

        <div className="p-6 space-y-5">
          {CONFIG_FIELDS.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">
                {field.label}
              </label>
              {field.description && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">{field.description}</p>
              )}
              {field.type === "textarea" ? (
                <textarea
                  rows={3}
                  value={config[field.key] ?? ""}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:border-blue-500 dark:focus:border-blue-400 transition text-sm dark:text-white placeholder-gray-400 dark:placeholder-gray-500 resize-none"
                />
              ) : (
                <input
                  type="text"
                  value={config[field.key] ?? ""}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:border-blue-500 dark:focus:border-blue-400 transition text-sm dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Info note */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-700/50">
        <AlertCircle size={16} className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-blue-700 dark:text-blue-300">
          Los cambios en la configuración se reflejan en los nuevos tickets generados.
          Los tickets anteriores no serán modificados.
        </p>
      </div>
    </div>
  )
}
