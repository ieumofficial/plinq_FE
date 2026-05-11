import { useEffect, useMemo, useState } from 'react'
import Input from './ui/Input'
import Button from './ui/Button'
import Icon from './ui/Icon'
import { useQueryClient } from '@tanstack/react-query'
import { createTask } from '../lib/queries'
import { useCurrentUser, useProjectMembers, useUserProjects } from '../lib/hooks'
import { queryKeys } from '../lib/queryKeys'
import type { TaskStatusDb, UserRow } from '../lib/types'

type Props = {
  open: boolean
  /** Optional pre-selected project id. */
  defaultProjectId?: string | null
  /** When true, project picker is locked to defaultProjectId (cannot be changed). */
  lockProject?: boolean
  onClose: () => void
  onCreated?: (id: string) => void
}

type Priority = 'highest' | 'high' | 'medium' | 'low' | 'lowest'

const STATUSES: { key: TaskStatusDb; label: string; activeBg: string; activeText: string }[] = [
  { key: 'planned', label: 'Planned', activeBg: 'bg-[#E6ECEF]', activeText: 'text-black' },
  { key: 'in_progress', label: 'In progress', activeBg: 'bg-blue-light', activeText: 'text-blue-main' },
  { key: 'review', label: 'Review', activeBg: 'bg-brown-light', activeText: 'text-brown-med' },
  { key: 'blocked', label: 'Blocked', activeBg: 'bg-red-light', activeText: 'text-red-main' },
  { key: 'done', label: 'Done', activeBg: 'bg-[#DCEBE0]', activeText: 'text-green-main' },
]

const PRIORITIES: {
  key: Priority
  label: string
  iconName: 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest'
  activeBg: string
  activeText: string
}[] = [
  { key: 'highest', label: 'Highest', iconName: 'Highest', activeBg: 'bg-red-light', activeText: 'text-red-main' },
  { key: 'high', label: 'High', iconName: 'High', activeBg: 'bg-brown-light', activeText: 'text-brown-med' },
  { key: 'medium', label: 'Medium', iconName: 'Medium', activeBg: 'bg-brown-light', activeText: 'text-brown-med' },
  { key: 'low', label: 'Low', iconName: 'Low', activeBg: 'bg-blue-light', activeText: 'text-blue-main' },
  { key: 'lowest', label: 'Lowest', iconName: 'Lowest', activeBg: 'bg-gray-extra-light', activeText: 'text-gray-main' },
]

const PROJECT_COLOR_BY_DB_KEY: Record<string, { bg: string; fg: string }> = {
  blue: { bg: 'bg-blue-light', fg: 'text-blue-main' },
  green: { bg: 'bg-[#DCEBE0]', fg: 'text-green-main' },
  amber: { bg: 'bg-brown-light', fg: 'text-brown-med' },
  red: { bg: 'bg-red-light', fg: 'text-red-main' },
  purple: { bg: 'bg-purple-light', fg: 'text-purple-main' },
  turquoise: { bg: 'bg-turquoise-light', fg: 'text-turquoise-main' },
}
function projectColor(key: string | null | undefined) {
  return PROJECT_COLOR_BY_DB_KEY[key ?? 'blue'] ?? PROJECT_COLOR_BY_DB_KEY.blue
}

// UI 5단계 → DB 4단계
function uiPriorityToDb(p: Priority): 'low' | 'medium' | 'high' | 'urgent' {
  if (p === 'highest') return 'urgent'
  if (p === 'high') return 'high'
  if (p === 'medium') return 'medium'
  return 'low' // low + lowest 둘 다
}

function memberLabel(u: UserRow) {
  return u.nickname || `${u.first_name} ${u.last_name}`.trim() || u.email
}

