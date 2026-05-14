// POST /functions/v1/zoom-disconnect
// Deletes the stored Zoom tokens. Renderer hits this from the "Disconnect"
// button in the Zoom connection chip.
import { clearTokens } from '../_shared/zoom.ts'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  await clearTokens()
  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
