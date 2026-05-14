// GET /functions/v1/zoom-list-recordings
// → { meetings: ZoomMeeting[] }
// Lists the user's Zoom cloud recordings from the last 6 months.
import { authedZoomFetch } from '../_shared/zoom.ts'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
    const today = new Date()
    const from = new Date(today)
    from.setMonth(from.getMonth() - 6)
    const fmt = (d: Date) => d.toISOString().slice(0, 10)
    const res = await authedZoomFetch(
      `/users/me/recordings?from=${fmt(from)}&to=${fmt(today)}&page_size=30`,
    )
    const data = (await res.json()) as { meetings?: unknown[] }
    return new Response(
      JSON.stringify({ meetings: data.meetings ?? [] }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
