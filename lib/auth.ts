import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { z } from "zod"

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const { email, password } = parsed.data

        const user = await db.user.findUnique({
          where: { email, active: true },
          select: { id: true, name: true, email: true, role: true, image: true, password: true, tenantId: true },
        })

        if (!user || !user.password) return null

        const passwordMatch = await bcrypt.compare(password, user.password)
        if (!passwordMatch) return null

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          image: user.image,
          tenantId: user.tenantId,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
        token.id = user.id
        token.tenantId = (user as any).tenantId ?? null
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.tenantId = token.tenantId as string | null
      }
      return session
    },
  },
  events: {
    async signIn({ user }) {
      // Registrar login en auditoría
      await db.auditLog.create({
        data: {
          userId: user.id!,
          action: "LOGIN",
          entity: "User",
          entityId: user.id,
        },
      }).catch(() => {})
    },
  },
})

// Helpers de permisos
export const isSuperAdmin = (role: string) => role === "SUPER_ADMIN"
export const isAdmin = (role: string) => ["ADMIN", "OWNER", "SUPER_ADMIN"].includes(role)
export const isOwner = (role: string) => ["OWNER", "SUPER_ADMIN"].includes(role)
export const isCashier = (role: string) => role === "CASHIER"
