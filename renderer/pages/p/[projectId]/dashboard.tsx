import { useMemo } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import ProjectAppShell, { useCreateNew } from '../../../components/ProjectAppShell'
import Button from '../../../components/ui/Button'
import PriorityTag from '../../../components/ui/PriorityTag'
import UserGroup from '../../../components/ui/UserGroup'
import Schedule from '../../../components/ui/Schedule'
import Icon from '../../../components/ui/Icon'
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

const KANBAN_COLS: {
  key: TaskStatusDb
  status: 'planned' | 'in-progress' | 'review' | 'done'
  label: string
  dot: string
}[] = [
  { key: 'planned', status: 'planned', label: 'Planned', dot: '#C7CFD4' },
  { key: 'in_progress', status: 'in-progress', label: 'In Progress', dot: '#5B7FB6' },
  { key: 'review', status: 'review', label: 'Review', dot: '#B68A48' },
  { key: 'done', status: 'done', label: 'Done', dot: '#588F6E' },
]

// Per Figma 966:11512 — each row label + bar share the same color hex.
const HEALTH_BREAKDOWN: { key: TaskStatusDb; label: string; color: string }[] = [
  { key: 'done', label: 'Done', color: '#588F6E' }, // Green/Med
  { key: 'in_progress', label: 'In Progress', color: '#5B7FB6' }, // Blue/Med
  { key: 'review', label: 'In Review', color: '#B68A48' }, // Brown/Med
  { key: 'blocked', label: 'Blocked', color: '#B65A5A' }, // Red/Med
  { key: 'planned', label: 'Planned', color: '#455E6A' }, // Primary/Main
]

/** Palette key → hex used by the project chip / eyebrow tinting. */
const PROJECT_COLOR_HEX: Record<string, string> = {
  blue: '#2D5A9E',
  green: '#2F6B45',
  amber: '#B68A48',
  red: '#9B3838',
  purple: '#5B3D8A',
  turquoise: '#558589',
}

function resolveProjectColor(color: string | null | undefined): string {
  if (!color) return PROJECT_COLOR_HEX.blue
  if (color.startsWith('#')) return color
  return PROJECT_COLOR_HEX[color] ?? PROJECT_COLOR_HEX.blue
}

/** Section eyebrow palette used across the dashboard (Figma 966:11512). */
const EYEBROW = {
  blue: '#2D5A9E',
  purple: '#5B3D8A',
  green: '#2F6B45',
} as const

