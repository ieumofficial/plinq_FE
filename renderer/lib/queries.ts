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
  ChatSessionRow,
  ChatSessionPrivacy,
  ChatMessageRow,
} from './types'

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function getCurrentUser(): Promise<UserRow | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('users')
    .select('id, email, first_name, last_name, nickname, job_title, status')
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
  /** Earliest task due_date — the next upcoming deadline (YYYY-MM-DD), or null.
   *  Used by health logic ("at-risk if a deadline is within 7 days"); do
   *  not surface as the project's "Due" — that's `dueDate` below. */
  nextDueDate: string | null
  /** The project's "Due" label. Prefers the explicit `projects.due_date`
   *  column when set; otherwise falls back to the latest task due_date as a
   *  legacy heuristic for projects created before due_date existed. */
  dueDate: string | null
}

/**
 * Projects the user is a member of, optionally filtered by status, ordered
 * by most recently updated task.
 */
export async function getUserProjects(
  userId: string,
  opts?: {
    statuses?: ProjectRow['status'][]
    limit?: number
    /** Restrict to projects in this org. Personal Space pages pass the
     *  active-org id so multi-org users don't see cross-org bleed-through. */
    orgId?: string | null
  }
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
    .select('id, name, description, org_id, lead_id, status, color, budget, due_date, created_at')
    .in('id', projectIds)
  if (opts?.statuses && opts.statuses.length > 0) {
    q = q.in('status', opts.statuses)
  }
  if (opts?.orgId) q = q.eq('org_id', opts.orgId)
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
      .select('project_id, users(id, email, first_name, last_name, nickname, job_title, status)')
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
    { total: number; done: number; nextDueDate: string | null; dueDate: string | null }
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
      dueDate: null,
    }
    c.total += 1
    if (t.status === 'done') c.done += 1
    if (t.due_date && (!c.nextDueDate || t.due_date < c.nextDueDate)) {
      c.nextDueDate = t.due_date
    }
    if (t.due_date && (!c.dueDate || t.due_date > c.dueDate)) {
      c.dueDate = t.due_date
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
      // Prefer the project's explicit due_date; fall back to the latest
      // task due_date for legacy projects without one.
      dueDate: p.due_date ?? counts?.dueDate ?? null,
    }
  })
}

/**
 * All projects in an org, regardless of the viewer's project_members
 * membership. Used by Organization Space pages (leadership/portfolio
 * view): the CEO can see every project the org runs, not only ones they
 * personally joined.
 */
export async function getOrgProjects(
  orgId: string,
  opts?: { statuses?: ProjectRow['status'][]; limit?: number }
): Promise<ProjectWithStats[]> {
  let q = supabase
    .from('projects')
    .select(
      'id, name, description, org_id, lead_id, status, color, budget, due_date, created_at'
    )
    .eq('org_id', orgId)
  if (opts?.statuses && opts.statuses.length > 0) {
    q = q.in('status', opts.statuses)
  }
  q = q.order('created_at', { ascending: false })
  if (opts?.limit) q = q.limit(opts.limit)

  const { data: projects, error: pErr } = await q
  if (pErr) {
    console.error('[queries] org projects', pErr)
    return []
  }
  const projectRows = (projects ?? []) as ProjectRow[]
  if (projectRows.length === 0) return []

  const ids = projectRows.map((p) => p.id)
  const [membersRes, tasksRes] = await Promise.all([
    supabase
      .from('project_members')
      .select(
        'project_id, users(id, email, first_name, last_name, nickname, job_title, status)'
      )
      .in('project_id', ids),
    supabase
      .from('tasks')
      .select('project_id, status, due_date')
      .in('project_id', ids),
  ])
  if (membersRes.error)
    console.error('[queries] members for org projects', membersRes.error)
  if (tasksRes.error)
    console.error('[queries] tasks for org projects', tasksRes.error)

  const membersByProject = new Map<string, UserRow[]>()
  for (const row of membersRes.data ?? []) {
    const r = row as unknown as {
      project_id: string
      users: UserRow | UserRow[] | null
    }
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
    { total: number; done: number; nextDueDate: string | null; dueDate: string | null }
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
      dueDate: null,
    }
    c.total += 1
    if (t.status === 'done') c.done += 1
    if (t.due_date && (!c.nextDueDate || t.due_date < c.nextDueDate)) {
      c.nextDueDate = t.due_date
    }
    if (t.due_date && (!c.dueDate || t.due_date > c.dueDate)) {
      c.dueDate = t.due_date
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
      // Prefer the project's explicit due_date; fall back to the latest
      // task due_date for legacy projects without one.
      dueDate: p.due_date ?? counts?.dueDate ?? null,
    }
  })
}

// ─── Project mutations ──────────────────────────────────────────────────────

export type NewProjectInput = {
  name: string
  description?: string
  color?: string
  /**
   * Organization the project belongs to. Optional — if omitted, we look up
   * the current user's org_memberships and use it when there's exactly
   * one. Multiple memberships → caller must pass org_id explicitly.
   */
  org_id?: string
  status?: ProjectRow['status']
  /** Optional project due date (YYYY-MM-DD). */
  due_date?: string | null
  /** Members to add (besides the lead, who is auto-added by trigger as admin). */
  members?: { user_id: string; role: import('./types').ProjectRoleDb }[]
  /** Email-only invites (user not yet registered). */
  emailInvites?: { email: string; role: import('./types').ProjectRoleDb }[]
}

/**
 * Insert a project with the current user as `lead_id` so the
 * `handle_new_project` trigger auto-adds them to project_members.
 *
 * `org_id` is required by the schema. When the caller omits it we auto-
 * resolve from the user's organization memberships (works as long as the
 * user belongs to exactly one org — most common case for now).
 */
