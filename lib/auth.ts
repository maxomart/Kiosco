import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { z } from "zod"

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  trustHost: true,
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
        try {
          const parsed = loginSchema.safeParse(credentials)
          if (!parsed.success) {
            console.error("[AUTH] Invalid credentials shape:", parsed.error.flatten())
            return null
          }

          const email = parsed.data.email.trim().toLowerCase()
          const password = parsed.data.password

          const user = await db.user.findUnique({
            where: { email },
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              image: true,
              password: true,
              tenantId: true,
              active: true,
            },
          })

          if (!user) {
            console.error(`[AUTH] User not found: ${email}`)
            return null
          }
          if (!user.active) {
            console.error(`[AUTH] User inactive: ${email}`)
            return null
          }
          if (!user.password) {
            console.error(`[AUTH] User has no password: ${email}`)
            return null
          }

          const match = await bcrypt.compare(password, user.password)
          if (!match) {
            console.error(`[AUTH] Password mismatch for: ${email}`)
            return null
          }

          console.log(`[AUTH] Login OK: ${email} (${user.role})`)
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            image: user.image,
            tenantId: user.tenantId,
          }
        } catch (err) {
          console.error("[AUTH] authorize threw:", err)
          return null
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
      await db.auditLog
        .create({
          data: {
            userId: user.id!,
            action: "LOGIN",
            entity: "User",
            entityId: user.id,
          },
        })
        .catch(() => {})
    },
  },
})

export const isSuperAdmin = (role: string) => role === "SUPER_ADMIN"
export const isAdmin = (role: string) =>
  ["ADMIN", "OWNER", "SUPER_ADMIN"].includes(role)
export const isOwner = (role: string) => ["OWNER", "SUPER_ADMIN"].includes(role)
