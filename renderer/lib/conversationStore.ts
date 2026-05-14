/**
 * Per-scope "last active AI conversation" tracker.
 *
 * AskAiPanel calls this on mount to remember which conversation the user was
 * last in for a given (orgId, projectId) scope. localStorage is just a cache —
 * if it's empty (new install / different device), the panel falls back to
 * `GET /agent/conversations?limit=1` to find the most recent server-side.
 */

// Sessions are scoped to an organization only — context (which projects to
// load into the prompt) is per-message, not per-conversation.
type Scope = { orgId?: string | null }

function key(scope: Scope): string {
  const o = scope.orgId ?? '_'
  return `plinq.activeAgentConv.${o}`
}

export function getActiveConversationId(scope: Scope): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(key(scope))
  } catch {
    return null
  }
}

export function setActiveConversationId(scope: Scope, id: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key(scope), id)
  } catch {
    /* quota / private mode — silently ignore */
  }
}

export function clearActiveConversationId(scope: Scope): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key(scope))
  } catch {
    /* ignore */
  }
}
