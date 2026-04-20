import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { z } from "zod"
import { authConfig } from "@/lib/auth.config"
import { checkLoginRateLimit, recordLoginFailure, resetLoginAttempts } from "@/lib/rate-limit"

// Dummy hash fijo para timing-attack mitigation (bcrypt de "dummy-password-fixed")
const DUMMY_HASH = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8/Z1XqJZqFgJN/yGt7dEJkFbK5RQgS"

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
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
            // No loguear detalles — puede exponer pattern del atacante
            return null
          }

          const email = parsed.data.email.trim().toLowerCase()
          const password = parsed.data.password

          // Rate limiting: bloquea tras N intentos fallidos
          const rate = checkLoginRateLimit(email)
          if (!rate.allowed) {
            // Respuesta genérica — no revelar que está bloqueado para email específico
            return null
          }

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

          // Timing attack mitigation: correr bcrypt también cuando no existe/está inactivo
          if (!user || !user.active || !user.password) {
            await bcrypt.compare(password, DUMMY_HASH)
            recordLoginFailure(email)
            return null
          }

          const match = await bcrypt.compare(password, user.password)
          if (!match) {
            recordLoginFailure(email)
            return null
          }

          // Login OK → reset contador
          resetLoginAttempts(email)

          console.log(`[AUTH] Login OK: ${email} (${user.role})`)
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            image: user.image,
            tenantId: user.tenantId,
          } as any
        } catch (err) {
          console.error("[AUTH] authorize threw:", (err as Error).message)
          return null
        }
      },
    }),
  ],
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
