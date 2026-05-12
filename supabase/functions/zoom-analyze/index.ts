// POST /functions/v1/zoom-analyze
// body: { meetingId: string }   // plinq meeting row id
//
// Pulls the matching Zoom cloud recording, runs Gemini transcription +
// 4-section extraction, writes the result to `meeting_minutes`
// (full_text + JSON-encoded summary). Mirrors plow_FE's
// /api/process/zoom/:meetingId — same Gemini prompts and models, ported
// to Deno. Single-user demo: tokens come from the shared `zoom-config`
// Storage bucket.
import { authedZoomFetch, getTokens } from '../_shared/zoom.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const PRIMARY_MODEL = 'gemini-2.5-flash'
const FALLBACK_MODELS = ['gemini-2.0-flash', 'gemini-2.5-flash-lite']
const MAX_INLINE_BYTES = 19 * 1024 * 1024 // Gemini inline-data hard cap ≈ 20MB

const EXTRACT_SYSTEM = `You are an expert meeting analyst.
Read a meeting transcript (Korean and/or English) and extract structured insight.

Return STRICT JSON with this exact shape — no markdown fences, no commentary:
{
  "summary": "2-3 sentence neutral summary in the transcript's primary language",
  "keyDecisions": ["..."],
  "actionItems": [{"task": "...", "owner": "person if named, else null", "dueDate": "ISO or relative phrase if mentioned, else null"}],
  "followUps": ["topics raised that need follow-up but were not decided"],
  "unresolved": ["items that came up repeatedly across the transcript and remain unresolved"]
}

Rules:
- Be concise. One bullet = one idea.
- Preserve the transcript's primary language. If transcript is Korean, return Korean strings.
- If a category has no items, return an empty array.
- Do NOT invent owners or dates that are not in the transcript.`

type Extracted = {
  summary?: string
  keyDecisions: string[]
  actionItems: {
    task: string
    owner?: string | null
    dueDate?: string | null
  }[]
  followUps: string[]
  unresolved: string[]
}

/** Pull the numeric Zoom meeting ID from a join URL like
 *  `https://us02web.zoom.us/j/123456789?pwd=...`. */
function extractZoomMeetingId(url: string): string | null {
  const m = url.match(/\/j\/(\d+)/)
  return m ? m[1] : null
}

/** Chunked base64 — `btoa(String.fromCharCode(...big))` blows the stack. */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000
  let bin = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}

function mimeForExt(ext: string): string {
  const e = ext.toLowerCase().replace(/^\.+/, '')
  if (e === 'mp3') return 'audio/mp3'
  if (e === 'm4a' || e === 'mp4') return 'audio/mp4'
  if (e === 'wav') return 'audio/wav'
  return 'audio/mp4'
}

async function geminiGenerate(args: {
  model: string
  contents: unknown[]
  systemInstruction?: string
  responseMimeType?: string
}): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')!
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${args.model}:generateContent?key=${apiKey}`
  const body: Record<string, unknown> = { contents: args.contents }
  if (args.systemInstruction) {
    body.systemInstruction = { parts: [{ text: args.systemInstruction }] }
  }
  if (args.responseMimeType) {
    body.generationConfig = { responseMimeType: args.responseMimeType }
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gemini ${args.model} ${res.status}: ${text}`)
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

