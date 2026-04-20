// Edge-safe NextAuth config (no DB, no bcrypt — usable in proxy.ts/middleware)
import type { NextAuthConfig } from "next-auth"

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  // Providers added in lib/auth.ts (which is NOT Edge-safe because of Prisma+bcrypt)
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
        token.id = (user as any).id
        token.tenantId = (user as any).tenantId ?? null
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        ;(session.user as any).id = token.id as string
        ;(session.user as any).role = token.role as string
        ;(session.user as any).tenantId = token.tenantId as string | null
      }
      return session
    },
  },
}
