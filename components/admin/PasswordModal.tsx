"use client"

import { Copy } from "lucide-react"
import toast from "react-hot-toast"

interface Props {
  email: string
  password: string
  onClose: () => void
}

export default function PasswordModal({ email, password, onClose }: Props) {
  const copy = () => {
    navigator.clipboard.writeText(password)
    toast.success("Contraseña copiada")
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 max-w-md w-full">
        <h3 className="text-white font-semibold text-lg mb-3">Contraseña nueva generada</h3>
        <p className="text-gray-400 text-sm mb-4">
          Compartí esta contraseña de forma segura con el usuario. No podrás verla otra vez.
        </p>
        <div className="bg-gray-800 rounded-lg p-3 mb-3">
          <p className="text-xs text-gray-500 mb-1">Email</p>
          <p className="text-white font-mono text-sm">{email}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-3 mb-4 flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 mb-1">Contraseña</p>
            <p className="text-white font-mono text-sm truncate">{password}</p>
          </div>
          <button
            onClick={copy}
            className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors flex-shrink-0"
          >
            <Copy size={16} />
          </button>
        </div>
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold transition-colors"
        >
          Listo
        </button>
      </div>
    </div>
  )
}
