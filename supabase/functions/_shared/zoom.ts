// Zoom OAuth + REST helpers, ported from plow_FE/backend/src/lib/zoom.ts.
// Single-user demo: tokens live as one JSON object in the `zoom-config`
// Storage bucket. Equivalent of plow_FE's `backend/data/tokens.json`.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected into every
// Edge Function by the platform.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const TOKENS_BUCKET = 'zoom-config'
const TOKENS_KEY = 'tokens.json'

export type ZoomTokens = {
  access_token: string
  refresh_token: string
  expires_at: number
  scope: string
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

/** Create the tokens bucket on first use. Idempotent — ignores "already
 *  exists" errors so the function self-bootstraps on cold start. */
async function ensureBucket(): Promise<void> {
  const { data } = await supabase.storage.listBuckets()
  if (data?.some((b) => b.id === TOKENS_BUCKET)) return
  await supabase.storage
    .createBucket(TOKENS_BUCKET, { public: false })
    .catch(() => {
      /* race condition or "already exists" — fine */
    })
}

export async function getTokens(): Promise<ZoomTokens | null> {
  const { data, error } = await supabase.storage
    .from(TOKENS_BUCKET)
    .download(TOKENS_KEY)
  if (error || !data) return null
  try {
    return JSON.parse(await data.text()) as ZoomTokens
  } catch {
    return null
  }
}

export async function saveTokens(tokens: ZoomTokens): Promise<void> {
  await ensureBucket()
  const blob = new Blob([JSON.stringify(tokens)], {
    type: 'application/json',
  })
  const { error } = await supabase.storage
    .from(TOKENS_BUCKET)
    .upload(TOKENS_KEY, blob, {
      upsert: true,
      contentType: 'application/json',
    })
  if (error) throw new Error(`Failed to save tokens: ${error.message}`)
}

export async function clearTokens(): Promise<void> {
  await supabase.storage.from(TOKENS_BUCKET).remove([TOKENS_KEY])
}

function basicAuth(): string {
  const id = Deno.env.get('ZOOM_CLIENT_ID') || ''
  const secret = Deno.env.get('ZOOM_CLIENT_SECRET') || ''
  return btoa(`${id}:${secret}`)
}

export function buildAuthUrl(state: string): string {
  const url = new URL('https://zoom.us/oauth/authorize')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', Deno.env.get('ZOOM_CLIENT_ID') || '')
  url.searchParams.set(
    'redirect_uri',
    Deno.env.get('ZOOM_REDIRECT_URI') || '',
  )
  url.searchParams.set('state', state)
  return url.toString()
}

export async function exchangeCodeForToken(code: string): Promise<ZoomTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: Deno.env.get('ZOOM_REDIRECT_URI') || '',
  })
  const res = await fetch('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Zoom token exchange failed: ${res.status} ${text}`)
  }
  const data = (await res.json()) as {
    access_token: string
    refresh_token: string
    expires_in: number
    scope: string
  }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    scope: data.scope,
  }
}

async function refreshIfNeeded(tokens: ZoomTokens): Promise<ZoomTokens> {
  if (tokens.expires_at > Date.now() + 60_000) return tokens
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh_token,
  })
  const res = await fetch('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })
  if (!res.ok) throw new Error(`Zoom token refresh failed: ${res.status}`)
  const data = (await res.json()) as {
    access_token: string
    refresh_token: string
    expires_in: number
    scope: string
  }
  const next: ZoomTokens = {
    ...tokens,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    scope: data.scope,
  }
  await saveTokens(next)
  return next
}

const ZOOM_API = 'https://api.zoom.us/v2'

export async function authedZoomFetch(
  pathname: string,
  init?: RequestInit,
): Promise<Response> {
  let tokens = await getTokens()
  if (!tokens) throw new Error('Zoom is not connected')
  tokens = await refreshIfNeeded(tokens)
  const res = await fetch(`${ZOOM_API}${pathname}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${tokens.access_token}`,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Zoom API ${pathname} failed: ${res.status} ${text}`)
  }
  return res
}
