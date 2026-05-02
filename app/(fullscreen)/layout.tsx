import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

/** Layout para vistas full-screen (TV mode, etc) — sin sidebar ni header. */
export default async function FullscreenLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect("/login")
  return <div className="min-h-screen bg-black text-white">{children}</div>
}
