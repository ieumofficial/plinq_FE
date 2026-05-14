/**
 * Thin wrapper around plinq_ai's LiveKit token endpoint.
 *
 * Two reasons we go through plinq_ai instead of letting the FE mint tokens:
 *  1. Project membership check lives on the server (same gate as analyze-audio).
 *  2. We never want to ship LIVEKIT_API_SECRET to a client bundle.
 */
import { aiFetch } from './aiClient'

export type LiveKitJoinInfo = {
  token: string
  url: string
  room: string
  identity: string
}

export async function fetchLiveKitToken(meetingId: string): Promise<LiveKitJoinInfo> {
  const r = await aiFetch(`/meetings/${encodeURIComponent(meetingId)}/livekit-token`, {
    method: 'POST',
    body: {},
  })
  if (!r.ok) {
    let detail = `HTTP ${r.status}`
    try {
      const j = await r.json()
      detail = typeof j.detail === 'string' ? j.detail : detail
    } catch {
      /* keep status */
    }
    throw new Error(detail)
  }
  return (await r.json()) as LiveKitJoinInfo
}
