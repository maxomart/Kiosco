import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function getSessionTenant() {
  const session = await auth()
  if (!session) {
    return {
      error: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
      tenantId: null,
      session: null,
      isSuperAdmin: false,
    }
  }

  if (session.user.role === "SUPER_ADMIN") {
    return { error: null, tenantId: null, session, isSuperAdmin: true }
  }

  const tenantId = session.user.tenantId
  if (!tenantId) {
    return {
      error: NextResponse.json(
        { error: "Sin tenant asignado" },
        { status: 403 }
      ),
      tenantId: null,
      session: null,
      isSuperAdmin: false,
    }
  }

  return { error: null, tenantId, session, isSuperAdmin: false }
}
