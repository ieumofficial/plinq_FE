import { useMemo, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import ProjectAppShell, { useCreateNew } from '../../../components/ProjectAppShell'
import Button from '../../../components/ui/Button'
import Input from '../../../components/ui/Input'
import Icon from '../../../components/ui/Icon'
import UserGroup from '../../../components/ui/UserGroup'
import { useProject, useProjectMeetings } from '../../../lib/hooks'
import { userToMember, type MeetingType } from '../../../lib/types'

const TYPE_STYLES: Record<MeetingType, { bg: string; text: string; label: string }> = {
  planning: { bg: 'bg-blue-light', text: 'text-blue-main', label: 'Planning' },
  check_in: { bg: 'bg-green-light', text: 'text-green-main', label: 'Check-In' },
  review: { bg: 'bg-amber-light', text: 'text-amber-main', label: 'Review' },
  retrospective: {
    bg: 'bg-purple-light',
    text: 'text-purple-main',
    label: 'Retrospective',
  },
}

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

function whenLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const isToday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return isToday ? `Today · ${time}` : `${d.toLocaleDateString('en-US')} · ${time}`
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
                  className="not-italic italic text-blue-main font-medium"
                  style={{ fontFamily: 'Inter, ui-sans-serif, sans-serif' }}
                >
                  indexed.
                </em>
              </h1>
            </div>
            <div className="flex items-center gap-[10px]">
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
                const t = TYPE_STYLES[m.meeting_type]
                const block = dateBlock(m.scheduled_at)
                const isLive = m.status === 'recording'
                return (
                  <article
                    key={m.id}
                    className="bg-white-white border border-gray-border-light rounded-[10px] p-[15px] flex items-stretch gap-[15px]"
                  >
                    {/* Date block */}
                    <div className="bg-purple-light rounded-[5px] w-[55px] flex flex-col items-center justify-center gap-[2px] shrink-0">
                      <span className="text-purple-main text-[10px] font-semibold tracking-[1px]">
                        {block.top}
                      </span>
                      <span
                        className="text-purple-main text-[16px] font-bold"
                        style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
                      >
                        {block.bottom}
                      </span>
                    </div>
                    {/* Body */}
                    <div className="flex-1 min-w-0 flex flex-col gap-[8px]">
                      <div className="flex items-center gap-[10px] flex-wrap">
                        <h3 className="text-black text-[16px] font-semibold">{m.name}</h3>
                        <span className="text-gray-secondary text-[12px]">
                          {whenLabel(m.scheduled_at)} · {m.duration_min} min
                        </span>
                        {isLive && (
                          <span className="text-red-main text-[12px] font-semibold flex items-center gap-[4px]">
                            <span className="w-[6px] h-[6px] rounded-full bg-red-main" />
                            LIVE
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-[5px]">
                        <span
                          className={`px-[8px] py-[3px] rounded-[3px] text-[10px] font-semibold uppercase tracking-[1px] ${t.bg} ${t.text}`}
                        >
                          {t.label}
                        </span>
                      </div>
                    </div>
                    {/* Right column */}
                    <div className="flex flex-col items-end justify-between gap-[10px] shrink-0">
                      <Button size="compact" variant="secondary">
                        Join
                      </Button>
                      <div className="flex items-center gap-[8px]">
                        {m.action_count > 0 && (
                          <span className="bg-green-light text-green-main text-[10px] font-semibold uppercase tracking-[1px] px-[8px] py-[3px] rounded-[3px]">
                            ✓ {m.action_count} actions
                          </span>
                        )}
                        {m.attendees.length > 0 && (
                          <UserGroup
                            members={m.attendees.slice(0, 4).map(userToMember)}
                            size={20}
                          />
                        )}
                      </div>
                    </div>
                  </article>
                )
              })
            )}
          </div>
    </div>
  )
}
