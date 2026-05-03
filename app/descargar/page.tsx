"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Download, Smartphone, ShieldCheck, ArrowDown, AlertCircle, Sparkles, Apple } from "lucide-react"

interface AppInfo {
  available: boolean
  version?: string
  url?: string
  sizeMB?: number
  lastModified?: string
}

/**
 * Página pública de descarga de la app Android.
 * No requiere auth. Detecta dispositivo y muestra botón directo en Android,
 * QR + instrucciones en desktop/iOS.
 */
export default function DescargarPage() {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [device, setDevice] = useState<"android" | "ios" | "desktop">("desktop")
  const [origin, setOrigin] = useState("")

  useEffect(() => {
    setOrigin(window.location.origin)
    const ua = navigator.userAgent.toLowerCase()
    if (/android/.test(ua)) setDevice("android")
    else if (/iphone|ipad|ipod/.test(ua)) setDevice("ios")
    else setDevice("desktop")

    fetch("/api/app/latest", { cache: "no-store" })
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setInfo({ available: false }))
  }, [])

  const apkUrl = info?.url ? `${origin}${info.url}` : ""
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(`${origin}/descargar`)}&size=300x300&color=ffffff&bgcolor=000000`

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-950 to-black text-white">
      {/* Header */}
      <header className="border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-white font-bold text-lg">
            <span className="bg-gradient-to-br from-blue-400 to-violet-400 bg-clip-text text-transparent">Orvex</span>
          </Link>
          <Link
            href="/login"
            className="text-sm text-gray-400 hover:text-white"
          >
            Iniciá sesión →
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium mb-6">
            <Sparkles size={12} />
            Funciona offline · Lector de códigos · Instalación directa
          </div>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight mb-4">
            Orvex en tu Android
          </h1>
          <p className="text-lg text-gray-400 max-w-xl mx-auto">
            Descargá la app del kiosquero. POS, inventario y caja todo desde tu celular.
          </p>
        </div>

        {/* Estado / no disponible aún */}
        {info && !info.available && (
          <div className="max-w-md mx-auto bg-amber-950/30 border border-amber-700/40 rounded-2xl p-6 text-center">
            <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
            <h2 className="text-white font-bold text-lg mb-1">Próximamente</h2>
            <p className="text-sm text-amber-200/80 mb-4">
              Estamos preparando la app. Mientras tanto, agregá Orvex como app web desde tu celu.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm text-amber-200 underline"
            >
              Iniciá sesión y "Agregar a inicio" desde el menú del navegador
            </Link>
          </div>
        )}

        {/* Disponible */}
        {info?.available && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card Android (móvil o desktop) */}
            <div className="relative bg-gradient-to-br from-emerald-500/10 via-gray-900 to-gray-900 border border-emerald-700/30 rounded-3xl p-6 sm:p-8">
              <div className="absolute -top-12 -right-12 w-40 h-40 bg-emerald-500/20 blur-3xl rounded-full pointer-events-none" />
              <div className="relative">
                <Smartphone className="w-10 h-10 text-emerald-400 mb-4" />
                <h2 className="text-2xl font-bold text-white mb-1">Android</h2>
                <p className="text-sm text-gray-400 mb-6">
                  v{info.version} · {info.sizeMB} MB
                  {info.lastModified && (
                    <> · Actualizado {new Date(info.lastModified).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}</>
                  )}
                </p>

                {device === "android" ? (
                  <a
                    href={info.url!}
                    download
                    className="w-full inline-flex items-center justify-center gap-2 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-base transition-all shadow-lg shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.99]"
                  >
                    <Download size={18} />
                    Descargar APK ({info.sizeMB} MB)
                  </a>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-black/40 border border-gray-800 rounded-2xl p-4 flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrUrl}
                        alt="QR para descargar Orvex"
                        width={200}
                        height={200}
                        className="rounded-lg"
                      />
                    </div>
                    <p className="text-xs text-gray-400 text-center">
                      Escaneá el QR con tu celular Android
                    </p>
                    <a
                      href={info.url!}
                      download
                      className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium border border-gray-700"
                    >
                      <ArrowDown size={14} />
                      O descargá igual el APK ({info.sizeMB} MB)
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Card iOS / web */}
            <div className="bg-gray-900/60 border border-gray-800 rounded-3xl p-6 sm:p-8">
              <Apple className="w-10 h-10 text-gray-400 mb-4" />
              <h2 className="text-2xl font-bold text-white mb-1">iPhone / iPad</h2>
              <p className="text-sm text-gray-400 mb-6">
                Apple no permite apps fuera del App Store, pero podés instalar Orvex como app web — funciona casi igual.
              </p>
              <ol className="space-y-3 text-sm">
                <Step n={1}>Abrí <strong className="text-white">cobraorvex.com</strong> en Safari</Step>
                <Step n={2}>Tocá el botón de compartir <span className="inline-block">⬆️</span></Step>
                <Step n={3}>Bajá hasta <strong className="text-white">"Agregar a pantalla de inicio"</strong></Step>
                <Step n={4}>Listo — tenés Orvex como ícono en el celu</Step>
              </ol>
            </div>
          </div>
        )}

        {/* Cómo instalar el APK (sólo si hay APK disponible) */}
        {info?.available && (
          <section className="mt-12 bg-gray-900/40 border border-gray-800 rounded-3xl p-6 sm:p-8">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Cómo instalar el APK en tu Android
            </h2>
            <p className="text-sm text-gray-400 mb-6">
              Como no descargás desde Play Store, Android te va a pedir permitir "orígenes desconocidos" la primera vez. Es 100% normal y seguro — el APK está firmado por Orvex.
            </p>
            <ol className="space-y-4">
              <InstallStep n={1} title="Descargá el APK">
                Tocá el botón verde de arriba o escaneá el QR. Se baja un archivo <code className="bg-black/40 px-1.5 py-0.5 rounded text-emerald-300 text-xs">orvex.apk</code>.
              </InstallStep>
              <InstallStep n={2} title="Abrí el archivo descargado">
                En la barra de notificaciones aparece "Descarga completa". Tocala. O abrí <strong>Archivos → Descargas</strong>.
              </InstallStep>
              <InstallStep n={3} title="Permití instalar">
                La primera vez Android dice "Por seguridad, tu celular no permite instalar apps de origen desconocido". Tocá <strong>Configuración</strong> y activá el permiso para tu navegador (Chrome / Samsung Internet / lo que uses).
              </InstallStep>
              <InstallStep n={4} title="Instalá">
                Volvé al APK y tocá <strong>Instalar</strong>. En 10 segundos te aparece el ícono de Orvex en tu cajón de apps.
              </InstallStep>
              <InstallStep n={5} title="Listo">
                Abrí Orvex, iniciá sesión y andá vendiendo.
              </InstallStep>
            </ol>
          </section>
        )}

        {/* Garantías */}
        <section className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card icon={<ShieldCheck className="w-5 h-5 text-emerald-400" />} title="100% seguro">
            APK firmado digitalmente por Orvex. La firma se verifica al instalar.
          </Card>
          <Card icon={<Smartphone className="w-5 h-5 text-sky-400" />} title="Funciona offline">
            Vendé sin internet en el POS — las ventas se sincronizan al volver la conexión.
          </Card>
          <Card icon={<Sparkles className="w-5 h-5 text-purple-400" />} title="Sin cargo extra">
            La app está incluida en tu suscripción. Sin in-app purchases.
          </Card>
        </section>

        <footer className="mt-16 text-center text-xs text-gray-600">
          © {new Date().getFullYear()} Orvex · <Link href="/" className="hover:text-gray-400">Volver al inicio</Link>
        </footer>
      </div>
    </main>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-800 border border-gray-700 text-gray-300 text-xs font-bold flex items-center justify-center">
        {n}
      </span>
      <span className="text-gray-300">{children}</span>
    </li>
  )
}

function InstallStep({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-sm font-bold flex items-center justify-center">
        {n}
      </span>
      <div>
        <p className="text-white font-semibold mb-0.5">{title}</p>
        <p className="text-sm text-gray-400">{children}</p>
      </div>
    </li>
  )
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-5">
      <div className="mb-2">{icon}</div>
      <h3 className="text-white font-semibold mb-1">{title}</h3>
      <p className="text-xs text-gray-400 leading-relaxed">{children}</p>
    </div>
  )
}
