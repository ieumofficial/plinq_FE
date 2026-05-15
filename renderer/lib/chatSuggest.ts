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

export type CatchMeUpActionItem = {
  title: string
  project_key: string | null
}

export type CatchMeUpResult = {
  summary: string
  action_items: CatchMeUpActionItem[]
  /** False = user has no unread messages → FE hides the whole card. */
  has_unread?: boolean
  /** True = served from the BE cache (no Sonnet call). Diagnostic. */
  cached?: boolean
}

/** AI summary of recent activity in a chat session. Used by the right-side
 *  ChatDetails panel — the summary text supports `**bold**` person names. */
export async function getCatchMeUp(
  sessionId: string,
  opts?: { signal?: AbortSignal },
): Promise<CatchMeUpResult> {
  const res = await aiFetch(`/chat/sessions/${sessionId}/catch-me-up`, {
    body: {},
    signal: opts?.signal,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`catch-me-up failed: ${res.status} ${text}`)
  }
  return (await res.json()) as CatchMeUpResult
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
