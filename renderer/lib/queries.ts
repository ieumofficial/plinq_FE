/**
 * Supabase query helpers for the personal-space pages.
 *
 * Each function takes any context it needs (user_id, org_id, project_id) so
 * pages can pass these from auth/context. Returns plain shapes; mapping to
 * component props happens at the call site.
 */

import { supabase } from './supabase'
import type {
  ProjectRow,
  TaskRow,
  MeetingRow,
  UserRow,
  TaskStatusDb,
} from './types'

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function getCurrentUser(): Promise<UserRow | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('users')
    .select('id, email, first_name, last_name, nickname, job_title')
    .eq('id', user.id)
    .single()
  if (error) {
    console.error('[queries] getCurrentUser', error)
    return null
  }
  return data as UserRow
}

// ─── Projects ────────────────────────────────────────────────────────────────

export type ProjectWithStats = ProjectRow & {
  members: UserRow[]
  /** done / total — null if no tasks yet. */
  progressPct: number | null
}

/**
 * Projects the user is a member of, optionally filtered by status, ordered
 * by most recently updated task.
 */
export async function getUserProjects(
  userId: string,
  opts?: { statuses?: ProjectRow['status'][]; limit?: number }
): Promise<ProjectWithStats[]> {
  // 1. Project ids the user belongs to
  const { data: memberships, error: mErr } = await supabase
    .from('project_members')
    .select('project_id')
    .eq('user_id', userId)
  if (mErr) {
    console.error('[queries] project_members', mErr)
    return []
  }
  const projectIds = (memberships ?? []).map((m) => m.project_id as string)
  if (projectIds.length === 0) return []

  // 2. Fetch the projects themselves
  let q = supabase
    .from('projects')
    .select('id, name, description, team_id, lead_id, status, budget, created_at')
    .in('id', projectIds)
  if (opts?.statuses && opts.statuses.length > 0) {
    q = q.in('status', opts.statuses)
  }
  q = q.order('created_at', { ascending: false })
  if (opts?.limit) q = q.limit(opts.limit)

  const { data: projects, error: pErr } = await q
  if (pErr) {
    console.error('[queries] projects', pErr)
    return []
  }
  const projectRows = (projects ?? []) as ProjectRow[]

  // 3. Members + task counts per project (parallel)
  const ids = projectRows.map((p) => p.id)
  const [membersRes, tasksRes] = await Promise.all([
    supabase
      .from('project_members')
      .select('project_id, users(id, email, first_name, last_name, nickname, job_title)')
      .in('project_id', ids),
    supabase
      .from('tasks')
      .select('project_id, status')
      .in('project_id', ids),
  ])
  if (membersRes.error) console.error('[queries] members for projects', membersRes.error)
  if (tasksRes.error) console.error('[queries] tasks for projects', tasksRes.error)

  const membersByProject = new Map<string, UserRow[]>()
  for (const row of membersRes.data ?? []) {
    const r = row as unknown as { project_id: string; users: UserRow | UserRow[] | null }
    const pid = r.project_id
    const u = r.users
    if (!u) continue
    const users = Array.isArray(u) ? u : [u]
    const arr = membersByProject.get(pid) ?? []
    arr.push(...users)
    membersByProject.set(pid, arr)
  }

  const taskCountByProject = new Map<string, { total: number; done: number }>()
  for (const t of (tasksRes.data ?? []) as { project_id: string; status: TaskStatusDb }[]) {
    const c = taskCountByProject.get(t.project_id) ?? { total: 0, done: 0 }
    c.total += 1
    if (t.status === 'done') c.done += 1
    taskCountByProject.set(t.project_id, c)
  }

  return projectRows.map((p) => {
    const counts = taskCountByProject.get(p.id)
    const progressPct = counts && counts.total > 0
      ? Math.round((counts.done / counts.total) * 100)
      : null
    return {
      ...p,
      members: membersByProject.get(p.id) ?? [],
      progressPct,
    }
  })
}

// ─── Project mutations ──────────────────────────────────────────────────────

export type NewProjectInput = {
  name: string
  description?: string
  team_id?: string | null
  status?: ProjectRow['status']
}

/**
 * Insert a project with the current user as `lead_id` so the
 * `handle_new_project` trigger auto-adds them to project_members.
 */
export async function createProject(
  input: NewProjectInput
): Promise<{ id: string } | { error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  const { data, error } = await supabase
    .from('projects')
    .insert({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      team_id: input.team_id ?? null,
      lead_id: user.id,
      status: input.status ?? 'active',
    })
    .select('id')
    .single()

  if (error) {
    console.error('[queries] createProject', error)
    return { error: error.message }
  }
  return { id: (data as { id: string }).id }
}

// ─── Tasks (action items) ────────────────────────────────────────────────────

export type TaskWithProject = TaskRow & {
  project_name: string | null
}

/**
 * Tasks assigned to the user, excluding done by default, ordered by
 * upcoming due date.
 */
