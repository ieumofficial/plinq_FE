// POST /functions/v1/analyze-audio?meetingId=<uuid>
// Content-Type: audio/*  (or application/octet-stream)
// body: raw audio bytes (m4a / mp4 / mp3 / wav — Zoom local recordings are
//       usually audio_only.m4a)
//
// Pipeline mirrors plow_FE's /api/process/local: read audio bytes →
// Gemini 2.5 Flash transcribe → 4-section extract → write the result to
// `meeting_minutes` (full_text + JSON-encoded summary).
//
// Replaces `zoom-analyze` for Free-tier users since Zoom Free doesn't
// upload to the cloud — plinq pulls the m4a straight from the user's PC
// and posts it here.
import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const PRIMARY_MODEL = 'gemini-2.5-flash'
const FALLBACK_MODELS = ['gemini-2.0-flash', 'gemini-2.5-flash-lite']
const MAX_INLINE_BYTES = 19 * 1024 * 1024 // Gemini inline-data cap

const EXTRACT_SYSTEM = `You are an expert meeting analyst.
Read a meeting transcript (Korean and/or English) and extract structured
insight. BE GENEROUS — when there is ANY signal at all, surface it. Prefer
extracting too much over too little.

Return STRICT JSON with this exact shape — no markdown fences, no commentary:
{
  "summary": "1-3 sentence summary in the transcript's primary language",
  "keyDecisions": ["..."],
  "actionItems": [{"task": "...", "owner": "person if named, else null", "dueDate": "ISO or natural-language phrase if mentioned, else null"}],
  "followUps": ["topics raised that need follow-up but were not decided"],
  "unresolved": ["items that came up repeatedly and remain unresolved"]
}

Mapping cheat sheet (apply liberally):
- "다음 회의는 5/18", "Let's meet next Tuesday" → keyDecisions PLUS an
  actionItem like { task: "다음 회의 예약", dueDate: "5/18" }.
- Anyone saying they will do something ("내가 ~ 할게요", "I'll handle X")
  → actionItem with that person as owner.
- Any mentioned deadline / number / dollar figure → include it verbatim
  in the relevant bullet so the reader sees it.
- A topic raised but not closed → followUps.
- Same point coming back without resolution → unresolved.
- Even a very short transcript usually has at least one extractable
  decision or action — re-read carefully before returning empty arrays.

Hard rules:
- Preserve the transcript's primary language. Korean transcript → Korean strings.
- Owners and dates that are EXPLICITLY in the transcript only —
  never invent a name or date that wasn't said.
- Only return empty arrays for a category when the transcript truly says
  nothing about it.`

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

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000
  let bin = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}

function mimeFromContentType(ct: string | null): string {
  const t = (ct || '').toLowerCase()
  if (t.startsWith('audio/') || t.startsWith('video/')) return t
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
    const url = new URL(req.url)
    const meetingId = url.searchParams.get('meetingId')
    if (!meetingId) {
      return json({ error: 'meetingId query param required' }, 400)
    }

    const { data: meeting, error: mErr } = await supabase
      .from('meetings')
      .select('id, name')
      .eq('id', meetingId)
      .single()
    if (mErr || !meeting) {
      return json({ error: 'Meeting not found in plinq DB' }, 404)
    }

    const audioBytes = new Uint8Array(await req.arrayBuffer())
    if (audioBytes.length === 0) {
      return json({ error: 'Empty body — send the audio file as raw bytes' }, 400)
    }
    if (audioBytes.length > MAX_INLINE_BYTES) {
      return json(
        {
          error: `Audio is ${(audioBytes.length / 1024 / 1024).toFixed(
            1,
          )}MB — Gemini inline limit is 20MB. Use a shorter recording.`,
        },
        413,
      )
    }

    const audioBase64 = uint8ArrayToBase64(audioBytes)
    const audioMime = mimeFromContentType(req.headers.get('content-type'))

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
        /* fall through with empty defaults — transcript still saved. */
      }
    }

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

    // Once analyzed, flip the meeting to `processed` so the card retires
    // any live-mode controls.
    await supabase
      .from('meetings')
      .update({ status: 'processed' })
      .eq('id', meetingId)

    return json({ ok: true, transcript, extracted })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
