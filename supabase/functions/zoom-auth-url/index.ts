// GET /functions/v1/zoom-auth-url
// → { url, state }
// The renderer opens `url` in the system browser; user approves Zoom OAuth;
// Zoom redirects back to /functions/v1/zoom-callback with ?code=...&state=...
import { buildAuthUrl } from '../_shared/zoom.ts'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve((req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (!Deno.env.get('ZOOM_CLIENT_ID') || !Deno.env.get('ZOOM_REDIRECT_URI')) {
    return new Response(
      JSON.stringify({ error: 'Zoom is not configured' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
  const state = crypto.randomUUID()
  return new Response(
    JSON.stringify({ url: buildAuthUrl(state), state }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  )
})