function formatDateLabel(iso: string) {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function dayDiffFromToday(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.round((d.getTime() - today.getTime()) / 86400000)
  if (days === 0) return 'Today'
  if (days > 0) return `+${days}d`
  return `${days}d`
}

export default function CreateTaskModal({
  open,
  defaultProjectId,
  lockProject = false,
  onClose,
  onCreated,
}: Props) {
  const { data: me } = useCurrentUser()
  const { data: projects = [] } = useUserProjects(me?.id)
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useState<string | null>(defaultProjectId ?? null)
  const [projectPickerOpen, setProjectPickerOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [assigneeId, setAssigneeId] = useState<string | null>(null)
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false)
  const [status, setStatus] = useState<TaskStatusDb>('planned')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')

  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Reset on open
  useEffect(() => {
    if (!open) return
    setTitle('')
    setProjectId(defaultProjectId ?? null)
    setDescription('')
    setAssigneeId(null)
    setStatus('planned')
    setDueDate('')
    setPriority('medium')
    setError('')
    setSubmitting(false)
  }, [open, defaultProjectId])

  // Default project = first one when opening
  useEffect(() => {
    if (open && !projectId && projects.length > 0) setProjectId(projects[0].id)
  }, [open, projectId, projects])

  const { data: members = [] } = useProjectMembers(projectId)

  // Esc / Cmd+Enter
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        void submit()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, title, projectId, description, assigneeId, status, dueDate, priority])

  const project = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId]
  )

  const submit = async () => {
    if (!title.trim()) {
      setError('Task name is required.')
      return
    }
    if (!projectId) {
      setError('Project is required.')
      return
    }
    if (!dueDate) {
      setError('Due date is required.')
      return
    }
    setError('')
    setSubmitting(true)
    const result = await createTask({
      title,
      description: description || undefined,
      project_id: projectId,
      status,
      priority: uiPriorityToDb(priority),
      due_date: dueDate,
      assigneeIds: assigneeId ? [assigneeId] : [],
    })
    setSubmitting(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
    queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all })
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
    onCreated?.(result.id)
    onClose()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white-white rounded-[10px] shadow-2xl w-[717px] max-w-[95vw] max-h-[92vh] overflow-y-auto overflow-x-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-[20px] pt-[20px] pb-[20px] border-b border-gray-border-light">
          <p className="text-blue-main text-[10px] font-semibold uppercase tracking-[1.5px]">
            New Task
            {project ? ` · ${project.name}` : ''}
          </p>
          <h2 className="text-black text-[20px] font-semibold mt-2">
            {title.trim() || 'Untitled task'}
          </h2>
          <p className="text-gray-main text-[12px] mt-1">
            Tip: Press ⌘ ↵ to create. Press / for AI assist.
          </p>
        </div>

        {/* Body */}
        <div className="px-[20px] py-[20px] flex flex-col gap-[15px]">
          <Input
            label="TASK NAME *"
            placeholder="Cutover runbook v2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            className="!max-w-none"
          />

          <div className="flex flex-col gap-1 relative">
            <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
              Project *
            </label>
            <button
              type="button"
              onClick={() => !lockProject && setProjectPickerOpen((v) => !v)}
              disabled={lockProject}
              className={`bg-white-white border border-gray-border rounded-lg px-3 py-2 text-left flex items-center gap-2 h-[39px] ${
                lockProject ? 'cursor-not-allowed opacity-90' : 'hover:border-primary-main'
              }`}
            >
              {project ? (
                <>
                  {(() => {
                    const c = projectColor(project.color)
                    return (
                      <span
                        className={`w-[20px] h-[20px] rounded-[3px] inline-flex items-center justify-center text-[11px] font-bold uppercase shrink-0 ${c.bg} ${c.fg}`}
                        style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
                      >
                        {project.name.charAt(0)}
                      </span>
                    )
                  })()}
                  <span className="text-[13px] text-black font-semibold">{project.name}</span>
                  <span className="text-[12px] text-gray-secondary">· Org name</span>
                  {!lockProject && (
                    <span className="ml-auto text-gray-secondary">
                      <Icon name="ArrowRight" size={12} />
                    </span>
                  )}
                </>
              ) : (
                <span className="text-gray-secondary text-[12px]">— select project —</span>
              )}
            </button>
            {projectPickerOpen && !lockProject && (
              <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white-white border border-gray-border rounded-lg shadow-lg z-10 max-h-[200px] overflow-y-auto">
                {projects.length === 0 ? (
                  <p className="px-3 py-2 text-gray-secondary text-[11px]">No projects yet</p>
                ) : (
                  projects.map((p) => {
                    const c = projectColor(p.color)
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setProjectId(p.id)
                          setProjectPickerOpen(false)
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-white-item text-left ${
                          projectId === p.id ? 'bg-blue-light/30' : ''
                        }`}
                      >
                        <span
                          className={`w-[20px] h-[20px] rounded-[3px] inline-flex items-center justify-center text-[11px] font-bold uppercase shrink-0 ${c.bg} ${c.fg}`}
                          style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
                        >
                          {p.name.charAt(0)}
                        </span>
                        <span className="text-[12px] text-black">{p.name}</span>
                      </button>
                    )
                  })
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-baseline gap-2">
              <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                Description
              </label>
              <span className="text-gray-secondary text-[10px]">markdown supported</span>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="bg-white-white border border-gray-border rounded-lg px-4 py-3 text-[12px] text-black outline-none focus:border-primary-main resize-none"
              placeholder="What needs to be done?"
            />
            <div className="flex items-center gap-2 mt-1">
              <Button size="mini" variant="secondary" disabled>
                Attach files
              </Button>
              <Button size="mini" variant="secondary" disabled>
                Link doc
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-[283.5px_1fr] gap-[15px]">
            <div className="flex flex-col gap-1 relative">
              <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                Assignee
              </label>
              <button
                type="button"
                onClick={() => setAssigneePickerOpen((v) => !v)}
                className="bg-white-white border border-gray-border rounded-lg px-3 py-1.5 text-left flex items-center gap-2 h-[39px] hover:border-primary-main"
                disabled={!projectId}
              >
                {(() => {
                  const a = members.find((m) => m.id === assigneeId)
                  if (!a) {
                    return (
                      <>
                        <span className="w-[25px] h-[25px] rounded-full bg-gray-extra-light inline-flex items-center justify-center text-gray-secondary shrink-0">
                          <Icon name="People" size={12} />
                        </span>
                        <span className="text-[12px] text-gray-secondary">— unassigned —</span>
                        <span className="ml-auto text-gray-secondary">
                          <Icon name="ArrowRight" size={12} />
                        </span>
                      </>
                    )
                  }
                  return (
                    <>
                      <span className="w-[25px] h-[25px] rounded-full bg-gray-extra-light inline-flex items-center justify-center text-[10px] font-semibold text-gray-main shrink-0">
                        {memberLabel(a).charAt(0).toUpperCase()}
                      </span>
                      <span className="text-[12px] text-black truncate">{memberLabel(a)}</span>
                      <span className="ml-auto text-gray-secondary">
                        <Icon name="ArrowRight" size={12} />
                      </span>
                    </>
                  )
                })()}
              </button>
              {assigneePickerOpen && (
                <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white-white border border-gray-border rounded-lg shadow-lg z-10 max-h-[200px] overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setAssigneeId(null)
                      setAssigneePickerOpen(false)
                    }}
                    className="w-full px-3 py-2 hover:bg-white-item text-left text-[12px] text-gray-main"
                  >
                    — Unassigned —
                  </button>
                  {members.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setAssigneeId(m.id)
                        setAssigneePickerOpen(false)
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-white-item text-left ${
                        assigneeId === m.id ? 'bg-blue-light/30' : ''
                      }`}
                    >
                      <span className="w-[25px] h-[25px] rounded-full bg-gray-extra-light inline-flex items-center justify-center text-[10px] font-semibold text-gray-main shrink-0">
                        {memberLabel(m).charAt(0).toUpperCase()}
                      </span>
                      <span className="text-[12px] text-black truncate">{memberLabel(m)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                Status *
              </label>
              <div className="flex items-center gap-[6px] h-[39px]">
                {STATUSES.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setStatus(s.key)}
                    className={`text-[12px] font-semibold uppercase tracking-[1px] whitespace-nowrap rounded-[2px] transition-colors ${
                      status === s.key
                        ? `${s.activeBg} ${s.activeText} px-[7px] py-[3px]`
                        : 'text-gray-secondary hover:text-black px-[2px]'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-[283.5px_1fr] gap-[15px]">
            <div className="flex flex-col gap-1">
              <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                Due Date *
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-white-white border border-gray-border rounded-lg px-3 py-2 pr-14 text-[12px] text-black outline-none focus:border-primary-main h-[39px]"
                />
                {dueDate && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-secondary text-[11px]">
                    {dayDiffFromToday(dueDate)}
                  </span>
                )}
              </div>
              {dueDate && (
                <p className="text-gray-secondary text-[10px]">{formatDateLabel(dueDate)}</p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                Priority *
              </label>
              <div className="flex items-center gap-[4px] h-[39px]">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPriority(p.key)}
                    className={`text-[12px] font-semibold uppercase tracking-[0.5px] rounded-[2px] transition-colors whitespace-nowrap inline-flex items-center gap-[3px] ${
                      priority === p.key
                        ? `${p.activeBg} ${p.activeText} px-[6px] py-[3px]`
                        : 'text-gray-secondary hover:text-black px-[2px]'
                    }`}
                  >
                    <Icon name={p.iconName} size={11} />
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && <p className="text-red-main text-[12px]">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-[20px] py-[15px] border-t border-gray-border-light flex items-center justify-between">
          <p className="text-gray-secondary text-[11px]">⌘ ↵ to create</p>
          <div className="flex items-center gap-3">
            <Button variant="subtle" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={submitting || !title.trim() || !projectId || !dueDate}
            >
              {submitting ? 'Creating…' : 'Create Task'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
