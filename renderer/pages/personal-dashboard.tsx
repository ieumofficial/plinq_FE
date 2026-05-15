import { useMemo, useState, type ReactNode } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import PersonalAppShell from '../components/PersonalAppShell'
import { useProjectPreview } from '../components/ProjectPreviewProvider'
import TaskDetailModal from '../components/TaskDetailModal'
import type { TaskWithProject } from '../lib/queries'
import ProjectCard from '../components/ui/ProjectCard'
import ActionItem from '../components/ui/ActionItem'
import Calendar, { type CalendarEvent } from '../components/ui/Calendar'
import Schedule from '../components/ui/Schedule'
import Icon from '../components/ui/Icon'
import {
  useActiveOrg,
  useCurrentUser,
  useUpdateTaskStatus,
  useUserActionItems,
  useUserCalendarEvents,
  useUserProjects,
  useUserUpcomingMeetings,
} from '../lib/hooks'
import { useFitCount } from '../lib/useFitCount'
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
  eyebrowColorClass = 'text-gray-main',
  title,
  action,
}: {
  eyebrow: string
  eyebrowColorClass?: string
  title: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div className="flex flex-col gap-[5px]">
        <p className={`${eyebrowColorClass} text-[10px] font-medium uppercase tracking-[1.5px]`}>
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
  const preview = useProjectPreview()
  const { data: user } = useCurrentUser()
  const userId = user?.id
  const [openTask, setOpenTask] = useState<TaskWithProject | null>(null)

  const [calMonth] = useState(startOfMonth(new Date()))
  const today = useMemo(() => new Date(), [])

  // Dynamic capacity so each section shows what fits and never collapses to
  // just its header. `min: 1` keeps at least one row visible. `itemHeight`
  // is only a fallback — the hook switches to the first child's measured
  // height after mount.
  const [tasksListRef, tasksFit, tasksFree] = useFitCount<HTMLDivElement>({
    itemHeight: 70,
    gap: 5,
    min: 1,
    max: ACTION_ITEMS_LIMIT,
  })
  const [scheduleListRef, scheduleFit, scheduleFree] = useFitCount<HTMLDivElement>({
    itemHeight: 84,
    gap: 10,
    min: 1,
    max: TODAY_SCHEDULE_LIMIT,
  })

  // Reserve approximately one line + leading gap for the trailing "+N more"
  // chip. If the leftover space after the visible items already fits this,
  // we keep every fitted item and just append the chip; otherwise we drop
  // one item to make room. Keeps the chip from clipping AND from wasting
  // space when there's already room for it.
  const TRAILING_PX = 22

  // Personal dashboard is scoped to the user's currently-active org. Without
  // this, multi-org users see every org's projects/tasks/meetings smashed
  // together (and the "current org" header label doesn't match the data).
  const activeOrg = useActiveOrg(user?.id)
  const activeOrgId = activeOrg?.id ?? null
  console.log('[personal-dashboard] activeOrg', { id: activeOrgId, name: activeOrg?.name })

  const { data: projects = [], isLoading: projectsLoading } = useUserProjects(userId, {
    statuses: ['planned', 'in_progress', 'review'],
    limit: ACTIVE_PROJECTS_LIMIT,
    orgId: activeOrgId,
  })
  // Separate unfiltered fetch for the mini calendar — we want every project
  // the user belongs to so their due dates show up regardless of status.
  // Still org-scoped so cross-org dots don't bleed in.
  const { data: allProjects = [] } = useUserProjects(userId, {
    orgId: activeOrgId,
  })

  const { data: tasks = [], isLoading: tasksLoading } = useUserActionItems(userId, {
    limit: ACTION_ITEMS_LIMIT,
    orgId: activeOrgId,
  })
  const { mutate: updateTaskStatus } = useUpdateTaskStatus()

  const { data: meetings = [], isLoading: meetingsLoading } = useUserUpcomingMeetings(
    userId,
    {
      from: startOfDay(today),
      to: endOfDay(today),
      limit: TODAY_SCHEDULE_LIMIT,
      orgId: activeOrgId,
    }
  )

  const { data: rawEvents } = useUserCalendarEvents(
    userId,
    startOfMonth(calMonth),
    endOfMonth(calMonth),
    { orgId: activeOrgId },
  )

  const calEvents: CalendarEvent[] = useMemo(() => {
    if (!rawEvents) return []
    // Project-due events: each project the user belongs to whose `dueDate`
    // (latest task due_date — see queries.ts) lands inside the visible month.
    const monthStart = startOfMonth(calMonth).getTime()
    const monthEnd = endOfMonth(calMonth).getTime()
    const projectEvents = allProjects
      .filter((p) => {
        if (!p.dueDate) return false
        const t = new Date(p.dueDate + 'T00:00:00').getTime()
        return t >= monthStart && t <= monthEnd
      })
      .map((p) => ({
        id: `p-${p.id}`,
        date: p.dueDate!,
        title: `${p.name} due`,
        // Red chips, matching the "Project" legend dot. Reuses EVENT_COLORS.project.
        type: 'project' as const,
      }))
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
          // Task chips render amber so they line up with the "Task" legend
          // dot at the top of the mini calendar. (Was 'deadline' = red.)
          type: 'task' as const,
        })),
      ...projectEvents,
    ]
  }, [rawEvents, allProjects, calMonth])

  return (
    <>
      <Head>
        <title>plinq · Dashboard</title>
      </Head>
      <PersonalAppShell active="dashboard">
        <div className="flex-1 min-h-0 flex p-6 gap-[10px]">
          {/* LEFT COLUMN — Projects + Action Items */}
          <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-[10px]">
            <section className="shrink-0 bg-white-white rounded-[10px] border border-gray-border-light p-[20px] flex flex-col overflow-hidden">
              <SectionHeader
                eyebrow={`Projects · ${projects.length} active`}
                eyebrowColorClass="text-blue-main"
                title="Active Projects"
                action={
                  <button
                    type="button"
                    onClick={() => router.push('/projects')}
                    className="flex items-center gap-[5px] pl-[10px] pr-[5px] py-[5px] rounded-[5px] text-black hover:bg-white-item"
                  >
                    <span className="text-black text-[10px] uppercase leading-none">view all</span>
                    <Icon name="ArrowRight" size={15} />
                  </button>
                }
              />
              {projectsLoading && projects.length === 0 ? (
                <p className="text-gray-secondary text-[12px]">Loading…</p>
              ) : projects.length === 0 ? (
                <p className="text-gray-secondary text-[12px]">No active projects yet.</p>
              ) : (
                <div
                  className="grid gap-[10px] min-h-[225px]"
                  style={{
                    gridTemplateColumns: `repeat(${projects.length}, minmax(0, 1fr))`,
                  }}
                >
                  {projects.map((p) => (
                    <ProjectCard
                      key={p.id}
                      fluid
                      name={p.name}
                      description={p.description ?? ''}
                      status={dbStatusToUi(p.status)}
                      progress={p.progressPct ?? 0}
                      members={p.members.map(userToMember)}
                      onOpen={() => preview.open(p.id)}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="flex-1 min-h-0 bg-white-white rounded-[10px] border border-gray-border-light p-[20px] flex flex-col overflow-hidden">
              <SectionHeader
                eyebrow={`Tasks · ${tasks.length} pending`}
                eyebrowColorClass="text-red-main"
                title="What you have to do"
                action={
                  <button
                    type="button"
                    onClick={() => router.push('/action-items')}
                    className="flex items-center gap-[5px] pl-[10px] pr-[5px] py-[5px] rounded-[5px] text-black hover:bg-white-item"
                  >
                    <span className="text-black text-[10px] uppercase leading-none">view all</span>
                    <Icon name="ArrowRight" size={15} />
                  </button>
                }
              />
              {tasksLoading && tasks.length === 0 ? (
                <p className="text-gray-secondary text-[12px]">Loading…</p>
              ) : tasks.length === 0 ? (
                <p className="text-gray-secondary text-[12px]">All caught up.</p>
              ) : (
                (() => {
                  const hasOverflow = tasks.length > tasksFit
                  // If the unused space below already holds the +N chip, keep
                  // every fitted item; otherwise drop one to make room.
                  const visible = hasOverflow
                    ? tasksFree >= TRAILING_PX
                      ? tasksFit
                      : Math.max(1, tasksFit - 1)
                    : tasksFit
                  const hidden = tasks.length - visible
                  return (
                    <div
                      ref={tasksListRef}
                      className="flex-1 min-h-0 flex flex-col gap-[5px] overflow-hidden"
                    >
                      {tasks.slice(0, visible).map((t) => (
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
                          checked={t.status === 'done'}
                          onCheckedChange={(next) =>
                            updateTaskStatus({
                              taskId: t.id,
                              status: next ? 'done' : 'in_progress',
                            })
                          }
                          onClick={() => setOpenTask(t)}
                        />
                      ))}
                      {hidden > 0 && (
                        <button
                          type="button"
                          onClick={() => router.push('/action-items')}
                          className="shrink-0 text-left text-gray-secondary hover:text-black text-[10px] font-medium uppercase tracking-[1.5px] pl-[14px] py-[2px]"
                        >
                          +{hidden} more
                        </button>
                      )}
                    </div>
                  )
                })()
              )}
            </section>
          </div>

          {/* RIGHT COLUMN — Calendar + Today.
              flex-1 (not a fixed 594px cap) so the calendar grid scales with
              viewport width — container queries inside Day/Event then enlarge
              the date number and event chips.
              Calendar section gets a heavier vertical share so the cells
              grow tall on large viewports instead of staying squat. */}
          <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-[10px]">
            <section className="flex-[3] [@media(min-height:900px)]:flex-[4] [@media(min-height:1100px)]:flex-[5] min-h-0 bg-white-white rounded-[10px] border border-gray-border-light p-[20px] flex flex-col overflow-hidden">
              <Calendar
                view="dashboard"
                month={calMonth}
                events={calEvents}
                onOpen={() => router.push('/calendar')}
              />
            </section>

            <section className="flex-[1] min-h-0 bg-white-white rounded-[10px] border border-gray-border-light p-[20px] flex flex-col overflow-hidden">
              <SectionHeader
                eyebrow="Upcoming · Today"
                eyebrowColorClass="text-green-main"
                title="What's Next"
              />
              {meetingsLoading && meetings.length === 0 ? (
                <p className="text-gray-secondary text-[12px]">Loading…</p>
              ) : meetings.length === 0 ? (
                <p className="text-gray-secondary text-[12px]">No meetings scheduled today.</p>
              ) : (
                (() => {
                  const hasOverflow = meetings.length > scheduleFit
                  const visible = hasOverflow
                    ? scheduleFree >= TRAILING_PX
                      ? scheduleFit
                      : Math.max(1, scheduleFit - 1)
                    : scheduleFit
                  const hidden = meetings.length - visible
                  return (
                    <div
                      ref={scheduleListRef}
                      className="flex-1 min-h-0 flex flex-col gap-[10px] overflow-hidden"
                    >
                      {meetings.slice(0, visible).map((m) => (
                        <Schedule
                          key={m.id}
                          title={m.name}
                          time={formatTimeRange(m.scheduled_at, m.duration_min)}
                          location={m.location_or_url ?? undefined}
                          attendees={m.attendees.map(userToMember)}
                        />
                      ))}
                      {hidden > 0 && (
                        <button
                          type="button"
                          onClick={() => router.push('/calendar')}
                          className="shrink-0 text-left text-gray-secondary hover:text-black text-[10px] font-medium uppercase tracking-[1.5px] py-[2px]"
                        >
                          +{hidden} more
                        </button>
                      )}
                    </div>
                  )
                })()
              )}
            </section>
          </div>
        </div>
      </PersonalAppShell>
      <TaskDetailModal
        open={openTask !== null}
        task={openTask}
        projectName={openTask?.project_name ?? 'No project'}
        ticketId={openTask ? openTask.id.slice(0, 8).toUpperCase() : ''}
        sourceMeeting={
          openTask?.source_meeting_name && openTask?.source_meeting_scheduled_at
            ? {
                name: openTask.source_meeting_name,
                date: new Date(
                  openTask.source_meeting_scheduled_at
                ).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                }),
              }
            : null
        }
        onClose={() => setOpenTask(null)}
      />
    </>
  )
}
