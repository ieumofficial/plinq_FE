/**
 * In-app voice meeting room (LiveKit).
 *
 * Renders a small panel that:
 *   - fetches a LiveKit access token from plinq_ai
 *   - connects to the room (audio publish + subscribe, no video for now)
 *   - shows the participant list with a speaking indicator
 *   - lets the user mute / unmute / leave
 *
 * Recording + analyze-audio wiring is Phase 2 (server-side Egress).
 */
import { useEffect, useRef, useState } from 'react'
import {
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
  type LocalParticipant,
  type Participant,
} from 'livekit-client'
import Button from './ui/Button'
import { fetchLiveKitToken, startMeetingRecording } from '../lib/livekit'

type Props = {
  meetingId: string
  meetingName?: string
  onLeave?: () => void
}

type ParticipantState = {
  identity: string
  name: string
  isLocal: boolean
  isSpeaking: boolean
  isMuted: boolean
}

export default function MeetingRoom({ meetingId, meetingName, onLeave }: Props) {
  const roomRef = useRef<Room | null>(null)
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error' | 'left'>(
    'idle',
  )
  const [error, setError] = useState<string | null>(null)
  const [participants, setParticipants] = useState<ParticipantState[]>([])
  const [muted, setMuted] = useState(false)
  const [recording, setRecording] = useState(false)
  const [startingRecording, setStartingRecording] = useState(false)
  const [recError, setRecError] = useState<string | null>(null)

  // Connect on mount, leave on unmount.
  useEffect(() => {
    let cancelled = false
    const room = new Room({
      adaptiveStream: false,
      dynacast: true,
    })
    roomRef.current = room

    function rebuildParticipants() {
      if (cancelled) return
      const list: ParticipantState[] = []
      const all: Participant[] = [
        room.localParticipant as LocalParticipant,
        ...Array.from(room.remoteParticipants.values()),
      ]
      for (const p of all) {
        const audioTrack = Array.from(p.audioTrackPublications.values())[0]
        list.push({
          identity: p.identity,
          name: p.name || p.identity,
          isLocal: p === room.localParticipant,
          isSpeaking: p.isSpeaking,
          isMuted: audioTrack?.isMuted ?? false,
        })
      }
      setParticipants(list)
    }

    room
      .on(RoomEvent.ParticipantConnected, rebuildParticipants)
      .on(RoomEvent.ParticipantDisconnected, rebuildParticipants)
      .on(RoomEvent.ActiveSpeakersChanged, rebuildParticipants)
      .on(RoomEvent.TrackMuted, rebuildParticipants)
      .on(RoomEvent.TrackUnmuted, rebuildParticipants)
      .on(RoomEvent.LocalTrackPublished, rebuildParticipants)
      // LiveKit broadcasts recording state to every participant — using
      // this means whoever clicked "Start recording" doesn't need to
      // tell the others; they all see the REC indicator together.
      .on(RoomEvent.RecordingStatusChanged, (active: boolean) => {
        if (cancelled) return
        setRecording(active)
      })
      .on(RoomEvent.TrackSubscribed, (track, _pub, participant: RemoteParticipant) => {
        // Audio tracks attach to a hidden <audio> so we can hear them.
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach()
          el.style.display = 'none'
          el.dataset.lkParticipant = participant.identity
          document.body.appendChild(el)
        }
      })
      .on(RoomEvent.TrackUnsubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) track.detach().forEach((el) => el.remove())
      })
      .on(RoomEvent.Disconnected, () => {
        if (!cancelled) setStatus('left')
      })

    ;(async () => {
      setStatus('connecting')
      setError(null)
      try {
        const info = await fetchLiveKitToken(meetingId)
        if (cancelled) return
        await room.connect(info.url, info.token)
        if (cancelled) return
        // Publish microphone immediately so other participants can hear us.
        await room.localParticipant.setMicrophoneEnabled(true)
        if (cancelled) return
        setStatus('connected')
        // Pick up an already-running recording on first connect.
        setRecording(room.isRecording)
        rebuildParticipants()
      } catch (e) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : String(e)
        setError(msg)
        setStatus('error')
      }
    })()

    return () => {
      cancelled = true
      // Detach any audio elements we appended to body.
      document.querySelectorAll('audio[data-lk-participant]').forEach((el) => el.remove())
      void room.disconnect()
    }
    // We deliberately mount once per meetingId; subsequent props don't
    // re-run the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId])

  async function toggleMute() {
    const room = roomRef.current
    if (!room) return
    const next = !muted
    await room.localParticipant.setMicrophoneEnabled(!next)
    setMuted(next)
  }

  async function startRecording() {
    if (recording || startingRecording) return
    setStartingRecording(true)
    setRecError(null)
    try {
      await startMeetingRecording(meetingId)
      // No need to setRecording(true) here — LiveKit's RecordingStatusChanged
      // event fires for every participant (us included) within ~1s.
    } catch (e) {
      setRecError(e instanceof Error ? e.message : String(e))
    } finally {
      setStartingRecording(false)
    }
  }

  function leave() {
    void roomRef.current?.disconnect()
    onLeave?.()
  }

  return (
    <div className="flex flex-col gap-[10px] rounded-[10px] border border-gray-border-light bg-white-white p-[15px]">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <p className="text-[10px] uppercase tracking-[1.5px] text-gray-secondary">
            Voice room
          </p>
          <h3 className="text-[14px] font-semibold text-black truncate max-w-[260px]">
            {meetingName ?? 'Meeting'}
          </h3>
        </div>
        <div className="flex items-center gap-[8px]">
          {recording && (
            <span className="inline-flex items-center gap-[5px] text-[10px] font-semibold uppercase tracking-[1.5px] text-red-main">
              <span className="size-[8px] animate-pulse rounded-full bg-red-main" />
              REC
            </span>
          )}
          <span
            className={`text-[10px] uppercase tracking-[1.5px] ${
              status === 'connected'
                ? 'text-green-main'
                : status === 'error'
                  ? 'text-red-main'
                  : 'text-gray-secondary'
            }`}
          >
            {status === 'connecting' && 'Connecting…'}
            {status === 'connected' && 'Live'}
            {status === 'left' && 'Disconnected'}
            {status === 'error' && 'Error'}
            {status === 'idle' && 'Idle'}
          </span>
        </div>
      </div>

      {error && (
        <p className="rounded-[6px] border border-red-med/40 bg-red-light px-[8px] py-[6px] text-[11px] text-red-main">
          {error}
        </p>
      )}

      {status === 'connected' && (
        <>
          <ul className="flex flex-col gap-[5px]">
            {participants.map((p) => (
              <li
                key={p.identity}
                className="flex items-center gap-[8px] rounded-[5px] px-[6px] py-[4px] hover:bg-white-item"
              >
                <span
                  className={`size-[8px] rounded-full ${
                    p.isSpeaking ? 'bg-green-main' : 'bg-gray-border'
                  }`}
                  title={p.isSpeaking ? 'Speaking' : 'Quiet'}
                />
                <span className="flex-1 truncate text-[12px] text-black">
                  {p.name}
                  {p.isLocal && <span className="ml-[5px] text-gray-secondary">(you)</span>}
                </span>
                {p.isMuted && (
                  <span className="text-[10px] uppercase text-gray-secondary">muted</span>
                )}
              </li>
            ))}
          </ul>
          {recError && (
            <p className="rounded-[6px] border border-red-med/40 bg-red-light px-[8px] py-[5px] text-[11px] text-red-main">
              {recError}
            </p>
          )}
          <div className="flex items-center justify-between gap-[8px] pt-[5px]">
            {recording ? (
              <span className="text-[11px] text-gray-main">
                Recording — AI will summarize once everyone leaves.
              </span>
            ) : (
              <Button
                variant="primary"
                size="compact"
                onClick={() => void startRecording()}
                disabled={startingRecording}
              >
                {startingRecording ? 'Starting…' : '● Start recording'}
              </Button>
            )}
            <div className="flex items-center gap-[8px]">
              <Button variant="secondary" size="compact" onClick={toggleMute}>
                {muted ? 'Unmute' : 'Mute'}
              </Button>
              <Button variant="tertiary" size="compact" onClick={leave}>
                Leave
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
