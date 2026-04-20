import Anthropic from "@anthropic-ai/sdk"

let _client: Anthropic | null = null

/**
 * Lazy singleton for the Anthropic SDK. Throws a clear, user-actionable
 * error if the API key isn't configured (so the AI assistant gracefully
 * falls back to a "set up your key" message).
 */
export function getAnthropic(): Anthropic {
  if (_client) return _client
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY no configurada en Railway. Andá a console.anthropic.com → API Keys, generá una y agregala como variable de entorno."
    )
  }
  _client = new Anthropic({ apiKey })
  return _client
}

export function isAnthropicConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY
}

/** Default model + thinking config for the AI assistant. */
export const DEFAULT_MODEL = "claude-opus-4-6"
