import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export default auth((req) => {
  const { nextUrl, auth: session } = req as any
  const isLoggedIn = !!session

  const isAuthRoute = nextUrl.pathname.startsWith("/login") ||
    nextUrl.pathname.startsWith("/signup") ||
    nextUrl.pathname.startsWith("/forgot-password")
  const isDashboard = nextUrl.pathname.startsWith("/pos") ||
    nextUrl.pathname.startsWith("/inventario") ||
    nextUrl.pathname.startsWith("/ventas") ||
    nextUrl.pathname.startsWith("/reportes") ||
    nextUrl.pathname.startsWith("/clientes") ||
    nextUrl.pathname.startsWith("/caja") ||
    nextUrl.pathname.startsWith("/gastos") ||
    nextUrl.pathname.startsWith("/cargas") ||
    nextUrl.pathname.startsWith("/configuracion")
  const isAdminRoute = nextUrl.pathname.startsWith("/admin")

  // Redirigir usuarios logueados lejos del login
  if (isAuthRoute && isLoggedIn) {
    return NextResponse.redirect(new URL("/", nextUrl))
  }

  // Proteger rutas dashboard
  if (isDashboard && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", nextUrl))
  }

  // Proteger rutas admin
  if (isAdminRoute && (!isLoggedIn || session?.user?.role !== "SUPER_ADMIN")) {
    return NextResponse.redirect(new URL("/login", nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|manifest.json|icons).*)"],
}
