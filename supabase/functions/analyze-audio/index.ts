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
Read a meeting transcript and extract structured insight. BE GENEROUS —
when there is ANY signal at all, surface it. Prefer extracting too much
over too little.

You will be given an ordered list of AGENDA ITEMS (대주제) that the meeting
was scheduled to cover. Your job is to map every portion of the transcript
to one of these agenda items, or to an "other" bucket if it does not fit
any of them. Each agenda item gets its own summary AND its own transcript
excerpt (the actual lines from the transcript that belong under it).

Return STRICT JSON with this exact shape — no markdown fences, no commentary:
{
  "summary": "concrete overall recap — see Summary style below",
  "keyDecisions": ["..."],
  "actionItems": [{"task": "...", "owner": "person if named, else null", "dueDate": "ISO or natural-language phrase if mentioned, else null"}],
  "followUps": ["topics raised that need follow-up but were not decided"],
  "unresolved": ["items that came up repeatedly and remain unresolved"],
  "byAgenda": [
    {
      "agendaId": "<exact uuid from input>",
      "summary": "1-3 sentence agenda-specific recap, same style as overall summary",
      "transcript": "the [MM:SS] Speaker N: lines from the transcript that belong under this agenda, joined by newlines. Copy lines verbatim — do not rewrite."
    }
  ],
  "other": {
    "summary": "1-2 sentences covering content not belonging to any agenda (small talk, off-topic, tangents). Empty string if nothing.",
    "transcript": "transcript lines that did not fit any agenda, joined by newlines. Empty string if nothing."
  }
}

byAgenda rules:
- Include EVERY input agenda in the output array, in the same order, even
  if there is little or no content for it (use a short summary like
  "Not discussed" and empty transcript in that case).
- agendaId MUST be the exact uuid string from the input — do not invent.
- Transcript lines must be COPIED verbatim from the input transcript
  (keep the [MM:SS] prefix and speaker label).
- A single transcript line belongs to AT MOST ONE bucket (agenda or other).
- Order transcript lines chronologically (by timestamp) within each bucket.

Language: ALL output strings (summary, decisions, action items, follow-ups,
unresolved) MUST be in English, regardless of the language spoken in the
transcript. Translate the substance to English. Keep proper nouns
(people, products, project names) as they appear — do not romanise or
re-translate them. Dates can stay in the format the speaker used
("5/18", "May 18", etc.).

Summary style (the highest-bar rule):
- 1-3 sentences, max ~50 words. English only.
- Lead with NAMED PEOPLE doing SPECIFIC THINGS, plus NUMBERS / COUNTS / DATES
  the transcript actually mentions. Concrete > narrative.
- Wrap the 2-4 most informative spans in **markdown bold** — exact
  decision artifacts (e.g. "**v3 disclosure paragraph**"), counts +
  unit ("**5 were assigned automatically**"), key dates / windows
  ("**May 18 send window**"), unowned items ("**has no clear owner**").
- GOOD: "Daniel walked through cutover blockers, Mira surfaced **2 SAML
  edge cases**. **4 action items** extracted, **1 unowned**."
- GOOD (Korean transcript → English summary): "민지 shared **3 design
  drafts**; 영천 flagged a **320ms API response** issue. **4 action
  items** captured, next meeting **5/18**."
- BAD (avoid): "This meeting was about X and we decided to do Y." —
  passive narrative, no names, no numbers, no bold.
- If no names appear, lead with concrete nouns + counts instead of vague
  topic-summary.
- Do NOT start with phrases like "This meeting was about", "We discussed",
  "The team talked about". Open with the most informative concrete sentence.

Mapping cheat sheet (apply liberally):
- "다음 회의는 5/18", "Let's meet next Tuesday" → keyDecisions like
  "Next meeting set for 5/18", PLUS an actionItem like
  { task: "Schedule next meeting", dueDate: "5/18" }.
- Anyone saying they will do something ("내가 ~ 할게요", "I'll handle X")
  → actionItem with that person as owner, task phrased in English.
- Any mentioned deadline / number / currency amount → include it verbatim
  in the relevant bullet so the reader sees it.
- A topic raised but not closed → followUps.
- Same point coming back without resolution → unresolved.

Hard rules:
- Output strings are ALL in English. Translate everything except proper
  nouns. Korean names like "민지" stay as "민지" (not "Minji" or "Minjee").
- Owners and dates that are EXPLICITLY in the transcript only —
  never invent a name or date that wasn't said.
