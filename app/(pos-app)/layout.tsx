/**
 * Layout para el POS standalone offline-first (/pos-app).
 *
 * NO usa server components — todo lo que pase debe poder rendererearse
 * sin DB ni internet. La auth se chequea en el cliente leyendo
 * /api/auth/session (cacheado por el SW). Si no hay sesión, redirige a
 * /login (lo cual sí requiere internet — es OK porque para "iniciar
 * sesión por primera vez" obviamente necesitás conexión).
 */

import { Metadata } from "next"

export const metadata: Metadata = {
  title: "POS Orvex",
  robots: { index: false, follow: false },
}

// Sin server-side fetch — la página es renderizable offline.
export default function PosAppLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-gray-950 text-white">{children}</div>
}
