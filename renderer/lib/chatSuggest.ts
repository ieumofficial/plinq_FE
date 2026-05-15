/**
 * Client for plinq_ai's chat reply suggestion endpoint.
 *
 * Returns 0..N candidates the user can pick from in the composer's
 * "Suggested replies" panel. The server itself decides when no suggestion
 * is appropriate (e.g. last message is from the user) and returns an empty
 * array, so callers only need to render whatever comes back.
 */
import { aiFetch } from './aiClient'

export type ChatSuggestion = {
  /** Short uppercase tag shown above the body — e.g. "short" / "follow-up". */
  label: string
  /** The reply text to drop into the composer. */
  body: string
}

export async function getChatSuggestions(
  sessionId: string,
  opts?: { n?: number; draft?: string | null; timeoutMs?: number },
): Promise<ChatSuggestion[]> {
  const timeoutMs = opts?.timeoutMs ?? 30_000
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await aiFetch(`/chat/sessions/${sessionId}/draft-reply`, {
      body: { n: opts?.n ?? 3, draft: opts?.draft ?? null },
      signal: ctrl.signal,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`draft-reply failed: ${res.status} ${text}`)
    }
    const data = (await res.json()) as { suggestions?: ChatSuggestion[] }
    return data.suggestions ?? []
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      throw new Error(`draft-reply timed out after ${timeoutMs}ms`)
    }
    throw e
  } finally {
    clearTimeout(t)
  }
}
