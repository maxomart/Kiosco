/**
 * Mobbex Subscriptions — platform-level integration for billing tenants in ARS.
 *
 * Setup:
 *   1. Creá una cuenta en https://mobbex.com
 *   2. En el panel: Configuración → API → copiá API Key y Access Token
 *   3. Agregá en Railway:
 *      MOBBEX_API_KEY      (ej: "appkey_...")
 *      MOBBEX_ACCESS_TOKEN (ej: "eyJ...")
 *   4. Configurá el webhook en Mobbex panel → URL: {NEXTAUTH_URL}/api/billing/mobbex/webhook
 */

const MOBBEX_API = "https://api.mobbex.com/p"

export function isMobbexConfigured(): boolean {
  return !!(process.env.MOBBEX_API_KEY && process.env.MOBBEX_ACCESS_TOKEN)
}

function authHeaders(): Record<string, string> {
  const key = process.env.MOBBEX_API_KEY
  const token = process.env.MOBBEX_ACCESS_TOKEN
  if (!key || !token) throw new Error("MOBBEX_API_KEY y MOBBEX_ACCESS_TOKEN son requeridos")
  return {
    "x-api-key": key,
    "x-access-token": token,
    "Content-Type": "application/json",
    "cache-control": "no-cache",
  }
}

export interface MobbexSubscriptionInput {
  name: string
  description: string
  amountARS: number
  interval: "1m" | "1y"
  returnUrl: string
}

export interface MobbexSubscriberInput {
  name: string
  email: string
  externalReference: string
}

export interface MobbexCheckoutResult {
  subscriptionUid: string
  subscriberUid: string
  checkoutUrl: string
}

/** Creates a subscription plan + subscriber in one call. Returns the checkout URL. */
export async function createMobbexCheckout(
  sub: MobbexSubscriptionInput,
  customer: MobbexSubscriberInput
): Promise<MobbexCheckoutResult> {
  // Step 1: create the subscription plan
  const planRes = await fetch(`${MOBBEX_API}/subscriptions/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      total: sub.amountARS.toFixed(2),
      currency: "ARS",
      type: "dynamic",
      name: sub.name,
      description: sub.description,
      limit: 0,
      return_url: sub.returnUrl,
      interval: sub.interval,
    }),
  })
  if (!planRes.ok) {
    const text = await planRes.text()
    throw new Error(`Mobbex createSubscription (${planRes.status}): ${text}`)
  }
  const planData = await planRes.json()
  const subscriptionUid: string = planData?.data?.uid ?? planData?.uid
  if (!subscriptionUid) throw new Error("Mobbex no devolvió UID del plan")

  // Step 2: create the subscriber
  const subRes = await fetch(`${MOBBEX_API}/subscriptions/${subscriptionUid}/subscriber`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      customer: {
        name: customer.name,
        email: customer.email,
        identification: "",
        phone: "",
      },
      externalReference: customer.externalReference,
      startDate: new Date().toISOString().split("T")[0],
      return_url: sub.returnUrl,
    }),
  })
  if (!subRes.ok) {
    const text = await subRes.text()
    throw new Error(`Mobbex createSubscriber (${subRes.status}): ${text}`)
  }
  const subData = await subRes.json()
  const subscriberUid: string = subData?.data?.uid ?? subData?.uid
  const checkoutUrl: string = subData?.data?.url ?? subData?.url ?? subData?.data?.checkoutUrl
  if (!subscriberUid || !checkoutUrl) {
    throw new Error(`Mobbex subscriber sin UID/URL: ${JSON.stringify(subData)}`)
  }

  return { subscriptionUid, subscriberUid, checkoutUrl }
}

/** Cancels a subscriber. subscriptionUid:subscriberUid stored in DB as "sub:sid". */
export async function cancelMobbexSubscriber(
  subscriptionUid: string,
  subscriberUid: string
): Promise<boolean> {
  const res = await fetch(
    `https://api.mobbex.com/subscriptions/${subscriptionUid}/subscriber/${subscriberUid}/action/delete`,
    { method: "DELETE", headers: authHeaders() }
  )
  return res.ok
}

/** Parses the composite ID stored in DB: "subscriptionUid:subscriberUid" */
export function parseMobbexId(composite: string): { subscriptionUid: string; subscriberUid: string } | null {
  const parts = composite.replace(/^mobbex:/, "").split(":")
  if (parts.length !== 2) return null
  return { subscriptionUid: parts[0], subscriberUid: parts[1] }
}
