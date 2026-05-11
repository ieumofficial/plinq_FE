import { useMemo, useState } from 'react'
import Head from 'next/head'
import PersonalAppShell from '../components/PersonalAppShell'
import Calendar, { type CalendarEvent } from '../components/ui/Calendar'
import Schedule from '../components/ui/Schedule'
import FilterChecklist from '../components/ui/FilterChecklist'
import {
  useCurrentUser,
  useUserCalendarEvents,
  useUserUpcomingMeetings,
} from '../lib/hooks'

type FilterKey = 'meetings' | 'tasks'
const FILTER_COLORS: Record<FilterKey, string> = {
  meetings: '#5B7FB6',
  tasks: '#588F6E',
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

export default function CalendarPage() {
  const { data: user } = useCurrentUser()
  const userId = user?.id
  const [calMonth, setCalMonth] = useState(startOfMonth(new Date()))
  const today = useMemo(() => new Date(), [])

  const { data: rawEvents } = useUserCalendarEvents(
    userId,
    startOfMonth(calMonth),
    endOfMonth(calMonth)
  )
  const { data: todayMeetings = [] } = useUserUpcomingMeetings(userId, {
    from: startOfDay(today),
    to: endOfDay(today),
  })

  const [filters, setFilters] = useState<Record<FilterKey, boolean>>({
    meetings: true,
    tasks: true,
  })

  const allEvents = useMemo(() => {
    if (!rawEvents) return { events: [] as CalendarEvent[], counts: { meetings: 0, tasks: 0 } }
    const events: CalendarEvent[] = [
      ...rawEvents.meetings.map((m) => ({
        id: `m-${m.id}`,
        date: m.scheduled_at.slice(0, 10),
        title: m.name,
        type: 'meeting' as const,
      })),
      ...rawEvents.tasksWithDue
        .filter((t) => t.due_date)
        .map((t) => ({
          id: `t-${t.id}`,
          date: t.due_date!,
          title: t.title,
          type: 'task' as const,
        })),
    ]
    return {
      events,
      counts: { meetings: rawEvents.meetings.length, tasks: rawEvents.tasksWithDue.length },
    }
  }, [rawEvents])

  const visibleEvents = allEvents.events.filter((e) => {
    if (e.type === 'meeting') return filters.meetings
    if (e.type === 'task') return filters.tasks
    return true
  })

  const monthLabel = calMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <>
      <Head>
        <title>plinq · Calendar</title>
      </Head>
      <PersonalAppShell active="calendar">
        <div className="p-6 flex gap-[10px]">
          {/* Calendar */}
          <section className="flex-1 bg-white-white rounded-[10px] border border-gray-border-light p-[20px] min-w-0">
            <Calendar
              view="monthly"
              month={calMonth}
              events={visibleEvents}
              onPrevMonth={() =>
                setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))
              }
              onNextMonth={() =>
                setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))
              }
            />
          </section>

          {/* Right column */}
          <aside className="w-[263px] flex flex-col gap-[10px] shrink-0">
            <section className="bg-white-white rounded-[10px] border border-gray-border-light p-[20px]">
              <div className="flex flex-col gap-[5px] mb-3">
                <p className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                  Today · {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
                <h2 className="text-black text-[16px] font-semibold">
                  {todayMeetings.length} {todayMeetings.length === 1 ? 'meeting' : 'meetings'}
                </h2>
              </div>
              {todayMeetings.length === 0 ? (
                <p className="text-gray-secondary text-[12px]">No meetings today.</p>
              ) : (
                <div className="flex flex-col gap-[5px]">
                  {todayMeetings.map((m) => (
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
                  label="Meetings"
                  count={allEvents.counts.meetings}
                  color={FILTER_COLORS.meetings}
                  checked={filters.meetings}
                  onChange={(v) => setFilters((s) => ({ ...s, meetings: v }))}
                />
                <FilterChecklist
                  label="Tasks (due)"
                  count={allEvents.counts.tasks}
                  color={FILTER_COLORS.tasks}
                  checked={filters.tasks}
                  onChange={(v) => setFilters((s) => ({ ...s, tasks: v }))}
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
