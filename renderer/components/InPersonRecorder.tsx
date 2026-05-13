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

// Minimal Web Speech API surface — the standard DOM lib doesn't ship
// these types yet. We only touch the bits we actually use.
type SpeechRecogResult = {
  isFinal: boolean
  0: { transcript: string }
}
type SpeechRecogEvent = {
  resultIndex: number
  results: ArrayLike<SpeechRecogResult>
}
type SpeechRecogLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((e: SpeechRecogEvent) => void) | null
  onerror: ((e: unknown) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}
type SpeechRecogCtor = new () => SpeechRecogLike

function getSpeechRecognitionCtor(): SpeechRecogCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecogCtor
    webkitSpeechRecognition?: SpeechRecogCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
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
 *
 * Live captions overlay the recorder area while the meeting is
 * recording. They come from the browser's built-in Web Speech API
 * (`webkitSpeechRecognition` in Chromium/Electron) — free, no API key,
 * decent Korean and English support. The final transcript still comes
 * from Gemini at Stop time (better quality + timestamps + speaker
 * labels), so these captions are purely a live UX preview.
 */
export default function InPersonRecorder({ meetingId, busy, onAnalyze }: Props) {
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [finalCaption, setFinalCaption] = useState('')
  const [interimCaption, setInterimCaption] = useState('')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recognitionRef = useRef<SpeechRecogLike | null>(null)
  const recordingRef = useRef(false)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef<number | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
      const rec = recorderRef.current
      if (rec && rec.state !== 'inactive') rec.stop()
      rec?.stream.getTracks().forEach((t) => t.stop())
      const recog = recognitionRef.current
      if (recog) {
        recog.onend = null
        try {
          recog.stop()
        } catch {
          /* already stopped */
        }
      }
    }
  }, [])

  function startSpeechRecognition() {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) return // Browser without Web Speech — captions just stay empty.
    const recog = new Ctor()
    recog.continuous = true
    recog.interimResults = true
    recog.lang = 'ko-KR'
    recog.onresult = (e) => {
      let finalChunk = ''
      let interimChunk = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        const t = r[0].transcript
        if (r.isFinal) finalChunk += t
        else interimChunk += t
      }
      if (finalChunk) {
        setFinalCaption((prev) =>
          prev ? `${prev} ${finalChunk.trim()}` : finalChunk.trim(),
        )
      }
      setInterimCaption(interimChunk)
    }
    recog.onerror = () => {
      /* swallow — speech recognition raises 'no-speech' / 'aborted'
         routinely, none of which are fatal. */
    }
    recog.onend = () => {
      // The API stops itself after long silences. Restart while the
      // user is still recording so captions feel continuous.
      if (recordingRef.current) {
        try {
          recog.start()
        } catch {
          /* race with stop() — fine */
        }
      }
    }
    try {
      recog.start()
    } catch {
      /* already started — fine */
    }
    recognitionRef.current = recog
  }

  function stopSpeechRecognition() {
    const recog = recognitionRef.current
    if (!recog) return
    recog.onend = null
    try {
      recog.stop()
    } catch {
      /* already stopped */
    }
    recognitionRef.current = null
  }

  async function start() {
    setError(null)
    setFinalCaption('')
    setInterimCaption('')
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
      recordingRef.current = true
      setElapsed(0)
      setRecording(true)
      timerRef.current = window.setInterval(() => {
        if (startedAtRef.current) {
          setElapsed(
            Math.floor((Date.now() - startedAtRef.current) / 1000),
          )
        }
      }, 1000) as unknown as number
      startSpeechRecognition()
    } catch (e) {
      const msg = (e as Error).message || ''
      setError(
        /denied|not allowed/i.test(msg)
          ? 'Mic permission denied — allow Electron access to the microphone.'
          : `Failed to start recording: ${msg}`,
      )
    }
  }

  async function stop() {
    const rec = recorderRef.current
    if (!rec) return
    recordingRef.current = false
    stopSpeechRecognition()
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
      <span className="text-[12px] text-gray-main shrink-0">Analyzing…</span>
    )
  }

  if (recording) {
    return (
      <div className="flex flex-col items-end gap-[6px] shrink-0 min-w-0">
        <div className="flex items-center gap-[8px]">
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
        {(finalCaption || interimCaption) && (
          <p
            className="text-[11px] leading-[16px] text-gray-main max-w-[320px] text-right max-h-[64px] overflow-y-auto"
            aria-live="polite"
          >
            {finalCaption}
            {interimCaption && (
              <span className="text-gray-secondary"> {interimCaption}</span>
            )}
          </p>
        )}
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
