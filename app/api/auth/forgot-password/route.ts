import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"

const Body = z.object({
  email: z.string().email(),
})

// Returns 200 regardless of whether the email exists to prevent enumeration.
// The actual email-sending step is deferred until a mail provider is wired.
export async function POST(req: Request) {
  let email: string
  try {
    const parsed = Body.parse(await req.json())
    email = parsed.email.toLowerCase().trim()
  } catch {
    return NextResponse.json({ ok: true })
  }

  try {
    const user = await db.user.findUnique({ where: { email } })
    if (user) {
      console.log(
        `[forgot-password] reset requested for ${email} (user id=${user.id}) — email delivery not configured.`
      )
    }
  } catch (err) {
    console.error("[forgot-password] lookup failed", err)
  }

  return NextResponse.json({ ok: true })
}