async function callWithRetry(
  fn: (model: string) => Promise<string>,
): Promise<string> {
  const models = [PRIMARY_MODEL, ...FALLBACK_MODELS]
  let lastErr: unknown = null
  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await fn(model)
      } catch (e) {
        lastErr = e
        const msg = (e as Error).message || ''
        if (!/503|429|500|UNAVAILABLE|overloaded|rate/i.test(msg)) throw e
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt))
      }
    }
  }
  throw lastErr
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
    const { meetingId } = (await req.json().catch(() => ({}))) as {
      meetingId?: string
    }
    if (!meetingId) return json({ error: 'meetingId is required' }, 400)

    // Look up plinq meeting
    const { data: meeting, error: mErr } = await supabase
      .from('meetings')
      .select('id, name, scheduled_at, duration_min, location_or_url')
      .eq('id', meetingId)
      .single()
    if (mErr || !meeting)
      return json({ error: 'Meeting not found in plinq DB' }, 404)
    if (!meeting.location_or_url)
      return json({ error: 'Meeting has no Zoom URL' }, 400)
    const zoomMeetingId = extractZoomMeetingId(meeting.location_or_url)
    if (!zoomMeetingId)
      return json(
        { error: 'Could not extract Zoom meeting ID from URL' },
        400,
      )

    // Auth + find recording
    const tokens = await getTokens()
    if (!tokens) return json({ error: 'Zoom is not connected' }, 401)
    const from = new Date(meeting.scheduled_at)
    from.setDate(from.getDate() - 1)
    const to = new Date(meeting.scheduled_at)
    to.setDate(to.getDate() + 7)
    const fmt = (d: Date) => d.toISOString().slice(0, 10)
    const listRes = await authedZoomFetch(
      `/users/me/recordings?from=${fmt(from)}&to=${fmt(to)}&page_size=30`,
    )
    const listData = (await listRes.json()) as {
      meetings?: {
        uuid?: string
        id?: number | string
        topic?: string
        recording_files?: {
          file_type: string
          file_extension?: string
          download_url: string
          status?: string
        }[]
      }[]
    }
    const zoomMeeting = listData.meetings?.find(
      (m) => String(m.id) === zoomMeetingId || m.uuid === zoomMeetingId,
    )
    if (!zoomMeeting) {
      return json(
        {
          error:
            'Zoom recording not found yet. Cloud processing takes 1-5 min after the meeting ends — try again shortly.',
        },
        404,
      )
    }
    const audioFile =
      zoomMeeting.recording_files?.find((f) => f.file_type === 'M4A') ??
      zoomMeeting.recording_files?.find((f) => f.file_type === 'MP4')
    if (!audioFile) return json({ error: 'No audio file in recording' }, 404)

    // Download audio (Zoom auth required on the file URL)
    const dlRes = await fetch(audioFile.download_url, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    if (!dlRes.ok) {
      return json({ error: `Audio download failed: ${dlRes.status}` }, 500)
    }
    const audioBytes = new Uint8Array(await dlRes.arrayBuffer())
    if (audioBytes.length > MAX_INLINE_BYTES) {
      return json(
        {
          error: `Audio is ${(audioBytes.length / 1024 / 1024).toFixed(
            1,
          )}MB — Gemini inline limit is 20MB. Use a shorter meeting (chunked transcription is Phase 2).`,
        },
        413,
      )
    }
    const audioBase64 = uint8ArrayToBase64(audioBytes)
    const audioMime = mimeForExt(audioFile.file_extension ?? 'm4a')

    // Transcribe
    const transcript = (
      await callWithRetry((model) =>
        geminiGenerate({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType: audioMime, data: audioBase64 } },
                {
                  text: `Transcribe this meeting audio verbatim.
- Preserve the speakers' original language (Korean, English, or mixed).
- Keep speaker turns on separate lines if multiple voices are present.
- Output ONLY the transcript text. No headings, no commentary, no markdown.`,
                },
              ],
            },
          ],
        }),
      )
    ).trim()

    // Extract 4 sections
    const rawExtract = (
      await callWithRetry((model) =>
        geminiGenerate({
          model,
          systemInstruction: EXTRACT_SYSTEM,
          responseMimeType: 'application/json',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `Transcript:\n\n${transcript}\n\nReturn the JSON now.`,
                },
              ],
            },
          ],
        }),
      )
    ).trim()

    let extracted: Extracted = {
      summary: undefined,
      keyDecisions: [],
      actionItems: [],
      followUps: [],
      unresolved: [],
    }
    const jStart = rawExtract.indexOf('{')
    const jEnd = rawExtract.lastIndexOf('}')
    if (jStart >= 0 && jEnd >= 0) {
      try {
        const parsed = JSON.parse(rawExtract.slice(jStart, jEnd + 1))
        extracted = {
          summary: parsed.summary,
          keyDecisions: parsed.keyDecisions ?? [],
          actionItems: parsed.actionItems ?? [],
          followUps: parsed.followUps ?? [],
          unresolved: parsed.unresolved ?? [],
        }
      } catch (_) {
        // fall through with empty defaults — transcript still saved.
      }
    }

    // Save to meeting_minutes. We stash the four-section JSON in `summary`
    // since the column is already there and labelled for the natural-
    // language summary; the renderer parses it back out.
    const { error: saveErr } = await supabase.from('meeting_minutes').upsert(
      {
        meeting_id: meetingId,
        full_text: transcript,
        summary: JSON.stringify(extracted),
        processed_at: new Date().toISOString(),
      },
      { onConflict: 'meeting_id' },
    )
    if (saveErr) {
      return json({ error: `Save failed: ${saveErr.message}` }, 500)
    }

    return json({ ok: true, transcript, extracted })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
