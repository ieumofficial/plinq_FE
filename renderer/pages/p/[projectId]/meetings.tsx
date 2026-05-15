import { useMemo, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useQueryClient } from '@tanstack/react-query'
import ProjectAppShell, { useCreateNew } from '../../../components/ProjectAppShell'
import Button from '../../../components/ui/Button'
import Input from '../../../components/ui/Input'
import Icon from '../../../components/ui/Icon'
import UserGroup from '../../../components/ui/UserGroup'
import ZoomConnectButton from '../../../components/ZoomConnectButton'
import { useProject, useProjectMeetings } from '../../../lib/hooks'
import { queryKeys } from '../../../lib/queryKeys'
import { supabase } from '../../../lib/supabase'
import { parseSummary } from '../../../lib/aiAnalyze'
import { userToMember, type MeetingType } from '../../../lib/types'
import MeetingTypeLabel from '../../../components/ui/MeetingTypeLabel'
import { resolveProjectColor } from '../../../lib/projectColors'

function dateBlock(iso: string): { top: string; bottom: string } {
  const d = new Date(iso)
  const today = new Date()
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  const top = isToday
    ? 'TODAY'
    : d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  const bottom = isToday
    ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    : d.getDate().toString()
  return { top, bottom }
}

function metaLabel(iso: string, durationMin: number): string {
  const d = new Date(iso)
  const today = new Date()
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  const time = d
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    .toUpperCase()
  const dayLabel = isToday ? 'Today' : d.toLocaleDateString('en-US')
  return `${dayLabel} · ${time} · ${durationMin} min`
}

// Date block bg + label colour by meeting type. Mirrors the tag colour
// each `MeetingTypeLabel` uses so a quick glance at the date block
// already conveys the meeting kind. Figma 976:3975 varies per card.
const DATE_BLOCK_STYLES: Record<MeetingType, { bg: string; text: string }> = {
  planning: { bg: 'bg-[#E6ECEF]', text: 'text-[#6B7B86]' }, // gray-blue
  check_in: { bg: 'bg-[#DCEBE0]', text: 'text-[#2F6B45]' }, // pale green
  review: { bg: 'bg-[#F2EAD5]', text: 'text-[#8A5A1E]' }, // pale sand
  retrospective: { bg: 'bg-[#E5DEEF]', text: 'text-[#5B3D8A]' }, // pale purple
}

export default function MeetingsPage() {
  const router = useRouter()
  const projectId = router.query.projectId as string | undefined
  if (!projectId) return null
  return (
    <>
      <Head>
        <title>plinq · Meetings</title>
      </Head>
      <ProjectAppShell projectId={projectId} active="meetings">
        <MeetingsBody projectId={projectId} />
      </ProjectAppShell>
    </>
  )
}