- Only return empty arrays for a category when the transcript truly says
  nothing about it.`

type AgendaBucket = {
  agendaId: string
  summary: string
  transcript: string
}

type OtherBucket = {
  summary: string
  transcript: string
}

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
  byAgenda: AgendaBucket[]
  other: OtherBucket
}

type AgendaInput = { id: string; title: string; order: number }

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

function extForMime(mime: string): string {
  const m = mime.toLowerCase()
  if (m.includes('webm')) return 'webm'
  if (m.includes('m4a') || m.includes('mp4')) return 'm4a'
  if (m.includes('mp3') || m.includes('mpeg')) return 'mp3'
  if (m.includes('wav')) return 'wav'
  return 'audio'
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

type ParsedSegment = {
  speaker: string | null
  startSec: number
  endSec: number
  text: string
}

/**
 * Split Gemini's timestamped transcript into discrete segments.
 * Format we expect (per the prompt):
 *   `[MM:SS] 화자 1: 첫 문장.`
 *   `[MM:SS] Speaker 2: text…`
 * end_time = the next segment's start_time, or start + 30s for the last.
 */
function parseTimestampedSegments(raw: string): ParsedSegment[] {
  const out: ParsedSegment[] = []
  const SPEAKER_PREFIX = /^([\p{L}][\p{L}\p{N}\s.]{0,40}?):\s*(.*)$/u
  for (const lineRaw of raw.split(/\r?\n/)) {
    const line = lineRaw.trim()
    if (!line) continue
    const ts = line.match(/^\[(\d{1,3}):(\d{2})\]\s*(.*)$/)
    if (!ts) continue
    const startSec = parseInt(ts[1], 10) * 60 + parseInt(ts[2], 10)
    const rest = ts[3].trim()
    let speaker: string | null = null
    let text = rest
    const sp = rest.match(SPEAKER_PREFIX)
    if (sp && sp[1].length < 30) {
      speaker = sp[1].trim()
      text = sp[2].trim()
    }
    if (!text) continue
    out.push({ speaker, startSec, endSec: 0, text })
  }
  for (let i = 0; i < out.length; i++) {
    const next = out[i + 1]?.startSec
    out[i].endSec =
      typeof next === 'number' && next > out[i].startSec
        ? next
        : out[i].startSec + 30
  }
  return out
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

    const { data: agendaRows, error: agendaErr } = await supabase
      .from('meeting_agendas')
      .select('id, title, order')
      .eq('meeting_id', meetingId)
      .order('order', { ascending: true })
    if (agendaErr) {
      console.error('[analyze-audio] meeting_agendas fetch', agendaErr)
    }
    const agendas: AgendaInput[] = (agendaRows ?? []).map((r) => ({
      id: r.id as string,
      title: r.title as string,
      order: r.order as number,
    }))

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

    // Persist the raw audio to Supabase Storage so the meeting detail
    // page can play it back. We do this BEFORE Gemini so a Gemini
    // failure doesn't lose the recording. Bucket is created on first
    // use; subsequent calls are no-ops (already-exists is swallowed).
    let audioUrl: string | null = null
    try {
      await supabase.storage
        .createBucket('meeting-audio', { public: true })
        .catch(() => {
          /* bucket exists — fine */
        })
      const ext = extForMime(audioMime)
      const objectPath = `${meetingId}/audio.${ext}`
      const upRes = await supabase.storage
        .from('meeting-audio')
        .upload(objectPath, audioBytes, {
          contentType: audioMime,
          upsert: true,
        })
      if (!upRes.error) {
        audioUrl = supabase.storage
          .from('meeting-audio')
          .getPublicUrl(objectPath).data.publicUrl
      } else {
        console.error('[analyze-audio] storage upload', upRes.error)
      }
    } catch (e) {
      console.error('[analyze-audio] storage error', (e as Error).message)
    }

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
                  text: `Transcribe this meeting audio and translate the
content to English. Regardless of the spoken language (Korean, English,
or mixed), every line you output must be in English.
- Keep proper nouns (people, products, place names) as the speakers say
  them. Korean names stay in Hangul, not romanised.
- Begin EVERY line with a [MM:SS] timestamp counted from the start of
  the audio (e.g. [00:00], [00:14], [02:31]). Use 00 padding.
- When multiple distinct voices are present, label EVERY turn with
  "Speaker 1:", "Speaker 2:", … . Use the SAME label every time the
  SAME voice speaks. Merge consecutive turns from one speaker into a
  single labelled paragraph.
