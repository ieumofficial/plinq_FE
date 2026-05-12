import { useMemo } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import ProjectAppShell, { useCreateNew } from '../../../components/ProjectAppShell'
import Button from '../../../components/ui/Button'
import StatusLabelBig from '../../../components/ui/StatusLabelBig'
import PriorityTag from '../../../components/ui/PriorityTag'
import UserGroup from '../../../components/ui/UserGroup'
import Schedule from '../../../components/ui/Schedule'
import {
  useProject,
  useProjectMeetings,
  useProjectMembersWithRoles,
  useProjectTasks,
} from '../../../lib/hooks'
import {
  dbPriorityToUi,
  userToMember,
  type TaskStatusDb,
} from '../../../lib/types'
import type { ProjectTask, ProjectMember } from '../../../lib/queries'

const KANBAN_COLS: { key: TaskStatusDb; label: string; status: 'planned' | 'in-progress' | 'review' | 'done' }[] = [
  { key: 'planned', label: 'Planned', status: 'planned' },
  { key: 'in_progress', label: 'In Progress', status: 'in-progress' },
  { key: 'review', label: 'Review', status: 'review' },
  { key: 'done', label: 'Done', status: 'done' },
]

const HEALTH_BREAKDOWN: { key: TaskStatusDb; label: string; color: string }[] = [
  { key: 'done', label: 'Done', color: '#588F6E' },
  { key: 'in_progress', label: 'In Progress', color: '#5B7FB6' },
  { key: 'review', label: 'In Review', color: '#B68A48' },
  { key: 'blocked', label: 'Blocked', color: '#9B3838' },
  { key: 'planned', label: 'Planned', color: '#C7CFD4' },
]

function ticketId(projectName: string, idx: number): string {
  const prefix = projectName
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .join('')
    .slice(0, 3)
    .toUpperCase()
  return `${prefix || 'TSK'}-${(idx + 100).toString().padStart(3, '0')}`
}