function CardSection({
  eyebrow,
  eyebrowColor,
  title,
  action,
  badge,
  children,
  className,
}: {
  eyebrow: string
  /** Hex color for the eyebrow text. Defaults to brand blue. */
  eyebrowColor?: string
  title: string
  action?: React.ReactNode
  badge?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={`bg-white-white border border-gray-border-light rounded-[10px] p-[20px] ${className ?? ''}`}
    >
      <div className="flex items-start justify-between gap-[15px] mb-[15px]">
        <div className="flex flex-col gap-[5px] min-w-0">
          <p
            className="text-[10px] font-medium uppercase tracking-[1.5px]"
            style={{ color: eyebrowColor ?? EYEBROW.blue }}
          >
            {eyebrow}
          </p>
          <div className="flex items-center gap-[10px]">
            <h2 className="text-black text-[20px] font-semibold truncate">{title}</h2>
            {badge}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function MiniTaskCard({
  task,
  status,
}: {
  task: ProjectTask
  status: 'planned' | 'in-progress' | 'review' | 'done'
}) {
  const STATUS_BORDER: Record<string, string> = {
    planned: '#C7CFD4',
    'in-progress': '#5B7FB6',
    review: '#B68A48',
    done: '#588F6E',
  }
  return (
    <div
      className="bg-white-white rounded-[5px] flex flex-col gap-[10px] pt-[10px] pb-[8px] pl-[14px] pr-[10px] border-l-[6px] border-solid border border-gray-border-light min-h-[78px]"
      style={{ borderLeftColor: STATUS_BORDER[status] }}
    >
      <p className="text-[11px] font-semibold text-black leading-snug line-clamp-2">
        {task.title}
      </p>
      <div className="flex items-center justify-between mt-auto">
        <PriorityTag priority={dbPriorityToUi(task.priority)} isText={false} />
        {task.assignees.length > 0 ? (
          <UserGroup
            members={task.assignees.slice(0, 3).map(userToMember)}
            size={20}
            borderColor="#FFFFFF"
          />
        ) : (
          <span
            aria-hidden
            className="w-[20px] h-[20px] rounded-full border border-dashed border-gray-border-light inline-flex items-center justify-center text-gray-secondary text-[10px]"
          >
            ?
          </span>
        )}
      </div>
    </div>
  )
}

/** "Kanban / Timeline" segmented tabs at the top of the kanban snapshot. */
function KanbanTabs({ value }: { value: 'kanban' | 'timeline' }) {
  return (
    <div className="bg-white-item rounded-[5px] flex items-center p-[3px] gap-[5px]">
      {(['kanban', 'timeline'] as const).map((k) => {
        const active = k === value
        return (
          <span
            key={k}
            className={`px-[10px] py-[5px] rounded-[3px] text-[12px] font-medium capitalize ${
              active ? 'bg-white-white text-black shadow-sm' : 'text-gray-main'
            }`}
            style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
          >
            {k}
          </span>
        )
      })}
    </div>
  )
}

/** 3/4-circle gauge — open at the bottom, with rounded end caps. Geometry is
 *  picked so the arc, including the stroke radius, fits inside viewBox 200×160. */
/** Half-circle (180°) gauge opening downward — matches Figma 966:8367. */
function HealthGauge({ pct, doneLabel }: { pct: number; doneLabel: string }) {
  const rx = 115
  const ry = 110
  const cx = 140
  const cy = 130 // baseline (chord) of the semicircle
  const stroke = 14

  // Math-convention angles: 0° = right, 90° = top, 180° = left.
  // We invert sin because SVG y points down.
  const polar = (angleDeg: number) => {
    const a = (angleDeg * Math.PI) / 180
    return { x: cx + rx * Math.cos(a), y: cy - ry * Math.sin(a) }
  }

  // Sweep from left (180°) through top (90°) to right (0°) — 180° total.
  const startAngle = 180
  const totalSweep = 180

  const start = polar(startAngle)
  const end = polar(startAngle - totalSweep)
  const bgArc = `M ${start.x} ${start.y} A ${rx} ${ry} 0 0 1 ${end.x} ${end.y}`

  const clampedPct = Math.max(0, Math.min(100, pct))
  const fillSweep = (totalSweep * clampedPct) / 100
  const fillEnd = polar(startAngle - fillSweep)
  const fillArc = `M ${start.x} ${start.y} A ${rx} ${ry} 0 0 1 ${fillEnd.x} ${fillEnd.y}`

  return (
    <div className="relative w-full h-[160px] mx-auto">
      <svg viewBox="0 0 280 160" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        <path d={bgArc} fill="none" stroke="#E6ECEF" strokeWidth={stroke} strokeLinecap="round" />
        {clampedPct > 0 && (
          <path d={fillArc} fill="none" stroke="#5B7FB6" strokeWidth={stroke} strokeLinecap="round" />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-[30px]">
        <span
          className="text-black text-[30px] font-semibold leading-none"
          style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
        >
          {pct}%
        </span>
        <span className="text-gray-secondary text-[10px] mt-[6px]">{doneLabel}</span>
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
    return KANBAN_COLS.map((c) => ({
      ...c,
      items: tasks.filter((t) => t.status === c.key),
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

  const maxMemberTasks = useMemo(
    () => Math.max(1, ...Array.from(tasksByMember.values())),
    [tasksByMember]
  )

  const upcomingMeetings = useMemo(() => {
    const now = Date.now()
    return meetings
      .filter((m) => {
        const start = new Date(m.scheduled_at).getTime()
        const end = start + (m.duration_min ?? 30) * 60_000
        return end >= now
      })
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

  // Velocity placeholder: done tasks per week, capped (matches Figma "↑ 18/wk")
  const velocityPerWeek = stats.done

  function fmtTimeRange(iso: string, durationMin: number | null): string {
    const start = new Date(iso)
    const end = new Date(start.getTime() + (durationMin ?? 30) * 60_000)
    const f = (d: Date) =>
      d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })
    return `${f(start)} – ${f(end)}`
  }

  function isMeetingLive(iso: string, durationMin: number | null): boolean {
    const start = new Date(iso).getTime()
    const end = start + (durationMin ?? 30) * 60_000
    const now = Date.now()
    return now >= start && now <= end
  }

  return (
    <div className="p-[15px] flex flex-col gap-[15px]">
      {/* Title row */}
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-[5px]">
          <p
            className="text-[10px] font-medium uppercase tracking-[1.5px]"
            style={{ color: resolveProjectColor(project?.color) }}
          >
            Q2 2026 · {daysLeft ?? 0} DAYS LEFT
          </p>
          <h1 className="text-black text-[35px] font-semibold leading-tight">
            {project?.name ?? 'Project'} is{' '}
            <em
              className="italic font-semibold text-gray-main"
              style={{ fontFamily: 'Inter, ui-sans-serif, sans-serif' }}
            >
              on track.
            </em>
          </h1>
        </div>
        <div className="flex items-center gap-[10px]">
          {members.length > 0 && (
            <UserGroup
              members={members.map(userToMember)}
              size={28}
              max={6}
            />
          )}
          <Button size="compact" iconLeft="Add" onClick={() => open('task')}>
            New task
          </Button>
        </div>
      </div>

      {/* Two-column main grid */}
      <div className="flex gap-[10px] items-start">
        {/* LEFT — Kanban snapshot + Meetings */}
        <div className="flex-1 min-w-0 flex flex-col gap-[10px]">
          {/* Kanban snapshot */}
          <CardSection
            eyebrow="Work in flight"
            eyebrowColor={EYEBROW.blue}
            title="Kanban snapshot"
            action={
              <div className="flex items-center gap-[10px] shrink-0">
                <KanbanTabs value="kanban" />
                <button
                  type="button"
                  onClick={() => router.push(`/p/${projectId}/kanban`)}
                  className="text-black text-[12px] font-normal flex items-center gap-[8px]"
                >
                  OPEN
                  <Icon name="ArrowRight" size={13} />
                </button>
              </div>
            }
          >
            <div className="grid grid-cols-4 gap-[10px] min-h-[500px]">
              {kanbanByCol.map((c) => (
                <div
                  key={c.key}
                  className="flex flex-col gap-[10px] min-w-0 bg-white-main rounded-[5px] p-[10px]"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-[8px]">
                      <span
                        className="w-[9px] h-[9px] rounded-full shrink-0"
                        style={{ backgroundColor: c.dot }}
                      />
                      <span className="text-[12px] font-medium text-black">
                        {c.label}
                      </span>
                    </span>
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
                    {c.items.slice(0, 6).map((t) => (
                      <MiniTaskCard
                        key={t.id}
                        task={t}
                        status={c.status}
                      />
                    ))}
                    {c.items.length > 6 && (
                      <span
                        className="text-gray-secondary text-[10px] text-center tracking-[1px]"
                        style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
                      >
                        +{c.items.length - 6} more
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
            eyebrowColor={EYEBROW.blue}
            title="Ongoing & upcoming"
            action={
              <button
                type="button"
                onClick={() => router.push(`/p/${projectId}/meetings`)}
                className="text-black text-[12px] font-normal flex items-center gap-[8px]"
              >
                ALL
                <Icon name="ArrowRight" size={13} />
              </button>
            }
          >
            {upcomingMeetings.length === 0 ? (
              <p className="text-gray-secondary text-[12px]">
                No upcoming meetings.
              </p>
            ) : (
              <div className="flex flex-col gap-[5px]">
                {upcomingMeetings.map((m) => {
                  const live = isMeetingLive(m.scheduled_at, m.duration_min)
                  const extra = Math.max(0, members.length - 4)
                  return (
                    <Schedule
                      key={m.id}
                      size="full"
                      title={m.name}
                      time={fmtTimeRange(m.scheduled_at, m.duration_min)}
                      isCurrent={live}
                      type="planning"
                      attendees={members.slice(0, 4).map(userToMember)}
                      attendeesLabel={extra > 0 ? `+${extra}` : undefined}
                      onJoin={() => router.push(`/p/${projectId}/meetings`)}
                    />
                  )
                })}
              </div>
            )}
          </CardSection>
        </div>

        {/* RIGHT — Apollo health + Members */}
        <aside className="w-[420px] shrink-0 flex flex-col gap-[10px]">
          <CardSection
            eyebrow="Overall progress"
            eyebrowColor={EYEBROW.purple}
            title={`${project?.name ?? 'Project'} health`}
            action={
              <span
                className="text-[10px] font-semibold tracking-[1px] shrink-0"
                style={{
                  color: '#6B7B86',
                  fontFamily: 'Geist Mono, ui-monospace, monospace',
                }}
              >
                ↑ {velocityPerWeek}/wk
              </span>
            }
          >
            <div className="py-[10px]">
              <HealthGauge
                pct={stats.pct}
                doneLabel={`${stats.done} of ${stats.total} tasks`}
              />
            </div>
            <div className="grid grid-cols-2 gap-[10px] border-t border-gray-border-light pt-[15px] mt-[10px]">
              <div
                className="flex flex-col gap-[2px] p-[12px] rounded-[10px]"
                style={{ backgroundColor: '#F8FAFB' }}
              >
                <p
                  className="text-[10px] font-medium uppercase tracking-[1.5px]"
                  style={{ color: '#2F6B45' }}
                >
                  Velocity
                </p>
                <p
                  className="text-black text-[24px] font-semibold leading-none"
                  style={{
                    fontFamily: 'Geist Mono, ui-monospace, monospace',
                  }}
                >
                  {velocityPerWeek}
                </p>
                <p
                  className="text-[10px]"
                  style={{ color: '#455E6A' }}
                >
                  tasks/week
                </p>
              </div>
              <div
                className="flex flex-col gap-[2px] p-[12px] rounded-[10px]"
                style={{ backgroundColor: '#F8FAFB' }}
              >
                <p
                  className="text-[10px] font-medium uppercase tracking-[1.5px]"
                  style={{ color: '#9B3838' }}
                >
                  Days left
                </p>
                <p
                  className="text-black text-[24px] font-semibold leading-none"
                  style={{
                    fontFamily: 'Geist Mono, ui-monospace, monospace',
                  }}
                >
                  {daysLeft ?? '—'}
                </p>
                <p
                  className="text-[10px]"
                  style={{ color: '#455E6A' }}
                >
                  until deadline
                </p>
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
                  <div key={b.key} className="flex items-center gap-[10px]">
                    <span
                      className="text-[12px] font-medium w-[74px] shrink-0"
                      style={{ color: b.color }}
                    >
                      {b.label}
                    </span>
                    <span className="flex-1 h-[5px] bg-gray-extra-light rounded-full overflow-hidden">
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

          {/* Members */}
          <CardSection
            eyebrow={`Members · ${members.length} active`}
            eyebrowColor={EYEBROW.green}
            title="Who is shipping what"
            action={
              <button
                type="button"
                onClick={() => router.push(`/p/${projectId}/members`)}
                className="text-black text-[12px] font-normal flex items-center gap-[8px]"
              >
                MANAGE
                <Icon name="ArrowRight" size={13} />
              </button>
            }
          >
            {members.length === 0 ? (
              <p className="text-gray-secondary text-[12px]">
                No members yet.
              </p>
            ) : (
              <div className="flex flex-col gap-[5px]">
                {members.slice(0, 4).map((m: ProjectMember) => {
                  const n = tasksByMember.get(m.id) ?? 0
                  const barPct = Math.round((n / maxMemberTasks) * 100)
                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-[10px] py-[10px] px-[10px] rounded-[5px] bg-white-main hover:bg-white-item"
                    >
                      <div className="flex items-center gap-[10px] min-w-0">
                        <UserGroup members={[userToMember(m)]} size={25} />
                        <div className="flex flex-col min-w-0">
                          <span className="text-black text-[12px] font-semibold truncate">
                            {m.nickname ||
                              `${m.first_name} ${m.last_name}`.trim()}
                          </span>
                          <span className="text-gray-secondary text-[9px] truncate">
                            {m.job_title ?? '—'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-[10px] shrink-0">
                        <span className="block w-[52px] h-[4px] bg-gray-extra-light rounded-full overflow-hidden">
                          <span
                            className="block h-full bg-blue-main rounded-full"
                            style={{ width: `${barPct}%` }}
                          />
                        </span>
                        <span
                          className="text-gray-main text-[11px] font-medium tracking-[-0.2px] whitespace-nowrap text-right"
                          style={{
                            fontFamily: 'Geist Mono, ui-monospace, monospace',
                          }}
                        >
                          {n} tasks
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardSection>
        </aside>
      </div>
    </div>
  )
}
