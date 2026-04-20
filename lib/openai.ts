import OpenAI from "openai"

let _client: OpenAI | null = null

/**
 * Lazy singleton for the OpenAI SDK. Throws a clear, user-actionable
 * error if the API key isn't configured (so the AI assistant gracefully
 * falls back to a "set up your key" message in the UI).
 */
export function getOpenAI(): OpenAI {
  if (_client) return _client
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY no configurada en Railway. Andá a platform.openai.com → API Keys, generá una y agregala como variable de entorno."
    )
  }
  _client = new OpenAI({ apiKey })
  return _client
}

export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY
}

/**
 * Default model for the AI assistant.
 * gpt-4o-mini is the sweet spot: fast, cheap (~$0.15 input / $0.60 output per 1M tokens),
 * great Spanish, plenty smart for business advice. Bump to "gpt-4o" if you want
 * higher quality at ~10x cost.
 */
export const DEFAULT_MODEL = "gpt-4o-mini"
