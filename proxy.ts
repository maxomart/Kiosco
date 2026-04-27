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

  // /verificar-email lives in the auth route group but is meant for
  // freshly-signed-up (and already logged-in but unverified) users —
  // we don't want the "logged-in → bounce to /inicio" rule below to
  // apply here, otherwise a verified user could never reach it again
  // and an unverified-but-logged-in user would get stuck in a loop with
  // the dashboard layout that bounces unverified users back here.
  const isVerifyEmailRoute = pathname.startsWith("/verificar-email")

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

  // Logged-in user on auth pages → send them to their home. We exclude
  // /verificar-email because logged-in-but-unverified users need to reach
  // it from the dashboard redirect.
  if (isAuthRoute && isLoggedIn && !isVerifyEmailRoute) {
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

  // Forward the resolved pathname so server components (e.g. the admin
  // layout's device-binding check) know which page is rendering. Edge
  // runtime can't reach Prisma, so the layout does the heavy lifting —
  // this header just lets it skip its own check on /admin/dispositivo.
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set("x-pathname", pathname)
  return NextResponse.next({ request: { headers: requestHeaders } })
}) as any

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon\\.ico|manifest\\.json|icons).*)"],
}
