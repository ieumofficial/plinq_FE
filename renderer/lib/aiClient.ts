/**
 * Tiny client for the plinq_ai FastAPI backend.
 *
 * Two cross-cutting concerns it owns so the rest of the app stays clean:
 *   1. Base URL — read once from NEXT_PUBLIC_PLINQ_AI_URL
 *   2. Auth — pulls the supabase access token and stamps it on every call
 *
 * Use `aiFetch()` for plain JSON responses and `aiStream()` when the
 * endpoint streams NDJSON (chat, analyze-audio, apply-proposal, …).
 */

import { supabase } from './supabase'

const BASE = (process.env.NEXT_PUBLIC_PLINQ_AI_URL ?? 'http://localhost:8000').replace(
  /\/+$/,
  '',
)

export function aiUrl(path: string): string {
  return `${BASE}${path.startsWith('/') ? path : `/${path}`}`
}

async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) {
    throw new Error('Not signed in — cannot call plinq_ai')
  }
  return { authorization: `Bearer ${token}` }
}

export async function aiFetch(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    ...(await authHeaders()),
    'content-type': 'application/json',
  }
  return fetch(aiUrl(path), {
    method: init.method ?? 'POST',
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
}

/**
 * NDJSON line-stream wrapper. `onEvent` is invoked once per JSON line
 * the server sends, in order. Stops when the body stream ends.
 *
 * Throws on non-2xx status (with the response body's `detail` field if
 * present). Throws on JSON parse error per line.
 */
export async function aiStream(
  path: string,
  body: unknown,
  onEvent: (evt: Record<string, unknown>) => void | Promise<void>,
): Promise<void> {
  const r = await aiFetch(path, { method: 'POST', body })
  if (!r.ok || !r.body) {
    let detail = `HTTP ${r.status}`
    try {
      const j = await r.json()
      detail =
        typeof j.detail === 'string'
          ? j.detail
          : j.detail?.code || JSON.stringify(j.detail || j)
    } catch {
      /* keep status */
    }
    throw new Error(detail)
  }

  const reader = r.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      let evt: Record<string, unknown>
      try {
        evt = JSON.parse(line)
      } catch {
        continue
      }
      await onEvent(evt)
    }
  }
}