export async function createProject(
  input: NewProjectInput
): Promise<{ id: string } | { error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  // Resolve org_id: explicit input → user's single org → error.
  let orgId = input.org_id
  if (!orgId) {
    const { data: orgRows, error: orgErr } = await supabase
      .from('organization_members')
      .select('org_id')
      .eq('user_id', user.id)
    if (orgErr) {
      console.error('[queries] lookup user orgs', orgErr)
      return { error: orgErr.message }
    }
    if (!orgRows || orgRows.length === 0) {
      return { error: 'You do not belong to any organization' }
    }
    if (orgRows.length > 1) {
      return {
        error:
          'You belong to multiple organizations — choose which one to create the project in',
      }
    }
    orgId = (orgRows[0] as { org_id: string }).org_id
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      org_id: orgId,
      lead_id: user.id,
      ...(input.color ? { color: input.color } : {}),
      // status omitted → DB default 'planned' applies
      ...(input.status ? { status: input.status } : {}),
      ...(input.due_date !== undefined ? { due_date: input.due_date } : {}),
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

/**
 * Delete a project plus every row that references it. The schema does not
 * have `ON DELETE CASCADE` on most project FKs, so a plain
 * `delete from projects` fails with a foreign-key violation as soon as the
 * project has a member, task, meeting, doc, or chat session. We clear the
 * children explicitly in dependency order. Mirrors `deleteMeeting`.
 */
export async function deleteProject(
  projectId: string,
): Promise<{ ok: true } | { error: string }> {
  const [tasksRes, meetingsRes, sessionsRes] = await Promise.all([
    supabase.from('tasks').select('id').eq('project_id', projectId),
    supabase.from('meetings').select('id').eq('project_id', projectId),
    supabase.from('chat_sessions').select('id').eq('project_id', projectId),
  ])
  const taskIds = (tasksRes.data ?? []).map((r) => (r as { id: string }).id)
  const meetingIds = (meetingsRes.data ?? []).map((r) => (r as { id: string }).id)
  const sessionIds = (sessionsRes.data ?? []).map((r) => (r as { id: string }).id)

  // chat — `chat_sessions` has ON DELETE CASCADE for messages/members per
  // `deleteChatSession`, so deleting the parent rows is enough.
  if (sessionIds.length > 0) {
    const { error } = await supabase
      .from('chat_sessions')
      .delete()
      .in('id', sessionIds)
    if (error) return { error: error.message }
  }

  // meetings — mirror `deleteMeeting`'s manual child cleanup.
  if (meetingIds.length > 0) {
    for (const table of [
      'meeting_attendees',
      'meeting_agendas',
      'meeting_invites',
      'meeting_minutes',
      'transcript_segments',
      'meeting_decisions',
    ]) {
      const { error: e } = await supabase
        .from(table)
        .delete()
        .in('meeting_id', meetingIds)
      if (e) console.warn(`[deleteProject] ${table}:`, e.message)
    }
    const { error } = await supabase
      .from('meetings')
      .delete()
      .in('id', meetingIds)
    if (error) return { error: error.message }
  }

  // tasks — `task_assignees` references `tasks.id`.
  if (taskIds.length > 0) {
    await supabase.from('task_assignees').delete().in('task_id', taskIds)
    const { error } = await supabase
      .from('tasks')
      .delete()
      .in('id', taskIds)
    if (error) return { error: error.message }
  }

  // remaining direct children of the project row
  for (const table of [
    'knowledge_documents',
    'project_invites',
    'project_members',
  ]) {
    const { error: e } = await supabase
      .from(table)
      .delete()
      .eq('project_id', projectId)
    if (e) console.warn(`[deleteProject] ${table}:`, e.message)
  }

  // Use `.select('id')` so an RLS-filtered delete (caller is not the lead /
  // admin) is surfaced as 0 returned rows instead of looking like success.
  const { data, error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)
    .select('id')
  if (error) return { error: error.message }
  if (!data || data.length === 0) {
    return {
      error:
        "Couldn't delete the project — you may not have permission. Only the project lead can delete this project.",
    }
  }
  return { ok: true }
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

/**
 * Invite a user to a project by email. Two-step: look up the email in
 * `public.users` (via the SECURITY DEFINER RPC so RLS doesn't hide the row),
 * and if a registered user exists, add them to `project_members` directly.
 * Otherwise create a pending row in `project_invites` so the join happens
 * once they sign up.
 */
export async function inviteToProject(input: {
  project_id: string
  email: string
  role: import('./types').ProjectRoleDb
}): Promise<
  | { ok: true; mode: 'added' | 'invited' }
  | { error: 'already_member' | string }
> {
  const email = input.email.trim().toLowerCase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  const { data: userId, error: lookupErr } = await supabase.rpc(
    'lookup_user_id_by_email',
    { p_email: email }
  )
  if (lookupErr) return { error: lookupErr.message }

  if (userId) {
    const { error } = await supabase.from('project_members').insert({
      project_id: input.project_id,
      user_id: userId,
      role: input.role,
    })
    if (error) {
      if (error.code === '23505') return { error: 'already_member' }
      return { error: error.message }
    }
    return { ok: true, mode: 'added' }
  }

  const { error } = await supabase.from('project_invites').insert({
    project_id: input.project_id,
    email,
    role: input.role,
    invited_by: user.id,
  })
  if (error) return { error: error.message }
  return { ok: true, mode: 'invited' }
}

// ─── Project mutations ──────────────────────────────────────────────────────

export type ProjectPatch = Partial<{
  name: string
  description: string | null
  color: string
  status: import('./types').ProjectStatusDb
  lead_id: string | null
  due_date: string | null
}>

export async function updateProject(
  projectId: string,
  patch: ProjectPatch
): Promise<{ ok: true } | { error: string }> {
  // Use .select() so RLS-filtered updates surface as 0 returned rows. Without
  // this, Supabase reports success even when the policy silently dropped the
  // write, so the user sees "saved" but nothing actually changed.
  const { data, error } = await supabase
    .from('projects')
    .update(patch)
    .eq('id', projectId)
    .select('id')
  if (error) {
    console.error('[queries] updateProject', error)
    return { error: error.message }
  }
  if (!data || data.length === 0) {
    return {
      error:
        "Couldn't save changes — you may not have permission. Only the project lead or an admin can edit project details.",
    }
  }
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

/**
 * Delete a task. Cleans up `task_assignees` first (no cascade in schema),
 * then nulls out `parent_task_id` on any children so they survive the
 * delete, then deletes the task row. Uses `.select()` on the final step so
 * an RLS-filtered delete (caller is not a project admin) surfaces as 0
 * returned rows.
 */
export async function deleteTask(
  taskId: string,
): Promise<{ ok: true } | { error: string }> {
  await supabase.from('task_assignees').delete().eq('task_id', taskId)
  await supabase
    .from('tasks')
    .update({ parent_task_id: null })
    .eq('parent_task_id', taskId)

  const { data, error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)
    .select('id')
  if (error) return { error: error.message }
  if (!data || data.length === 0) {
    return {
      error:
        "Couldn't delete the task — you may not have permission. Only the project lead or an admin can delete tasks.",
    }
  }
  return { ok: true }
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

/**
 * Delete a meeting plus its dependent rows. We clear children explicitly
 * because we don't rely on `ON DELETE CASCADE` being set for every FK in
 * this schema — tasks that originated from this meeting keep existing,
 * we just null out their `source_meeting_id` so the tasks live on.
 */
export async function deleteMeeting(
  meetingId: string,
): Promise<{ ok: true } | { error: string }> {
  // Null out the task back-reference so tasks survive the meeting delete.
  await supabase
    .from('tasks')
    .update({ source_meeting_id: null })
    .eq('source_meeting_id', meetingId)

  for (const table of [
    'meeting_attendees',
    'meeting_agendas',
    'meeting_invites',
    'meeting_minutes',
    'transcript_segments',
    'meeting_decisions',
  ]) {
    const { error: e } = await supabase
      .from(table)
      .delete()
      .eq('meeting_id', meetingId)
    if (e) console.warn(`[deleteMeeting] ${table}:`, e.message)
  }

  const { error } = await supabase
    .from('meetings')
    .delete()
    .eq('id', meetingId)
  if (error) return { error: error.message }
  return { ok: true }
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
    .select('users(id, email, first_name, last_name, nickname, job_title, status)')
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

export type OrgMemberWithRole = UserRow & { role: import('./types').OrgRoleDb }

/** Org members with their `organization_members.role` joined in. */
export async function getOrgMembersWithRoles(
  orgId: string
): Promise<OrgMemberWithRole[]> {
  const { data, error } = await supabase
    .from('organization_members')
    .select('role, users(id, email, first_name, last_name, nickname, job_title, status)')
    .eq('org_id', orgId)
  if (error) {
    console.error('[queries] getOrgMembersWithRoles', error)
    return []
  }
  const out: OrgMemberWithRole[] = []
  for (const row of data ?? []) {
    const r = row as unknown as {
      role: import('./types').OrgRoleDb
      users: UserRow | UserRow[] | null
    }
    if (!r.users) continue
    const users = Array.isArray(r.users) ? r.users : [r.users]
    for (const u of users) out.push({ ...u, role: r.role })
  }
  return out
}

/** Add an already-registered user to an organization by email. The caller
 *  must hold admin/owner permission (RLS enforces). Returns `not_found` if
 *  no `public.users` row exists for the address, `already_member` if the
 *  user is already in the org. */
export async function inviteToOrganization(input: {
  org_id: string
  email: string
  role: import('./types').OrgRoleDb
}): Promise<
  | { ok: true }
  | { error: 'not_found' | 'already_member' | string }
> {
  const email = input.email.trim().toLowerCase()
  // `public.users` RLS only exposes the caller themselves and users in the
  // same org, so a direct `from('users').select(...)` returns null for an
  // external invitee even when the row exists. Look up via a SECURITY
  // DEFINER RPC that returns just the id on exact-email match — this
  // unblocks invite without opening up the user directory.
  const { data: userId, error: userErr } = await supabase.rpc(
    'lookup_user_id_by_email',
    { p_email: email }
  )
  if (userErr) return { error: userErr.message }
  if (!userId) return { error: 'not_found' }
  const { error: insertErr } = await supabase.from('organization_members').insert({
    org_id: input.org_id,
    user_id: userId,
    role: input.role,
  })
  if (insertErr) {
    if (insertErr.code === '23505') return { error: 'already_member' }
    return { error: insertErr.message }
  }
  return { ok: true }
}

export type MyOrgWithStats = {
  id: string
  name: string
  /** Member count across the org. */
  memberCount: number
  /** Total projects in the org. */
  projectCount: number
  /** Projects in this org where the current user is a member. */
  myProjectCount: number
}

/** Orgs the current user belongs to, with member/project totals. Used by
 *  the My Space profile page. */
export async function getMyOrgsWithStats(
  userId: string
): Promise<MyOrgWithStats[]> {
  const { data: memberships, error } = await supabase
    .from('organization_members')
    .select('org_id, organizations(id, name)')
    .eq('user_id', userId)
  if (error) {
    console.error('[queries] getMyOrgsWithStats memberships', error)
    return []
  }
  const orgs: { id: string; name: string }[] = []
  for (const row of memberships ?? []) {
    const o = (row as unknown as { organizations: { id: string; name: string } | null })
      .organizations
    if (o) orgs.push(o)
  }
  if (orgs.length === 0) return []

  const orgIds = orgs.map((o) => o.id)
  const [memberCounts, projectsResult, myProjects] = await Promise.all([
    supabase
      .from('organization_members')
      .select('org_id', { count: 'exact' })
      .in('org_id', orgIds),
    supabase
      .from('projects')
      .select('id, org_id')
      .in('org_id', orgIds),
    supabase
      .from('project_members')
      .select('project_id, projects(org_id)')
      .eq('user_id', userId),
  ])

  const memberCountByOrg = new Map<string, number>()
  for (const row of memberCounts.data ?? []) {
    const oid = (row as { org_id: string }).org_id
    memberCountByOrg.set(oid, (memberCountByOrg.get(oid) ?? 0) + 1)
  }

  const projectCountByOrg = new Map<string, number>()
  for (const row of projectsResult.data ?? []) {
    const oid = (row as { org_id: string }).org_id
    projectCountByOrg.set(oid, (projectCountByOrg.get(oid) ?? 0) + 1)
  }

  const myProjectCountByOrg = new Map<string, number>()
  for (const row of myProjects.data ?? []) {
    const oid = (row as unknown as { projects: { org_id: string } | null }).projects?.org_id
    if (!oid) continue
    myProjectCountByOrg.set(oid, (myProjectCountByOrg.get(oid) ?? 0) + 1)
  }

  return orgs.map((o) => ({
    id: o.id,
    name: o.name,
    memberCount: memberCountByOrg.get(o.id) ?? 0,
    projectCount: projectCountByOrg.get(o.id) ?? 0,
    myProjectCount: myProjectCountByOrg.get(o.id) ?? 0,
  }))
}

export type UserProfilePatch = {
  first_name?: string
  last_name?: string
  nickname?: string | null
  job_title?: string | null
}

/** Update the current user's profile fields. Email is auth-managed and
 *  cannot be changed here. */
export async function updateCurrentUser(
  patch: UserProfilePatch
): Promise<{ ok: true } | { error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const { error } = await supabase
    .from('users')
    .update(patch)
    .eq('id', user.id)
  if (error) return { error: error.message }
  return { ok: true }
}

export async function getProjectMembers(projectId: string): Promise<UserRow[]> {
  const { data, error } = await supabase
    .from('project_members')
    .select('users(id, email, first_name, last_name, nickname, job_title, status)')
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
  project_color: string | null
  /** org_id of the parent project. null when the task has no project (personal task). */
  project_org_id: string | null
  source_meeting_name: string | null
  source_meeting_scheduled_at: string | null
  creator_name: string | null
}

/**
 * Tasks assigned to the user, excluding done by default, ordered by
 * upcoming due date.
 */
export async function getUserActionItems(
  userId: string,
  opts?: {
    includeDone?: boolean
    limit?: number
    /** Restrict to the active org. Tasks with no project (personal tasks)
     *  always pass through — they aren't tied to any org. */
    orgId?: string | null
  }
): Promise<TaskWithProject[]> {
  // "My tasks" = tasks assigned to me OR created by me. The created-by half
  // matters because CreateTaskModal doesn't auto-assign the creator, so a
  // task you just made would otherwise never show in your personal lists.
  const [assignRes, createdRes] = await Promise.all([
    supabase.from('task_assignees').select('task_id').eq('user_id', userId),
    supabase.from('tasks').select('id').eq('created_by', userId),
  ])
  if (assignRes.error) {
    console.error('[queries] task_assignees', assignRes.error)
    return []
  }
  if (createdRes.error) {
    console.error('[queries] tasks created_by', createdRes.error)
  }
  const idSet = new Set<string>()
  for (const a of assignRes.data ?? []) idSet.add(a.task_id as string)
  for (const t of createdRes.data ?? []) idSet.add(t.id as string)
  const taskIds = [...idSet]
  if (taskIds.length === 0) return []

  // Org filter must run at the DB level — otherwise applying it in JS after
  // .limit(N) silently drops most rows when the cross-org top-N happen to
  // belong to other orgs (e.g., dashboard's limit:7 comes back as 0-2 items
  // for a user with many tasks in another org).
  // Allow `project_id IS NULL` (personal tasks) to pass through always.
  let orgProjectIds: string[] | null = null
  if (opts?.orgId) {
    const { data: orgProjects } = await supabase
      .from('projects')
      .select('id')
      .eq('org_id', opts.orgId)
    orgProjectIds = (orgProjects ?? []).map((p) => p.id as string)
  }
  console.log('[getUserActionItems] probe', {
    userId,
    orgId: opts?.orgId,
    assignedTaskIds: taskIds.length,
    orgProjectIdsVisible: orgProjectIds?.length ?? null,
  })

  let q = supabase
    .from('tasks')
    .select(
      'id, project_id, parent_task_id, title, description, status, priority, start_date, due_date, kanban_column_id, source_meeting_id, created_by, created_at, updated_at, projects(name, color, org_id), meetings:source_meeting_id(name, scheduled_at), users:created_by(first_name, last_name, nickname, email)'
    )
    .in('id', taskIds)
    // Newest first so a just-created task surfaces at the top of the
    // personal Tasks / Dashboard lists (the dashboard renders in this order
    // directly; the Tasks page defaults to a matching client sort).
    .order('created_at', { ascending: false })

  if (!opts?.includeDone) q = q.neq('status', 'done')
  if (orgProjectIds) {
    // PostgREST `.or` with a parenthesised in-list. Empty IN list would
    // produce an invalid filter, so when the org has no projects we just
    // restrict to personal tasks.
    if (orgProjectIds.length === 0) {
      q = q.is('project_id', null)
    } else {
      q = q.or(
        `project_id.is.null,project_id.in.(${orgProjectIds.join(',')})`,
      )
    }
  }
  if (opts?.limit) q = q.limit(opts.limit)

  const { data, error } = await q
  if (error) {
    console.error('[queries] tasks for user', error)
    return []
  }
  return (data ?? []).map((row) => {
    const r = row as unknown as TaskRow & {
      projects: { name: string; color: string | null; org_id: string } | { name: string; color: string | null; org_id: string }[] | null
      meetings: { name: string; scheduled_at: string } | { name: string; scheduled_at: string }[] | null
      users: { first_name: string; last_name: string; nickname: string | null; email: string } | { first_name: string; last_name: string; nickname: string | null; email: string }[] | null
    }
    const proj = Array.isArray(r.projects) ? r.projects[0] : r.projects
    const mtg = Array.isArray(r.meetings) ? r.meetings[0] : r.meetings
    const usr = Array.isArray(r.users) ? r.users[0] : r.users
    const creatorName = usr
      ? usr.nickname || `${usr.first_name} ${usr.last_name}`.trim() || usr.email
      : null
    return {
      ...(r as TaskRow),
      project_name: proj?.name ?? null,
      project_color: proj?.color ?? null,
      project_org_id: proj?.org_id ?? null,
      source_meeting_name: mtg?.name ?? null,
      source_meeting_scheduled_at: mtg?.scheduled_at ?? null,
      creator_name: creatorName,
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
  opts?: { from?: Date; to?: Date; limit?: number; orgId?: string | null }
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

  // Org filter: if orgId is given, restrict to meetings whose project is in
  // that org. Two-step (look up project_ids in the org first, then filter
  // meetings on that set) keeps the query simple and works without joins.
  let orgProjectIds: string[] | null = null
  if (opts?.orgId) {
    const { data: orgProjects } = await supabase
      .from('projects')
      .select('id')
      .eq('org_id', opts.orgId)
    orgProjectIds = (orgProjects ?? []).map((p) => p.id as string)
    if (orgProjectIds.length === 0) return []
  }

  const from = opts?.from ?? new Date()
  let q = supabase
    .from('meetings')
    .select('id, project_id, name, scheduled_at, duration_min, location_or_url, status')
    .in('id', meetingIds)
    .gte('scheduled_at', from.toISOString())
    .order('scheduled_at', { ascending: true })
  if (orgProjectIds) q = q.in('project_id', orgProjectIds)
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
    .select('meeting_id, users(id, email, first_name, last_name, nickname, job_title, status)')
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

// ─── Project (single) ───────────────────────────────────────────────────────

export async function getProject(projectId: string): Promise<ProjectRow | null> {
  // maybeSingle so a missing row is just `null` (not the "0 rows" error
  // that triggers TanStack Query retry storms when an URL points at a
  // deleted / RLS-hidden project).
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, description, org_id, lead_id, status, color, budget, due_date, created_at')
    .eq('id', projectId)
    .maybeSingle()
  if (error) {
    console.error('[queries] getProject', error)
    return null
  }
  return data as ProjectRow | null
}

/** Counts shown in the StackedSideMenu nav for a single project. */
export async function getProjectCounts(projectId: string): Promise<{
  tasks: number
  meetings: number
  members: number
  docs: number
}> {
  const [tasks, meetings, members, docs] = await Promise.all([
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
    supabase
      .from('meetings')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId),
    supabase
      .from('project_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('project_id', projectId),
    supabase
      .from('knowledge_documents')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId),
  ])
  return {
    tasks: tasks.count ?? 0,
    meetings: meetings.count ?? 0,
    members: members.count ?? 0,
    docs: docs.count ?? 0,
  }
}

export type ProjectTask = TaskRow & {
  assignees: UserRow[]
}

/** All tasks (top-level only) in the project, with assignees. */
export async function getProjectTasks(projectId: string): Promise<ProjectTask[]> {
  const { data: rows, error } = await supabase
    .from('tasks')
    .select(
      'id, project_id, parent_task_id, title, description, status, priority, start_date, due_date, kanban_column_id, created_by, created_at, updated_at'
    )
    .eq('project_id', projectId)
    .is('parent_task_id', null)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[queries] getProjectTasks', error)
    return []
  }
  const tasks = (rows ?? []) as TaskRow[]
  if (tasks.length === 0) return []

  const taskIds = tasks.map((t) => t.id)
  // task_assignees has TWO FKs to users (user_id, assigned_by) — use the
  // `users:user_id` alias so PostgREST follows the correct relationship.
  const { data: assignRows, error: aErr } = await supabase
    .from('task_assignees')
    .select(
      'task_id, users:user_id(id, email, first_name, last_name, nickname, job_title, status)'
    )
    .in('task_id', taskIds)
  if (aErr) console.error('[queries] task assignees', aErr)

  const byTask = new Map<string, UserRow[]>()
  for (const row of assignRows ?? []) {
    const r = row as unknown as { task_id: string; users: UserRow | UserRow[] | null }
    if (!r.users) continue
    const us = Array.isArray(r.users) ? r.users : [r.users]
    const arr = byTask.get(r.task_id) ?? []
    arr.push(...us)
    byTask.set(r.task_id, arr)
  }
  return tasks.map((t) => ({ ...t, assignees: byTask.get(t.id) ?? [] }))
}

export type ProjectMember = UserRow & {
  role: import('./types').ProjectRoleDb
}

export async function getProjectMembersWithRoles(
  projectId: string
): Promise<ProjectMember[]> {
  // NOTE: project_members has no joined_at / created_at column. Don't select
  // one here without first adding a migration.
  const { data, error } = await supabase
    .from('project_members')
    .select('role, users(id, email, first_name, last_name, nickname, job_title, status)')
    .eq('project_id', projectId)
  if (error) {
    console.error('[queries] getProjectMembersWithRoles', error)
    return []
  }
  const out: ProjectMember[] = []
  for (const row of data ?? []) {
    const r = row as unknown as {
      role: import('./types').ProjectRoleDb
      users: UserRow | UserRow[] | null
    }
    if (!r.users) continue
    const us = Array.isArray(r.users) ? r.users : [r.users]
    for (const u of us) out.push({ ...u, role: r.role })
  }
  return out
}

export type ProjectMeeting = MeetingRow & {
  attendees: UserRow[]
  action_count: number
  /** AI-generated summary from `meeting_minutes.summary`, if processed. */
  summary: string | null
}

/** Meetings for a project, with attendee list and AI-extracted action item count. */
export async function getProjectMeetings(projectId: string): Promise<ProjectMeeting[]> {
  const { data: meetingRows, error } = await supabase
    .from('meetings')
    .select(
      'id, project_id, name, scheduled_at, duration_min, location_or_url, status, meeting_type, recurrence, recurrence_until, recurrence_group_id'
    )
    .eq('project_id', projectId)
    .order('scheduled_at', { ascending: false })
  if (error) {
    console.error('[queries] getProjectMeetings', error)
    return []
  }
  const meetings = (meetingRows ?? []) as MeetingRow[]
  if (meetings.length === 0) return []

  const ids = meetings.map((m) => m.id)
  const [attRes, actionRes, minRes] = await Promise.all([
    supabase
      .from('meeting_attendees')
      .select('meeting_id, users(id, email, first_name, last_name, nickname, job_title, status)')
      .in('meeting_id', ids),
    supabase.from('tasks').select('source_meeting_id').in('source_meeting_id', ids),
    supabase.from('meeting_minutes').select('meeting_id, summary').in('meeting_id', ids),
  ])
  if (attRes.error) console.error('[queries] meeting attendees', attRes.error)
  if (actionRes.error) console.error('[queries] meeting actions', actionRes.error)
  if (minRes.error) console.error('[queries] meeting minutes', minRes.error)

  const byMeeting = new Map<string, UserRow[]>()
  for (const row of attRes.data ?? []) {
    const r = row as unknown as {
      meeting_id: string
      users: UserRow | UserRow[] | null
    }
    if (!r.users) continue
    const us = Array.isArray(r.users) ? r.users : [r.users]
    const arr = byMeeting.get(r.meeting_id) ?? []
    arr.push(...us)
    byMeeting.set(r.meeting_id, arr)
  }
  const actionCounts = new Map<string, number>()
  for (const row of actionRes.data ?? []) {
    const r = row as { source_meeting_id: string | null }
    if (!r.source_meeting_id) continue
    actionCounts.set(r.source_meeting_id, (actionCounts.get(r.source_meeting_id) ?? 0) + 1)
  }
  const summaryByMeeting = new Map<string, string>()
  for (const row of minRes.data ?? []) {
    const r = row as { meeting_id: string; summary: string | null }
    if (r.summary) summaryByMeeting.set(r.meeting_id, r.summary)
  }
  return meetings.map((m) => ({
    ...m,
    attendees: byMeeting.get(m.id) ?? [],
    action_count: actionCounts.get(m.id) ?? 0,
    summary: summaryByMeeting.get(m.id) ?? null,
  }))
}

export type ProjectDoc = {
  id: string
  project_id: string
  name: string
  file_url: string | null
  file_type: string | null
  source: 'uploaded' | 'meeting' | 'auto_generated'
  uploaded_by: string | null
  uploaded_at: string
  uploader: UserRow | null
}

export async function getProjectDocs(projectId: string): Promise<ProjectDoc[]> {
  const { data, error } = await supabase
    .from('knowledge_documents')
    .select(
      'id, project_id, name, file_url, file_type, source, uploaded_by, uploaded_at, users:uploaded_by(id, email, first_name, last_name, nickname, job_title, status)'
    )
    .eq('project_id', projectId)
    .order('uploaded_at', { ascending: false })
  if (error) {
    console.error('[queries] getProjectDocs', error)
    return []
  }
  return (data ?? []).map((row) => {
    const r = row as ProjectDoc & {
      users: UserRow | UserRow[] | null
    }
    const u = Array.isArray(r.users) ? r.users[0] : r.users
    return {
      id: r.id,
      project_id: r.project_id,
      name: r.name,
      file_url: r.file_url,
      file_type: r.file_type,
      source: r.source,
      uploaded_by: r.uploaded_by,
      uploaded_at: r.uploaded_at,
      uploader: u ?? null,
    }
  })
}

export type NewDocInput = {
  project_id: string
  name: string
  source?: ProjectDoc['source']
  file_url?: string | null
  file_type?: string | null
}

export async function deleteKnowledgeDoc(
  docId: string
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase
    .from('knowledge_documents')
    .delete()
    .eq('id', docId)
  if (error) {
    console.error('[queries] deleteKnowledgeDoc', error)
    return { error: error.message }
  }
  return { ok: true }
}

export async function createKnowledgeDoc(
  input: NewDocInput
): Promise<{ id: string } | { error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  const { data, error } = await supabase
    .from('knowledge_documents')
    .insert({
      project_id: input.project_id,
      name: input.name.trim(),
      source: input.source ?? 'uploaded',
      file_url: input.file_url ?? null,
      file_type: input.file_type ?? null,
      uploaded_by: user.id,
    })
    .select('id')
    .single()
  if (error) {
    console.error('[queries] createKnowledgeDoc', error)
    return { error: error.message }
  }
  return { id: (data as { id: string }).id }
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
  to: Date,
  opts?: { orgId?: string | null }
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
        'tasks!inner(id, project_id, parent_task_id, title, description, status, priority, start_date, due_date, kanban_column_id, created_by, created_at, updated_at)'
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

  // Org scope: keep only rows whose project belongs to the active org. Tasks
  // with no project (personal tasks) always pass through.
  if (opts?.orgId) {
    const projectIds = new Set<string>()
    for (const m of meetings) if (m.project_id) projectIds.add(m.project_id)
    for (const t of tasksWithDue) if (t.project_id) projectIds.add(t.project_id)
    if (projectIds.size > 0) {
      const { data: orgProjects } = await supabase
        .from('projects')
        .select('id')
        .eq('org_id', opts.orgId)
        .in('id', Array.from(projectIds))
      const inOrg = new Set((orgProjects ?? []).map((p) => p.id as string))
      const filteredMeetings = meetings.filter(
        (m) => m.project_id && inOrg.has(m.project_id),
      )
      const filteredTasks = tasksWithDue.filter(
        (t) => !t.project_id || inOrg.has(t.project_id),
      )
      return { meetings: filteredMeetings, tasksWithDue: filteredTasks }
    }
    // No projects to check; tasks-with-no-project still pass through.
    return { meetings: [], tasksWithDue: tasksWithDue.filter((t) => !t.project_id) }
  }

  return { meetings, tasksWithDue }
}

// ─── Notifications ──────────────────────────────────────────────────────────

export type NotificationType =
  | 'chat_message'
  | 'task_assigned'
  | 'task_due_soon'
  | 'meeting_starting'
  | 'mention'
  | 'agent_proposal'

export type NotificationRow = {
  id: string
  user_id: string
  type: NotificationType
  source_id: string
  source_session_id: string | null
  preview_title: string | null
  preview_body: string | null
  preview_meta: Record<string, unknown> | null
  read_at: string | null
  dismissed_at: string | null
  created_at: string
}

/** Inbox for the current user. Returns undismissed rows newest-first.
 *  RLS already restricts to user_id = auth.uid() — no extra .eq() needed. */
export async function getNotifications(opts?: {
  limit?: number
}): Promise<NotificationRow[]> {
  let q = supabase
    .from('notifications')
    .select(
      'id, user_id, type, source_id, source_session_id, preview_title, preview_body, preview_meta, read_at, dismissed_at, created_at'
    )
    .is('dismissed_at', null)
    .order('created_at', { ascending: false })
  if (opts?.limit) q = q.limit(opts.limit)
  const { data, error } = await q
  if (error) {
    console.error('[queries] getNotifications', error)
    return []
  }
  return (data ?? []) as NotificationRow[]
}

export async function dismissNotification(
  id: string
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase
    .from('notifications')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }
  return { ok: true }
}

/** Soft-delete every undismissed notification for the current user. */
export async function dismissAllNotifications(): Promise<
  { ok: true } | { error: string }
> {
  const { error } = await supabase
    .from('notifications')
    .update({ dismissed_at: new Date().toISOString() })
    .is('dismissed_at', null)
  if (error) return { error: error.message }
  return { ok: true }
}

/** Dismiss every notification tied to a particular chat session — used when
 *  the user opens that session and "consumes" the unread bubble all at once. */
export async function dismissNotificationsForSession(
  sessionId: string
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase
    .from('notifications')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('source_session_id', sessionId)
    .is('dismissed_at', null)
  if (error) return { error: error.message }
  return { ok: true }
}

// ─── Chat ────────────────────────────────────────────────────────────────────

export type ChatSessionWithMeta = ChatSessionRow & {
  /** Channels: project name (when scope=project). */
  project_name: string | null
  /** DMs: the OTHER participant (not the current user). */
  other_user: UserRow | null
  /** Number of unread messages for the current user. */
  unread_count: number
  /** Last message body for preview. */
  last_message_body: string | null
  /** Last message timestamp for sort + preview. */
  last_message_at: string | null
}

/**
 * All chat sessions the current user is a member of, in the given org.
 * Returns enriched rows with project name, other-user (for DMs), unread count,
 * and last message preview.
 */
export async function getChatSessions(
  userId: string,
  orgId: string
): Promise<ChatSessionWithMeta[]> {
  // 1) Sessions the user is a member of.
  const { data: memberRows, error: mErr } = await supabase
    .from('chat_session_members')
    .select('session_id, last_read_at')
    .eq('user_id', userId)
  if (mErr) {
    console.error('[queries] chat_session_members', mErr)
    return []
  }
  const ids = (memberRows ?? []).map((r) => r.session_id as string)
  if (ids.length === 0) return []

  const lastReadByMembership = new Map<string, string | null>()
  for (const r of memberRows ?? []) {
    lastReadByMembership.set(
      r.session_id as string,
      (r as { last_read_at: string | null }).last_read_at ?? null
    )
  }

  const { data: sessionRows, error: sErr } = await supabase
    .from('chat_sessions')
    .select(
      'id, org_id, kind, scope, privacy, name, description, project_id, dm_user_a, dm_user_b, created_by, created_at, projects(name)'
    )
    .eq('org_id', orgId)
    .in('id', ids)
  if (sErr) {
    console.error('[queries] chat_sessions', sErr)
    return []
  }
  const sessions = (sessionRows ?? []) as (ChatSessionRow & {
    projects: { name: string } | { name: string }[] | null
  })[]
  if (sessions.length === 0) return []

  // 2) For DMs, fetch the OTHER user record.
  const otherUserIds = new Set<string>()
  for (const s of sessions) {
    if (s.kind === 'dm') {
      const other = s.dm_user_a === userId ? s.dm_user_b : s.dm_user_a
      if (other) otherUserIds.add(other)
    }
  }
  let usersById = new Map<string, UserRow>()
  if (otherUserIds.size > 0) {
    const { data: users, error: uErr } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, nickname, job_title, status')
      .in('id', Array.from(otherUserIds))
    if (uErr) console.error('[queries] dm other users', uErr)
    usersById = new Map((users ?? []).map((u) => [u.id as string, u as UserRow]))
  }

  // 3) Latest message + unread count per session.
  // Fetch author_id too so we can exclude the current user's own messages
  // from the unread count (you don't get notified about your own posts).
  const sessionIds = sessions.map((s) => s.id)
  const { data: msgs, error: msgErr } = await supabase
    .from('chat_messages')
    .select('session_id, author_id, body, created_at')
    .in('session_id', sessionIds)
    .order('created_at', { ascending: false })
  if (msgErr) console.error('[queries] chat_messages preview', msgErr)
  const lastBySession = new Map<string, { body: string; at: string }>()
  const unreadBySession = new Map<string, number>()
  for (const row of (msgs ?? []) as {
    session_id: string
    author_id: string
    body: string
    created_at: string
  }[]) {
    if (!lastBySession.has(row.session_id)) {
      lastBySession.set(row.session_id, { body: row.body, at: row.created_at })
    }
    if (row.author_id === userId) continue // own message → not unread
    const lastRead = lastReadByMembership.get(row.session_id) ?? null
    if (!lastRead || row.created_at > lastRead) {
      unreadBySession.set(
        row.session_id,
        (unreadBySession.get(row.session_id) ?? 0) + 1
      )
    }
  }

  return sessions
    .map<ChatSessionWithMeta>((s) => {
      const proj = Array.isArray(s.projects) ? s.projects[0] : s.projects
      const other =
        s.kind === 'dm'
          ? usersById.get(
              (s.dm_user_a === userId ? s.dm_user_b : s.dm_user_a) as string
            ) ?? null
          : null
      const last = lastBySession.get(s.id)
      return {
        id: s.id,
        org_id: s.org_id,
        kind: s.kind,
        scope: s.scope,
        privacy: s.privacy,
        name: s.name,
        description: s.description,
        project_id: s.project_id,
        dm_user_a: s.dm_user_a,
        dm_user_b: s.dm_user_b,
        created_by: s.created_by,
        created_at: s.created_at,
        project_name: proj?.name ?? null,
        other_user: other,
        unread_count: unreadBySession.get(s.id) ?? 0,
        last_message_body: last?.body ?? null,
        last_message_at: last?.at ?? null,
      }
    })
    .sort((a, b) => {
      const at = a.last_message_at ?? a.created_at
      const bt = b.last_message_at ?? b.created_at
      return bt.localeCompare(at)
    })
}

export type ChatMessageWithAuthor = ChatMessageRow & {
  author: UserRow
}

export type ChatSearchHit = {
  /** session_id this message belongs to */
  session_id: string
  /** chat_messages.id */
  message_id: string
  body: string
  created_at: string
  /** Snippet around the first match — pre-trimmed for the UI. */
  snippet: string
}

/** Search messages across all chat sessions in an org that the current user
 *  can read. RLS on chat_messages restricts visibility to sessions the user is
 *  a member of, so the org_id scope just narrows the join. */
export async function searchChatMessages(
  orgId: string,
  query: string,
  opts?: { limit?: number }
): Promise<ChatSearchHit[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const limit = opts?.limit ?? 30
  // ilike on body, joined with chat_sessions for the org filter. RLS does the
  // membership scoping; we just constrain to the active org.
  const { data, error } = await supabase
    .from('chat_messages')
    .select(
      'id, session_id, body, created_at, chat_sessions!inner(org_id)'
    )
    .ilike('body', `%${q}%`)
    .eq('chat_sessions.org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('[queries] searchChatMessages', error)
    return []
  }
  return (data ?? []).map((row) => {
    const r = row as unknown as {
      id: string
      session_id: string
      body: string
      created_at: string
    }
    const lower = r.body.toLowerCase()
    const at = lower.indexOf(q.toLowerCase())
    const radius = 40
    const from = Math.max(0, at - radius)
    const to = Math.min(r.body.length, at + q.length + radius)
    const snippet =
      (from > 0 ? '…' : '') + r.body.slice(from, to) + (to < r.body.length ? '…' : '')
    return {
      session_id: r.session_id,
      message_id: r.id,
      body: r.body,
      created_at: r.created_at,
      snippet,
    }
  })
}

export async function getChatMessages(
  sessionId: string,
  opts?: { limit?: number; before?: string }
): Promise<ChatMessageWithAuthor[]> {
  let q = supabase
    .from('chat_messages')
    .select(
      'id, session_id, author_id, body, reply_to_id, pinned_at, pinned_by, edited_at, created_at, users:author_id(id, email, first_name, last_name, nickname, job_title, status)'
    )
    .eq('session_id', sessionId)
    .is('reply_to_id', null) // top-level only; threads loaded separately
    .order('created_at', { ascending: true })
  if (opts?.before) q = q.lt('created_at', opts.before)
  if (opts?.limit) q = q.limit(opts.limit)

  const { data, error } = await q
  if (error) {
    console.error('[queries] getChatMessages', error)
    return []
  }
  return (data ?? []).map((row) => {
    const r = row as unknown as ChatMessageRow & {
      users: UserRow | UserRow[] | null
    }
    const u = Array.isArray(r.users) ? r.users[0] : r.users
    return {
      ...(r as ChatMessageRow),
      author: u as UserRow,
    }
  })
}

// ─── Chat mutations ─────────────────────────────────────────────────────────

export type NewChatSessionInput = {
  org_id: string
  name: string
  description?: string
  privacy?: ChatSessionPrivacy
  /** When provided, scope='project' and project members auto-sync as members. */
  project_id?: string | null
  /** Otherwise scope='member_group' and these users become members. */
  member_user_ids?: string[]
}

export async function createChatSession(
  input: NewChatSessionInput
): Promise<{ id: string } | { error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  const isProject = !!input.project_id
  const scope = isProject ? 'project' : 'member_group'

  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({
      org_id: input.org_id,
      kind: 'channel',
      scope,
      privacy: input.privacy ?? 'public',
      name: input.name.trim(),
      description: input.description?.trim() || null,
      project_id: input.project_id ?? null,
      created_by: user.id,
    })
    .select('id')
    .single()
  if (error) {
    console.error('[queries] createChatSession', error)
    return { error: error.message }
  }
  const sessionId = (data as { id: string }).id

  // Resolve membership: project members for project scope, explicit list otherwise.
  let memberIds: string[] = []
  if (isProject) {
    const { data: pm } = await supabase
      .from('project_members')
      .select('user_id')
      .eq('project_id', input.project_id!)
    memberIds = (pm ?? []).map((r) => r.user_id as string)
  } else {
    memberIds = input.member_user_ids ?? []
  }
  if (!memberIds.includes(user.id)) memberIds.push(user.id)

  const rows = memberIds.map((uid) => ({ session_id: sessionId, user_id: uid }))
  if (rows.length > 0) {
    const { error: mErr } = await supabase.from('chat_session_members').insert(rows)
    if (mErr) console.error('[queries] add chat session members', mErr)
  }
  return { id: sessionId }
}

/**
 * Delete a chat session. RLS policy enforces creator-only access on the DB
 * side; this just issues the DELETE. Related rows (messages, members) are
 * removed via FK ON DELETE CASCADE.
 */
export async function deleteChatSession(
  sessionId: string
): Promise<{ ok: true } | { error: string }> {
  const { error } = await supabase.from('chat_sessions').delete().eq('id', sessionId)
  if (error) {
    console.error('[queries] deleteChatSession', error)
    return { error: error.message }
  }
  return { ok: true }
}

/**
 * Open (or create) a 1-1 DM session between the current user and `otherUserId`
 * in the given org. Returns the session id.
 */
export async function getOrCreateDm(
  orgId: string,
  otherUserId: string
): Promise<{ id: string } | { error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  if (user.id === otherUserId) return { error: 'Cannot DM yourself' }

  const [a, b] = user.id < otherUserId ? [user.id, otherUserId] : [otherUserId, user.id]

  const { data: existing } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('org_id', orgId)
    .eq('kind', 'dm')
    .eq('dm_user_a', a)
    .eq('dm_user_b', b)
    .maybeSingle()
  if (existing) return { id: (existing as { id: string }).id }

  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({
      org_id: orgId,
      kind: 'dm',
      scope: 'dm',
      privacy: 'private',
      dm_user_a: a,
      dm_user_b: b,
      created_by: user.id,
    })
    .select('id')
    .single()
  if (error) return { error: error.message }
  const sessionId = (data as { id: string }).id

  await supabase.from('chat_session_members').insert([
    { session_id: sessionId, user_id: a },
    { session_id: sessionId, user_id: b },
  ])
  return { id: sessionId }
}

/** Members of a chat session (channel or DM). */
export async function getChatSessionMembers(
  sessionId: string
): Promise<UserRow[]> {
  const { data, error } = await supabase
    .from('chat_session_members')
    .select('users(id, email, first_name, last_name, nickname, job_title, status)')
    .eq('session_id', sessionId)
  if (error) {
    console.error('[queries] getChatSessionMembers', error)
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

export async function sendChatMessage(input: {
  session_id: string
  body: string
  reply_to_id?: string | null
}): Promise<{ id: string } | { error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }
  const trimmed = input.body.trim()
  if (!trimmed) return { error: 'Message body is required' }

  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      session_id: input.session_id,
      author_id: user.id,
      body: trimmed,
      reply_to_id: input.reply_to_id ?? null,
    })
    .select('id')
    .single()
  if (error) return { error: error.message }
  return { id: (data as { id: string }).id }
}

export async function markChatSessionRead(sessionId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  await supabase
    .from('chat_session_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('session_id', sessionId)
    .eq('user_id', user.id)
}
