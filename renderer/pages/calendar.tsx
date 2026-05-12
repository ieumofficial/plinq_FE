import { useMemo, useState } from 'react'
import Head from 'next/head'
import PersonalAppShell from '../components/PersonalAppShell'
import Calendar, { type CalendarEvent } from '../components/ui/Calendar'
import FilterChecklist from '../components/ui/FilterChecklist'
import ProjectLabel from '../components/ui/ProjectLabel'
import {
  useCurrentUser,
  useUserCalendarEvents,
  useUserProjects,
  useUserUpcomingMeetings,
} from '../lib/hooks'

type FilterKey = 'meetings' | 'one_on_ones' | 'action_items' | 'project_due'
const FILTER_LABEL: Record<FilterKey, string> = {
  meetings: 'Meetings',
  one_on_ones: '1:1s',
  action_items: 'Action Items',
  project_due: 'Project Due',
}
const FILTER_COLORS: Record<FilterKey, string> = {
  meetings: '#5B3D8A', // purple-main
  one_on_ones: '#558589', // turquoise-main
  action_items: '#9B3838', // red-main
  project_due: '#2D5A9E', // blue-main
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

/** Row background tint by category (matches filter colors). */
const ROW_BG_BY_TYPE: Record<FilterKey, string> = {
  meetings: 'bg-purple-light',
  one_on_ones: 'bg-turquoise-light',
  action_items: 'bg-red-light',
  project_due: 'bg-blue-light',
}

function DayItemRow({
  type,
  projectName,
  projectColor,
  title,
  time,
}: {
  type: FilterKey
  projectName: string
  projectColor: string | null
  title: string
  time?: string
}) {
  return (
    <div className={`flex items-center gap-[8px] px-[10px] py-[8px] rounded-[3px] ${ROW_BG_BY_TYPE[type]}`}>
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

  const selectedYmd = useMemo(() => ymd(selectedDate), [selectedDate])

  // Map project_id → { name, color } for row rendering.
  const projectMap = useMemo(() => {
    const m = new Map<string, { name: string; color: string | null }>()
    for (const p of allProjects) m.set(p.id, { name: p.name, color: p.color ?? null })
    return m
  }, [allProjects])

  // ── Day items, split into 4 categories ────────────────────────────────────
  // 1:1 heuristic: exactly 2 attendees (user + 1 other).
  const dayOneOnOnes = useMemo(
    () => dayMeetings.filter((m) => m.attendees.length === 2),
    [dayMeetings]
  )
  const dayRegularMeetings = useMemo(
    () => dayMeetings.filter((m) => m.attendees.length !== 2),
    [dayMeetings]
  )
  const dayActionItems = useMemo(
    () =>
      (rawEvents?.tasksWithDue ?? []).filter((t) => t.due_date === selectedYmd),
    [rawEvents, selectedYmd]
  )
  const dayProjectDues = useMemo(
    () => allProjects.filter((p) => p.nextDueDate === selectedYmd),
    [allProjects, selectedYmd]
  )

  const totalDayItems =
    dayRegularMeetings.length +
    dayOneOnOnes.length +
    dayActionItems.length +
    dayProjectDues.length

  // ── Filters ───────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<Record<FilterKey, boolean>>({
    meetings: true,
    one_on_ones: true,
    action_items: true,
    project_due: true,
  })

  // ── Grid events (with 4 type buckets) ─────────────────────────────────────
  const allEvents = useMemo(() => {
    const events: CalendarEvent[] = []
    const counts = { meetings: 0, one_on_ones: 0, action_items: 0, project_due: 0 }
    if (rawEvents) {
      // Meetings (grid lacks attendee data, so cannot split 1:1s here — counted
      // together; the right panel splits them via attendees length).
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
        counts.action_items++
      }
    }
    for (const p of allProjects) {
      if (!p.nextDueDate) continue
      events.push({
        id: `p-${p.id}`,
        date: p.nextDueDate,
        title: `${p.name} due`,
        type: 'project',
      })
      counts.project_due++
    }
    // 1:1 count on the grid uses the day-level breakdown total across month.
    // For the filters card, we surface the day-scoped count as a hint.
    return { events, counts }
  }, [rawEvents, allProjects])

  const visibleEvents = allEvents.events.filter((e) => {
    if (e.type === 'meeting') return filters.meetings || filters.one_on_ones
    if (e.type === 'task') return filters.action_items
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
          <section className="flex-1 bg-white-white rounded-[10px] border border-gray-border-light p-[20px] min-w-0 flex flex-col">
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
                  {dayRegularMeetings.length + dayOneOnOnes.length} meetings,{' '}
                  {dayActionItems.length + dayProjectDues.length} due
                </h2>
              </div>
              {totalDayItems === 0 ? (
                <p className="text-gray-secondary text-[12px]">
                  Nothing scheduled for this day.
                </p>
              ) : (
                <div className="flex flex-col gap-[5px]">
                  {dayRegularMeetings.map((m) => {
                    const p = projectMap.get(m.project_id)
                    return (
                      <DayItemRow
                        key={`m-${m.id}`}
                        type="meetings"
                        projectName={p?.name ?? m.name}
                        projectColor={p?.color ?? null}
                        title={m.name}
                        time={formatTime(m.scheduled_at)}
                      />
                    )
                  })}
                  {dayOneOnOnes.map((m) => {
                    const p = projectMap.get(m.project_id)
                    return (
                      <DayItemRow
                        key={`o-${m.id}`}
                        type="one_on_ones"
                        projectName={p?.name ?? m.name}
                        projectColor={p?.color ?? null}
                        title={m.name}
                        time={formatTime(m.scheduled_at)}
                      />
                    )
                  })}
                  {dayProjectDues.map((p) => (
                    <DayItemRow
                      key={`p-${p.id}`}
                      type="project_due"
                      projectName={p.name}
                      projectColor={p.color ?? null}
                      title={`${p.name} due`}
                    />
                  ))}
                  {dayActionItems.map((t) => {
                    const p = t.project_id ? projectMap.get(t.project_id) : undefined
                    return (
                      <DayItemRow
                        key={`t-${t.id}`}
                        type="action_items"
                        projectName={p?.name ?? t.title}
                        projectColor={p?.color ?? null}
                        title={t.title}
                      />
                    )
                  })}
                </div>
              )}
            </section>

            <section className="bg-white-white rounded-[10px] border border-gray-border-light p-[20px]">
              <div className="flex flex-col gap-[5px] mb-3">
                <p className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
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
                  label={FILTER_LABEL.one_on_ones}
                  count={dayOneOnOnes.length}
                  color={FILTER_COLORS.one_on_ones}
                  checked={filters.one_on_ones}
                  onChange={(v) => setFilters((s) => ({ ...s, one_on_ones: v }))}
                />
                <FilterChecklist
                  label={FILTER_LABEL.action_items}
                  count={allEvents.counts.action_items}
                  color={FILTER_COLORS.action_items}
                  checked={filters.action_items}
                  onChange={(v) => setFilters((s) => ({ ...s, action_items: v }))}
                />
                <FilterChecklist
                  label={FILTER_LABEL.project_due}
                  count={allEvents.counts.project_due}
                  color={FILTER_COLORS.project_due}
                  checked={filters.project_due}
                  onChange={(v) => setFilters((s) => ({ ...s, project_due: v }))}
                />
              </div>
              <p className="text-gray-secondary text-[10px] mt-3">Showing {monthLabel}</p>
            </section>
          </aside>
        </div>
      </PersonalAppShell>
    </>
  )
}
