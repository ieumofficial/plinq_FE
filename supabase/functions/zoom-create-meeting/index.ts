// POST /functions/v1/zoom-create-meeting
// body: { topic, type: 1 | 2, start_time?, duration? }
// → { id, uuid, topic, start_url, join_url, password? }
//
// type=1 → instant meeting (start immediately, host opens start_url)
// type=2 → scheduled meeting (use start_time ISO + duration minutes)
//
// Cloud recording is auto-enabled so the user's recording lands in
// Zoom Cloud — that's the input for the AI pipeline later. Requires the
// connected Zoom user to have Pro (Free can't cloud-record). For Free
// accounts the API returns an error and the caller surfaces it.
import { authedZoomFetch } from '../_shared/zoom.ts'
import { corsHeaders } from '../_shared/cors.ts'

type Body = {
  topic?: string
  type?: 1 | 2
  start_time?: string
  duration?: number
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
    const body = ((await req.json().catch(() => ({}))) as Body) || {}
    const topic =
      body.topic?.trim() ||
      `plinq meeting ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`
    const type = body.type === 2 ? 2 : 1

    const payload: Record<string, unknown> = {
      topic,
      type,
      settings: {
        // 'local' works for Free + Pro. Cloud would require Pro and silently
        // fails on Free — we pull recordings from the user's local Zoom
        // folder instead (Phase A handles the auto-import).
        auto_recording: 'local',
        host_video: true,
        participant_video: true,
        approval_type: 2,
        waiting_room: false,
      },
    }
    if (type === 2) {
      if (!body.start_time) {
        return json({ error: 'start_time is required for scheduled meetings' }, 400)
      }
      payload.start_time = body.start_time
      payload.duration = Math.max(1, Math.round(body.duration ?? 30))
      payload.timezone = 'UTC'
    }

    const res = await authedZoomFetch('/users/me/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = (await res.json()) as {
      id: number
      uuid?: string
      topic: string
      start_url: string
      join_url: string
      password?: string
    }
    return json({
      id: data.id,
      uuid: data.uuid,
      topic: data.topic,
      start_url: data.start_url,
      join_url: data.join_url,
      password: data.password,
    })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
