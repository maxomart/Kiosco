import NextAuth from "next-auth"
import { NextResponse } from "next/server"
import { authConfig } from "@/lib/auth.config"

const { auth } = NextAuth(authConfig)

export const proxy = auth((req) => {
  const { nextUrl } = req
  const session = (req as any).auth
  const isLoggedIn = !!session
  const role = session?.user?.role
  const { pathname } = nextUrl

  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/forgot-password")

  const isDashboard =
    pathname.startsWith("/pos") ||
    pathname.startsWith("/inventario") ||
    pathname.startsWith("/ventas") ||
    pathname.startsWith("/reportes") ||
    pathname.startsWith("/clientes") ||
    pathname.startsWith("/caja") ||
    pathname.startsWith("/gastos") ||
    pathname.startsWith("/cargas") ||
    pathname.startsWith("/configuracion") ||
    pathname.startsWith("/inicio")

  const isAdminRoute = pathname.startsWith("/admin")

  // Logged-in user on auth pages → send them to their home
  if (isAuthRoute && isLoggedIn) {
    const target = role === "SUPER_ADMIN" ? "/admin" : "/inicio"
    return NextResponse.redirect(new URL(target, nextUrl))
  }

  // Protect dashboard routes
  if (isDashboard && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", nextUrl))
  }

  // Protect admin routes
  if (isAdminRoute && (!isLoggedIn || role !== "SUPER_ADMIN")) {
    return NextResponse.redirect(new URL("/login", nextUrl))
  }

  return NextResponse.next()
}) as any

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon\\.ico|manifest\\.json|icons).*)"],
}
