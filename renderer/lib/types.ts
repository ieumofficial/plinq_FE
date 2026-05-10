/**
 * DB row types and the mapper helpers that turn them into props for the
 * UI components in `components/ui`.
 *
 * Keep this file as the single boundary between Supabase shape (snake_case,
 * enums) and component shape (camelCase, kebab-case unions).
 */

import type { Priority } from '../components/ui/PriorityTag'
import type { Status } from '../components/ui/StatusLabelBig'
import type { Member } from '../components/ui/UserGroup'

// ─── DB enums (mirror of Postgres enums) ─────────────────────────────────────

export type TaskStatusDb = 'todo' | 'in_progress' | 'review' | 'blocked' | 'done'
export type TaskPriorityDb = 'low' | 'medium' | 'high' | 'urgent'
export type ProjectStatusDb = 'planning' | 'active' | 'on_hold' | 'done'

// ─── Row shapes ──────────────────────────────────────────────────────────────

export type UserRow = {
  id: string
  email: string
  first_name: string
  last_name: string
  nickname: string | null
  job_title: string | null
}

export type ProjectRow = {
  id: string
  name: string
  description: string | null
  team_id: string | null
  lead_id: string | null
  status: ProjectStatusDb
  category: string | null
  budget: number | null
  created_at: string
}

export type TaskRow = {
  id: string
  project_id: string | null
  team_id: string | null
  parent_task_id: string | null
  title: string
  description: string | null
  status: TaskStatusDb
  priority: TaskPriorityDb
  start_date: string | null
  due_date: string | null
  kanban_column_id: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export type MeetingRow = {
  id: string
  project_id: string
  name: string
  scheduled_at: string
  duration_min: number
  location_or_url: string | null
  status: 'planned' | 'recording' | 'processed'
}

// ─── Mappers: DB → component props ──────────────────────────────────────────

export function dbStatusToUi(s: TaskStatusDb): Status {
  switch (s) {
    case 'todo':
      return 'planned'
    case 'in_progress':
      return 'in-progress'
    case 'review':
      return 'review'
    case 'blocked':
      return 'blocked'
    case 'done':
      return 'done'
  }
}

export function dbPriorityToUi(p: TaskPriorityDb): Priority {
  switch (p) {
    case 'urgent':
      return 'highest'
    case 'high':
      return 'high'
    case 'medium':
      return 'medium'
    case 'low':
      return 'low'
  }
}

export function userToMember(u: Pick<UserRow, 'first_name' | 'last_name' | 'nickname'>): Member {
  const name = u.nickname || `${u.first_name} ${u.last_name}`.trim() || 'User'
  return { name }
}

/** Format a YYYY-MM-DD or ISO date as the short label used on cards: "Apr 22". */
export function formatShortDate(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** "Today" / "Tomorrow" / "Apr 22" relative formatter for due dates. */
export function formatDueDate(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return undefined
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * "9:00 — 9:30 AM" formatter for meeting time ranges.
 */
export function formatTimeRange(scheduledAt: string, durationMin: number): string {
  const start = new Date(scheduledAt)
  const end = new Date(start.getTime() + durationMin * 60 * 1000)
  const fmt = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const startStr = fmt(start).replace(/\s?(AM|PM)$/i, '')
  return `${startStr} — ${fmt(end)}`
}
