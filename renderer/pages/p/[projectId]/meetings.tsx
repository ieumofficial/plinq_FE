import { useMemo, useState } from 'react'
import Head from 'next/head'
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
import { userToMember, type MeetingType } from '../../../lib/types'
import MeetingTypeLabel from '../../../components/ui/MeetingTypeLabel'
import MeetingInsights from '../../../components/MeetingInsights'
import { analyzeMeeting, parseSummary } from '../../../lib/aiAnalyze'

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

const DATE_BLOCK_STYLES: Record<MeetingType, { bg: string; text: string }> = {
  planning: { bg: 'bg-[#E6ECEF]', text: 'text-[#6B7B86]' },
  check_in: { bg: 'bg-[#E6ECEF]', text: 'text-[#6B7B86]' },
  review: { bg: 'bg-[#E6ECEF]', text: 'text-[#6B7B86]' },
  retrospective: { bg: 'bg-[#E5DEEF]', text: 'text-[#5B3D8A]' },
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

  async function handleAnalyze(meetingId: string) {
    setAnalyzeState((prev) => ({
      ...prev,
      [meetingId]: { analyzing: true, error: null },
    }))
    try {
      await analyzeMeeting(meetingId)
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
    <div className="p-6 flex flex-col gap-6">
          {/* Toolbar */}
          <div className="flex items-end justify-between gap-4">
            <div className="flex flex-col gap-[5px]">
              <p className="text-blue-main text-[10px] font-medium uppercase tracking-[1.5px]">
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

          {/* AI insights bar */}
          {totalActions > 0 && (
            <div className="bg-black text-white rounded-[10px] p-[20px] flex items-center justify-between gap-4">
              <div className="flex items-center gap-[15px]">
                <span className="bg-primary-main/40 rounded p-[8px] inline-flex">
                  <Icon name="Sparkle" size={15} />
                </span>
                <div className="flex flex-col gap-[4px]">
                  <p className="text-[14px] font-semibold">
                    {totalActions} action items extracted from this week's meetings.
                  </p>
                  <p className="text-[12px] text-white/60">
                    AI processed {meetings.length} meetings.
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
                // Analysis is available when (a) the meeting has a real
                // Zoom join URL, (b) it's not currently live, (c) its
                // scheduled start time is in the past, and (d) we haven't
                // analyzed it yet. This covers both the "user ran a Right
                // Now meeting" and "user ended a scheduled meeting" paths.
                const isPast =
                  new Date(m.scheduled_at).getTime() <= Date.now()
                const canAnalyze =
                  !isLive &&
                  isPast &&
                  !insights &&
                  !!m.location_or_url &&
                  /^https?:\/\//i.test(m.location_or_url)
                const showAnalysisCard =
                  !!insights || canAnalyze || az.analyzing || !!az.error
                return (
                  <div key={m.id} className="flex flex-col gap-[10px]">
                  <article
                    className="bg-white-white border border-gray-border-light rounded-[10px] p-[15px] flex items-center gap-[15px]"
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
                            <h3 className="text-black text-[20px] font-semibold leading-none">
                              {m.name}
                            </h3>
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
                          // Live mode: card shows "Open Zoom" (reopen the
                          // call if user closed it) + "End meeting" (flips
                          // status to processed so the AI pipeline kicks in).
                          if (isLive) {
                            return (
                              <div className="flex items-center gap-[8px] shrink-0">
                                {isUrl && (
                                  <button
                                    type="button"
                                    onClick={() => openExternal(url!)}
                                    className="bg-white-white border border-gray-border text-black text-[12px] px-[10px] py-[10px] rounded-[5px] hover:bg-white-item"
                                  >
                                    Open Zoom
                                  </button>
                                )}
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
                                    ? `"${url}" 는 유효한 링크가 아닙니다 — Zoom으로 다시 만들면 join URL이 자동 생성됩니다`
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
                          {m.action_count > 0 && (
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
                                  fontFamily: 'Wanted Sans, ui-sans-serif, sans-serif',
                                  fontWeight: 600,
                                }}
                              >
                                {m.action_count} ACTIONS
                              </span>
                            </span>
                          )}
                          {m.attendees.length > 0 && (
                            <UserGroup
                              members={m.attendees.slice(0, 5).map(userToMember)}
                              size={15}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                  {showAnalysisCard && (
                    <div className="bg-white-white border border-gray-border-light rounded-[10px] p-[15px] ml-[75px]">
                      {insights ? (
                        <MeetingInsights data={insights} />
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-black text-[13px] font-semibold">
                              AI 회의록 — 로컬 녹화 분석 곧 지원
                            </p>
                            <p className="text-gray-main text-[11px] mt-1">
                              회의 종료 후 PC에 저장된 m4a 파일을 자동으로 가져와 분석합니다.
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled
                            title="Local audio import coming next iteration"
                            className="bg-gray-disabled text-gray-main text-[12px] px-[15px] py-[8px] rounded-[5px] shrink-0 cursor-not-allowed"
                          >
                            Coming soon
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  </div>
                )
              })
            )}
          </div>
    </div>
  )
}
