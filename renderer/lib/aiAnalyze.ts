// Client-side hook + invocation for the Gemini-powered AI meeting
// analysis pipeline. Talks to the `zoom-analyze` Supabase Edge Function
// and reads `meeting_minutes` rows back via React Query so the card can
// render the four-section insight inline once it's saved.
import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'

export type ExtractedMeeting = {
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

export type MeetingMinutesRow = {
  id: string
  meeting_id: string
  full_text: string | null
  summary: string | null
  raw_audio_url: string | null
  processed_at: string | null
}

export const meetingMinutesQueryKey = (meetingId: string) =>
  ['meeting_minutes', meetingId] as const

export type TranscriptSegmentRow = {
  id: string
  meeting_id: string
  speaker_id: string | null
  start_time: number
  end_time: number
  text: string
}

export const transcriptSegmentsQueryKey = (meetingId: string) =>
  ['transcript_segments', meetingId] as const

/** Fetch ordered transcript segments saved by `analyze-audio`.
 *  Empty array (not null) when none — keeps the consumer's render
 *  branch simple. */
export function useTranscriptSegments(meetingId: string | null | undefined) {
  return useQuery({
    queryKey: transcriptSegmentsQueryKey(meetingId ?? ''),
    enabled: !!meetingId,
    queryFn: async (): Promise<TranscriptSegmentRow[]> => {
      if (!meetingId) return []
      const { data, error } = await supabase
        .from('transcript_segments')
        .select('id, meeting_id, speaker_id, start_time, end_time, text')
        .eq('meeting_id', meetingId)
        .order('start_time', { ascending: true })
      if (error) throw error
      return (data as TranscriptSegmentRow[]) ?? []
    },
  })
}

/** React Query hook — returns the meeting_minutes row for a meeting, or
 *  null when analysis hasn't run yet. Treats "not found" as a non-error. */
export function useMeetingMinutes(meetingId: string | null | undefined) {
  return useQuery({
    queryKey: meetingMinutesQueryKey(meetingId ?? ''),
    enabled: !!meetingId,
    queryFn: async (): Promise<MeetingMinutesRow | null> => {
      if (!meetingId) return null
      const { data, error } = await supabase
        .from('meeting_minutes')
        .select('id, meeting_id, full_text, summary, raw_audio_url, processed_at')
        .eq('meeting_id', meetingId)
        .maybeSingle()
      if (error) throw error
      return (data as MeetingMinutesRow | null) ?? null
    },
  })
}

/** Try to parse the JSON payload stored in `meeting_minutes.summary`. The
 *  Edge Function writes the four-section JSON into that column; if it ever
 *  contains plain text (e.g. legacy rows) we surface it as `summary` only. */
export function parseSummary(raw: string | null | undefined): ExtractedMeeting | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('{')) {
    try {
      const obj = JSON.parse(trimmed)
      return {
        summary: obj.summary,
        keyDecisions: obj.keyDecisions ?? [],
        actionItems: obj.actionItems ?? [],
        followUps: obj.followUps ?? [],
        unresolved: obj.unresolved ?? [],
      }
    } catch {
      /* fall through */
    }
  }
  return {
    summary: trimmed,
    keyDecisions: [],
    actionItems: [],
    followUps: [],
    unresolved: [],
  }
}

/**
 * Materialise the AI-extracted action items into real `tasks` rows so
 * they show up in Kanban / Action Items / Tasks views and so the meeting
 * card's `action_count` badge reflects them.
 *
 * For each item we:
 *  1. Insert a row in `tasks` linked back to the meeting via
 *     `source_meeting_id`. Owner / due date end up in `description` so
 *     no signal is lost when we can't map them to structured fields.
 *  2. Try to match the AI-supplied owner string to a row in `users`
 *     (nickname > full name > first name). On a hit, insert into
 *     `task_assignees`. On a miss, the description still carries the
 *     name so the user can re-assign manually.
 *  3. Try to parse the due date as ISO (YYYY-MM-DD) or M/D — anything
 *     looser stays in description only.
 */
export async function acceptActionItems(args: {
  meetingId: string
  projectId: string
  items: ExtractedMeeting['actionItems']
}): Promise<{ inserted: number; errors: string[] }> {
  const { data: userData, error: authErr } = await supabase.auth.getUser()
  if (authErr || !userData.user) {
    return { inserted: 0, errors: ['Not logged in'] }
  }
  const me = userData.user.id

  const errors: string[] = []
  let inserted = 0

  for (const item of args.items) {
    const parsedDate = parseDueDateLoose(item.dueDate)
    const descriptionParts: string[] = []
    if (item.owner) descriptionParts.push(`Owner (AI): ${item.owner}`)
    if (item.dueDate && !parsedDate) {
      descriptionParts.push(`Due (AI, unparsed): ${item.dueDate}`)
    }
    descriptionParts.push('From AI meeting analysis')

    const { data: task, error: taskErr } = await supabase
      .from('tasks')
      .insert({
        project_id: args.projectId,
        title: item.task,
        description: descriptionParts.join('\n'),
        due_date: parsedDate,
        source_meeting_id: args.meetingId,
        status: 'planned',
        priority: 'medium',
        created_by: me,
      })
      .select('id')
      .single()
    if (taskErr || !task) {
      errors.push(
        `"${truncateForError(item.task)}": ${taskErr?.message ?? 'unknown error'}`,
      )
      continue
    }
    inserted++

    if (item.owner) {
      const ownerId = await findUserIdByName(item.owner)
      if (ownerId) {
        const { error: aErr } = await supabase
          .from('task_assignees')
          .insert({ task_id: task.id, user_id: ownerId })
        if (aErr) errors.push(`Assign ${item.owner}: ${aErr.message}`)
      }
    }
  }

  return { inserted, errors }
}

