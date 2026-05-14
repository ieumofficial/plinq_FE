import { useEffect, useRef, useState } from 'react'
import Icon from './ui/Icon'
import PriorityTag from './ui/PriorityTag'
import { useUpdateTask } from '../lib/hooks'
import {
  dbPriorityToUi,
  userToMember,
  type TaskStatusDb,
  type UserRow,
  type TaskRow,
} from '../lib/types'

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

export default function TaskDetailModal({
  open,
  task,
  projectName,
  ticketId,
  sourceMeeting,
  onClose,
}: Props) {
  const updateTask = useUpdateTask()

  // Local edit state — initialised from `task` whenever a new one opens.
  const [status, setStatus] = useState<TaskStatusDb>('planned')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (task) {
      setStatus(task.status)
      setTitle(task.title)
      setDescription(task.description ?? '')
    }
  }, [task?.id]) // re-init only when the task identity changes

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task, status, title, description])

  if (!open || !task) return null

  const isDirty =
    status !== task.status ||
    title.trim() !== task.title ||
    (description ?? '') !== (task.description ?? '')

  function save() {
    if (!task || !isDirty) return
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return
    updateTask.mutate(
      {
        taskId: task.id,
        patch: {
          status,
          title: trimmedTitle,
          description: description.trim() === '' ? null : description,
        },
      },
      { onSuccess: () => onClose() }
    )
  }

  const assignee = task.assignees?.[0]
    ? userToMember(task.assignees[0])
    : null
  const dueText = formatDueDate(task.due_date)
  const dueDeltaText = dueDelta(task.due_date)

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
                {ticketId}
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
                task · {ticketId.toLowerCase()}
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
                <div className="flex items-center gap-[35px]">
                  <p className="text-gray-main text-[12px] w-[55px]">
                    Assignee
                  </p>
                  {assignee ? (
                    <div className="flex items-center gap-[5px] min-w-0">
                      <span className="bg-primary-main text-white rounded-full w-[20px] h-[20px] inline-flex items-center justify-center text-[10px] font-semibold uppercase shrink-0">
                        {assignee.name.charAt(0)}
                      </span>
                      <span className="text-black text-[12px] font-semibold truncate">
                        {assignee.name}
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-secondary text-[12px]">—</span>
                  )}
                </div>
                <div className="flex items-center gap-[35px]">
                  <p className="text-gray-main text-[12px] w-[55px]">Priority</p>
                  <PriorityTag priority={dbPriorityToUi(task.priority)} />
                </div>
                <div className="flex items-center gap-[35px]">
                  <p className="text-gray-main text-[12px] w-[55px]">Due date</p>
                  {dueText ? (
                    <span className="flex items-center gap-[5px]">
                      <Icon name="Calendar" size={15} className="text-gray-main" />
                      <span className="text-black text-[12px] font-semibold">
                        {dueText}
                      </span>
                    </span>
                  ) : (
                    <span className="text-gray-secondary text-[12px]">—</span>
                  )}
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
              disabled={updateTask.isPending}
              className="bg-white-white border border-solid border-gray-border-light rounded-[5px] px-[15px] py-[10px] text-black text-[12px] hover:bg-white-item transition-colors disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!isDirty || updateTask.isPending}
              className="bg-primary-main rounded-[5px] px-[15px] py-[10px] text-white-main text-[12px] font-semibold hover:bg-primary-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {updateTask.isPending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
