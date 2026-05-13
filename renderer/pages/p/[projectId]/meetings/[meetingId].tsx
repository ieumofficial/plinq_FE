import { useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useQueryClient } from '@tanstack/react-query'
import ProjectAppShell from '../../../../components/ProjectAppShell'
import Icon from '../../../../components/ui/Icon'
import MeetingTypeLabel from '../../../../components/ui/MeetingTypeLabel'
import {
  useProject,
  useProjectMeetings,
} from '../../../../lib/hooks'
import { queryKeys } from '../../../../lib/queryKeys'
import {
  useMeetingMinutes,
  useTranscriptSegments,
  parseSummary,
  acceptActionItems,
  analyzeAudio,
  meetingMinutesQueryKey,
  transcriptSegmentsQueryKey,
  type ExtractedMeeting,
  type TranscriptSegmentRow,
} from '../../../../lib/aiAnalyze'

export default function MeetingDetailPage() {
  const router = useRouter()
  const projectId =
    typeof router.query.projectId === 'string' ? router.query.projectId : null
  const meetingId =
    typeof router.query.meetingId === 'string' ? router.query.meetingId : null
  // Both params come from the URL — until Next.js has hydrated the
  // query object they're null, so render nothing rather than mounting
  // the AppShell against an empty id (it requires a real project).
  if (!projectId || !meetingId) return null
  return (
    <>
      <Head>
        <title>Meeting · plinq</title>
      </Head>
      <ProjectAppShell projectId={projectId} active="meetings">
        <MeetingDetailBody projectId={projectId} meetingId={meetingId} />
      </ProjectAppShell>
    </>
  )
}

