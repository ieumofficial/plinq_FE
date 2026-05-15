import { useEffect, useRef, useState } from 'react'
import Icon from './ui/Icon'
import PriorityTag from './ui/PriorityTag'
import DatePicker from './ui/DatePicker'
import { supabase } from '../lib/supabase'
import {
  useProjectMembers,
  useProjectTasks,
  useSetTaskAssignee,
  useTaskAssignees,
  useUpdateTask,
} from '../lib/hooks'
import { taskTicketId } from '../lib/ticket'
import {
  dbPriorityToUi,
  type TaskPriorityDb,
  type TaskStatusDb,
  type UserRow,
  type TaskRow,
} from '../lib/types'

const PRIORITY_KEYS_BASE: TaskPriorityDb[] = ['urgent', 'high', 'medium', 'low']
// 'lowest' is only offered once the task_priority enum has the value (see the
// runtime probe in TaskDetailModal) — selecting it otherwise would 22P02.
const PRIORITY_KEYS_WITH_LOWEST: TaskPriorityDb[] = [
  ...PRIORITY_KEYS_BASE,
  'lowest',
]

function memberName(u: UserRow): string {
  return u.nickname || `${u.first_name} ${u.last_name}`.trim() || u.email
}

/** Minimum shape this modal needs — accepts both ProjectTask and
 *  TaskWithProject from the Personal action items page (which doesn't pre-load
 *  assignees). */
export type TaskDetailInput = TaskRow & { assignees?: UserRow[] }

type Props = {
  open: boolean
  task: TaskDetailInput | null
  projectName: string
  /** Ticket id like "APO-243". */
  ticketId: string
  /** Optional source meeting metadata — shown as a pill under the title. */
  sourceMeeting?: { name: string; date: string } | null
  onClose: () => void
}

const STATUS_LABEL: Record<TaskStatusDb, string> = {
  planned: 'Planned',
  in_progress: 'In progress',
  review: 'Review',
  blocked: 'Blocked',
  done: 'Done',
}

const STATUS_DOT: Record<TaskStatusDb, string> = {
  planned: '#94A0AA',
  in_progress: '#2D5A9E',
  review: '#B68A48',
  blocked: '#9B3838',
  done: '#2F6B45',
}

const STATUS_BG: Record<TaskStatusDb, string> = {
  planned: '#E6ECEF',
  in_progress: '#DDE7F4',
  review: '#F4E6CD',
  blocked: '#F2DEDE',
  done: '#DCEBE0',
}

const STATUS_TEXT: Record<TaskStatusDb, string> = {
  planned: '#455E6A',
  in_progress: '#2D5A9E',
  review: '#8A5A1E',
  blocked: '#9B3838',
  done: '#2F6B45',
}

const STATUS_KEYS: TaskStatusDb[] = [
  'planned',
  'in_progress',
  'review',
  'blocked',
  'done',
]

