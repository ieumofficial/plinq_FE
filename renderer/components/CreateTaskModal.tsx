import { useEffect, useMemo, useRef, useState } from 'react'
import Input from './ui/Input'
import Button from './ui/Button'
import Icon from './ui/Icon'
import ProjectLabel from './ui/ProjectLabel'
import UserGroup from './ui/UserGroup'
import DatePicker from './ui/DatePicker'
import { aiStream } from '../lib/aiClient'
import { markAiBusy } from '../lib/aiActivity'
import { useQueryClient } from '@tanstack/react-query'
import { createTask } from '../lib/queries'
import { useActiveOrg, useCurrentUser, useProjectMembers, useUserProjects } from '../lib/hooks'
import { queryKeys } from '../lib/queryKeys'
import { userToMember, type TaskStatusDb, type UserRow } from '../lib/types'

type Props = {
  open: boolean
  /** Optional pre-selected project id. */
  defaultProjectId?: string | null
  /** When true, project picker is locked to defaultProjectId (cannot be changed). */
  lockProject?: boolean
  /** Optional pre-selected status. Defaults to 'planned'. Still editable. */
  defaultStatus?: TaskStatusDb
  onClose: () => void
  onCreated?: (id: string) => void
}

type Priority = 'highest' | 'high' | 'medium' | 'low' | 'lowest'

const STATUSES: { key: TaskStatusDb; label: string; activeBg: string; activeText: string }[] = [
  { key: 'planned', label: 'Planned', activeBg: 'bg-[#E6ECEF]', activeText: 'text-primary-main' },
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
  { key: 'high', label: 'High', iconName: 'High', activeBg: 'bg-red-light', activeText: 'text-red-main' },
  { key: 'medium', label: 'Medium', iconName: 'Medium', activeBg: 'bg-brown-light', activeText: 'text-brown-med' },
  { key: 'low', label: 'Low', iconName: 'Low', activeBg: 'bg-blue-light', activeText: 'text-blue-main' },
  { key: 'lowest', label: 'Lowest', iconName: 'Lowest', activeBg: 'bg-blue-light', activeText: 'text-blue-main' },
]

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

// ─── AI Suggestion side panel ───────────────────────────────────────────────
//
// Matches Figma 1455:35204. Visually a dark-gradient card with stacked
// suggestion items. Each item shows a label + Accept button; the body of the
// item describes the suggestion (text, members, priority chip, date).

type AiPanelProps = {
  title: string
  busy: boolean
  error: string | null
  suggestion: {
    description: string
    assignees: string[]
    priority: Priority
    dueDate: string
  }
  accepted: {
    description: boolean
    assignees: boolean
    priority: boolean
    dueDate: boolean
  }
  members: UserRow[]
  onAcceptDescription: () => void
  onAcceptAssignees: () => void
  onAcceptPriority: () => void
  onAcceptDueDate: () => void
  onAcceptAll: () => void
  onRetry: () => void
}

function AiAcceptChip({
  onClick,
  disabled,
  accepted,
}: {
  onClick: () => void
  disabled?: boolean
  accepted?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={accepted ? 'Click to undo' : 'Apply this suggestion'}
      className={`shrink-0 inline-flex items-center gap-[3px] px-[5px] py-[3px] rounded-[5px] border border-solid text-[8px] font-semibold ${
        accepted
          ? 'border-[#9fcfa9] bg-[#9fcfa9] text-primary-dark hover:opacity-90'
          : disabled
            ? 'border-[#9fcfa9] text-[#9fcfa9] opacity-40 cursor-not-allowed'
            : 'border-[#9fcfa9] text-[#9fcfa9] hover:bg-[#9fcfa9]/10'
      }`}
    >
      {accepted ? (
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path
            d="M3 3L9 9M9 3L3 9"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path
            d="M2 6.5L4.8 9L10 3.5"
            stroke="#9fcfa9"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {accepted ? 'Undo' : 'Accept'}
    </button>
  )
}

function AiItemHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-[5px]">
      <span className="w-[18px] h-[18px] rounded-[4px] bg-white/15 inline-flex items-center justify-center text-white">
        <Icon name="Sparkle" size={10} />
      </span>
      <p className="text-white text-[10px] font-semibold">{label}</p>
    </div>
  )
}

