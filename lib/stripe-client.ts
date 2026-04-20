import Stripe from "stripe"

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set")
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia",
  typescript: true,
})

export const STRIPE_PLANS = {
  STARTER: process.env.STRIPE_PRICE_STARTER ?? "",
  PROFESSIONAL: process.env.STRIPE_PRICE_PROFESSIONAL ?? "",
  BUSINESS: process.env.STRIPE_PRICE_BUSINESS ?? "",
}