function formatTimestamp(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const date = d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  const time = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${date} at ${time}`
}

function formatDueDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function dueDelta(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
  if (diff === 0) return 'Due today'
  if (diff === 1) return 'Due tomorrow'
  if (diff > 0) return `Due in ${diff} day${diff === 1 ? '' : 's'}`
  if (diff === -1) return 'Overdue by 1 day'
  return `Overdue by ${Math.abs(diff)} days`
}

function StatusDropdown({
  value,
  onChange,
}: {
  value: TaskStatusDb
  onChange: (next: TaskStatusDb) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        style={{
          backgroundColor: STATUS_BG[value],
          borderColor: STATUS_DOT[value],
        }}
        className="w-full h-[34px] flex items-center justify-between px-[10px] py-[7px] rounded-lg border border-solid"
      >
        <span className="flex items-center gap-[5px]">
          <span
            className="w-[6px] h-[6px] rounded-full"
            style={{ backgroundColor: STATUS_DOT[value] }}
          />
          <span
            className="text-[12px] font-semibold leading-none"
            style={{ color: STATUS_TEXT[value] }}
          >
            {STATUS_LABEL[value]}
          </span>
        </span>
        <Icon name="ArrowRight" size={15} className="text-gray-main" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-[40px] z-10 bg-white-white border border-solid border-gray-border-light rounded-[5px] shadow-md p-[5px] flex flex-col gap-[2px]">
          {STATUS_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                onChange(k)
                setOpen(false)
              }}
              className={`flex items-center gap-[5px] px-[10px] py-[7px] rounded-[3px] hover:bg-white-item transition-colors text-left ${
                k === value ? 'bg-white-item' : ''
              }`}
            >
              <span
                className="w-[6px] h-[6px] rounded-full"
                style={{ backgroundColor: STATUS_DOT[k] }}
              />
              <span className="text-[12px] font-semibold text-black">
                {STATUS_LABEL[k]}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Generic outside-click/Esc popover wrapper for the small detail editors. */
function Popover({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div
      ref={ref}
      className="absolute right-0 top-[26px] z-20 bg-white-white border border-solid border-gray-border-light rounded-[5px] shadow-md p-[5px] flex flex-col gap-[2px] min-w-[160px] max-h-[220px] overflow-y-auto"
    >
      {children}
    </div>
  )
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="bg-primary-main text-white rounded-full w-[20px] h-[20px] inline-flex items-center justify-center text-[10px] font-semibold uppercase shrink-0">
      {name.charAt(0)}
    </span>
  )
}

function AssigneeEditor({
  members,
  value,
  fallbackUser,
  onChange,
}: {
  members: UserRow[]
  value: string | null
  /** The current assignee as fetched directly, used for display when they
   *  aren't (yet) in the project-members list so we never wrongly show
   *  "Unassigned" for an assigned task. */
  fallbackUser?: UserRow | null
  onChange: (next: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const selected =
    members.find((m) => m.id === value) ??
    (fallbackUser && fallbackUser.id === value ? fallbackUser : null)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="flex items-center gap-[5px] min-w-0 rounded-[3px] px-[5px] -mx-[5px] py-[2px] hover:bg-white-item transition-colors"
      >
        {selected ? (
          <>
            <Avatar name={memberName(selected)} />
            <span className="text-black text-[12px] font-semibold truncate max-w-[110px]">
              {memberName(selected)}
            </span>
          </>
        ) : (
          <span className="text-gray-secondary text-[12px]">— Unassigned</span>
        )}
      </button>
      <Popover open={open} onClose={() => setOpen(false)}>
        <button
          type="button"
          onClick={() => {
            onChange(null)
            setOpen(false)
          }}
          className={`flex items-center gap-[5px] px-[10px] py-[7px] rounded-[3px] hover:bg-white-item text-left ${
            value === null ? 'bg-white-item' : ''
          }`}
        >
          <span className="text-gray-secondary text-[12px]">Unassigned</span>
        </button>
        {members.length === 0 ? (
          <p className="px-[10px] py-[7px] text-gray-secondary text-[11px]">
            No project members.
          </p>
        ) : (
          members.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                onChange(m.id)
                setOpen(false)
              }}
              className={`flex items-center gap-[5px] px-[10px] py-[7px] rounded-[3px] hover:bg-white-item text-left ${
                m.id === value ? 'bg-white-item' : ''
              }`}
            >
              <Avatar name={memberName(m)} />
              <span className="text-black text-[12px] truncate">
                {memberName(m)}
              </span>
            </button>
          ))
        )}
      </Popover>
    </div>
  )
}

function PriorityEditor({
  value,
  keys,
  onChange,
}: {
  value: TaskPriorityDb
  keys: TaskPriorityDb[]
  onChange: (next: TaskPriorityDb) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="rounded-[3px] px-[3px] -mx-[3px] py-[1px] hover:bg-white-item transition-colors"
      >
        <PriorityTag priority={dbPriorityToUi(value)} />
      </button>
      <Popover open={open} onClose={() => setOpen(false)}>
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              onChange(k)
              setOpen(false)
            }}
            className={`px-[7px] py-[5px] rounded-[3px] hover:bg-white-item text-left ${
              k === value ? 'bg-white-item' : ''
            }`}
          >
            <PriorityTag priority={dbPriorityToUi(k)} />
          </button>
        ))}
      </Popover>
    </div>
  )
}

export default function TaskDetailModal({
  open,
  task,
  projectName,
  ticketId,
  sourceMeeting,
  onClose,
}: Props) {
  const updateTask = useUpdateTask()
  const setAssigneeMut = useSetTaskAssignee(task?.id ?? null)
  const { data: fetchedAssignees = [] } = useTaskAssignees(task?.id ?? null)
  const { data: projectMembers = [] } = useProjectMembers(
    task?.project_id ?? null
  )
  // Derive the ticket id ourselves from the task's creation rank within its
  // project, so it's identical on every page that opens this modal. The
  // `ticketId` prop is only a fallback while the project tasks load (or for
  // project-less personal tasks, which have no project code).
  const { data: projectTasks = [] } = useProjectTasks(
    task?.project_id ?? null
  )

  // Probe whether the task_priority enum has 'lowest' (added by
  // supabase/migrations/*_add_task_priority_lowest.sql). Only offer it once
  // the value exists — selecting it otherwise would 22P02 and fail the save.
  const [lowestSupported, setLowestSupported] = useState(false)
  useEffect(() => {
    let cancelled = false
    supabase
      .from('tasks')
      .select('id')
      .eq('priority', 'lowest')
      .limit(1)
      .then(({ error }) => {
        // 22P02 = invalid enum value → not migrated yet. Any other result
        // (rows or empty) means the enum accepts it.
        if (!cancelled && !error) setLowestSupported(true)
      })
    return () => {
      cancelled = true
    }
  }, [])
  const priorityKeys = lowestSupported
    ? PRIORITY_KEYS_WITH_LOWEST
    : PRIORITY_KEYS_BASE

  // Local edit state — initialised from `task` whenever a new one opens.
  const [status, setStatus] = useState<TaskStatusDb>('planned')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskPriorityDb>('medium')
  const [dueDate, setDueDate] = useState<string | null>(null)
  const [datePickerAnchor, setDatePickerAnchor] = useState<DOMRect | null>(null)
  const dateTriggerRef = useRef<HTMLButtonElement>(null)
  // Assignee uses an override: `undefined` = "untouched, follow the fetched
  // baseline"; an explicit string|null = a user edit. Reset per task so a
  // late-arriving assignees fetch doesn't clobber an in-progress edit.
  const [assigneeOverride, setAssigneeOverride] = useState<
    string | null | undefined
  >(undefined)

  const baselineAssigneeId = fetchedAssignees[0]?.id ?? null
  const assigneeId =
    assigneeOverride === undefined ? baselineAssigneeId : assigneeOverride

  useEffect(() => {
    if (task) {
      setStatus(task.status)
      setTitle(task.title)
      setDescription(task.description ?? '')
      setPriority(task.priority)
      setDueDate(task.due_date ?? null)
      setAssigneeOverride(undefined)
      setDatePickerAnchor(null)
    }
  }, [task?.id]) // re-init only when the task identity changes

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        void save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task, status, title, description, priority, dueDate, assigneeId])

  if (!open || !task) return null

  const assigneeDirty = assigneeId !== baselineAssigneeId
  const isDirty =
    status !== task.status ||
    title.trim() !== task.title ||
    (description ?? '') !== (task.description ?? '') ||
    priority !== task.priority ||
    (dueDate ?? null) !== (task.due_date ?? null) ||
    assigneeDirty

  const saving = updateTask.isPending || setAssigneeMut.isPending

  async function save() {
    if (!task || !isDirty || saving) return
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return
    try {
      await updateTask.mutateAsync({
        taskId: task.id,
        patch: {
          status,
          title: trimmedTitle,
          description: description.trim() === '' ? null : description,
          priority,
          due_date: dueDate,
        },
      })
      if (assigneeDirty) {
        await setAssigneeMut.mutateAsync(assigneeId)
      }
      onClose()
    } catch (e) {
      console.error('[TaskDetailModal] save failed', e)
    }
  }

  const dueText = formatDueDate(dueDate)
  const dueDeltaText = dueDelta(dueDate)
  // Stable, page-independent ticket id; fall back to the prop while the
  // project tasks load or when the task has no project.
  const ticket =
    taskTicketId(projectName, projectTasks, task.id) ?? ticketId

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white-white rounded-[15px] shadow-2xl w-[820px] max-w-[92vw] flex flex-col overflow-hidden"
      >
        {/* HEADER */}
        <div className="border-b border-solid border-gray-border-light p-[20px] flex items-center justify-between">
          <div className="flex items-center gap-[15px]">
            <div className="flex items-center gap-[5px]">
              <Icon name="Folder" size={15} className="text-gray-main" />
              <span className="text-black text-[12px]">{projectName}</span>
              <span className="text-gray-main text-[12px]">/</span>
              <span
                className="text-black text-[12px] font-bold"
                style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
              >
                {ticket}
              </span>
            </div>
            <span
              className="px-[7px] py-[3px] rounded-[2px] text-[12px] font-semibold tracking-[1px] uppercase"
              style={{
                backgroundColor: STATUS_BG[status],
                color: STATUS_TEXT[status],
              }}
            >
              {STATUS_LABEL[status]}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-secondary hover:text-black w-[20px] h-[20px] flex items-center justify-center"
            aria-label="Close"
          >
            <Icon name="Cross" size={14} />
          </button>
        </div>

        {/* BODY */}
        <div className="flex items-start">
          <div className="flex-1 min-w-0 p-[20px] flex flex-col gap-[15px]">
            <div className="flex flex-col gap-[5px] items-start">
              <p className="text-blue-main text-[10px] font-medium uppercase tracking-[1.5px]">
                task · {ticket.toLowerCase()}
              </p>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title"
                className="text-black text-[20px] font-semibold leading-none bg-transparent outline-none border border-solid border-transparent rounded-[5px] px-[15px] py-[7px] -mx-[15px] w-[calc(100%+30px)] hover:border-gray-border-light focus:border-gray-border focus:bg-white-white transition-colors placeholder:text-gray-secondary"
              />
              {sourceMeeting && (
                <div className="inline-flex items-center gap-[10px] bg-white-item rounded-[5px] px-[10px] py-[7px] w-fit">
                  <Icon name="Meeting" size={15} className="text-primary-main" />
                  <span className="text-primary-main text-[12px]">
                    {sourceMeeting.name}
                  </span>
                  <span className="w-px h-[10px] bg-gray-border-light" />
                  <span className="text-primary-main text-[12px]">
                    {sourceMeeting.date}
                  </span>
                </div>
              )}
            </div>
            <div className="h-px bg-gray-border-light w-full" />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description…"
              rows={8}
              className="bg-transparent outline-none resize-none text-black text-[12px] leading-[1.5] placeholder:text-gray-secondary border border-solid border-transparent rounded-[5px] px-[15px] py-[7px] -mx-[15px] w-[calc(100%+30px)] hover:border-gray-border-light focus:border-gray-border focus:bg-white-white transition-colors"
            />
          </div>

          {/* RIGHT SIDEBAR */}
          <div className="bg-white-item w-[254px] shrink-0 self-stretch px-[11px] py-[14px] flex flex-col gap-[10px]">
            <div className="flex flex-col gap-[5px]">
              <p className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                Status
              </p>
              <StatusDropdown value={status} onChange={setStatus} />
            </div>

            <div className="flex flex-col gap-[5px]">
              <p className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                Details
              </p>
              <div className="bg-white-white border border-solid border-gray-border-light rounded-[5px] p-[15px] flex flex-col gap-[15px]">
                <div className="flex items-center justify-between gap-[15px]">
                  <p className="text-gray-main text-[12px] w-[55px] shrink-0">
                    Assignee
                  </p>
                  <AssigneeEditor
                    members={projectMembers}
                    value={assigneeId}
                    fallbackUser={fetchedAssignees[0] ?? null}
                    onChange={setAssigneeOverride}
                  />
                </div>
                <div className="flex items-center justify-between gap-[15px]">
                  <p className="text-gray-main text-[12px] w-[55px] shrink-0">
                    Priority
                  </p>
                  <PriorityEditor
                    value={priority}
                    keys={priorityKeys}
                    onChange={setPriority}
                  />
                </div>
                <div className="flex items-center justify-between gap-[15px]">
                  <p className="text-gray-main text-[12px] w-[55px] shrink-0">
                    Due date
                  </p>
                  <button
                    ref={dateTriggerRef}
                    type="button"
                    onClick={() =>
                      setDatePickerAnchor((cur) =>
                        cur
                          ? null
                          : dateTriggerRef.current?.getBoundingClientRect() ??
                            null
                      )
                    }
                    className="flex items-center gap-[5px] rounded-[3px] px-[5px] -mx-[5px] py-[2px] hover:bg-white-item transition-colors"
                  >
                    <Icon
                      name="Calendar"
                      size={15}
                      className="text-gray-main shrink-0"
                    />
                    {dueText ? (
                      <span className="text-black text-[12px] font-semibold">
                        {dueText}
                      </span>
                    ) : (
                      <span className="text-gray-secondary text-[12px]">
                        Set date
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-[3px] text-gray-main text-[10px]">
              {formatTimestamp(task.created_at) && (
                <p>Created · {formatTimestamp(task.created_at)}</p>
              )}
              {formatTimestamp(task.updated_at) && (
                <p>Updated · {formatTimestamp(task.updated_at)}</p>
              )}
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="bg-white-item border-t border-solid border-gray-border-light px-[20px] py-[15px] flex items-center justify-between">
          <div className="flex items-center gap-[5px]">
            <span className="bg-white-white border border-solid border-gray-border-light rounded-[5px] px-[5px] py-[2px] text-gray-main text-[10px]">
              ⌘ ⏎
            </span>
            <span className="text-gray-main text-[10px]">to save</span>
          </div>
          <div className="flex items-center gap-[10px]">
            {dueDeltaText && (
              <span className="text-primary-main text-[10px]">{dueDeltaText}</span>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="bg-white-white border border-solid border-gray-border-light rounded-[5px] px-[15px] py-[10px] text-black text-[12px] hover:bg-white-item transition-colors disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!isDirty || saving}
              className="bg-primary-main rounded-[5px] px-[15px] py-[10px] text-white-main text-[12px] font-semibold hover:bg-primary-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>

        {/* Floating due-date picker — rendered inside the card so its clicks
            don't bubble to the overlay's close handler. */}
        <DatePicker
          anchorRect={datePickerAnchor}
          value={dueDate}
          onChange={(next) => setDueDate(next)}
          onClose={() => setDatePickerAnchor(null)}
        />
      </div>
    </div>
  )
}
