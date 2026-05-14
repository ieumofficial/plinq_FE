// Tiny client for plinq's Zoom Edge Functions. Wraps Supabase Functions
// invocation so callers don't have to know about the URL shape.
//
// This is the plinq equivalent of plow_FE/renderer/lib/backend.ts —
// instead of hitting an Express server at localhost:3001, we hit the
// project's Supabase Edge Functions.
import { supabase } from './supabase'

export type ZoomStatus = {
  connected: boolean
  expires_at: number | null
  scope: string | null
}

export type ZoomRecordingFile = {
  id: string
  meeting_id: string
  recording_start: string
  recording_end: string
  file_type: string
  file_extension?: string
  download_url: string
  status: string
}

export type ZoomMeetingSummary = {
  uuid: string
  id: string | number
  topic: string
  start_time: string
  duration: number
  total_size?: number
  recording_files?: ZoomRecordingFile[]
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
}

async function invoke<T>(
  name: string,
  init: { method?: 'GET' | 'POST'; body?: unknown } = {},
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, {
    method: init.method ?? 'GET',
    ...(init.body !== undefined ? { body: init.body } : {}),
  })
  if (error) throw new Error(`${name} failed: ${error.message}`)
  return data as T
}

export const zoomBackend = {
  status: () =>
    invoke<ZoomStatus>('zoom-status', { method: 'GET' }),

  authUrl: () =>
    invoke<{ url: string; state: string }>('zoom-auth-url', { method: 'GET' }),

  disconnect: () =>
    invoke<{ ok: true }>('zoom-disconnect', { method: 'POST' }),

  listRecordings: () =>
    invoke<{ meetings: ZoomMeetingSummary[] }>('zoom-list-recordings', {
      method: 'GET',
    }),

  /**
   * Create a Zoom meeting on behalf of the connected user.
   * - `type: 1` → instant meeting (host opens start_url immediately)
   * - `type: 2` → scheduled (provide ISO start_time + duration minutes)
   * Cloud recording is auto-enabled on the backend so the recording
   * is available for AI processing once the meeting ends.
   */
  createMeeting: (args: {
    topic: string
    type: 1 | 2
    start_time?: string
    duration?: number
  }) =>
    invoke<{
      id: number
      uuid?: string
      topic: string
      start_url: string
      join_url: string
      password?: string
    }>('zoom-create-meeting', { method: 'POST', body: args }),
}
