import { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import PersonalAppShell from '../components/PersonalAppShell'
import Calendar, { type CalendarEvent } from '../components/ui/Calendar'
import FilterChecklist from '../components/ui/FilterChecklist'
import ProjectLabel from '../components/ui/ProjectLabel'
import Icon from '../components/ui/Icon'
import {
  useCurrentUser,
  useUserCalendarEvents,
  useUserProjects,
  useUserUpcomingMeetings,
} from '../lib/hooks'

type FilterKey = 'meetings' | 'project_due' | 'task_due' | 'personal'
const FILTER_LABEL: Record<FilterKey, string> = {
  meetings: 'Meetings',
  project_due: 'Project Due',
  task_due: 'Task due',
  personal: 'Personal',
}
const FILTER_COLORS: Record<FilterKey, string> = {
  meetings: '#2D5A9E', // blue-main
  project_due: '#9B3838', // red-main
  task_due: '#B68A48', // brown-med (amber)
  personal: '#94A0AA', // gray-secondary
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
}
function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}
function isSameDate(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}
function ymd(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

type RowKind = 'meetings' | 'project_due' | 'task_due'

/** Row background tint by category. */
const ROW_BG_BY_KIND: Record<RowKind, string> = {
  meetings: 'bg-blue-light',
  project_due: 'bg-red-light',
  task_due: 'bg-brown-light',
}

function DayItemRow({
  kind,
  projectName,
  projectColor,
  title,
  time,
  onClick,
}: {
  kind: RowKind
  projectName: string
  projectColor: string | null
  title: string
  time?: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-[8px] px-[10px] py-[8px] rounded-[3px] text-left w-full hover:brightness-95 transition ${ROW_BG_BY_KIND[kind]}`}
    >
      <ProjectLabel name={projectName} color={projectColor ?? 'blue'} size="sm" />
      <div className="flex flex-col min-w-0 flex-1">
        {time && (
          <span
            className="text-[9px] text-gray-main tracking-[1px] uppercase leading-none mb-[3px]"
            style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
          >
            {time}
          </span>
        )}
        <span className="text-[12px] font-semibold text-black truncate leading-tight">
          {title}
        </span>
      </div>
    </button>
  )
}

type DetailItem =
  | {
      kind: 'meetings'
      title: string
      projectName: string
      projectColor: string | null
      scheduledAt: string
      durationMin: number
      location?: string | null
      attendees: { name: string }[]
    }
  | {
      kind: 'project_due'
      title: string
      projectName: string
      projectColor: string | null
      dueDate: string
      lead?: string
      status?: string
      progressPct?: number | null
      tasksDone?: number
      tasksTotal?: number
    }
  | {
      kind: 'task_due'
      title: string
      projectName: string
      projectColor: string | null
      dueDate: string
      priority?: string
      status?: string
      description?: string | null
    }

const STATUS_PILL: Record<string, { bg: string; text: string; label: string }> = {
  planned: { bg: 'bg-[#E6ECEF]', text: 'text-primary-main', label: 'Planned' },
  in_progress: { bg: 'bg-blue-light', text: 'text-blue-main', label: 'In Progress' },
  review: { bg: 'bg-brown-light', text: 'text-brown-med', label: 'Review' },
  blocked: { bg: 'bg-red-light', text: 'text-red-main', label: 'Blocked' },
  done: { bg: 'bg-green-light', text: 'text-green-main', label: 'Done' },
}

const PRIORITY_PILL: Record<string, { bg: string; text: string; label: string }> = {
  low: { bg: 'bg-gray-extra-light', text: 'text-gray-main', label: 'Low' },
  medium: { bg: 'bg-blue-light', text: 'text-blue-main', label: 'Medium' },
  high: { bg: 'bg-brown-light', text: 'text-brown-med', label: 'High' },
  urgent: { bg: 'bg-red-light', text: 'text-red-main', label: 'Urgent' },
}

function StatusPill({ status }: { status: string }) {
  const s = STATUS_PILL[status]
  if (!s) return <span className="text-black">{status}</span>
  return (
    <span
      className={`inline-flex items-center px-[8px] py-[3px] rounded-[3px] text-[11px] font-semibold uppercase tracking-[0.5px] ${s.bg} ${s.text}`}
    >
      {s.label}
    </span>
  )
}

function PriorityPill({ priority }: { priority: string }) {
  const p = PRIORITY_PILL[priority]
  if (!p) return <span className="text-black">{priority}</span>
  return (
    <span
      className={`inline-flex items-center px-[8px] py-[3px] rounded-[3px] text-[11px] font-semibold uppercase tracking-[0.5px] ${p.bg} ${p.text}`}
    >
      {p.label}
    </span>
  )
}

function DetailModal({ item, onClose }: { item: DetailItem; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const kindLabel =
    item.kind === 'meetings'
      ? 'Meeting'
      : item.kind === 'project_due'
        ? 'Project Due'
        : 'Task Due'
  const accent =
    item.kind === 'meetings'
      ? { color: '#2D5A9E', soft: 'bg-blue-light' }
      : item.kind === 'project_due'
        ? { color: '#9B3838', soft: 'bg-red-light' }
        : { color: '#B68A48', soft: 'bg-brown-light' }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white-white rounded-[14px] shadow-2xl w-[480px] max-w-[92vw] max-h-[85vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-[24px] pt-[20px] pb-[18px] flex items-start gap-[14px]">
          <ProjectLabel
            name={item.projectName}
            color={item.projectColor ?? 'blue'}
            size="md"
          />
          <div className="flex-1 min-w-0">
            <p
              className="text-[10px] font-semibold uppercase tracking-[1.5px]"
              style={{ color: accent.color }}
            >
              {kindLabel} · {item.projectName}
            </p>
            <h2 className="text-black text-[20px] font-semibold leading-tight mt-[6px]">
              {item.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-secondary hover:text-black hover:bg-gray-extra-light rounded-[5px] p-[5px] -mr-[5px] -mt-[2px]"
            aria-label="Close"
          >
            <Icon name="Cross" size={14} />
          </button>
        </div>

        {/* Hero band — date / time, depending on kind */}
        {item.kind === 'meetings' && (
          <div className={`mx-[24px] mb-[16px] rounded-[10px] px-[16px] py-[14px] flex items-center gap-[14px] ${accent.soft}`}>
            <div
              className="rounded-[8px] bg-white-white text-center px-[12px] py-[6px] shadow-sm"
              style={{ minWidth: 56 }}
            >
              <p
                className="text-[9px] font-semibold uppercase tracking-[1px] text-gray-main"
                style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
              >
                {new Date(item.scheduledAt).toLocaleDateString('en-US', { month: 'short' })}
              </p>
              <p
                className="text-[20px] font-semibold leading-none mt-[2px]"
                style={{
                  color: accent.color,
                  fontFamily: 'Geist Mono, ui-monospace, monospace',
                }}
              >
                {new Date(item.scheduledAt).getDate()}
              </p>
            </div>
            <div className="flex flex-col">
              <p className="text-black text-[14px] font-semibold leading-tight">
                {new Date(item.scheduledAt).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
                {'  '}—{'  '}
                {new Date(
                  new Date(item.scheduledAt).getTime() + item.durationMin * 60_000
                ).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
              <p className="text-gray-main text-[11px] mt-[2px]">
                {new Date(item.scheduledAt).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}{' '}
                · {item.durationMin}m
              </p>
            </div>
          </div>
        )}
        {(item.kind === 'project_due' || item.kind === 'task_due') && (
          <div className={`mx-[24px] mb-[16px] rounded-[10px] px-[16px] py-[14px] flex items-center gap-[14px] ${accent.soft}`}>
            <div
              className="rounded-[8px] bg-white-white text-center px-[12px] py-[6px] shadow-sm"
              style={{ minWidth: 56 }}
            >
              <p
                className="text-[9px] font-semibold uppercase tracking-[1px] text-gray-main"
                style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
              >
                {item.dueDate
                  ? new Date(item.dueDate).toLocaleDateString('en-US', { month: 'short' })
                  : '—'}
              </p>
              <p
                className="text-[20px] font-semibold leading-none mt-[2px]"
                style={{
                  color: accent.color,
                  fontFamily: 'Geist Mono, ui-monospace, monospace',
                }}
              >
                {item.dueDate ? new Date(item.dueDate).getDate() : ''}
              </p>
            </div>
            <div className="flex flex-col">
              <p className="text-black text-[14px] font-semibold leading-tight">
                Due{' '}
                {item.dueDate
                  ? new Date(item.dueDate).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    })
                  : '—'}
              </p>
              <p className="text-gray-main text-[11px] mt-[2px]">{kindLabel}</p>
            </div>
          </div>
        )}

        {/* Detail rows */}
        <div className="px-[24px] pb-[20px] flex flex-col gap-[14px] overflow-y-auto">
          {item.kind === 'meetings' && (
            <>
              {item.location && (
                <DetailRow icon="Folder" label="Where">
                  {item.location}
                </DetailRow>
              )}
              <DetailRow icon="People" label="Attendees">
                {item.attendees.length === 0 ? (
                  <span className="text-gray-secondary">No attendees yet</span>
                ) : (
                  <div className="flex flex-wrap gap-[6px]">
                    {item.attendees.map((a, i) => (
                      <span
                        key={`${a.name}-${i}`}
                        className="bg-gray-extra-light text-black text-[11px] px-[8px] py-[3px] rounded-full"
                      >
                        {a.name}
                      </span>
                    ))}
                  </div>
                )}
              </DetailRow>
            </>
          )}
          {item.kind === 'project_due' && (
            <>
              {item.lead && (
                <DetailRow icon="People" label="Lead">
                  {item.lead}
                </DetailRow>
              )}
              {item.status && (
                <DetailRow icon="Dashboard" label="Status">
                  <StatusPill status={item.status} />
                </DetailRow>
              )}
              {item.progressPct != null && (
                <DetailRow icon="Task" label="Progress">
                  <div className="flex flex-col gap-[6px]">
                    <span className="text-black text-[12px] font-semibold">
                      {item.progressPct}% · {item.tasksDone ?? 0}/{item.tasksTotal ?? 0} tasks
                    </span>
                    <div className="bg-gray-progress h-[5px] rounded-full overflow-hidden w-full">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${item.progressPct}%`,
                          backgroundColor: accent.color,
                        }}
                      />
                    </div>
                  </div>
                </DetailRow>
              )}
            </>
          )}
          {item.kind === 'task_due' && (
            <>
              {item.priority && (
                <DetailRow icon="High" label="Priority">
                  <PriorityPill priority={item.priority} />
                </DetailRow>
              )}
              {item.status && (
                <DetailRow icon="Dashboard" label="Status">
                  <StatusPill status={item.status} />
                </DetailRow>
              )}
              {item.description && (
                <DetailRow icon="File" label="Description">
                  <span className="text-black text-[12px] leading-[1.5] whitespace-pre-wrap">
                    {item.description}
                  </span>
                </DetailRow>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: 'Folder' | 'People' | 'Dashboard' | 'Task' | 'High' | 'File'
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-[12px]">
      <span className="text-gray-secondary mt-[2px] shrink-0">
        <Icon name={icon} size={14} />
      </span>
      <div className="flex flex-col gap-[3px] flex-1 min-w-0">
        <span className="text-gray-main text-[10px] uppercase tracking-[1.5px] font-medium">
          {label}
        </span>
        <span className="text-black text-[12px]">{children}</span>
      </div>
    </div>
  )
}

export default function CalendarPage() {
  const { data: user } = useCurrentUser()
  const userId = user?.id
  const [calMonth, setCalMonth] = useState(startOfMonth(new Date()))
  const today = useMemo(() => new Date(), [])
  const [selectedDate, setSelectedDate] = useState<Date>(today)

  const { data: rawEvents } = useUserCalendarEvents(
    userId,
    startOfMonth(calMonth),
    endOfMonth(calMonth)
  )
  const { data: dayMeetings = [] } = useUserUpcomingMeetings(userId, {
    from: startOfDay(selectedDate),
    to: endOfDay(selectedDate),
  })
  const { data: allProjects = [] } = useUserProjects(userId)
  const isSelectedToday = isSameDate(selectedDate, today)
  const [detail, setDetail] = useState<DetailItem | null>(null)

  const selectedYmd = useMemo(() => ymd(selectedDate), [selectedDate])

  // Map project_id → { name, color } for row rendering.
  const projectMap = useMemo(() => {
    const m = new Map<string, { name: string; color: string | null }>()
    for (const p of allProjects) m.set(p.id, { name: p.name, color: p.color ?? null })
    return m
  }, [allProjects])

  // ── Day items, split into 3 categories (Personal needs an integration) ───
  const dayTaskDues = useMemo(
    () =>
      (rawEvents?.tasksWithDue ?? []).filter((t) => t.due_date === selectedYmd),
    [rawEvents, selectedYmd]
  )
  const dayProjectDues = useMemo(
    () => allProjects.filter((p) => p.dueDate === selectedYmd),
    [allProjects, selectedYmd]
  )

  const totalDayItems =
    dayMeetings.length + dayTaskDues.length + dayProjectDues.length

  // ── Filters ───────────────────────────────────────────────────────────────
  // Personal starts off — it's a placeholder until the user connects an
  // external calendar (Google etc.) and we have data to render.
  const [filters, setFilters] = useState<Record<FilterKey, boolean>>({
    meetings: true,
    project_due: true,
    task_due: true,
    personal: false,
  })

  // ── Grid events (3 type buckets — personal not implemented) ──────────────
  const allEvents = useMemo(() => {
    const events: CalendarEvent[] = []
    const counts = { meetings: 0, project_due: 0, task_due: 0, personal: 0 }
    if (rawEvents) {
      for (const m of rawEvents.meetings) {
        events.push({
          id: `m-${m.id}`,
          date: m.scheduled_at.slice(0, 10),
          title: m.name,
          type: 'meeting',
        })
        counts.meetings++
      }
      for (const t of rawEvents.tasksWithDue) {
        if (!t.due_date) continue
        events.push({
          id: `t-${t.id}`,
          date: t.due_date,
          title: t.title,
          type: 'task',
        })
        counts.task_due++
      }
    }
    for (const p of allProjects) {
      if (!p.dueDate) continue
      events.push({
        id: `p-${p.id}`,
        date: p.dueDate,
        title: `${p.name} due`,
        type: 'project',
      })
      counts.project_due++
    }
    return { events, counts }
  }, [rawEvents, allProjects])

  const visibleEvents = allEvents.events.filter((e) => {
    if (e.type === 'meeting') return filters.meetings
    if (e.type === 'task') return filters.task_due
    if (e.type === 'project') return filters.project_due
    return true
  })

  const monthLabel = calMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  // Format a meeting time as "9:00 AM"
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  return (
    <>
      <Head>
        <title>plinq · Calendar</title>
      </Head>
      <PersonalAppShell active="calendar">
        <div className="p-6 flex gap-[10px] h-full overflow-hidden">
          {/* Calendar */}
          <section className="flex-1 min-w-0 flex flex-col">
            <Calendar
              view="monthly"
              month={calMonth}
              events={visibleEvents}
              selectedDate={selectedDate}
              onDayClick={(d) => {
                setSelectedDate(d)
                if (
                  d.getMonth() !== calMonth.getMonth() ||
                  d.getFullYear() !== calMonth.getFullYear()
                ) {
                  setCalMonth(new Date(d.getFullYear(), d.getMonth(), 1))
                }
              }}
              onPrevMonth={() =>
                setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))
              }
              onNextMonth={() =>
                setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))
              }
              onToday={() => {
                setCalMonth(startOfMonth(new Date()))
                setSelectedDate(new Date())
              }}
            />
          </section>

          {/* Right column */}
          <aside className="w-[263px] flex flex-col gap-[10px] shrink-0">
            <section className="bg-white-white rounded-[10px] border border-gray-border-light p-[20px]">
              <div className="flex flex-col gap-[5px] mb-3">
                <p className="text-blue-main text-[10px] font-medium uppercase tracking-[1.5px]">
                  {isSelectedToday ? 'Today' : 'Selected'} ·{' '}
                  {selectedDate.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
                <h2 className="text-black text-[20px] font-semibold leading-tight">
                  {dayMeetings.length} meetings,{' '}
                  {dayTaskDues.length + dayProjectDues.length} due
                </h2>
              </div>
              {totalDayItems === 0 ? (
                <p className="text-gray-secondary text-[12px]">
                  Nothing scheduled for this day.
                </p>
              ) : (
                <div className="flex flex-col gap-[5px]">
                  {dayMeetings.map((m) => {
                    const p = projectMap.get(m.project_id)
                    return (
                      <DayItemRow
                        key={`m-${m.id}`}
                        kind="meetings"
                        projectName={p?.name ?? m.name}
                        projectColor={p?.color ?? null}
                        title={m.name}
                        time={formatTime(m.scheduled_at)}
                        onClick={() =>
                          setDetail({
                            kind: 'meetings',
                            title: m.name,
                            projectName: p?.name ?? m.name,
                            projectColor: p?.color ?? null,
                            scheduledAt: m.scheduled_at,
                            durationMin: m.duration_min,
                            location: m.location_or_url,
                            attendees: m.attendees.map((a) => ({
                              name:
                                a.nickname ||
                                `${a.first_name} ${a.last_name}`.trim() ||
                                a.email,
                            })),
                          })
                        }
                      />
                    )
                  })}
                  {dayProjectDues.map((p) => {
                    const leadUser = p.members.find((m) => m.id === p.lead_id)
                    return (
                      <DayItemRow
                        key={`p-${p.id}`}
                        kind="project_due"
                        projectName={p.name}
                        projectColor={p.color ?? null}
                        title={`${p.name} due`}
                        onClick={() =>
                          setDetail({
                            kind: 'project_due',
                            title: `${p.name} due`,
                            projectName: p.name,
                            projectColor: p.color ?? null,
                            dueDate: p.dueDate ?? '',
                            lead: leadUser
                              ? leadUser.nickname ||
                                `${leadUser.first_name} ${leadUser.last_name}`.trim()
                              : undefined,
                            status: p.status,
                            progressPct: p.progressPct,
                            tasksDone: p.tasksDone,
                            tasksTotal: p.tasksTotal,
                          })
                        }
                      />
                    )
                  })}
                  {dayTaskDues.map((t) => {
                    const p = t.project_id ? projectMap.get(t.project_id) : undefined
                    return (
                      <DayItemRow
                        key={`t-${t.id}`}
                        kind="task_due"
                        projectName={p?.name ?? t.title}
                        projectColor={p?.color ?? null}
                        title={t.title}
                        onClick={() =>
                          setDetail({
                            kind: 'task_due',
                            title: t.title,
                            projectName: p?.name ?? t.title,
                            projectColor: p?.color ?? null,
                            dueDate: t.due_date ?? '',
                            priority: t.priority,
                            status: t.status,
                            description: t.description,
                          })
                        }
                      />
                    )
                  })}
                </div>
              )}
            </section>

            <section className="bg-white-white rounded-[10px] border border-gray-border-light p-[20px]">
              <div className="flex flex-col gap-[5px] mb-3">
                <p className="text-red-main text-[10px] font-medium uppercase tracking-[1.5px]">
                  Filters
                </p>
                <h2 className="text-black text-[16px] font-semibold">Show on calendar</h2>
              </div>
              <div className="flex flex-col gap-[2px]">
                <FilterChecklist
                  label={FILTER_LABEL.meetings}
                  count={allEvents.counts.meetings}
                  color={FILTER_COLORS.meetings}
                  checked={filters.meetings}
                  onChange={(v) => setFilters((s) => ({ ...s, meetings: v }))}
                />
                <FilterChecklist
                  label={FILTER_LABEL.project_due}
                  count={allEvents.counts.project_due}
                  color={FILTER_COLORS.project_due}
                  checked={filters.project_due}
                  onChange={(v) => setFilters((s) => ({ ...s, project_due: v }))}
                />
                <FilterChecklist
                  label={FILTER_LABEL.task_due}
                  count={allEvents.counts.task_due}
                  color={FILTER_COLORS.task_due}
                  checked={filters.task_due}
                  onChange={(v) => setFilters((s) => ({ ...s, task_due: v }))}
                />
                <FilterChecklist
                  label={FILTER_LABEL.personal}
                  count={allEvents.counts.personal}
                  color={FILTER_COLORS.personal}
                  checked={filters.personal}
                  onChange={(v) => setFilters((s) => ({ ...s, personal: v }))}
                />
              </div>
              <p className="text-gray-secondary text-[10px] mt-3">Showing {monthLabel}</p>
            </section>
          </aside>
        </div>
        {detail && <DetailModal item={detail} onClose={() => setDetail(null)} />}
      </PersonalAppShell>
    </>
  )
}
