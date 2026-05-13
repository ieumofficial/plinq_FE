import { useEffect, useRef, useState } from 'react'

type Props = {
  meetingId: string
  /** True while the parent is uploading the captured blob to Gemini. */
  busy: boolean
  /** Called with the captured audio file when the user clicks Stop. The
   *  parent runs it through `analyzeAudio()` (same Edge Function the Zoom
   *  Auto-import button uses), so the resulting `meeting_minutes` row +
   *  inline `<MeetingInsights>` show up via the existing query. */
  onAnalyze: (file: File) => void | Promise<void>
}

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

/**
 * Inline microphone recorder shown on a meeting card when the meeting is
 * live AND has no Zoom URL (in-person mode). Uses the browser's
 * MediaRecorder so the audio captured here matches the file Zoom would
 * produce for the cloud-recording path — we send it through the same
 * `analyze-audio` Edge Function and get Summary + 4 sections back.
 */
export default function InPersonRecorder({ meetingId, busy, onAnalyze }: Props) {
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef<number | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
      const rec = recorderRef.current
      if (rec && rec.state !== 'inactive') rec.stop()
      rec?.stream.getTracks().forEach((t) => t.stop())
    }
  }, [])

  async function start() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      })
      const rec = new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.start()
      recorderRef.current = rec
      startedAtRef.current = Date.now()
      setElapsed(0)
      setRecording(true)
      timerRef.current = window.setInterval(() => {
        if (startedAtRef.current) {
          setElapsed(
            Math.floor((Date.now() - startedAtRef.current) / 1000),
          )
        }
      }, 1000) as unknown as number
    } catch (e) {
      const msg = (e as Error).message || ''
      setError(
        /denied|not allowed/i.test(msg)
          ? '마이크 권한이 거부됐어요 — Electron에 마이크 접근 허용 필요'
          : `녹음 시작 실패: ${msg}`,
      )
    }
  }

  async function stop() {
    const rec = recorderRef.current
    if (!rec) return
    const stopped = new Promise<Blob>((resolve) => {
      rec.onstop = () => {
        const mime = rec.mimeType || 'audio/webm'
        resolve(new Blob(chunksRef.current, { type: mime }))
      }
    })
    rec.stop()
    rec.stream.getTracks().forEach((t) => t.stop())
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    setRecording(false)
    const blob = await stopped
    const ext = blob.type.includes('webm')
      ? 'webm'
      : blob.type.includes('mp4')
        ? 'm4a'
        : 'audio'
    const file = new File([blob], `inperson-${meetingId}.${ext}`, {
      type: blob.type,
    })
    await onAnalyze(file)
  }

  if (busy) {
    return (
      <span className="text-[12px] text-gray-main shrink-0">분석 중…</span>
    )
  }

  if (recording) {
    return (
      <div className="flex items-center gap-[8px] shrink-0">
        <span className="inline-flex items-center gap-[6px] text-red-med text-[12px] font-medium">
          <span className="w-[8px] h-[8px] rounded-full bg-red-main animate-pulse" />
          REC {fmt(elapsed)}
        </span>
        <button
          type="button"
          onClick={() => void stop()}
          className="bg-red-main text-white text-[12px] px-[10px] py-[10px] rounded-[5px] hover:opacity-90"
        >
          Stop &amp; analyze
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      <button
        type="button"
        onClick={() => void start()}
        className="bg-blue-main text-white text-[12px] px-[10px] py-[10px] rounded-[5px] hover:opacity-90"
      >
        Start recording
      </button>
      {error && (
        <p className="text-red-med text-[11px] max-w-[220px] text-right">
          {error}
        </p>
      )}
    </div>
  )
}
