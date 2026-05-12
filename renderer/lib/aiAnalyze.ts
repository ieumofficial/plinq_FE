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

/** Kick off the AI pipeline for a single meeting. Resolves with the
 *  freshly-extracted data on success; throws on Zoom/Gemini errors.
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