function CardSection({
  eyebrow,
  title,
  action,
  children,
  className,
}: {
  eyebrow: string
  title: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={`bg-white-white border border-gray-border-light rounded-[10px] p-[20px] ${className ?? ''}`}
    >
      <div className="flex items-start justify-between mb-[15px]">
        <div className="flex flex-col gap-[5px]">
          <p className="text-blue-main text-[10px] font-medium uppercase tracking-[1.5px]">
            {eyebrow}
          </p>
          <h2 className="text-black text-[16px] font-semibold">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function MiniTaskCard({
  ticket,
  task,
  status,
}: {
  ticket: string
  task: ProjectTask
  status: 'planned' | 'in-progress' | 'review' | 'done'
}) {
  const STATUS_BORDER: Record<string, string> = {
    planned: '#E6ECEF',
    'in-progress': '#5B7FB6',
    review: '#B68A48',
    done: '#588F6E',
  }
  return (
    <div
      className="bg-white-white rounded-[5px] flex flex-col gap-[6px] pt-[8px] pb-[6px] pl-[12px] pr-[8px] border-l-[6px] border-solid border border-gray-border-light"
      style={{ borderLeftColor: STATUS_BORDER[status] }}
    >
      <p
        className="text-[9px] font-semibold tracking-[1px] text-gray-secondary"
        style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
      >
        {ticket}
      </p>
      <p className="text-[11px] font-semibold text-black leading-snug line-clamp-2">
        {task.title}
      </p>
      <div className="flex items-center justify-between">
        <PriorityTag priority={dbPriorityToUi(task.priority)} />
        {task.assignees.length > 0 && (
          <UserGroup members={[userToMember(task.assignees[0])]} size={15} />
        )}
      </div>
    </div>
  )
}

export default function ProjectDashboardPage() {
  const router = useRouter()
  const projectId = router.query.projectId as string | undefined
  if (!projectId) return null
  return (
    <>
      <Head>
        <title>plinq · Dashboard</title>
      </Head>
      <ProjectAppShell projectId={projectId} active="dashboard">
        <ProjectDashboardBody projectId={projectId} />
      </ProjectAppShell>
    </>
  )
}

function ProjectDashboardBody({ projectId }: { projectId: string }) {
  const router = useRouter()
  const { open } = useCreateNew()
  const { data: project } = useProject(projectId)
  const { data: tasks = [] } = useProjectTasks(projectId)
  const { data: meetings = [] } = useProjectMeetings(projectId)
  const { data: members = [] } = useProjectMembersWithRoles(projectId)

  const stats = useMemo(() => {
    const byStatus = new Map<TaskStatusDb, number>()
    for (const t of tasks) {
      byStatus.set(t.status, (byStatus.get(t.status) ?? 0) + 1)
    }
    const total = tasks.length
    const done = byStatus.get('done') ?? 0
    const pct = total > 0 ? Math.round((done / total) * 100) : 0
    return { byStatus, total, done, pct }
  }, [tasks])

  const kanbanByCol = useMemo(() => {
    const order = new Map(tasks.map((t, i) => [t.id, i]))
    return KANBAN_COLS.map((c) => ({
      ...c,
      items: tasks
        .filter((t) => t.status === c.key)
        .map((t) => ({ ...t, _idx: order.get(t.id) ?? 0 })),
    }))
  }, [tasks])

  const tasksByMember = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of tasks) {
      for (const a of t.assignees) {
        map.set(a.id, (map.get(a.id) ?? 0) + 1)
      }
    }
    return map
  }, [tasks])

  const upcomingMeetings = useMemo(() => {
    const now = Date.now()
    return meetings
      .filter((m) => new Date(m.scheduled_at).getTime() >= now)
      .slice(0, 4)
  }, [meetings])

  const daysLeft = useMemo(() => {
    if (!project?.created_at) return null
    // Heuristic placeholder: 90-day project window
    const start = new Date(project.created_at)
    const end = new Date(start)
    end.setDate(end.getDate() + 90)
    const diff = Math.ceil((end.getTime() - Date.now()) / 86400000)
    return Math.max(0, diff)
  }, [project])

  return (
    <div className="p-6 flex flex-col gap-6">
          {/* Title */}
          <div className="flex items-end justify-between gap-4">
            <div className="flex flex-col gap-[5px]">
              <p className="text-blue-main text-[10px] font-medium uppercase tracking-[1.5px]">
                Q2 2026 · {daysLeft ?? 0} DAYS LEFT
              </p>
              <h1 className="text-black text-[28px] font-semibold leading-tight">
                {project?.name ?? 'Project'} is{' '}
                <em
                  className="italic text-blue-main font-medium"
                  style={{ fontFamily: 'Inter, ui-sans-serif, sans-serif' }}
                >
                  on track.
                </em>
              </h1>
            </div>
            <div className="flex items-center gap-[10px]">
              {members.length > 0 && (
                <UserGroup
                  members={members.slice(0, 5).map(userToMember)}
                  size={28}
                />
              )}
              <Button size="compact" iconLeft="Add" onClick={() => open('task')}>
                New task
              </Button>
            </div>
          </div>

          {/* Two-column grid */}
          <div className="flex gap-[15px] items-start">
            {/* LEFT — main */}
            <div className="flex-1 min-w-0 flex flex-col gap-[15px]">
              {/* Kanban snapshot */}
              <CardSection
                eyebrow="Work in flight"
                title="Kanban snapshot"
                action={
                  <button
                    type="button"
                    onClick={() => router.push(`/p/${projectId}/kanban`)}
                    className="text-blue-main text-[12px] font-semibold flex items-center gap-[5px]"
                  >
                    OPEN <span>›</span>
                  </button>
                }
              >
                <div className="flex gap-[10px] overflow-x-auto">
                  {kanbanByCol.map((c) => (
                    <div
                      key={c.key}
                      className="w-[200px] shrink-0 flex flex-col gap-[8px]"
                    >
                      <div className="flex items-center justify-between">
                        <StatusLabelBig status={c.status} size="md" />
                        <span
                          className="text-gray-secondary text-[12px] font-medium"
                          style={{
                            fontFamily: 'Geist Mono, ui-monospace, monospace',
                          }}
                        >
                          {c.items.length}
                        </span>
                      </div>
                      <div className="flex flex-col gap-[8px]">
                        {c.items.slice(0, 3).map((t) => (
                          <MiniTaskCard
                            key={t.id}
                            ticket={ticketId(project?.name ?? 'TSK', t._idx)}
                            task={t}
                            status={c.status}
                          />
                        ))}
                        {c.items.length > 3 && (
                          <span className="text-gray-secondary text-[10px] text-center">
                            +{c.items.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardSection>

              {/* Meetings */}
              <CardSection
                eyebrow={`Meetings · ${meetings.length} indexed`}
                title="Ongoing & upcoming"
                action={
                  <button
                    type="button"
                    onClick={() => router.push(`/p/${projectId}/meetings`)}
                    className="text-blue-main text-[12px] font-semibold flex items-center gap-[5px]"
                  >
                    ALL <span>›</span>
                  </button>
                }
              >
                {upcomingMeetings.length === 0 ? (
                  <p className="text-gray-secondary text-[12px]">
                    No upcoming meetings.
                  </p>
                ) : (
                  <div className="flex flex-col gap-[5px]">
                    {upcomingMeetings.map((m) => (
                      <Schedule
                        key={m.id}
                        size="mini"
                        title={m.name}
                        time={new Date(m.scheduled_at).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                        initial={m.name.charAt(0).toUpperCase()}
                      />
                    ))}
                  </div>
                )}
              </CardSection>

              {/* Members */}
              <CardSection
                eyebrow={`Members · ${members.length} active`}
                title="Who is shipping what"
                action={
                  <button
                    type="button"
                    onClick={() => router.push(`/p/${projectId}/members`)}
                    className="text-blue-main text-[12px] font-semibold"
                  >
                    MANAGE
                  </button>
                }
              >
                {members.length === 0 ? (
                  <p className="text-gray-secondary text-[12px]">
                    No members yet.
                  </p>
                ) : (
                  <div className="flex flex-col gap-[10px]">
                    {members.slice(0, 5).map((m: ProjectMember) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-[10px]">
                          <UserGroup members={[userToMember(m)]} size={28} />
                          <div className="flex flex-col">
                            <span className="text-black text-[14px] font-semibold">
                              {m.nickname ||
                                `${m.first_name} ${m.last_name}`.trim()}
                            </span>
                            <span className="text-gray-secondary text-[10px]">
                              {m.job_title ?? '—'}
                            </span>
                          </div>
                        </div>
                        <span
                          className="text-gray-secondary text-[12px]"
                          style={{
                            fontFamily: 'Geist Mono, ui-monospace, monospace',
                          }}
                        >
                          {tasksByMember.get(m.id) ?? 0} tasks
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardSection>
            </div>

            {/* RIGHT — health column */}
            <aside className="w-[290px] shrink-0 flex flex-col gap-[15px]">
              <CardSection
                eyebrow="Overall progress"
                title={`${project?.name ?? 'Project'} health`}
              >
                <div className="flex flex-col items-center gap-[10px] py-[15px]">
                  {/* Simple circular percent display */}
                  <div className="relative w-[140px] h-[140px]">
                    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                      <path
                        className="text-gray-extra-light"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        d="M18 2 a 16 16 0 0 1 0 32 a 16 16 0 0 1 0 -32"
                      />
                      <path
                        className="text-blue-main"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeDasharray={`${stats.pct}, 100`}
                        d="M18 2 a 16 16 0 0 1 0 32 a 16 16 0 0 1 0 -32"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span
                        className="text-black text-[28px] font-bold"
                        style={{
                          fontFamily: 'Geist Mono, ui-monospace, monospace',
                        }}
                      >
                        {stats.pct}%
                      </span>
                    </div>
                  </div>
                  <p className="text-gray-secondary text-[10px]">
                    {stats.done} of {stats.total} tasks
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-[10px] border-t border-gray-border-light pt-[15px]">
                  <div className="flex flex-col gap-[2px]">
                    <p className="text-blue-main text-[10px] font-medium uppercase tracking-[1.5px]">
                      Velocity
                    </p>
                    <p
                      className="text-black text-[20px] font-bold"
                      style={{
                        fontFamily: 'Geist Mono, ui-monospace, monospace',
                      }}
                    >
                      {stats.done}
                    </p>
                    <p className="text-gray-secondary text-[10px]">tasks/week</p>
                  </div>
                  <div className="flex flex-col gap-[2px]">
                    <p className="text-blue-main text-[10px] font-medium uppercase tracking-[1.5px]">
                      Days left
                    </p>
                    <p
                      className="text-black text-[20px] font-bold"
                      style={{
                        fontFamily: 'Geist Mono, ui-monospace, monospace',
                      }}
                    >
                      {daysLeft ?? '—'}
                    </p>
                    <p className="text-gray-secondary text-[10px]">until deadline</p>
                  </div>
                </div>
                <div className="flex flex-col gap-[6px] mt-[15px]">
                  {HEALTH_BREAKDOWN.map((b) => {
                    const count = stats.byStatus.get(b.key) ?? 0
                    const pct =
                      stats.total > 0
                        ? Math.round((count / stats.total) * 100)
                        : 0
                    return (
                      <div
                        key={b.key}
                        className="flex items-center gap-[10px]"
                      >
                        <span className="text-[12px] text-black w-[80px] shrink-0">
                          {b.label}
                        </span>
                        <span className="flex-1 h-[6px] bg-gray-extra-light rounded-full overflow-hidden">
                          <span
                            className="block h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: b.color }}
                          />
                        </span>
                        <span
                          className="text-gray-main text-[12px] font-medium tracking-[-0.2px] w-[24px] text-right"
                          style={{
                            fontFamily: 'Geist Mono, ui-monospace, monospace',
                          }}
                        >
                          {count}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </CardSection>
            </aside>
          </div>
    </div>
  )
}