- If only one voice is present, still include the [MM:SS] timestamp on
  each new line but omit the speaker label.
- Output format (one turn per line):
  [MM:SS] Speaker 1: First sentence in English.
  [MM:SS] Speaker 2: Next utterance in English.
- Output ONLY the transcript lines. No headings, no commentary, no markdown.`,
                },
              ],
            },
          ],
        }),
      )
    ).trim()

    const agendaPromptBlock = agendas.length
      ? `Agenda items (in order — map transcript content to these):\n${agendas
          .map((a, i) => `  ${i + 1}. [agendaId=${a.id}] ${a.title}`)
          .join('\n')}`
      : 'Agenda items: (none — leave byAgenda empty and put everything in "other")'

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
                  text: `${agendaPromptBlock}\n\nTranscript:\n\n${transcript}\n\nReturn the JSON now.`,
                },
              ],
            },
          ],
        }),
      )
    ).trim()

    const validAgendaIds = new Set(agendas.map((a) => a.id))
    let extracted: Extracted = {
      summary: undefined,
      keyDecisions: [],
      actionItems: [],
      followUps: [],
      unresolved: [],
      byAgenda: [],
      other: { summary: '', transcript: '' },
    }
    const jStart = rawExtract.indexOf('{')
    const jEnd = rawExtract.lastIndexOf('}')
    if (jStart >= 0 && jEnd >= 0) {
      try {
        const parsed = JSON.parse(rawExtract.slice(jStart, jEnd + 1))
        const rawByAgenda = Array.isArray(parsed.byAgenda) ? parsed.byAgenda : []
        const byAgenda: AgendaBucket[] = []
        for (const b of rawByAgenda) {
          if (!b || typeof b.agendaId !== 'string') continue
          if (!validAgendaIds.has(b.agendaId)) continue
          byAgenda.push({
            agendaId: b.agendaId,
            summary: typeof b.summary === 'string' ? b.summary : '',
            transcript: typeof b.transcript === 'string' ? b.transcript : '',
          })
        }
        const other =
          parsed.other && typeof parsed.other === 'object'
            ? {
                summary:
                  typeof parsed.other.summary === 'string'
                    ? parsed.other.summary
                    : '',
                transcript:
                  typeof parsed.other.transcript === 'string'
                    ? parsed.other.transcript
                    : '',
              }
            : { summary: '', transcript: '' }
        extracted = {
          summary: parsed.summary,
          keyDecisions: parsed.keyDecisions ?? [],
          actionItems: parsed.actionItems ?? [],
          followUps: parsed.followUps ?? [],
          unresolved: parsed.unresolved ?? [],
          byAgenda,
          other,
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
        raw_audio_url: audioUrl,
        processed_at: new Date().toISOString(),
      },
      { onConflict: 'meeting_id' },
    )
    if (saveErr) {
      return json({ error: `Save failed: ${saveErr.message}` }, 500)
    }

    // Per-agenda summary persistence: write each agenda's summary + transcript
    // excerpt into meeting_agendas.summary as JSON so the FE can show
    // anganda-grouped sections without a separate table.
    if (extracted.byAgenda.length > 0) {
      const updates = extracted.byAgenda.map((b) =>
        supabase
          .from('meeting_agendas')
          .update({
            summary: JSON.stringify({
              summary: b.summary,
              transcript: b.transcript,
            }),
            generated_by_ai: true,
          })
          .eq('id', b.agendaId),
      )
      const results = await Promise.all(updates)
      for (const r of results) {
        if (r.error) {
          console.error('[analyze-audio] meeting_agendas summary update', r.error)
        }
      }
    }

    // Persist per-turn segments so the UI can render timestamps and so
    // future per-speaker analytics have structured rows to query.
    // Clear + reinsert keeps the operation idempotent if the user
    // regenerates the analysis.
    const segments = parseTimestampedSegments(transcript)
    if (segments.length > 0) {
      await supabase
        .from('transcript_segments')
        .delete()
        .eq('meeting_id', meetingId)
      const { error: segErr } = await supabase
        .from('transcript_segments')
        .insert(
          segments.map((s) => ({
            meeting_id: meetingId,
            speaker_id: null, // speaker → user mapping is future work
            start_time: s.startSec,
            end_time: s.endSec,
            text: s.speaker ? `${s.speaker}: ${s.text}` : s.text,
          })),
        )
      if (segErr) {
        console.error('[analyze-audio] transcript_segments insert', segErr)
      }
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
