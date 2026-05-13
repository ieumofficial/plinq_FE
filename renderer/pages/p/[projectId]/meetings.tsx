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
import { deleteMeeting as deleteMeetingRow } from '../../../lib/queries'
import { userToMember, type MeetingType } from '../../../lib/types'
import MeetingTypeLabel from '../../../components/ui/MeetingTypeLabel'
import MeetingInsights from '../../../components/MeetingInsights'
import InPersonRecorder from '../../../components/InPersonRecorder'
import MeetingMinutesModal from '../../../components/MeetingMinutesModal'
import { analyzeAudio, parseSummary } from '../../../lib/aiAnalyze'

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
  // Which meeting's full minutes modal is open (null when closed).
  const [openMinutes, setOpenMinutes] = useState<{
    id: string
    name: string
  } | null>(null)
  // Meeting IDs whose inline Insights card is collapsed. Default expanded
  // for everyone so a fresh analysis is visible without an extra click.
  const [collapsedInsights, setCollapsedInsights] = useState<Set<string>>(
    new Set(),
  )

  function toggleInsights(meetingId: string) {
    setCollapsedInsights((prev) => {
      const next = new Set(prev)
      if (next.has(meetingId)) next.delete(meetingId)
      else next.add(meetingId)
      return next
    })
  }

  async function handleDelete(meetingId: string, meetingName: string) {
    const ok = window.confirm(
      `"${meetingName}" 미팅과 모든 회의록을 삭제할까요? 되돌릴 수 없습니다.`,
    )
    if (!ok) return
    const result = await deleteMeetingRow(meetingId)
    if ('error' in result) {
      window.alert(`삭제 실패: ${result.error}`)
      return
    }
    await queryClient.invalidateQueries({
      queryKey: queryKeys.project.meetings(projectId),
    })
  }

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

  // One-click "use the recording I just made" — the Electron main process
  // walks Documents/Zoom, reads the latest m4a, hands the bytes back via
  // IPC, then we run the same upload-and-analyze pipeline. The manual
  // file picker stays as a secondary path for the cases the auto-finder
  // can't cover (browser preview, non-default Zoom folder, etc.).
  async function handleAutoImport(meetingId: string) {
    setAnalyzeState((prev) => ({
      ...prev,
      [meetingId]: { analyzing: true, error: null },
    }))
    try {
      if (typeof window === 'undefined' || !window.ipc?.invoke) {
        throw new Error(
          '브라우저 프리뷰에서는 자동 가져오기를 지원하지 않습니다 — Electron 앱에서 사용하거나 "파일 선택"으로 업로드하세요.',
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
          throw new Error(`Zoom 폴더 읽기 실패: ${result.error}`)
        }
        const path = result.scannedPath || '(unknown)'
        const reasonMsg = {
          'no-zoom-folder': `Zoom 폴더가 없어요 — ${path}`,
          'no-subfolders': `${path} 폴더는 있는데 회의 녹화 하위 폴더가 없어요. Zoom에서 회의 녹화가 정말 시작됐는지 확인해주세요.`,
          'no-audio-files': `최근 폴더에 audio/video 파일이 없어요. Zoom이 아직 저장 중일 수 있습니다 (보통 종료 후 30초~5분). 잠시 후 재시도하거나 '파일 직접 선택'을 사용하세요.\n검색 경로: ${path}`,
          'all-too-small': `오디오 파일이 너무 작아요 (10KB 미만 — Zoom이 저장 중). 1분 뒤 다시 시도하세요.\n검색 경로: ${path}`,
        }[result.reason]
        throw new Error(reasonMsg)
      }
      const blob = new Blob([new Uint8Array(result.bytes)], {
        type: result.mime,
      })
      const file = new File([blob], result.filename, { type: result.mime })
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
                    <button
                      type="button"
                      onClick={() => void handleDelete(m.id, m.name)}
                      title="미팅 삭제"
                      aria-label="Delete meeting"
                      className="self-start text-gray-secondary hover:text-red-main text-[18px] leading-none px-1 -mt-1"
                    >
                      ×
                    </button>
                  </article>
                  {showAnalysisCard && (
                    <div className="bg-white-white border border-gray-border-light rounded-[10px] p-[15px] ml-[75px]">
                      {insights ? (
                        <div className="flex flex-col gap-[10px]">
                          <div className="flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => toggleInsights(m.id)}
                              className="inline-flex items-center gap-2 text-gray-main hover:text-black"
                              aria-expanded={!collapsedInsights.has(m.id)}
                            >
                              <span className="text-[12px] w-3 inline-block">
                                {collapsedInsights.has(m.id) ? '▶' : '▼'}
                              </span>
                              <span className="text-[10px] font-semibold uppercase tracking-[1.5px]">
                                회의록
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setOpenMinutes({ id: m.id, name: m.name })
                              }
                              className="text-[12px] text-blue-main hover:underline"
                            >
                              회의록 전체 보기 →
                            </button>
                          </div>
                          {!collapsedInsights.has(m.id) && (
                            <MeetingInsights data={insights} />
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-black text-[13px] font-semibold">
                              AI 회의록 — 방금 녹화한 회의 자동 분석
                            </p>
                            <p className="text-gray-main text-[11px] mt-1">
                              Documents/Zoom 의 최신 녹화를 자동으로 가져와 전사 + 4섹션 추출합니다.
                            </p>
                            {az.error && (
                              <p className="text-red-med text-[11px] mt-2 break-words">
                                {az.error}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => void handleAutoImport(m.id)}
                              disabled={az.analyzing}
                              className="bg-blue-main text-white text-[12px] px-[15px] py-[8px] rounded-[5px] hover:opacity-90 disabled:opacity-50 disabled:cursor-wait"
                            >
                              {az.analyzing ? '분석 중…' : 'Auto import latest'}
                            </button>
                            <label
                              className={`text-[11px] text-gray-main hover:text-black ${
                                az.analyzing
                                  ? 'opacity-50 cursor-wait'
                                  : 'cursor-pointer'
                              }`}
                            >
                              또는 파일 직접 선택…
                              <input
                                type="file"
                                accept="audio/*,video/mp4,.m4a,.mp4,.mp3,.wav,.webm"
                                className="hidden"
                                disabled={az.analyzing}
                                onChange={(e) => {
                                  const f = e.target.files?.[0]
                                  if (f) void handleAnalyzeFile(m.id, f)
                                  e.target.value = ''
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  </div>
                )
              })
            )}
          </div>

          {openMinutes && (
            <MeetingMinutesModal
              meetingId={openMinutes.id}
              meetingName={openMinutes.name}
              onClose={() => setOpenMinutes(null)}
            />
          )}
    </div>
  )
}
