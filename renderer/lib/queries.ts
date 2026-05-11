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
  tasksTotal: number
  tasksDone: number
  /** Latest due_date among the project's tasks (YYYY-MM-DD), or null. */
  nextDueDate: string | null
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
    .select('id, name, description, team_id, lead_id, status, color, budget, created_at')
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
      .select('project_id, status, due_date')
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

  const taskStatsByProject = new Map<
    string,
    { total: number; done: number; nextDueDate: string | null }
  >()
  for (const t of (tasksRes.data ?? []) as {
    project_id: string
    status: TaskStatusDb
    due_date: string | null
  }[]) {
    const c = taskStatsByProject.get(t.project_id) ?? {
      total: 0,
      done: 0,
      nextDueDate: null,
    }
    c.total += 1
    if (t.status === 'done') c.done += 1
    if (t.due_date && (!c.nextDueDate || t.due_date < c.nextDueDate)) {
      c.nextDueDate = t.due_date
    }
    taskStatsByProject.set(t.project_id, c)
  }

  return projectRows.map((p) => {
    const counts = taskStatsByProject.get(p.id)
    const total = counts?.total ?? 0
    const done = counts?.done ?? 0
    const progressPct = total > 0 ? Math.round((done / total) * 100) : null
    return {
      ...p,
      members: membersByProject.get(p.id) ?? [],
      progressPct,
      tasksTotal: total,
      tasksDone: done,
      nextDueDate: counts?.nextDueDate ?? null,
    }
  })
}

// ─── Project mutations ──────────────────────────────────────────────────────

export type NewProjectInput = {
  name: string
  description?: string
  color?: string
  team_id?: string | null
  status?: ProjectRow['status']
  /** Members to add (besides the lead, who is auto-added by trigger as admin). */
  members?: { user_id: string; role: import('./types').ProjectRoleDb }[]
  /** Email-only invites (user not yet registered). */
  emailInvites?: { email: string; role: import('./types').ProjectRoleDb }[]
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
      ...(input.color ? { color: input.color } : {}),
      // status omitted → DB default 'planned' applies
      ...(input.status ? { status: input.status } : {}),
    })
    .select('id')
    .single()

  if (error) {
    console.error('[queries] createProject', error)
    return { error: error.message }
  }
  const projectId = (data as { id: string }).id

  // Bulk insert additional members (skip the lead — trigger added them as admin).
  if (input.members && input.members.length > 0) {
    const rows = input.members
      .filter((m) => m.user_id !== user.id)
      .map((m) => ({ project_id: projectId, user_id: m.user_id, role: m.role }))
    if (rows.length > 0) {
      const { error: mErr } = await supabase.from('project_members').insert(rows)
      if (mErr) console.error('[queries] add project members', mErr)
    }
  }

  // Email invites (pending until they register)
  if (input.emailInvites && input.emailInvites.length > 0) {
    const rows = input.emailInvites.map((i) => ({
      project_id: projectId,
      email: i.email.trim().toLowerCase(),
      role: i.role,
      invited_by: user.id,
    }))
    const { error: iErr } = await supabase.from('project_invites').insert(rows)
    if (iErr) console.error('[queries] add project invites', iErr)
  }

  return { id: projectId }
}

export async function addProjectInvite(input: {
  project_id: string
  email: string
  role?: import('./types').ProjectRoleDb
}): Promise<{ ok: true } | { error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const { error } = await supabase.from('project_invites').insert({
    project_id: input.project_id,
    email: input.email.trim().toLowerCase(),
    role: input.role ?? 'editor',
    invited_by: user.id,
  })
  if (error) return { error: error.message }
  return { ok: true }
}

// ─── Task mutations ─────────────────────────────────────────────────────────

export type NewTaskInput = {
  title: string
  description?: string
  project_id: string
  status?: TaskStatusDb
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  due_date?: string | null
  /** User IDs to assign (each becomes a contributor). */
  assigneeIds?: string[]
}

export async function createTask(
  input: NewTaskInput
): Promise<{ id: string } | { error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      project_id: input.project_id,
      status: input.status ?? 'planned',
      priority: input.priority ?? 'medium',
      due_date: input.due_date ?? null,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[queries] createTask', error)
    return { error: error.message }
  }
  const taskId = (data as { id: string }).id

  if (input.assigneeIds && input.assigneeIds.length > 0) {
    const rows = input.assigneeIds.map((uid) => ({
      task_id: taskId,
      user_id: uid,
      role: 'contributor' as const,
      assigned_by: user.id,
    }))
    const { error: aErr } = await supabase.from('task_assignees').insert(rows)
    if (aErr) console.error('[queries] add task assignees', aErr)
  }

  return { id: taskId }
}

// ─── Meeting mutations ──────────────────────────────────────────────────────

export type NewMeetingInput = {
  name: string
  project_id: string
  scheduled_at: string // ISO timestamp
  duration_min: number
  location_or_url?: string | null
  meeting_type?: import('./types').MeetingType
  recurrence?: import('./types').MeetingRecurrence
  /** Required when recurrence != 'once'. ISO date string. */
  recurrence_until?: string | null
  attendeeIds?: string[]
  emailInvites?: string[]
  /** Ordered agenda titles. */
  agenda?: string[]
}