function aiMemberDisplayName(m: UserRow): string {
  return m.nickname || `${m.first_name} ${m.last_name}`.trim() || m.email
}

function AiSuggestionPanel({
  title,
  busy,
  error,
  suggestion,
  accepted,
  members,
  onAcceptDescription,
  onAcceptAssignees,
  onAcceptPriority,
  onAcceptDueDate,
  onAcceptAll,
  onRetry,
}: AiPanelProps) {
  const selectedMembers = members.filter((m) => suggestion.assignees.includes(m.id))
  const priorityMeta = PRIORITIES.find((p) => p.key === suggestion.priority)
  const dueLabel = suggestion.dueDate
    ? new Date(suggestion.dueDate + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '—'

  return (
    <aside
      style={{
        backgroundImage:
          'linear-gradient(142.24deg, rgb(46, 67, 78) 0%, rgb(31, 47, 56) 100%)',
      }}
      className="absolute top-0 left-full ml-[15px] w-[210px] rounded-[10px] p-[15px] flex flex-col gap-[12px] shadow-2xl max-h-[92vh] overflow-y-auto"
    >
      {/* Header */}
      <div className="flex items-center gap-[5px]">
        <span className="w-[22px] h-[22px] rounded-[5px] bg-white/15 inline-flex items-center justify-center text-white">
          <Icon
            name="Sparkle"
            size={12}
            className={busy ? 'ai-sparkle-anim' : undefined}
          />
        </span>
        <p className="text-white text-[12px] font-semibold">AI suggestion</p>
      </div>
      <p className="text-[#b5c2cc] text-[10px] leading-[1.5]">
        {title.trim()
          ? `Based on the title “${title.trim()}” and similar tasks in this project. Accept individually or accept all suggestions.`
          : 'Type a title to get suggestions.'}
      </p>
      {error && (
        <p className="text-[#f2dede] text-[10px] leading-[1.5]">
          AI error: {error}
        </p>
      )}

      {/* Description suggestion */}
      <div className="bg-white/10 rounded-[5px] p-[10px] flex flex-col gap-[5px]">
        <div className="flex items-center justify-between">
          <AiItemHeader label="Description" />
          <AiAcceptChip
            onClick={onAcceptDescription}
            disabled={!suggestion.description && !accepted.description}
            accepted={accepted.description}
          />
        </div>
        <p className="text-[#b5c2cc] text-[10px] leading-[1.5] whitespace-pre-wrap">
          {suggestion.description || (busy ? 'Drafting…' : '—')}
        </p>
      </div>

      {/* Suggested assignees */}
      <div className="bg-white/10 rounded-[5px] p-[10px] flex flex-col gap-[10px]">
        <div className="flex items-center justify-between">
          <AiItemHeader label="Suggested assignees" />
          <AiAcceptChip
            onClick={onAcceptAssignees}
            disabled={selectedMembers.length === 0 && !accepted.assignees}
            accepted={accepted.assignees}
          />
        </div>
        <div className="flex flex-col gap-[5px]">
          {selectedMembers.length === 0 ? (
            <p className="text-[#b5c2cc] text-[10px]">
              No project members to suggest.
            </p>
          ) : (
            selectedMembers.map((m, i) => {
              const badge =
                i === 0 ? '★ best fit' : i === 1 ? 'strong' : 'backup'
              return (
                <div
                  key={m.id}
                  className="bg-white/10 border border-solid border-[#6b7b86] rounded-[4px] px-[10px] py-[7px] flex items-center gap-[5px]"
                >
                  <span className="w-[25px] h-[25px] rounded-full bg-gray-extra-light inline-flex items-center justify-center text-[10px] font-semibold text-gray-main shrink-0">
                    {aiMemberDisplayName(m).charAt(0).toUpperCase()}
                  </span>
                  <div className="flex flex-col gap-[3px] min-w-0 flex-1">
                    <div className="flex items-center gap-[5px]">
                      <p className="text-white text-[10px] font-semibold truncate">
                        {aiMemberDisplayName(m)}
                      </p>
                      <span className="bg-[#a8c8e8]/30 text-[#a8c8e8] text-[6px] font-medium uppercase tracking-[1px] px-[5px] py-[2px] rounded-[10px] shrink-0">
                        {badge}
                      </span>
                    </div>
                    <p className="text-[#b5c2cc] text-[8px]">
                      Project member
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Priority */}
      <div className="bg-white/10 rounded-[5px] p-[10px] flex flex-col gap-[10px]">
        <div className="flex items-center justify-between">
          <AiItemHeader label="Priority" />
          <AiAcceptChip
            onClick={onAcceptPriority}
            accepted={accepted.priority}
          />
        </div>
        {priorityMeta && (
          <span
            className={`inline-flex items-center gap-[5px] px-[5px] py-[2px] rounded-[2px] text-[12px] font-semibold w-fit ${priorityMeta.activeBg} ${priorityMeta.activeText}`}
          >
            <Icon name={priorityMeta.iconName} size={15} />
            {priorityMeta.label}
          </span>
        )}
      </div>

      {/* Due date */}
      <div className="bg-white/10 rounded-[5px] p-[10px] flex flex-col gap-[10px]">
        <div className="flex items-center justify-between">
          <AiItemHeader label="Due date" />
          <AiAcceptChip
            onClick={onAcceptDueDate}
            disabled={!suggestion.dueDate && !accepted.dueDate}
            accepted={accepted.dueDate}
          />
        </div>
        <div className="flex items-center gap-[5px] text-[#b5c2cc]">
          <Icon name="Calendar" size={12} />
          <p className="text-[10px]">{dueLabel}</p>
        </div>
      </div>

      {/* Bottom — Accept All + Retry */}
      <div className="flex items-center gap-[5px]">
        <button
          type="button"
          onClick={onAcceptAll}
          disabled={busy}
          className={`flex-1 inline-flex items-center justify-center bg-white text-[#2e434e] text-[10px] font-semibold rounded-[5px] pl-[10px] pr-[8px] py-[5px] ${
            busy ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90'
          }`}
        >
          Accept All
        </button>
        <button
          type="button"
          onClick={onRetry}
          disabled={busy}
          className={`inline-flex items-center gap-[5px] bg-white/10 text-white text-[10px] rounded-[5px] pl-[10px] pr-[8px] py-[5px] ${
            busy ? 'opacity-60 cursor-not-allowed' : 'hover:bg-white/15'
          }`}
        >
          <Icon name="ArrowRight" size={10} className="rotate-180" />
          Retry
        </button>
      </div>
    </aside>
  )
}

export default function CreateTaskModal({
  open,
  defaultProjectId,
  lockProject = false,
  defaultStatus,
  onClose,
  onCreated,
}: Props) {
  const { data: me } = useCurrentUser()
  const activeOrg = useActiveOrg(me?.id)
  const { data: projects = [] } = useUserProjects(me?.id, {
    orgId: activeOrg?.id ?? null,
  })
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useState<string | null>(defaultProjectId ?? null)
  const [projectPickerOpen, setProjectPickerOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false)
  const [status, setStatus] = useState<TaskStatusDb>(defaultStatus ?? 'planned')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')

  const [datePickerAnchor, setDatePickerAnchor] = useState<DOMRect | null>(null)
  const dateTriggerRef = useRef<HTMLButtonElement>(null)
  /** Trigger rects for the floating pickers — used to position them with
   *  `fixed` so the modal's overflow-y-auto doesn't clip the list. */
  const [projectAnchor, setProjectAnchor] = useState<DOMRect | null>(null)
  const projectTriggerRef = useRef<HTMLButtonElement>(null)
  const [assigneeAnchor, setAssigneeAnchor] = useState<DOMRect | null>(null)
  const assigneeTriggerRef = useRef<HTMLButtonElement>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  /** Whether the AI side panel is currently visible. Toggled by the AI assist
   *  button in the header. Opening it kicks off a stream + heuristics. */
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  /** Cancellation flag for the in-flight AI stream. When `true`, the stream
   *  callback drops any further chunks. Set by toggleAiPanel when the user
   *  clicks "AI off" mid-generation. Reset to `false` whenever a new request
   *  begins. */
  const aiCancelRef = useRef(false)
  /** Suggestions the AI panel is offering. `description` is streamed from
   *  /agent/chat; the others are heuristic-derived from the title and project
   *  context. Each one can be accepted individually or via Accept All. */
  const [aiSuggestion, setAiSuggestion] = useState<{
    description: string
    assignees: string[]
    priority: Priority
    dueDate: string
  }>({ description: '', assignees: [], priority: 'medium', dueDate: '' })
  /** Per-field "currently applied" snapshots. A key being present means the
   *  AI's suggestion is currently filled into the form, and the value is the
   *  pre-acceptance state to restore when the user clicks Accept again. */
  const [acceptedSnapshots, setAcceptedSnapshots] = useState<{
    description?: string
    assignees?: string[]
    priority?: Priority
    dueDate?: string
  }>({})
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Reset on open
  useEffect(() => {
    if (!open) return
    setTitle('')
    setProjectId(defaultProjectId ?? null)
    setDescription('')
    setAssigneeIds([])
    setStatus(defaultStatus ?? 'planned')
    setDueDate('')
    setPriority('medium')
    setError('')
    setSubmitting(false)
    setAiPanelOpen(false)
    setAiError(null)
    setAiSuggestion({
      description: '',
      assignees: [],
      priority: 'medium',
      dueDate: '',
    })
    setAcceptedSnapshots({})
    aiCancelRef.current = false
  }, [open, defaultProjectId, defaultStatus])

  // Default project = first one when opening
  useEffect(() => {
    if (open && !projectId && projects.length > 0) setProjectId(projects[0].id)
  }, [open, projectId, projects])

  const { data: members = [] } = useProjectMembers(projectId)

  // Esc / Cmd+Enter — Esc closes any open dropdown first; only closes the modal
  // when no dropdown is showing.
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (projectPickerOpen) {
          setProjectPickerOpen(false)
          return
        }
        if (assigneePickerOpen) {
          setAssigneePickerOpen(false)
          return
        }
        onClose()
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        void submit()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    title,
    projectId,
    description,
    assigneeIds,
    status,
    dueDate,
    priority,
    projectPickerOpen,
    assigneePickerOpen,
  ])

  const project = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId]
  )

  /** Derive a sensible default priority from the title's wording. Returns
   *  `medium` when nothing obvious matches. */
  const priorityFromTitle = (t: string): Priority => {
    const s = t.toLowerCase()
    if (/\b(urgent|asap|blocker|hotfix|p0|p1|critical)\b/.test(s)) return 'highest'
    if (/\b(bug|important|fix|p2)\b/.test(s)) return 'high'
    if (/\b(nice|optional|cleanup|chore|tidy)\b/.test(s)) return 'low'
    return 'medium'
  }

  /** Call /agent/chat with the current task title and stream a suggested
   *  description into the AI panel. Mirrors AskAi's client (same /agent/chat
   *  endpoint, NDJSON stream of {type, text} events) but is one-shot: we
   *  discard the conversation_id after this call. */
  const runAiAssist = async () => {
    const t = title.trim()
    if (!t || aiBusy) return
    setAiError(null)
    setAiBusy(true)
    markAiBusy(true)
    aiCancelRef.current = false
    // A fresh suggestion run invalidates any previous accepted snapshots —
    // the user's pre-accept values are kept though by NOT touching the form
    // fields. Just clear the snapshot map so Accept buttons re-enable.
    setAcceptedSnapshots({})
    // Pre-fill the heuristic-derived fields immediately so the panel shows
    // something while the description streams in.
    const due = new Date()
    due.setDate(due.getDate() + 14)
    const dueIso = due.toISOString().slice(0, 10)
    const topAssignees = members.slice(0, 3).map((m) => m.id)
    setAiSuggestion({
      description: '',
      assignees: topAssignees,
      priority: priorityFromTitle(t),
      dueDate: dueIso,
    })
    let acc = ''
    try {
      await aiStream(
        '/agent/chat',
        {
          message:
            `I'm creating a project task titled "${t}". ` +
            `Suggest a concise 2-3 sentence description that captures the goal, ` +
            `scope, and a hint at acceptance criteria. Reply with just the ` +
            `description — no preamble, no markdown headers.`,
          conversation_id: null,
          org_id: null,
          project_id: projectId,
          // One-shot scratch call — must NOT create a persisted agent
          // conversation (otherwise every description suggestion pollutes
          // the Ask-AI session list).
          ephemeral: true,
        },
        (evt) => {
          // Cancelled — drop any further events from this stream.
          if (aiCancelRef.current) return
          const k = evt.type
          if (k === 'chunk' && typeof evt.text === 'string') {
            acc += evt.text as string
            setAiSuggestion((prev) => ({ ...prev, description: acc }))
          } else if (k === 'error') {
            const msg =
              typeof evt.message === 'string' ? evt.message : 'AI error'
            setAiError(msg)
          }
        }
      )
    } catch (err) {
      if (!aiCancelRef.current) {
        setAiError(err instanceof Error ? err.message : 'AI request failed')
      }
    } finally {
      // Only flip back to idle if this run wasn't already cancelled — when
      // cancelled, toggleAiPanel already set aiBusy=false.
      if (!aiCancelRef.current) setAiBusy(false)
      markAiBusy(false)
    }
  }

  /** AI assist button — toggles the panel. Opening it kicks off a fresh
   *  suggestion generation (title required). Closing while a stream is in
   *  flight cancels it (no further description chunks land in state). */
  const toggleAiPanel = () => {
    if (aiPanelOpen) {
      if (aiBusy) {
        aiCancelRef.current = true
        setAiBusy(false)
        // The stream's finally-block also decrements, but we want the global
        // signal to drop now since the user explicitly cancelled.
        markAiBusy(false)
      }
      setAiPanelOpen(false)
      return
    }
    if (!title.trim()) return
    setAiPanelOpen(true)
    void runAiAssist()
  }

  /** Toggle helpers — pressing Accept fills the field with the suggestion and
   *  records the prior value in `acceptedSnapshots`. Pressing it again restores
   *  the prior value and clears the snapshot. */
  const acceptDescription = () => {
    setAcceptedSnapshots((snaps) => {
      if (snaps.description !== undefined) {
        // Un-accept: restore previous description.
        setDescription(snaps.description)
        const { description: _drop, ...rest } = snaps
        return rest
      }
      const next = description
        ? description.trimEnd() + '\n\n' + aiSuggestion.description
        : aiSuggestion.description
      setDescription(next)
      return { ...snaps, description }
    })
  }
  const acceptAssignees = () => {
    setAcceptedSnapshots((snaps) => {
      if (snaps.assignees !== undefined) {
        setAssigneeIds(snaps.assignees)
        const { assignees: _drop, ...rest } = snaps
        return rest
      }
      setAssigneeIds(aiSuggestion.assignees)
      return { ...snaps, assignees: assigneeIds }
    })
  }
  const acceptPriority = () => {
    setAcceptedSnapshots((snaps) => {
      if (snaps.priority !== undefined) {
        setPriority(snaps.priority)
        const { priority: _drop, ...rest } = snaps
        return rest
      }
      setPriority(aiSuggestion.priority)
      return { ...snaps, priority }
    })
  }
  const acceptDueDate = () => {
    setAcceptedSnapshots((snaps) => {
      if (snaps.dueDate !== undefined) {
        setDueDate(snaps.dueDate)
        const { dueDate: _drop, ...rest } = snaps
        return rest
      }
      setDueDate(aiSuggestion.dueDate)
      return { ...snaps, dueDate }
    })
  }
  /** Accept All only flips items that aren't already applied — pressing it
   *  twice doesn't re-toggle individual rows the user already accepted. */
  const acceptAll = () => {
    if (aiSuggestion.description && acceptedSnapshots.description === undefined) {
      acceptDescription()
    }
    if (
      aiSuggestion.assignees.length > 0 &&
      acceptedSnapshots.assignees === undefined
    ) {
      acceptAssignees()
    }
    if (acceptedSnapshots.priority === undefined) acceptPriority()
    if (aiSuggestion.dueDate && acceptedSnapshots.dueDate === undefined) {
      acceptDueDate()
    }
  }

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
      assigneeIds,
    })
    setSubmitting(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    // Await invalidations so the lists refetch BEFORE we close the modal —
    // otherwise the user lands on a stale dashboard and has to refresh.
    // Also include the per-project key (`['project', projectId]`) used by
    // ProjectAppShell's tasks/counts hooks, which prefix `['projects']`
    // does NOT match.
    console.log('[CreateTaskModal] invalidating after create', { taskId: result.id })
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all }),
      queryClient.invalidateQueries({ queryKey: ['project'] }),
    ])
    onCreated?.(result.id)
    onClose()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      {/* `relative` wrapper sized to the modal — the AI side panel sits
       *  outside it via absolute positioning so the modal stays centered. */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative"
      >
      <div
        className="bg-white-white rounded-[10px] shadow-2xl w-[717px] max-w-[95vw] max-h-[92vh] overflow-y-auto overflow-x-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-[20px] pt-[20px] pb-[20px] border-b border-gray-border-light flex items-start justify-between gap-[10px]">
          <div className="flex-1 min-w-0 flex flex-col gap-[5px]">
            <p className="text-green-main text-[10px] font-medium uppercase tracking-[1.5px]">
              New Task
              {project ? ` · ${project.name}` : ''}
            </p>
            <h2 className="text-black text-[20px] font-semibold">
              {title.trim() || 'Untitled task'}
            </h2>
            <p className="text-gray-main text-[12px]">
              Tip: Press ⌘ ⏎ to create. Press / for AI assist.
            </p>
          </div>
          {/* AI assist — toggles the side panel. Opening it kicks off a
              suggestion stream; closing it hides the panel (form remains). */}
          <button
            type="button"
            onClick={toggleAiPanel}
            disabled={!title.trim() && !aiPanelOpen}
            title={
              !title.trim()
                ? 'Type a task title first.'
                : aiPanelOpen
                  ? aiBusy
                    ? 'Cancel and hide AI suggestions'
                    : 'Hide AI suggestions'
                  : 'Open AI suggestions'
            }
            className={`shrink-0 rounded-[5px] px-[15px] h-[32px] inline-flex items-center justify-center gap-[5px] text-[12px] transition-opacity ${
              !title.trim() && !aiPanelOpen
                ? 'bg-primary-dark text-white-main opacity-60 cursor-not-allowed'
                : aiPanelOpen
                  ? 'bg-primary-main text-white-main hover:opacity-90'
                  : 'bg-primary-dark text-white-main hover:opacity-90'
            }`}
          >
            <Icon
              name="Sparkle"
              size={13}
              className={aiBusy ? 'ai-sparkle-anim' : undefined}
            />
            <span>{aiPanelOpen ? 'AI off' : 'AI assist'}</span>
          </button>
        </div>

        {/* AI assist thinking banner — Figma 1436:27226. Inset rounded card
         *  spanning the full body width. Sparkle pulses while generating. */}
        {aiPanelOpen && aiBusy && (
          <div className="px-[20px] pt-[15px] pb-0">
            <div
              className="w-full rounded-[8px] px-[15px] py-[12px] flex items-center gap-[8px]"
              style={{
                backgroundImage:
                  'linear-gradient(179.14deg, rgb(46, 67, 78) 0%, rgb(31, 47, 56) 100%)',
              }}
            >
              <span className="w-[22px] h-[22px] rounded-[5px] bg-white/15 inline-flex items-center justify-center text-white shrink-0">
                <Icon name="Sparkle" size={12} className="ai-sparkle-anim" />
              </span>
              <p className="text-white text-[12px] leading-[1.4] flex-1">
                <span className="font-bold">AI assist</span>
                <span> is filling in fields based on the title. Accept or edit each one.</span>
              </p>
            </div>
          </div>
        )}

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

          <div className="flex flex-col gap-1">
            <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
              Project *
            </label>
            <button
              ref={projectTriggerRef}
              type="button"
              onClick={() => {
                if (lockProject) return
                if (projectPickerOpen) {
                  setProjectPickerOpen(false)
                  setProjectAnchor(null)
                } else {
                  setProjectAnchor(
                    projectTriggerRef.current?.getBoundingClientRect() ?? null
                  )
                  setProjectPickerOpen(true)
                }
              }}
              disabled={lockProject}
              className={`bg-white-white border border-gray-border rounded-lg px-3 py-2 text-left flex items-center gap-2 h-[39px] ${
                lockProject ? 'cursor-not-allowed opacity-90' : 'hover:border-primary-main'
              }`}
            >
              {project ? (
                <>
                  <ProjectLabel name={project.name} color={project.color} size="sm" />
                  <span className="text-[13px] text-black font-semibold">{project.name}</span>
                  {activeOrg?.name && (
                    <span className="text-[12px] text-gray-secondary">· {activeOrg.name}</span>
                  )}
                  {!lockProject && (
                    <span className="ml-auto text-gray-secondary">
                      <Icon
                        name="ArrowRight"
                        size={12}
                        className={`transition-transform ${
                          projectPickerOpen ? 'rotate-90' : ''
                        }`}
                      />
                    </span>
                  )}
                </>
              ) : (
                <span className="text-gray-secondary text-[12px]">— select project —</span>
              )}
            </button>
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

          <div className="grid grid-cols-[1fr_355px] gap-[15px]">
            <div className="flex flex-col gap-1">
              <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                Assignees
              </label>
              <button
                ref={assigneeTriggerRef}
                type="button"
                onClick={() => {
                  if (!projectId) return
                  if (assigneePickerOpen) {
                    setAssigneePickerOpen(false)
                    setAssigneeAnchor(null)
                  } else {
                    setAssigneeAnchor(
                      assigneeTriggerRef.current?.getBoundingClientRect() ?? null
                    )
                    setAssigneePickerOpen(true)
                  }
                }}
                className="bg-white-white border border-gray-border rounded-lg px-3 py-1.5 text-left flex items-center gap-2 h-[39px] hover:border-primary-main"
                disabled={!projectId}
              >
                {(() => {
                  const selected = members.filter((m) => assigneeIds.includes(m.id))
                  if (selected.length === 0) {
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
                  const label =
                    selected.length === 1
                      ? memberLabel(selected[0])
                      : `${selected.length} assignees`
                  return (
                    <>
                      <UserGroup
                        members={selected.map(userToMember)}
                        size={22}
                        max={3}
                      />
                      <span className="text-[12px] text-black truncate">{label}</span>
                      <span className="ml-auto text-gray-secondary">
                        <Icon name="ArrowRight" size={12} />
                      </span>
                    </>
                  )
                })()}
              </button>
              {assigneePickerOpen && assigneeAnchor && (
                <div
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'fixed',
                    top: assigneeAnchor.bottom + 4,
                    left: assigneeAnchor.left,
                    width: assigneeAnchor.width,
                    zIndex: 100,
                  }}
                  className="bg-white-white border border-gray-border rounded-lg shadow-lg max-h-[240px] overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => setAssigneeIds([])}
                    disabled={assigneeIds.length === 0}
                    className="w-full px-3 py-2 hover:bg-white-item text-left text-[12px] text-gray-main disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Clear all
                  </button>
                  <div className="h-px bg-gray-border-light" />
                  {members.length === 0 ? (
                    <p className="px-3 py-2 text-gray-secondary text-[11px]">
                      No project members.
                    </p>
                  ) : (
                    members.map((m) => {
                      const checked = assigneeIds.includes(m.id)
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() =>
                            setAssigneeIds((prev) =>
                              prev.includes(m.id)
                                ? prev.filter((x) => x !== m.id)
                                : [...prev, m.id]
                            )
                          }
                          className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-white-item text-left ${
                            checked ? 'bg-blue-light/30' : ''
                          }`}
                        >
                          <span
                            aria-hidden
                            className="w-[15px] h-[15px] rounded-[2px] inline-flex items-center justify-center shrink-0"
                            style={{
                              backgroundColor: checked ? '#2D5A9E' : '#EEF1F4',
                            }}
                          >
                            {checked && (
                              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                                <path
                                  d="M2 6.5L4.8 9L10 3.5"
                                  stroke="#FFFFFF"
                                  strokeWidth="1.6"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </span>
                          <span className="w-[25px] h-[25px] rounded-full bg-gray-extra-light inline-flex items-center justify-center text-[10px] font-semibold text-gray-main shrink-0">
                            {memberLabel(m).charAt(0).toUpperCase()}
                          </span>
                          <span className="text-[12px] text-black truncate">{memberLabel(m)}</span>
                        </button>
                      )
                    })
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                Status *
              </label>
              <div className="bg-white-item flex items-start gap-[5px] p-[5px] rounded-[5px] h-[39px]">
                {STATUSES.map((s) => {
                  const selected = status === s.key
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setStatus(s.key)}
                      className={`flex items-center justify-center px-[10px] py-[5px] rounded-[5px] text-[12px] font-semibold whitespace-nowrap transition-colors ${
                        selected
                          ? `${s.activeBg} ${s.activeText}`
                          : 'bg-white-item text-black hover:bg-white-white'
                      }`}
                    >
                      {s.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_436px] gap-[15px]">
            <div className="flex flex-col gap-1">
              <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                Due Date *
              </label>
              <button
                ref={dateTriggerRef}
                type="button"
                onClick={() => {
                  if (datePickerAnchor) {
                    setDatePickerAnchor(null)
                  } else {
                    setDatePickerAnchor(
                      dateTriggerRef.current?.getBoundingClientRect() ?? null
                    )
                  }
                }}
                className="bg-white-white border border-gray-border rounded-lg pl-3 pr-3 py-2 h-[39px] flex items-center gap-[8px] text-left hover:border-primary-main"
              >
                <Icon name="Calendar" size={13} className="text-gray-secondary shrink-0" />
                <span
                  className={`flex-1 text-[12px] ${
                    dueDate ? 'text-black font-semibold' : 'text-gray-secondary'
                  }`}
                >
                  {dueDate
                    ? new Date(dueDate + 'T00:00:00').toLocaleDateString(
                        'en-US',
                        { month: 'long', day: 'numeric', year: 'numeric' }
                      )
                    : 'Pick a date'}
                </span>
                {dueDate && (
                  <span
                    className="text-gray-main text-[10px] tracking-[1px] shrink-0"
                    style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
                  >
                    {dayDiffFromToday(dueDate)}
                  </span>
                )}
              </button>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                Priority *
              </label>
              <div className="bg-white-item flex items-start gap-[5px] p-[5px] rounded-[5px] h-[39px]">
                {PRIORITIES.map((p) => {
                  const selected = priority === p.key
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setPriority(p.key)}
                      className={`flex items-center justify-center gap-[10px] px-[10px] py-[5px] rounded-[5px] text-[12px] font-semibold whitespace-nowrap transition-colors ${
                        selected
                          ? `${p.activeBg} ${p.activeText}`
                          : 'bg-white-item text-black hover:bg-white-white'
                      }`}
                    >
                      <Icon name={p.iconName} size={15} />
                      {p.label}
                    </button>
                  )
                })}
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

      {/* AI Suggestion side panel — matches Figma 1455:35204. Visible when
       *  the user has toggled AI assist on. Each suggestion can be applied
       *  individually or together via Accept All. */}
      {aiPanelOpen && (
        <AiSuggestionPanel
          title={title}
          busy={aiBusy}
          error={aiError}
          suggestion={aiSuggestion}
          accepted={{
            description: acceptedSnapshots.description !== undefined,
            assignees: acceptedSnapshots.assignees !== undefined,
            priority: acceptedSnapshots.priority !== undefined,
            dueDate: acceptedSnapshots.dueDate !== undefined,
          }}
          members={members}
          onAcceptDescription={acceptDescription}
          onAcceptAssignees={acceptAssignees}
          onAcceptPriority={acceptPriority}
          onAcceptDueDate={acceptDueDate}
          onAcceptAll={acceptAll}
          onRetry={runAiAssist}
        />
      )}
      </div>

      {/* Date picker floats above the modal so it isn't clipped by overflow */}
      <DatePicker
        anchorRect={datePickerAnchor}
        value={dueDate || null}
        onChange={(next) => setDueDate(next ?? '')}
        onClose={() => setDatePickerAnchor(null)}
      />

      {/* Project picker — rendered as a sibling of the modal so its list
       *  escapes the modal's overflow-y-auto clipping. */}
      {projectPickerOpen && !lockProject && projectAnchor && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: projectAnchor.bottom + 4,
            left: projectAnchor.left,
            width: projectAnchor.width,
            zIndex: 100,
          }}
          className="bg-white-white border border-gray-border rounded-lg shadow-lg max-h-[200px] overflow-y-auto"
        >
          {projects.length === 0 ? (
            <p className="px-3 py-2 text-gray-secondary text-[11px]">
              No projects yet
            </p>
          ) : (
            projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setProjectId(p.id)
                  setProjectPickerOpen(false)
                  setProjectAnchor(null)
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-white-item text-left ${
                  projectId === p.id ? 'bg-blue-light/30' : ''
                }`}
              >
                <ProjectLabel name={p.name} color={p.color} size="sm" />
                <span className="text-[12px] text-black">{p.name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