function MeetingsBody({ projectId }: { projectId: string }) {
  const { open } = useCreateNew()
  const router = useRouter()
  const { data: project } = useProject(projectId)
  const { data: meetings = [] } = useProjectMeetings(projectId)
  const [search, setSearch] = useState('')
  const queryClient = useQueryClient()
  // Per-meeting AI analysis state. Lives at body-level so we can fan out
  // status to the inline analyze card per row without lifting each card
  // into its own component (one row = one map iteration, no hooks allowed).
  const [analyzeState, setAnalyzeState] = useState<
    Record<string, { analyzing: boolean; error: string | null }>
  >({})
  async function handleAnalyzeFile(meetingId: string, file: File) {
    setAnalyzeState((prev) => ({
      ...prev,
      [meetingId]: { analyzing: true, error: null },
    }))
    try {
      await analyzeAudio(meetingId, file)
      await queryClient.invalidateQueries({
        queryKey: queryKeys.project.meetings(projectId),
      })
      setAnalyzeState((prev) => ({
        ...prev,
        [meetingId]: { analyzing: false, error: null },
      }))
    } catch (e) {
      setAnalyzeState((prev) => ({
        ...prev,
        [meetingId]: { analyzing: false, error: (e as Error).message },
      }))
    }
  }

  // Open a Zoom (or other) URL in the system browser via Electron IPC,
  // falling back to window.open when running in a plain browser preview.
  function openExternal(url: string) {
    if (typeof window !== 'undefined' && window.ipc) {
      window.ipc.send('open-external', url)
    } else {
      window.open(url, '_blank')
    }
  }

  // Mark a meeting as "live now". Used when the user clicks Join — the
  // row flips to `recording` so the card UI swaps Join for the Open Zoom +
  // End meeting controls, and downstream features (zoom-analyze polling)
  // know which row to watch.
  async function startMeeting(meetingId: string) {
    const { error } = await supabase
      .from('meetings')
      .update({ status: 'recording' })
      .eq('id', meetingId)
    if (error) {
      console.error('[meetings] startMeeting status update failed', error)
      return
    }
    await queryClient.invalidateQueries({
      queryKey: queryKeys.project.meetings(projectId),
    })
  }

  // Flag the meeting as finished. The AI pipeline picks up `processed`
  // rows and runs transcript → summary against the Zoom cloud recording
  // (or any uploaded audio) — added in the next iteration.
  async function endMeeting(meetingId: string) {
    const { error } = await supabase
      .from('meetings')
      .update({ status: 'processed' })
      .eq('id', meetingId)
    if (error) {
      console.error('[meetings] endMeeting status update failed', error)
      return
    }
    await queryClient.invalidateQueries({
      queryKey: queryKeys.project.meetings(projectId),
    })
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return meetings
    const q = search.toLowerCase()
    return meetings.filter((m) => m.name.toLowerCase().includes(q))
  }, [meetings, search])

  const totalActions = meetings.reduce((s, m) => s + m.action_count, 0)

  return (
    <div className="p-6 flex flex-col gap-6 h-full overflow-y-auto">
          {/* Toolbar */}
          <div className="flex items-end justify-between gap-4">
            <div className="flex flex-col gap-[5px]">
              <p
                className="text-[10px] font-medium uppercase tracking-[1.5px]"
                style={{ color: resolveProjectColor(project?.color) }}
              >
                {(project?.name ?? '').toUpperCase()} · MEETINGS · {meetings.length} INDEXED
              </p>
              <h1 className="text-black text-[28px] font-semibold leading-tight">
                Every conversation,{' '}
                <em
                  className="italic text-blue-main font-medium"
                  style={{ fontFamily: 'Inter, ui-sans-serif, sans-serif' }}
                >
                  indexed.
                </em>
              </h1>
            </div>
            <div className="flex items-center gap-[10px]">
              <ZoomConnectButton />
              <Input
                variant="search"
                placeholder="Find a meeting..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Button size="compact" variant="secondary" iconLeft="Filter">
                Filter
              </Button>
              <Button size="compact" variant="secondary" iconLeft="Filter">
                Sort: Recent
              </Button>
              <Button size="compact" iconLeft="Add" onClick={() => open('meeting')}>
                Schedule
              </Button>
            </div>
          </div>

          {/* AI insights bar — dark navy to match Figma 976:3975 + Join
              button colour. Hidden until the project has processed
              meetings with at least one extracted action. */}
          {totalActions > 0 && (
            <div className="bg-[#2E434E] text-white rounded-[10px] p-[20px] flex items-center justify-between gap-4">
              <div className="flex items-center gap-[15px]">
                <span className="bg-white/15 rounded p-[8px] inline-flex">
                  <Icon name="Sparkle" size={15} />
                </span>
                <div className="flex flex-col gap-[4px]">
                  <p className="text-[14px] font-semibold">
                    {totalActions} action items extracted from this project&apos;s
                    meetings.
                  </p>
                  <p className="text-[12px] text-white/60">
                    AI processed {meetings.length}{' '}
                    {meetings.length === 1 ? 'meeting' : 'meetings'}.
                  </p>
                </div>
              </div>
              <Button size="compact" variant="secondary">
                Review actions
              </Button>
            </div>
          )}

          {/* List */}
          <div className="flex flex-col gap-[10px]">
            {filtered.length === 0 ? (
              <div className="bg-white-white border border-gray-border-light rounded-[10px] p-12 text-center">
                <p className="text-gray-secondary text-[14px]">
                  {meetings.length === 0
                    ? 'No meetings scheduled yet.'
                    : 'No meetings match your search.'}
                </p>
              </div>
            ) : (
              filtered.map((m) => {
                const block = dateBlock(m.scheduled_at)
                const isLive = m.status === 'recording'
                const isUpcoming = new Date(m.scheduled_at).getTime() >= Date.now()
                const showJoin = isLive || isUpcoming
                const dateStyle = DATE_BLOCK_STYLES[m.meeting_type]
                const insights = parseSummary(m.summary)
                const az = analyzeState[m.id] ?? {
                  analyzing: false,
                  error: null,
                }
                return (
                  <div key={m.id} className="flex flex-col gap-[10px]">
                  <article
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      // Whole card opens the meeting — but let inner controls
                      // (Join, recorder, the title link) handle their own
                      // clicks instead of also navigating.
                      if (
                        (e.target as HTMLElement).closest(
                          'button, a, input, textarea'
                        )
                      )
                        return
                      router.push(`/p/${projectId}/meetings/${m.id}`)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        router.push(`/p/${projectId}/meetings/${m.id}`)
                      }
                    }}
                    className="bg-white-white border border-gray-border-light rounded-[10px] p-[15px] flex items-center gap-[15px] cursor-pointer hover:border-blue-main transition-colors"
                  >
                    {/* Date block — 60×50 */}
                    <div
                      className={`w-[60px] h-[50px] rounded-[3px] py-[5px] flex flex-col items-center justify-center shrink-0 ${dateStyle.bg}`}
                    >
                      <p
                        className={`opacity-70 text-[10px] uppercase tracking-[1px] text-center ${dateStyle.text}`}
                        style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontWeight: 600 }}
                      >
                        {block.top}
                      </p>
                      <p
                        className={`text-[14px] tracking-[1px] text-center ${dateStyle.text}`}
                        style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontWeight: 600 }}
                      >
                        {block.bottom}
                      </p>
                    </div>

                    {/* Body — two stacked rows */}
                    <div className="flex-1 min-w-0 flex flex-col gap-[10px]">
                      {/* Top row */}
                      <div className="flex items-start justify-between gap-[15px]">
                        <div className="flex flex-col gap-[10px] min-w-0 flex-1">
                          <div className="flex items-center gap-[15px] flex-wrap">
                            <Link
                              href={`/p/${projectId}/meetings/${m.id}`}
                              className="text-black text-[20px] font-semibold leading-none hover:text-blue-main"
                            >
                              {m.name}
                            </Link>
                            <span
                              className="text-[10px] tracking-[1px] text-[#6B7B86]"
                              style={{
                                fontFamily: 'Geist Mono, ui-monospace, monospace',
                                fontWeight: 600,
                              }}
                            >
                              {metaLabel(m.scheduled_at, m.duration_min)}
                            </span>
                            {isLive && (
                              <span className="flex items-center gap-[5px]">
                                <span className="w-[6px] h-[6px] rounded-full bg-red-main" />
                                <span
                                  className="text-[#D9534F] text-[10px] tracking-[1px]"
                                  style={{
                                    fontFamily: 'Geist Mono, ui-monospace, monospace',
                                    fontWeight: 600,
                                  }}
                                >
                                  LIVE
                                </span>
                              </span>
                            )}
                          </div>
                          {insights?.summary && (
                            <p className="text-[12px] text-[#6B7B86] leading-snug">
                              {insights.summary}
                            </p>
                          )}
                        </div>
                        {(showJoin || isLive) && (() => {
                          const url = m.location_or_url
                          const isUrl = !!url && /^https?:\/\//i.test(url)
                          // Live mode branches by meeting type:
                          //  - Zoom (URL present): Open Zoom + End meeting
                          //  - In-person (no URL): inline mic recorder that
                          //    captures audio with MediaRecorder and pipes
                          //    the blob through `analyze-audio` on stop.
                          if (isLive) {
                            if (!isUrl) {
                              return (
                                <InPersonRecorder
                                  meetingId={m.id}
                                  busy={az.analyzing}
                                  onAnalyze={(file) =>
                                    handleAnalyzeFile(m.id, file)
                                  }
                                />
                              )
                            }
                            return (
                              <div className="flex items-center gap-[8px] shrink-0">
                                <button
                                  type="button"
                                  onClick={() => openExternal(url!)}
                                  className="bg-white-white border border-gray-border text-black text-[12px] px-[10px] py-[10px] rounded-[5px] hover:bg-white-item"
                                >
                                  Open Zoom
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void endMeeting(m.id)}
                                  className="bg-red-main text-white text-[12px] px-[10px] py-[10px] rounded-[5px] hover:opacity-90"
                                >
                                  End meeting
                                </button>
                              </div>
                            )
                          }
                          return (
                            <button
                              type="button"
                              disabled={!isUrl}
                              onClick={() => {
                                if (!isUrl) return
                                openExternal(url!)
                                void startMeeting(m.id)
                              }}
                              title={
                                isUrl
                                  ? `Open ${url}`
                                  : url
                                    ? `"${url}" isn't a valid link — recreate the meeting with Zoom to get a join URL`
                                    : 'No meeting URL set'
                              }
                              className="bg-[#2E434E] text-[#F8F9FA] text-[12px] px-[10px] py-[10px] rounded-[5px] shrink-0 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Join
                            </button>
                          )
                        })()}
                      </div>

                      {/* Bottom row */}
                      <div className="flex items-center justify-between gap-[15px] w-full">
                        <div className="flex items-center gap-[10px]">
                          <MeetingTypeLabel type={m.meeting_type} />
                        </div>
                        <div className="flex items-center gap-[15px]">
                          {(() => {
                            // When the AI has analysed this meeting, the
                            // authoritative action-item list lives in the
                            // insights JSON. Otherwise the card reflects
                            // rows in `tasks` linked via `source_meeting_id`.
                            const count = insights
                              ? insights.actionItems.length
                              : m.action_count
                            if (count <= 0) return null
                            return (
                              <span className="bg-red-light flex items-center gap-[5px] px-[5px] py-[2px] rounded-[2px]">
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 14 14"
                                  fill="none"
                                  aria-hidden
                                >
                                  <path
                                    d="M3 7L6 10L11 4"
                                    stroke="#9B3838"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                                <span
                                  className="text-[#9B3838] text-[10px] tracking-[1px] uppercase"
                                  style={{
                                    fontFamily:
                                      'Wanted Sans, ui-sans-serif, sans-serif',
                                    fontWeight: 600,
                                  }}
                                >
                                  {count} ACTIONS
                                </span>
                              </span>
                            )
                          })()}
                          {m.attendees.length > 0 && (
                            <UserGroup
                              members={m.attendees.slice(0, 5).map(userToMember)}
                              size={28}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Open-affordance — the whole card navigates; this is a
                        non-interactive indicator so it doesn't intercept the
                        card click. */}
                    <span
                      aria-hidden
                      className="self-center text-gray-secondary shrink-0"
                    >
                      <Icon name="ArrowRight" size={18} />
                    </span>
                  </article>
                  </div>
                )
              })
            )}
          </div>
    </div>
  )
}
