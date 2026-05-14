// Client-side hook + invocation for the AI meeting analysis pipeline.
// Calls plinq_ai's `/meetings/{id}/analyze-audio` (FastAPI, NDJSON
// streamed) which downloads the recording from Storage, runs Whisper
// + Sonnet, and writes meeting_minutes / transcript_segments /
// meeting_decisions back. React Query hooks then surface those rows
// to the meeting detail UI.
import { useQuery } from '@tanstack/react-query'
import { aiStream } from './aiClient'
import { supabase } from './supabase'

export type AgendaBucket = {
  agendaId: string
  summary: string
  transcript: string
}

export type OtherBucket = {
  summary: string
  transcript: string
}

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
  /** Per-agenda summary + transcript excerpt — populated when the
   *  meeting had agendas at analysis time. Empty array on legacy rows. */
  byAgenda: AgendaBucket[]
  /** Content that did not fit any agenda. Empty fields when nothing. */
  other: OtherBucket
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
      const byAgenda: AgendaBucket[] = []
      if (Array.isArray(obj.byAgenda)) {
        for (const b of obj.byAgenda) {
          if (!b || typeof b.agendaId !== 'string') continue
          byAgenda.push({
            agendaId: b.agendaId,
            summary: typeof b.summary === 'string' ? b.summary : '',
            transcript: typeof b.transcript === 'string' ? b.transcript : '',
          })
        }
      }
      const other: OtherBucket =
        obj.other && typeof obj.other === 'object'
          ? {
              summary: typeof obj.other.summary === 'string' ? obj.other.summary : '',
              transcript:
                typeof obj.other.transcript === 'string' ? obj.other.transcript : '',
            }
          : { summary: '', transcript: '' }
      return {
        summary: obj.summary,
        keyDecisions: obj.keyDecisions ?? [],
        actionItems: obj.actionItems ?? [],
        followUps: obj.followUps ?? [],
        unresolved: obj.unresolved ?? [],
        byAgenda,
        other,
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
    byAgenda: [],
    other: { summary: '', transcript: '' },
  }
}

export type MeetingAgendaRow = {
  id: string
  meeting_id: string
  title: string
  order: number
  /** AI-generated summary for this agenda — JSON `{summary, transcript}`
   *  written by `analyze-audio`, or null if the meeting hasn't been
   *  analyzed (or analysis predates agenda-grouping). */
  summary: string | null
  generated_by_ai: boolean
}

export type ParsedMeetingAgenda = {
  id: string
  title: string
  order: number
  summary: string | null
  transcript: string | null
  generated_by_ai: boolean
}

export const meetingAgendasQueryKey = (meetingId: string) =>
  ['meeting_agendas', meetingId] as const

/** Fetch the meeting's agenda items ordered by `order`, with each
 *  agenda's AI summary JSON pre-parsed into `{summary, transcript}` so
 *  the UI can read fields directly. */
export function useMeetingAgendas(meetingId: string | null | undefined) {
  return useQuery({
    queryKey: meetingAgendasQueryKey(meetingId ?? ''),
    enabled: !!meetingId,
    queryFn: async (): Promise<ParsedMeetingAgenda[]> => {
      if (!meetingId) return []
      const { data, error } = await supabase
        .from('meeting_agendas')
        .select('id, meeting_id, title, order, summary, generated_by_ai')
        .eq('meeting_id', meetingId)
        .order('order', { ascending: true })
      if (error) throw error
      const rows = (data as MeetingAgendaRow[]) ?? []
      return rows.map((r) => {
        let summary: string | null = null
        let transcript: string | null = null
        if (r.summary) {
          const t = r.summary.trim()
          if (t.startsWith('{')) {
            try {
              const obj = JSON.parse(t) as {
                summary?: string
                transcript?: string
              }
              summary = obj.summary ?? null
              transcript = obj.transcript ?? null
            } catch {
              summary = r.summary
            }
          } else {
            summary = r.summary
          }
        }
        return {
          id: r.id,
          title: r.title,
          order: r.order,
          summary,
          transcript,
          generated_by_ai: r.generated_by_ai,
        }
      })
    },
  })
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

/**
 * Two-step in-person analysis:
 *   1. Upload the recording to the `meeting-audio` Storage bucket.
 *   2. Tell plinq_ai to fetch + transcribe + analyze + persist + index.
 *
 * The `onProgress` callback (optional) gets each NDJSON event the server
 * streams — useful for showing "Transcribing… → Analyzing… → Done".
 */
export async function analyzeAudio(
  meetingId: string,
  file: File | Blob,
  opts: { onProgress?: (evt: AnalyzeProgressEvent) => void } = {},
): Promise<AnalyzeAudioResult> {
  // Pick a stable extension based on MIME type or fall back to webm.
  const mime = (file as File).type || 'audio/webm'
  const ext =
    mime === 'audio/m4a' || mime === 'audio/mp4'
      ? 'm4a'
      : mime === 'audio/mpeg'
        ? 'mp3'
        : mime === 'audio/wav'
          ? 'wav'
          : 'webm'
  const path = `${meetingId}.${ext}`

  // 1. Upload to Storage. `upsert: true` lets the user re-record + analyze.
  const { error: upErr } = await supabase.storage
    .from('meeting-audio')
    .upload(path, file, { upsert: true, contentType: mime })
  if (upErr) {
    throw new Error(`Upload failed: ${upErr.message}`)
  }

  // 2. Stream-call plinq_ai.
  let result: AnalyzeAudioResult | null = null
  await aiStream(
    `/meetings/${encodeURIComponent(meetingId)}/analyze-audio`,
    { audio_path: path, bucket: 'meeting-audio' },
    (evt) => {
      const t = evt.type as AnalyzeProgressEvent['type']
      if (t === 'done') {
        result = {
          minutesId: String(evt.minutes_id ?? ''),
          decisionCount: Number(evt.decision_count ?? 0),
          segmentCount: Number(evt.segment_count ?? 0),
          actionItemCount: Number(evt.action_item_count ?? 0),
          language: (evt.language as string | null) ?? null,
          durationSeconds: Number(evt.duration_seconds ?? 0),
        }
      } else if (t === 'error') {
        throw new Error(String(evt.message ?? 'analyze failed'))
      }
      opts.onProgress?.(evt as AnalyzeProgressEvent)
    },
  )
  if (!result) {
    throw new Error('analyze-audio stream ended without a `done` event')
  }
  return result
}

export type AnalyzeAudioResult = {
  minutesId: string
  decisionCount: number
  segmentCount: number
  actionItemCount: number
  language: string | null
  durationSeconds: number
}

export type AnalyzeProgressEvent =
  | { type: 'downloading' }
  | { type: 'transcribing' }
  | { type: 'analyzing' }
  | { type: 'persisting' }
  | { type: 'indexing' }
  | { type: 'done'; minutes_id: string; decision_count: number; segment_count: number; action_item_count: number; language: string | null; duration_seconds: number }
  | { type: 'error'; message: string }

/**
 * Stub for the (future) Zoom cloud-recording analysis pipeline. Kept so
 * call sites don't break — throws a clear error until Phase 3.5 wires it
 * into plinq_ai.
 */
export async function analyzeMeeting(_meetingId: string): Promise<never> {
  throw new Error('Zoom analysis is not enabled in this build (Coming soon)')
}
