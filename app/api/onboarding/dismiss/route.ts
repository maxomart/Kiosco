import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSessionTenant } from "@/lib/tenant"

export async function POST() {
  const { error, tenantId } = await getSessionTenant()
  if (error || !tenantId) {
    return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    await db.tenantConfig.upsert({
      where: { tenantId },
      update: { onboardingDismissed: true } as any,
      create: { tenantId, onboardingDismissed: true } as any,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[onboarding/dismiss]", err)
    return NextResponse.json({ error: "Error" }, { status: 500 })
  }
}

// Reopens the checklist
export async function DELETE() {
  const { error, tenantId } = await getSessionTenant()
  if (error || !tenantId) {
    return error ?? NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  try {
    await db.tenantConfig.update({
      where: { tenantId },
      data: { onboardingDismissed: false } as any,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: "Error" }, { status: 500 })
  }
}
