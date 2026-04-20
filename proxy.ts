import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const { pathname } = req.nextUrl
  const isLoggedIn = !!token

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
    pathname.startsWith("/configuracion")

  const isAdminRoute = pathname.startsWith("/admin")

  // Redirect logged-in users away from auth pages
  if (isAuthRoute && isLoggedIn) {
    return NextResponse.redirect(new URL("/pos", req.nextUrl))
  }

  // Protect dashboard routes
  if (isDashboard && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.nextUrl))
  }

  // Protect admin routes
  if (isAdminRoute && (!isLoggedIn || (token as any)?.role !== "SUPER_ADMIN")) {
    return NextResponse.redirect(new URL("/login", req.nextUrl))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon\\.ico|manifest\\.json|icons).*)"],
}