export async function getUserActionItems(
  userId: string,
  opts?: { includeDone?: boolean; limit?: number }
): Promise<TaskWithProject[]> {
  const { data: assignments, error: aErr } = await supabase
    .from('task_assignees')
    .select('task_id')
    .eq('user_id', userId)
  if (aErr) {
    console.error('[queries] task_assignees', aErr)
    return []
  }
  const taskIds = (assignments ?? []).map((a) => a.task_id as string)
  if (taskIds.length === 0) return []

  let q = supabase
    .from('tasks')
    .select(
      'id, project_id, team_id, parent_task_id, title, description, status, priority, start_date, due_date, kanban_column_id, created_by, created_at, updated_at, projects(name)'
    )
    .in('id', taskIds)
    .order('due_date', { ascending: true, nullsFirst: false })

  if (!opts?.includeDone) q = q.neq('status', 'done')
  if (opts?.limit) q = q.limit(opts.limit)

  const { data, error } = await q
  if (error) {
    console.error('[queries] tasks for user', error)
    return []
  }
  return (data ?? []).map((row) => {
    const r = row as unknown as TaskRow & {
      projects: { name: string } | { name: string }[] | null
    }
    const proj = Array.isArray(r.projects) ? r.projects[0] : r.projects
    return {
      ...(r as TaskRow),
      project_name: proj?.name ?? null,
    }
  })
}

// ─── Meetings (today / upcoming) ─────────────────────────────────────────────

export type MeetingWithAttendees = MeetingRow & {
  attendees: UserRow[]
}

/**
 * Upcoming meetings for the user (where they are an attendee), starting from now.
 */
export async function getUserUpcomingMeetings(
  userId: string,
  opts?: { from?: Date; to?: Date; limit?: number }
): Promise<MeetingWithAttendees[]> {
  const { data: rows, error: aErr } = await supabase
    .from('meeting_attendees')
    .select('meeting_id')
    .eq('user_id', userId)
  if (aErr) {
    console.error('[queries] meeting_attendees', aErr)
    return []
  }
  const meetingIds = (rows ?? []).map((r) => r.meeting_id as string)
  if (meetingIds.length === 0) return []

  const from = opts?.from ?? new Date()
  let q = supabase
    .from('meetings')
    .select('id, project_id, name, scheduled_at, duration_min, location_or_url, status')
    .in('id', meetingIds)
    .gte('scheduled_at', from.toISOString())
    .order('scheduled_at', { ascending: true })
  if (opts?.to) q = q.lte('scheduled_at', opts.to.toISOString())
  if (opts?.limit) q = q.limit(opts.limit)

  const { data: meetings, error: mErr } = await q
  if (mErr) {
    console.error('[queries] meetings', mErr)
    return []
  }
  const ms = (meetings ?? []) as MeetingRow[]
  if (ms.length === 0) return []

  // Attendees in one query
  const ids = ms.map((m) => m.id)
  const { data: attRows, error: attErr } = await supabase
    .from('meeting_attendees')
    .select('meeting_id, users(id, email, first_name, last_name, nickname, job_title)')
    .in('meeting_id', ids)
  if (attErr) console.error('[queries] meeting attendees expand', attErr)

  const attendeesByMeeting = new Map<string, UserRow[]>()
  for (const row of attRows ?? []) {
    const r = row as unknown as { meeting_id: string; users: UserRow | UserRow[] | null }
    const mid = r.meeting_id
    const u = r.users
    if (!u) continue
    const users = Array.isArray(u) ? u : [u]
    const arr = attendeesByMeeting.get(mid) ?? []
    arr.push(...users)
    attendeesByMeeting.set(mid, arr)
  }

  return ms.map((m) => ({ ...m, attendees: attendeesByMeeting.get(m.id) ?? [] }))
}

// ─── Calendar (month-range events) ───────────────────────────────────────────

export type CalendarSourceEvents = {
  meetings: MeetingRow[]
  tasksWithDue: TaskRow[]
}

/**
 * All calendar-relevant events for the user in a date range:
 *   - meetings the user attends
 *   - tasks assigned to the user with a due_date in range
 */
export async function getUserCalendarEvents(
  userId: string,
  from: Date,
  to: Date
): Promise<CalendarSourceEvents> {
  const [meetingsRes, taskAssignRes] = await Promise.all([
    supabase
      .from('meeting_attendees')
      .select(
        'meetings!inner(id, project_id, name, scheduled_at, duration_min, location_or_url, status)'
      )
      .eq('user_id', userId)
      .gte('meetings.scheduled_at', from.toISOString())
      .lte('meetings.scheduled_at', to.toISOString()),
    supabase
      .from('task_assignees')
      .select(
        'tasks!inner(id, project_id, team_id, parent_task_id, title, description, status, priority, start_date, due_date, kanban_column_id, created_by, created_at, updated_at)'
      )
      .eq('user_id', userId)
      .gte('tasks.due_date', from.toISOString().slice(0, 10))
      .lte('tasks.due_date', to.toISOString().slice(0, 10)),
  ])

  const meetings: MeetingRow[] = []
  for (const row of meetingsRes.data ?? []) {
    const m = (row as { meetings: MeetingRow | MeetingRow[] }).meetings
    if (!m) continue
    if (Array.isArray(m)) meetings.push(...m)
    else meetings.push(m)
  }

  const tasksWithDue: TaskRow[] = []
  for (const row of taskAssignRes.data ?? []) {
    const t = (row as { tasks: TaskRow | TaskRow[] }).tasks
    if (!t) continue
    if (Array.isArray(t)) tasksWithDue.push(...t)
    else tasksWithDue.push(t)
  }

  return { meetings, tasksWithDue }
}
