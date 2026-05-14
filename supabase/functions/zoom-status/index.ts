// GET /functions/v1/zoom-status
// → { connected, expires_at, scope }
// Renderer polls this to render the "● Zoom Connected" badge.
import { getTokens } from '../_shared/zoom.ts'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  const tokens = await getTokens()
  return new Response(
    JSON.stringify({
      connected: !!tokens,
      expires_at: tokens?.expires_at ?? null,
      scope: tokens?.scope ?? null,
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  )
})