function MeetingDetailBody({
  projectId,
  meetingId,
}: {
  projectId: string
  meetingId: string
}) {
  const { data: project } = useProject(projectId)
  const { data: meetings = [] } = useProjectMeetings(projectId)
  const { data: minutes } = useMeetingMinutes(meetingId)
  const { data: segments = [] } = useTranscriptSegments(meetingId)
  const queryClient = useQueryClient()
  const [accept, setAccept] = useState<{
    running: boolean
    inserted: number | null
    errors: string[]
  }>({ running: false, inserted: null, errors: [] })
  const [analyze, setAnalyze] = useState<{
    running: boolean
    error: string | null
  }>({ running: false, error: null })

  async function runAnalyze(file: File): Promise<void> {
    setAnalyze({ running: true, error: null })
    try {
      await analyzeAudio(meetingId, file)
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.project.meetings(projectId),
        }),
        queryClient.invalidateQueries({
          queryKey: meetingMinutesQueryKey(meetingId),
        }),
        queryClient.invalidateQueries({
          queryKey: transcriptSegmentsQueryKey(meetingId),
        }),
      ])
      setAnalyze({ running: false, error: null })
    } catch (e) {
      setAnalyze({ running: false, error: (e as Error).message })
    }
  }

  async function handleAutoImport(): Promise<void> {
    setAnalyze({ running: true, error: null })
    try {
      if (typeof window === 'undefined' || !window.ipc?.invoke) {
        throw new Error(
          'Auto-import is not available in browser preview — open the Electron app or use "Choose file" to upload.',
        )
      }
      type FindResult =
        | {
            found: true
            filename: string
            mime: string
            bytes: Uint8Array
            folder: string
            scannedPath: string
          }
        | {
            found: false
            scannedPath: string
            reason:
              | 'no-zoom-folder'
              | 'no-subfolders'
              | 'no-audio-files'
              | 'all-too-small'
            checkedFolders: { folder: string; files: string[] }[]
            error?: string
          }
      const result = await window.ipc.invoke<FindResult>(
        'import-latest-zoom-recording',
      )
      if (!result.found) {
        if (result.error) {
          throw new Error(`Failed to read Zoom folder: ${result.error}`)
        }
        const path = result.scannedPath || '(unknown)'
        const reasonMsg = {
          'no-zoom-folder': `Zoom folder not found — ${path}`,
          'no-subfolders': `${path} exists but has no recording subfolders. Make sure Zoom actually started recording.`,
          'no-audio-files': `No audio/video files in the most recent folder. Zoom may still be saving (usually 30s–5 min after the meeting ends). Retry shortly or use "Choose file".\nSearched: ${path}`,
          'all-too-small': `The audio file is too small (<10 KB — Zoom is still writing). Try again in a minute.\nSearched: ${path}`,
        }[result.reason]
        throw new Error(reasonMsg)
      }
      const blob = new Blob([new Uint8Array(result.bytes)], {
        type: result.mime,
      })
      const file = new File([blob], result.filename, { type: result.mime })
      await runAnalyze(file)
    } catch (e) {
      setAnalyze({ running: false, error: (e as Error).message })
    }
  }

  async function handleAcceptAll(
    items: ExtractedMeeting['actionItems'],
  ) {
    setAccept({ running: true, inserted: null, errors: [] })
    const result = await acceptActionItems({
      meetingId,
      projectId,
      items,
    })
    setAccept({
      running: false,
      inserted: result.inserted,
      errors: result.errors,
    })
    // Refresh project meetings so the `action_count` badge updates and
    // the materialised tasks appear elsewhere (Kanban / Action Items).
    await queryClient.invalidateQueries({
      queryKey: queryKeys.project.meetings(projectId),
    })
    await queryClient.invalidateQueries({
      queryKey: queryKeys.project.tasks(projectId),
    })
  }

  const meeting = useMemo(
    () => meetings.find((m) => m.id === meetingId),
    [meetings, meetingId],
  )
  const insights: ExtractedMeeting | null = parseSummary(minutes?.summary)

  if (!meeting) {
    return (
      <div className="p-6">
        <Link
          href={`/p/${projectId}/meetings`}
          className="text-[12px] text-gray-main hover:text-black inline-flex items-center gap-1"
        >
          ← Back to Meetings
        </Link>
        <p className="text-gray-main text-[13px] mt-6">
          Meeting not found (id: {meetingId}).
        </p>
      </div>
    )
  }

  const startDate = new Date(meeting.scheduled_at)
  const endDate = new Date(startDate.getTime() + meeting.duration_min * 60_000)
  const isZoom =
    !!meeting.location_or_url &&
    /^https?:\/\//i.test(meeting.location_or_url) &&
    /zoom\.us/i.test(meeting.location_or_url)

  const actionCount = insights?.actionItems.length ?? 0
  const decisionCount = insights?.keyDecisions.length ?? 0
  const openCount =
    (insights?.followUps.length ?? 0) + (insights?.unresolved.length ?? 0)

  const statusBadge = (() => {
    if (meeting.status === 'recording')
      return { label: 'LIVE', dot: 'bg-red-main', text: 'text-[#D9534F]' }
    if (meeting.status === 'processed')
      return {
        label: 'FINISHED',
        dot: 'bg-green-main',
        text: 'text-green-main',
      }
    return { label: 'SCHEDULED', dot: 'bg-gray-secondary', text: 'text-gray-main' }
  })()

  return (
    <div className="p-6 flex gap-6 items-start">
      <div className="flex-1 flex flex-col gap-6 min-w-0 max-w-[820px]">
      {/* Back link */}
      <Link
        href={`/p/${projectId}/meetings`}
        className="text-[12px] text-gray-main hover:text-black inline-flex items-center gap-1 w-fit"
      >
        ← Back to Meetings
      </Link>

      {/* Breadcrumb pills */}
      <div className="flex items-center gap-[10px] text-[10px] font-semibold uppercase tracking-[1.5px] text-gray-main flex-wrap">
        <span>{project?.name?.toUpperCase() ?? 'PROJECT'}</span>
        <span className="text-gray-secondary">·</span>
        <span>MEETING</span>
        <span className="text-gray-secondary">·</span>
        <span>{formatDateLabel(startDate)}</span>
        <span className="text-gray-secondary">·</span>
        <span>
          {formatTime(startDate)} → {formatTime(endDate)}
        </span>
        <MeetingTypeLabel type={meeting.meeting_type} />
        <span
          className={`inline-flex items-center gap-[5px] ${statusBadge.text}`}
        >
          <span className={`w-[6px] h-[6px] rounded-full ${statusBadge.dot}`} />
          {statusBadge.label}
        </span>
        {minutes?.processed_at && (
          <span className="text-gray-secondary normal-case tracking-normal">
            · {timeAgo(minutes.processed_at)}
          </span>
        )}
      </div>

      {/* Title + subtitle */}
      <div>
        <h1 className="text-black text-[32px] font-semibold leading-tight">
          {meeting.name}
        </h1>
        <p className="text-gray-main text-[13px] mt-2">
          {meeting.duration_min} min · {meeting.attendees.length} attendees ·{' '}
          {isZoom ? 'Zoom' : meeting.location_or_url ? 'In-person' : 'In-person'}{' '}
          ·{' '}
          {minutes
            ? 'auto-transcribed and summarized by AI'
            : 'awaiting AI analysis'}
        </p>
      </div>

      {/* AI Summary card */}
      {insights ? (
        (() => {
          // Confidence is a coarse readout of how much signal Gemini
          // actually found in the transcript. The thresholds reflect
          // "do we have enough to act on?" — not internal model
          // confidence, which the API doesn't expose for inline data.
          const totalItems =
            actionCount + decisionCount + openCount
          const confidence: 'HIGH' | 'MEDIUM' | 'LOW' =
            totalItems >= 4 ? 'HIGH' : totalItems >= 1 ? 'MEDIUM' : 'LOW'
          const confidenceColor = {
            HIGH: 'bg-green-main/30 text-[#D7F0DC]',
            MEDIUM: 'bg-yellow-500/30 text-[#FBE6B6]',
            LOW: 'bg-red-main/30 text-[#F4D6D6]',
          }[confidence]
          const assignedActionItems = insights.actionItems.filter(
            (a) => a.owner,
          ).length
          const unownedActionItems =
            insights.actionItems.length - assignedActionItems
          const actionHint =
            actionCount === 0
              ? '—'
              : unownedActionItems === 0
                ? `${assignedActionItems} assigned`
                : `${assignedActionItems} assigned · ${unownedActionItems} unowned`
          const decisionHint =
            decisionCount === 0
              ? '—'
              : decisionCount === 1
                ? 'logged'
                : 'all logged'
          const openHint =
            openCount === 0
              ? '—'
              : insights.unresolved[0] ??
                insights.followUps[0] ??
                'pending'
          return (
            <div className="bg-[#2E434E] text-white rounded-[10px] p-[20px] flex flex-col gap-[15px]">
              <div className="flex items-center gap-[8px] flex-wrap">
                <span className="bg-white/15 rounded p-[6px] inline-flex">
                  <Icon name="Sparkle" size={13} />
                </span>
                <span className="font-semibold text-[14px]">AI summary</span>
                <span className="bg-white/10 rounded-[3px] px-[8px] py-[2px] text-[10px] font-semibold uppercase tracking-[1.5px]">
                  {meeting.meeting_type.replace('_', '-')}
                </span>
                <span
                  className={`rounded-[3px] px-[8px] py-[2px] text-[10px] font-semibold uppercase tracking-[1.5px] ${confidenceColor}`}
                  title={`Signal density: ${totalItems} extracted items`}
                >
                  CONFIDENCE · {confidence}
                </span>
                {minutes?.processed_at && (
                  <span className="ml-auto text-[11px] text-white/60">
                    Generated {timeAgo(minutes.processed_at)}
                  </span>
                )}
              </div>

              {insights.summary && (
                <p className="text-[14px] leading-[22px] text-white/90">
                  {renderBoldMarkdown(insights.summary)}
                </p>
              )}

              <div className="grid grid-cols-4 gap-[10px]">
                <Stat
                  label="Action Items"
                  value={String(actionCount)}
                  hint={actionHint}
                />
                <Stat
                  label="Decisions"
                  value={String(decisionCount)}
                  hint={decisionHint}
                />
                <Stat
                  label="Open Items"
                  value={String(openCount)}
                  hint={openHint}
                />
                <Stat
                  label="Speaker Bal."
                  value="—"
                  hint="needs per-speaker timing"
                />
              </div>

              <div className="flex items-center gap-[8px] pt-[5px] flex-wrap">
                <button
                  type="button"
                  onClick={() => void handleAcceptAll(insights.actionItems)}
                  disabled={
                    accept.running ||
                    actionCount === 0 ||
                    accept.inserted !== null
                  }
                  className="bg-white text-black text-[12px] font-semibold px-[14px] py-[8px] rounded-[5px] disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Insert each action item as a task linked back to this meeting"
                >
                  {accept.running
                    ? 'Accepting…'
                    : accept.inserted !== null
                      ? `Accepted ${accept.inserted}`
                      : `Accept all ${actionCount > 0 ? `${actionCount} ` : ''}items`}
                </button>
                <button
                  type="button"
                  disabled
                  className="bg-white/10 text-white text-[12px] font-semibold px-[14px] py-[8px] rounded-[5px] inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Re-run analysis (not yet wired)"
                >
                  ↻ Regenerate
                </button>
                {accept.errors.length > 0 && (
                  <span className="text-[11px] text-red-light">
                    {accept.errors.length} item(s) failed — check console
                  </span>
                )}
              </div>
            </div>
          )
        })()
      ) : minutes?.full_text ? (
        <div className="bg-white-item border border-gray-border-light rounded-[10px] p-[20px]">
          <p className="text-gray-main text-[13px]">
            AI insights came back empty — the transcript is available
            below.
          </p>
        </div>
      ) : (
        <AnalyzeUploadCard
          analyzing={analyze.running}
          error={analyze.error}
          onAutoImport={() => void handleAutoImport()}
          onFile={(f) => void runAnalyze(f)}
        />
      )}

      {/* Generated Action Items */}
      {insights && insights.actionItems.length > 0 && (
        <section className="flex flex-col gap-[12px]">
          <div className="flex items-center justify-between">
            <h2 className="text-black text-[16px] font-semibold">
              {insights.actionItems.length} actions extracted from the
              conversation
            </h2>
          </div>
          <div className="border border-gray-border-light rounded-[10px] overflow-hidden bg-white-white">
            {insights.actionItems.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-[12px] px-[16px] py-[12px] border-b border-gray-border-light last:border-b-0"
              >
                <input
                  type="checkbox"
                  className="w-[14px] h-[14px] shrink-0 cursor-not-allowed"
                  disabled
                  aria-label="Action item (Accept-as-task not yet wired)"
                />
                <span
                  className="text-gray-secondary text-[11px] w-[44px] shrink-0"
                  style={{
                    fontFamily: 'Geist Mono, ui-monospace, monospace',
                  }}
                >
                  AI-{String(i + 1).padStart(3, '0')}
                </span>
                <span className="text-[13px] text-black flex-1 min-w-0">
                  {item.task}
                </span>
                {item.owner && (
                  <span className="text-[11px] text-gray-main shrink-0">
                    {item.owner}
                  </span>
                )}
                {item.dueDate && (
                  <span className="text-[11px] text-gray-secondary shrink-0">
                    {item.dueDate}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Key decisions & open items (compact lists) */}
      {insights &&
        (insights.keyDecisions.length > 0 ||
          insights.followUps.length > 0 ||
          insights.unresolved.length > 0) && (
          <div className="grid grid-cols-2 gap-[15px]">
            {insights.keyDecisions.length > 0 && (
              <ListBlock title="Key Decisions" accent="#2F6B45">
                {insights.keyDecisions}
              </ListBlock>
            )}
            {insights.followUps.length > 0 && (
              <ListBlock title="Follow-ups" accent="#8A5A1E">
                {insights.followUps}
              </ListBlock>
            )}
            {insights.unresolved.length > 0 && (
              <ListBlock title="Unresolved" accent="#9B3838">
                {insights.unresolved}
              </ListBlock>
            )}
          </div>
        )}

      {/* Full transcript — chat-style rows. Prefers the structured
          `transcript_segments` rows (have real timestamps); falls back
          to parsing the labelled full_text for analyses recorded
          before timestamp support landed. */}
      {(segments.length > 0 || minutes?.full_text) && (
        <section className="flex flex-col gap-[10px]">
          <h2 className="text-black text-[16px] font-semibold">Transcript</h2>
          <TranscriptList
            segments={segments}
            raw={minutes?.full_text ?? null}
          />
        </section>
      )}
      </div>

      {/* Right sidebar — Recording / Action Items / Attendees. Order
          matches the Figma "swap" arrow: Action Items sits above the
          Attendees card. */}
      <aside className="w-[280px] flex flex-col gap-[15px] shrink-0">
        <RecordingCard audioUrl={minutes?.raw_audio_url ?? null} />
        {insights && insights.actionItems.length > 0 && (
          <ActionItemsMini items={insights.actionItems} />
        )}
        <AttendeesCard attendees={meeting.attendees} />
      </aside>
    </div>
  )
}

function AnalyzeUploadCard({
  analyzing,
  error,
  onAutoImport,
  onFile,
}: {
  analyzing: boolean
  error: string | null
  onAutoImport: () => void
  onFile: (f: File) => void
}) {
  return (
    <div className="bg-white-white border border-gray-border-light rounded-[10px] p-[20px] flex items-center justify-between gap-3 flex-wrap">
      <div className="min-w-0 flex-1">
        <p className="text-black text-[14px] font-semibold">
          AI minutes — analyse the recording you just made
        </p>
        <p className="text-gray-main text-[12px] mt-1 leading-snug">
          Pulls the latest recording from Documents/Zoom and runs
          transcript + 4-section extraction. If the file lives elsewhere,
          use "Choose a file" to upload an m4a/mp4 directly.
        </p>
        {error && (
          <p className="text-red-med text-[12px] mt-2 break-words whitespace-pre-wrap">
            {error}
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-[6px] shrink-0">
        <button
          type="button"
          onClick={onAutoImport}
          disabled={analyzing}
          className="bg-blue-main text-white text-[12px] font-semibold px-[15px] py-[8px] rounded-[5px] hover:opacity-90 disabled:opacity-50 disabled:cursor-wait"
        >
          {analyzing ? 'Analyzing…' : 'Auto import latest'}
        </button>
        <label
          className={`text-[11px] text-gray-main hover:text-black ${
            analyzing ? 'opacity-50 cursor-wait' : 'cursor-pointer'
          }`}
        >
          or choose a file…
          <input
            type="file"
            accept="audio/*,video/mp4,.m4a,.mp4,.mp3,.wav,.webm"
            className="hidden"
            disabled={analyzing}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onFile(f)
              e.target.value = ''
            }}
          />
        </label>
      </div>
    </div>
  )
}

function RecordingCard({ audioUrl }: { audioUrl: string | null }) {
  return (
    <section className="bg-white-white border border-gray-border-light rounded-[10px] p-[15px] flex flex-col gap-[10px]">
      <p className="text-[10px] font-semibold uppercase tracking-[1.5px] text-gray-main">
        Recording
      </p>
      {audioUrl ? (
        <audio controls src={audioUrl} className="w-full" />
      ) : (
        <p className="text-[12px] text-gray-secondary italic">
          No saved recording yet. Once the post-meeting upload finishes
          you can play it back here.
        </p>
      )}
    </section>
  )
}

function ActionItemsMini({
  items,
}: {
  items: ExtractedMeeting['actionItems']
}) {
  return (
    <section className="bg-white-white border border-gray-border-light rounded-[10px] p-[15px] flex flex-col gap-[10px]">
      <p className="text-[10px] font-semibold uppercase tracking-[1.5px] text-gray-main">
        Action Items · {items.length}
      </p>
      <ul className="flex flex-col gap-[8px]">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-[8px]">
            <input
              type="checkbox"
              disabled
              className="w-[13px] h-[13px] mt-[3px] shrink-0 cursor-not-allowed"
              aria-label="Action item (not yet wired)"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-black leading-[16px]">
                {item.task}
              </p>
              {(item.owner || item.dueDate) && (
                <p className="text-[10px] text-gray-secondary mt-[2px]">
                  {[item.owner, item.dueDate].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function AttendeesCard({
  attendees,
}: {
  attendees: { id: string; first_name: string; last_name: string; nickname: string | null; job_title: string | null }[]
}) {
  return (
    <section className="bg-white-white border border-gray-border-light rounded-[10px] p-[15px] flex flex-col gap-[10px]">
      <p className="text-[10px] font-semibold uppercase tracking-[1.5px] text-gray-main">
        Attendees · {attendees.length}
      </p>
      {attendees.length === 0 ? (
        <p className="text-[12px] text-gray-secondary italic">
          No attendees yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-[8px]">
          {attendees.map((u) => {
            const name = u.nickname || `${u.first_name} ${u.last_name}`.trim() || 'User'
            const palette = avatarColorFor(name)
            return (
              <li key={u.id} className="flex items-center gap-[10px]">
                <span
                  className={`w-[28px] h-[28px] rounded-full inline-flex items-center justify-center text-[11px] font-semibold shrink-0 ${palette.bg} ${palette.text}`}
                >
                  {initialOf(name)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-black truncate">
                    {name}
                  </p>
                  {u.job_title && (
                    <p className="text-[10px] text-gray-secondary truncate">
                      {u.job_title}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/** Render text with `**bold**` markdown spans converted to `<strong>`. */
function renderBoldMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return (
        <strong key={i} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return <span key={i}>{part}</span>
  })
}

type Turn = { speaker: string | null; text: string }

/**
 * Parse Gemini's labelled transcript into discrete turns. The model is
 * prompted to prefix each turn with "화자 N:" / "Speaker N:" / a name —
 * we split on that pattern and treat any unlabelled lines as a
 * continuation of the previous turn. Falls back to one turn covering
 * the whole text when no speaker labels were emitted (single-voice
 * recording).
 */
function parseTurns(raw: string): Turn[] {
  const SPEAKER = /^([\p{L}][\p{L}\p{N}\s.]{0,40}?):\s*(.*)$/u
  const out: Turn[] = []
  let current: Turn | null = null
  for (const lineRaw of raw.split(/\r?\n/)) {
    const line = lineRaw.trim()
    if (!line) {
      if (current) {
        out.push(current)
        current = null
      }
      continue
    }
    const m = line.match(SPEAKER)
    if (m && m[1].length < 30) {
      if (current) out.push(current)
      current = { speaker: m[1].trim(), text: m[2] }
    } else if (current) {
      current.text += (current.text ? '\n' : '') + line
    } else {
      current = { speaker: null, text: line }
    }
  }
  if (current) out.push(current)
  return out
}

const AVATAR_PALETTE = [
  { bg: 'bg-[#E6ECEF]', text: 'text-[#3A5260]' },
  { bg: 'bg-[#DCEBE0]', text: 'text-[#2F6B45]' },
  { bg: 'bg-[#E5DEEF]', text: 'text-[#5B3D8A]' },
  { bg: 'bg-[#F2EAD5]', text: 'text-[#8A5A1E]' },
  { bg: 'bg-[#F4D6D6]', text: 'text-[#9B3838]' },
  { bg: 'bg-[#D6E4F4]', text: 'text-[#2D5A9E]' },
]

function avatarColorFor(speaker: string | null): {
  bg: string
  text: string
} {
  if (!speaker) return AVATAR_PALETTE[0]
  // Stable hash so the same speaker label maps to the same colour
  // across renders without us tracking it in state.
  let h = 0
  for (let i = 0; i < speaker.length; i++) h = (h * 31 + speaker.charCodeAt(i)) | 0
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]
}

function initialOf(speaker: string | null): string {
  if (!speaker) return '?'
  // First non-whitespace char, uppercased. Works for Korean names too
  // (just returns the first syllable).
  return speaker.trim().charAt(0).toUpperCase()
}

type RenderTurn = {
  startSec: number | null
  speaker: string | null
  text: string
}

function segmentToTurn(s: TranscriptSegmentRow): RenderTurn {
  // The Edge Function packs "Speaker: text" into a single column when
  // we have a label; split it back out here so the renderer can show
  // the speaker as a header above the text.
  const SPEAKER_PREFIX = /^([\p{L}][\p{L}\p{N}\s.]{0,40}?):\s*(.*)$/u
  const m = s.text.match(SPEAKER_PREFIX)
  if (m && m[1].length < 30) {
    return { startSec: s.start_time, speaker: m[1].trim(), text: m[2].trim() }
  }
  return { startSec: s.start_time, speaker: null, text: s.text }
}

function formatTimestamp(sec: number | null): string | null {
  if (sec == null || Number.isNaN(sec)) return null
  const total = Math.max(0, Math.floor(sec))
  const mm = Math.floor(total / 60)
    .toString()
    .padStart(2, '0')
  const ss = (total % 60).toString().padStart(2, '0')
  return `${mm}:${ss}`
}

function TranscriptList({
  segments,
  raw,
}: {
  segments: TranscriptSegmentRow[]
  raw: string | null
}) {
  const turns: RenderTurn[] =
    segments.length > 0
      ? segments.map(segmentToTurn)
      : raw
        ? parseTurns(raw).map((t) => ({ ...t, startSec: null }))
        : []
  if (turns.length === 0) {
    return (
      <div className="bg-white-white border border-gray-border-light rounded-[10px] p-[16px]">
        <p className="text-gray-main text-[13px] italic">
          Transcript is empty.
        </p>
      </div>
    )
  }
  return (
    <div className="bg-white-white border border-gray-border-light rounded-[10px] py-[8px]">
      {turns.map((turn, i) => {
        const palette = avatarColorFor(turn.speaker)
        const ts = formatTimestamp(turn.startSec)
        return (
          <div
            key={i}
            className="flex items-start gap-[12px] px-[16px] py-[10px]"
          >
            {ts && (
              <span
                className="text-[11px] text-gray-secondary w-[40px] shrink-0 mt-[3px]"
                style={{
                  fontFamily: 'Geist Mono, ui-monospace, monospace',
                }}
              >
                {ts}
              </span>
            )}
            <span
              className={`w-[24px] h-[24px] rounded-full inline-flex items-center justify-center text-[11px] font-semibold shrink-0 ${palette.bg} ${palette.text}`}
            >
              {initialOf(turn.speaker)}
            </span>
            <div className="flex-1 min-w-0">
              {turn.speaker && (
                <p className="text-[12px] font-semibold text-black">
                  {turn.speaker}
                </p>
              )}
              <p className="text-[13px] leading-[20px] text-black whitespace-pre-wrap break-words mt-[2px]">
                {turn.text}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="bg-white/[0.06] rounded-[6px] p-[12px] flex flex-col gap-[4px]">
      <p className="text-[10px] font-semibold uppercase tracking-[1.5px] text-white/60">
        {label}
      </p>
      <p className="text-[28px] font-semibold leading-none">{value}</p>
      <p className="text-[10px] text-white/40">{hint}</p>
    </div>
  )
}

function ListBlock({
  title,
  accent,
  children,
}: {
  title: string
  accent: string
  children: string[]
}) {
  return (
    <div className="bg-white-white border border-gray-border-light rounded-[10px] p-[15px] flex flex-col gap-[10px]">
      <p
        className="text-[10px] font-semibold uppercase tracking-[1.5px]"
        style={{ color: accent }}
      >
        {title}
      </p>
      <ul className="flex flex-col gap-[6px]">
        {children.map((item, i) => (
          <li key={i} className="flex items-start gap-[8px]">
            <span
              className="w-[6px] h-[6px] rounded-full mt-[7px] shrink-0"
              style={{ backgroundColor: accent }}
            />
            <p className="text-[13px] leading-[20px] text-black">{item}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

function formatDateLabel(d: Date): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const that = new Date(d)
  that.setHours(0, 0, 0, 0)
  const diffDays = Math.round(
    (that.getTime() - today.getTime()) / 86400000,
  )
  if (diffDays === 0) return 'TODAY'
  if (diffDays === -1) return 'YESTERDAY'
  if (diffDays === 1) return 'TOMORROW'
  return d
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    .toUpperCase()
}

function formatTime(d: Date): string {
  return d
    .toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    .replace(/^24:/, '00:')
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  if (diffMs < 0) return 'just now'
  const min = Math.floor(diffMs / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hr ago`
  const day = Math.floor(hr / 24)
  return `${day}d ago`
}
