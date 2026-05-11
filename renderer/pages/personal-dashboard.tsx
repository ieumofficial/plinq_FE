import { useMemo, useState, type ReactNode } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import PersonalAppShell from '../components/PersonalAppShell'
import ProjectCard from '../components/ui/ProjectCard'
import ActionItem from '../components/ui/ActionItem'
import Calendar, { type CalendarEvent } from '../components/ui/Calendar'
import Schedule from '../components/ui/Schedule'
import Button from '../components/ui/Button'
import {
  useCurrentUser,
  useUserActionItems,
  useUserCalendarEvents,
  useUserProjects,
  useUserUpcomingMeetings,
} from '../lib/hooks'
import {
  dbPriorityToUi,
  dbStatusToUi,
  formatDueDate,
  formatTimeRange,
  userToMember,
} from '../lib/types'

const ACTIVE_PROJECTS_LIMIT = 3
const ACTION_ITEMS_LIMIT = 7
const TODAY_SCHEDULE_LIMIT = 3

function SectionHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string
  title: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div className="flex flex-col gap-[5px]">
        <p className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
          {eyebrow}
        </p>
        <h2 className="text-black text-[20px] font-semibold leading-tight">{title}</h2>
      </div>
      {action}
    </div>
  )
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

export default function PersonalDashboardPage() {
  const router = useRouter()
  const { data: user } = useCurrentUser()
  const userId = user?.id

  const [calMonth, setCalMonth] = useState(startOfMonth(new Date()))
  const today = useMemo(() => new Date(), [])

  const { data: projects = [], isLoading: projectsLoading } = useUserProjects(userId, {
    statuses: ['planned', 'in_progress', 'review'],
    limit: ACTIVE_PROJECTS_LIMIT,
  })

  const { data: tasks = [], isLoading: tasksLoading } = useUserActionItems(userId, {
    limit: ACTION_ITEMS_LIMIT,
  })

  const { data: meetings = [], isLoading: meetingsLoading } = useUserUpcomingMeetings(
    userId,
    {
      from: startOfDay(today),
      to: endOfDay(today),
      limit: TODAY_SCHEDULE_LIMIT,
    }
  )

  const { data: rawEvents } = useUserCalendarEvents(
    userId,
    startOfMonth(calMonth),
    endOfMonth(calMonth)
  )

  const calEvents: CalendarEvent[] = useMemo(() => {
    if (!rawEvents) return []
    return [
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
          type: 'deadline' as const,
        })),
    ]
  }, [rawEvents])

  return (
    <>
      <Head>
        <title>plinq · Dashboard</title>
      </Head>
      <PersonalAppShell active="dashboard">
        <div className="p-6 flex gap-[10px] min-h-full">
          {/* LEFT COLUMN — Projects + Action Items */}
          <div className="flex-1 flex flex-col gap-[10px] min-w-0">
            <section className="bg-white-white rounded-[10px] border border-gray-border-light p-[20px] min-h-[306px]">
              <SectionHeader
                eyebrow={`Projects · ${projects.length} active`}
                title="Active Projects"
                action={
                  <Button
                    size="mini"
                    variant="secondary"
                    iconRight="ArrowRight"
                    onClick={() => router.push('/projects')}
                  >
                    View all
                  </Button>
                }
              />
              {projectsLoading && projects.length === 0 ? (
                <p className="text-gray-secondary text-[12px]">Loading…</p>
              ) : projects.length === 0 ? (
                <p className="text-gray-secondary text-[12px]">No active projects yet.</p>
              ) : (
                <div className="flex gap-[10px] overflow-x-auto">
                  {projects.map((p) => (
                    <ProjectCard
                      key={p.id}
                      name={p.name}
                      description={p.description ?? ''}
                      status={dbStatusToUi(p.status)}
                      progress={p.progressPct ?? 0}
                      members={p.members.map(userToMember)}
                      onOpen={() => router.push(`/projects/${p.id}`)}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="bg-white-white rounded-[10px] border border-gray-border-light p-[20px] flex-1">
              <SectionHeader
                eyebrow={`Tasks · ${tasks.length} pending`}
                title="What you have to do"
                action={
                  <Button
                    size="mini"
                    variant="secondary"
                    iconRight="ArrowRight"
                    onClick={() => router.push('/action-items')}
                  >
                    View all
                  </Button>
                }
              />
              {tasksLoading && tasks.length === 0 ? (
                <p className="text-gray-secondary text-[12px]">Loading…</p>
              ) : tasks.length === 0 ? (
                <p className="text-gray-secondary text-[12px]">All caught up.</p>
              ) : (
                <div className="flex flex-col gap-[5px]">
                  {tasks.map((t) => (
                    <ActionItem
                      key={t.id}
                      title={t.title}
                      date={formatDueDate(t.due_date)}
                      priority={dbPriorityToUi(t.priority)}
                      projectTag={
                        t.project_name
                          ? { label: t.project_name, color: 'purple' }
                          : undefined
                      }
                    />
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* RIGHT COLUMN — Calendar + Today */}
          <div className="w-[594px] flex flex-col gap-[10px]">
            <section className="bg-white-white rounded-[10px] border border-gray-border-light p-[20px]">
              <Calendar
                view="dashboard"
                month={calMonth}
                events={calEvents}
                onPrevMonth={() =>
                  setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))
                }
                onNextMonth={() =>
                  setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))
                }
                onDayClick={() => router.push('/calendar')}
              />
            </section>

            <section className="bg-white-white rounded-[10px] border border-gray-border-light p-[20px] flex-1">
              <SectionHeader eyebrow="Upcoming · Today" title="What's Next" />
              {meetingsLoading && meetings.length === 0 ? (
                <p className="text-gray-secondary text-[12px]">Loading…</p>
              ) : meetings.length === 0 ? (
                <p className="text-gray-secondary text-[12px]">No meetings scheduled today.</p>
              ) : (
                <div className="flex flex-col gap-[10px]">
                  {meetings.map((m) => (
                    <Schedule
                      key={m.id}
                      title={m.name}
                      time={formatTimeRange(m.scheduled_at, m.duration_min)}
                      location={m.location_or_url ?? undefined}
                      attendees={m.attendees.map(userToMember)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </PersonalAppShell>
    </>
  )
}
