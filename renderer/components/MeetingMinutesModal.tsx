import { useEffect, useState } from 'react'
import {
  useMeetingMinutes,
  parseSummary,
  type ExtractedMeeting,
} from '../lib/aiAnalyze'
import MeetingInsights from './MeetingInsights'

type Props = {
  meetingId: string
  meetingName: string
  onClose: () => void
}

/**
 * Full-meeting minutes viewer. Shows the parsed Summary + four-section
 * insights on top, the verbatim transcript below. Reuses the same
 * `useMeetingMinutes` hook and `parseSummary` helper as the inline card,
 * but pulls `full_text` (not selected by the project meetings list query).
 */
export default function MeetingMinutesModal({
  meetingId,
  meetingName,
  onClose,
}: Props) {
  const { data: minutes, isLoading } = useMeetingMinutes(meetingId)
  const insights: ExtractedMeeting | null = parseSummary(minutes?.summary)
  const [copied, setCopied] = useState(false)

  // Esc closes the modal (matches CreateMeetingModal's behaviour).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  function copyTranscript() {
    if (!minutes?.full_text) return
    navigator.clipboard.writeText(minutes.full_text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white-white rounded-[10px] shadow-2xl w-[800px] max-w-[95vw] max-h-[90vh] overflow-y-auto flex flex-col"
      >
        {/* Header */}
        <div className="px-[20px] pt-[20px] pb-[15px] border-b border-gray-border-light flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-blue-main text-[10px] font-semibold uppercase tracking-[1.5px]">
              Meeting Minutes
              {minutes?.processed_at && (
                <span className="text-gray-main normal-case tracking-normal ml-2">
                  · {new Date(minutes.processed_at).toLocaleString()}
                </span>
              )}
            </p>
            <h2 className="text-black text-[20px] font-semibold mt-1 truncate">
              {meetingName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-[32px] h-[32px] flex items-center justify-center rounded-full hover:bg-white-item text-gray-main text-[20px] leading-none shrink-0"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-[20px] py-[20px] flex flex-col gap-[20px]">
          {isLoading && (
            <p className="text-gray-main text-[13px]">불러오는 중…</p>
          )}

          {!isLoading && !minutes && (
            <p className="text-gray-main text-[13px]">
              저장된 회의록이 없어요.
            </p>
          )}

          {insights && (
            <div>
              <p className="text-gray-main text-[10px] font-semibold uppercase tracking-[1.5px] mb-[8px]">
                Insights
              </p>
              <MeetingInsights data={insights} />
            </div>
          )}

          {minutes?.full_text && (
            <div>
              <div className="flex items-center justify-between mb-[8px]">
                <p className="text-gray-main text-[10px] font-semibold uppercase tracking-[1.5px]">
                  Full Transcript
                </p>
                <button
                  type="button"
                  onClick={copyTranscript}
                  className="text-[11px] text-gray-main hover:text-black"
                >
                  {copied ? '복사됨' : '복사'}
                </button>
              </div>
              <pre className="bg-white-item border border-gray-border-light p-[15px] rounded-[8px] text-[13px] leading-[20px] text-black whitespace-pre-wrap font-sans break-words">
                {minutes.full_text}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