function generateRecurrenceDates(
  startIso: string,
  recurrence: import('./types').MeetingRecurrence,
  until: string
): Date[] {
  const start = new Date(startIso)
  const untilDate = new Date(until + 'T23:59:59')
  const out: Date[] = [start]
  if (recurrence === 'once') return out

  const stepDays =
    recurrence === 'every_day' ? 1 : recurrence === 'every_week' ? 7 : 365
  let cursor = new Date(start)
  while (true) {
    cursor = new Date(cursor)
    if (recurrence === 'every_year') {
      cursor.setFullYear(cursor.getFullYear() + 1)
    } else {
      cursor.setDate(cursor.getDate() + stepDays)
    }
    if (cursor > untilDate) break
    out.push(new Date(cursor))
    if (out.length > 500) break // safety cap
  }
  return out
}

export async function createMeeting(
  input: NewMeetingInput
): Promise<{ id: string; instances?: number } | { error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  const recurrence = input.recurrence ?? 'once'
  const isRecurring = recurrence !== 'once' && !!input.recurrence_until
  const groupId = isRecurring ? crypto.randomUUID() : null
  const dates = isRecurring
    ? generateRecurrenceDates(input.scheduled_at, recurrence, input.recurrence_until!)
    : [new Date(input.scheduled_at)]

  // Insert all instances (single insert if 'once', many if recurring)
  const meetingRows = dates.map((d) => ({
    name: input.name.trim(),
    project_id: input.project_id,
    scheduled_at: d.toISOString(),
    duration_min: input.duration_min,
    location_or_url: input.location_or_url ?? null,
    meeting_type: input.meeting_type ?? 'planning',
    recurrence,
    recurrence_until: input.recurrence_until ?? null,
    recurrence_group_id: groupId,
    created_by: user.id,
  }))
  const { data: insertedMeetings, error } = await supabase
    .from('meetings')
    .insert(meetingRows)
    .select('id')

  if (error) {
    console.error('[queries] createMeeting', error)
    return { error: error.message }
  }
  const meetingIds = (insertedMeetings ?? []).map((r) => (r as { id: string }).id)
  const firstId = meetingIds[0]

  // Attendees + agenda for each instance.
  if (input.attendeeIds && input.attendeeIds.length > 0) {
    const rows = meetingIds.flatMap((mid) =>
      input.attendeeIds!.map((uid) => ({
        meeting_id: mid,
        user_id: uid,
        attendance: 'invited' as const,
      }))
    )
    const { error: aErr } = await supabase.from('meeting_attendees').insert(rows)
    if (aErr) console.error('[queries] add meeting attendees', aErr)
  }

  if (input.agenda && input.agenda.length > 0) {
    const cleanAgenda = input.agenda
      .map((title, i) => ({ title: title.trim(), order: i }))
      .filter((r) => r.title.length > 0)
    if (cleanAgenda.length > 0) {
      const rows = meetingIds.flatMap((mid) =>
        cleanAgenda.map((a) => ({ meeting_id: mid, title: a.title, order: a.order }))
      )
      const { error: gErr } = await supabase.from('meeting_agendas').insert(rows)
      if (gErr) console.error('[queries] add meeting agendas', gErr)
    }
  }

  // Email invites (only on the first/parent instance — when they register, they
  // get added to all instances via the recurrence_group_id lookup)
  if (input.emailInvites && input.emailInvites.length > 0 && firstId) {
    const rows = input.emailInvites.map((email) => ({
      meeting_id: firstId,
      email: email.trim().toLowerCase(),
      invited_by: user.id,
    }))
    const { error: iErr } = await supabase.from('meeting_invites').insert(rows)
    if (iErr) console.error('[queries] add meeting invites', iErr)
  }

  return { id: firstId, instances: meetingIds.length }
}

export async function addMeetingInvite(input: {
  meeting_id: string
  email: string
}): Promise<{ ok: true } | { error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const { error } = await supabase.from('meeting_invites').insert({
    meeting_id: input.meeting_id,
    email: input.email.trim().toLowerCase(),
    invited_by: user.id,
  })
  if (error) return { error: error.message }
  return { ok: true }
}

// ─── Member helpers ─────────────────────────────────────────────────────────

/** All users that are members of any organization the current user belongs to. */
export async function getOrgMembers(orgId: string): Promise<UserRow[]> {
  const { data, error } = await supabase
    .from('organization_members')
    .select('users(id, email, first_name, last_name, nickname, job_title)')
    .eq('org_id', orgId)
  if (error) {
    console.error('[queries] getOrgMembers', error)
    return []
  }
  const out: UserRow[] = []
  for (const row of data ?? []) {
    const u = (row as unknown as { users: UserRow | UserRow[] | null }).users
    if (!u) continue
    if (Array.isArray(u)) out.push(...u)
    else out.push(u)
  }
  return out
}

export async function getProjectMembers(projectId: string): Promise<UserRow[]> {
  const { data, error } = await supabase
    .from('project_members')
    .select('users(id, email, first_name, last_name, nickname, job_title)')
    .eq('project_id', projectId)
  if (error) {
    console.error('[queries] getProjectMembers', error)
    return []
  }
  const out: UserRow[] = []
  for (const row of data ?? []) {
    const u = (row as unknown as { users: UserRow | UserRow[] | null }).users
    if (!u) continue
    if (Array.isArray(u)) out.push(...u)
    else out.push(u)
  }
  return out
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