function truncateForError(s: string): string {
  return s.length > 40 ? s.slice(0, 37) + '…' : s
}

/** Loose ISO/M-D parser. Returns null when the input is too informal
 *  to land safely in the `due_date` date column. */
function parseDueDateLoose(raw: string | null | undefined): string | null {
  if (!raw) return null
  const s = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const md = s.match(/^(\d{1,2})\/(\d{1,2})$/)
  if (md) {
    const year = new Date().getFullYear()
    const mm = md[1].padStart(2, '0')
    const dd = md[2].padStart(2, '0')
    return `${year}-${mm}-${dd}`
  }
  // Korean "5월 18일"
  const ko = s.match(/^\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일\s*$/)
  if (ko) {
    const year = new Date().getFullYear()
    const mm = ko[1].padStart(2, '0')
    const dd = ko[2].padStart(2, '0')
    return `${year}-${mm}-${dd}`
  }
  return null
}

async function findUserIdByName(name: string): Promise<string | null> {
  const trimmed = name.trim()
  if (!trimmed) return null
  // Try nickname first (closest to "what someone said in a meeting"),
  // then first/last name. .or() with ilike covers Korean + English.
  const { data } = await supabase
    .from('users')
    .select('id')
    .or(
      `nickname.ilike.${trimmed},first_name.ilike.${trimmed},last_name.ilike.${trimmed}`,
    )
    .limit(1)
  return data?.[0]?.id ?? null
}

/** Upload a local Zoom recording (m4a) to the `analyze-audio` Edge
 *  Function and resolve with the extracted insights. We bypass
 *  `supabase.functions.invoke` here because that path JSON-stringifies
 *  the body — we need to ship raw audio bytes with an `audio/*`
 *  Content-Type instead. */
export async function analyzeAudio(
  meetingId: string,
  file: File | Blob,
): Promise<{ transcript: string; extracted: ExtractedMeeting }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    throw new Error('Supabase env vars are missing')
  }
  const url = `${supabaseUrl}/functions/v1/analyze-audio?meetingId=${encodeURIComponent(meetingId)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': (file as File).type || 'audio/mp4',
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
    },
    body: file,
  })
  const text = await res.text()
  if (!res.ok) {
    try {
      const body = JSON.parse(text)
      throw new Error(body.error || `HTTP ${res.status}`)
    } catch (e) {
      // not JSON or already a real Error — surface what we can
      if (e instanceof Error && e.message && !e.message.startsWith('HTTP'))
        throw e
      throw new Error(text.slice(0, 300) || `HTTP ${res.status}`)
    }
  }
  const data = JSON.parse(text) as
    | { ok: true; transcript: string; extracted: ExtractedMeeting }
    | { error: string }
  if ('error' in data) throw new Error(data.error)
  return { transcript: data.transcript, extracted: data.extracted }
}

/** Legacy: kick off the cloud-recording pipeline. Kept for Pro accounts
 *  that have Zoom cloud recording on. Free users should use
 *  `analyzeAudio()` with a local file instead.
 *  supabase-js's FunctionsHttpError.message is always the generic
 *  "Edge Function returned a non-2xx status code" — to surface the real
 *  message from the function body we have to dig into `error.context`,
 *  which is the raw Response. */
export async function analyzeMeeting(meetingId: string): Promise<{
  transcript: string
  extracted: ExtractedMeeting
}> {
  const { data, error } = await supabase.functions.invoke('zoom-analyze', {
    method: 'POST',
    body: { meetingId },
  })
  if (error) {
    let detail = error.message
    const ctx = (error as unknown as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      try {
        const body = await ctx.clone().json()
        if (body && typeof body.error === 'string') detail = body.error
      } catch {
        try {
          const txt = await ctx.clone().text()
          if (txt) detail = txt.slice(0, 300)
        } catch {
          /* keep generic message */
        }
      }
    }
    throw new Error(detail)
  }
  const result = data as
    | { ok: true; transcript: string; extracted: ExtractedMeeting }
    | { error: string }
  if ('error' in result) throw new Error(result.error)
  return { transcript: result.transcript, extracted: result.extracted }
}
