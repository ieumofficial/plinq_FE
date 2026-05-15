import { useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import PersonalAppShell, { useCreateNew } from '../components/PersonalAppShell'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import FilterChecklist from '../components/ui/FilterChecklist'
import Checkbox from '../components/ui/Checkbox'
import StatusLabelBig from '../components/ui/StatusLabelBig'
import PriorityTag from '../components/ui/PriorityTag'
import ProjectLabel from '../components/ui/ProjectLabel'
import Icon from '../components/ui/Icon'
import Table, { TableHeader, TableRow, TableCell, type Column } from '../components/ui/Table'
import { useActiveOrg, useCurrentUser, useDeleteTask, useUpdateTaskStatus, useUserActionItems } from '../lib/hooks'
import { type TaskWithProject } from '../lib/queries'
import { dbStatusToUi, dbPriorityToUi, type TaskPriorityDb } from '../lib/types'
import DeleteConfirmModal from '../components/DeleteConfirmModal'
import TaskDetailModal from '../components/TaskDetailModal'

const PRIORITY_OPTIONS: { key: TaskPriorityDb; label: string; color: string }[] = [
  { key: 'urgent', label: 'Highest', color: '#9B3838' },
  { key: 'high', label: 'High', color: '#9B3838' },
  { key: 'medium', label: 'Medium', color: '#B68A48' },
  { key: 'low', label: 'Low', color: '#2D5A9E' },
]

const PROJECT_PALETTE: Record<string, string> = {
  blue: '#2D5A9E',
  green: '#2F6B45',
  amber: '#B68A48',
  red: '#9B3838',
  purple: '#5B3D8A',
  turquoise: '#558589',
}

/** Resolve a project's stored color (palette key or hex) to a usable hex. */
function resolveProjectColor(color: string | null | undefined): string {
  if (!color) return PROJECT_PALETTE.blue
  if (color.startsWith('#')) return color
  return PROJECT_PALETTE[color] ?? PROJECT_PALETTE.blue
}

type SortKey = 'status' | 'priority' | 'due'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'due', label: 'Due date' },
]

/** Stable ordering for status / priority so the sorted output is predictable. */
const STATUS_ORDER: Record<string, number> = {
  blocked: 0,
  in_progress: 1,
  review: 2,
  planned: 3,
  done: 4,
}
const PRIORITY_ORDER: Record<TaskPriorityDb, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
}

const COLS: Column[] = [
  // Action stretches to fill the row; the right-side columns are fixed
  // widths so Source/Status/Priority/Due/⋯ hug the right edge regardless
  // of viewport width.
  { key: 'task', label: 'Action', width: 'flex-1' },
  { key: 'source', label: 'Source', width: 'w-[150px]' },
  { key: 'status', label: 'Status', width: 'w-[102px]' },
  { key: 'priority', label: 'Priority', width: 'w-[76px]' },
  { key: 'due', label: 'Due', width: 'w-[70px]' },
  { key: 'more', label: '', width: 'w-[30px]' },
]

function startOfToday() {
  const t = new Date()
  t.setHours(0, 0, 0, 0)
  return t
}

function isOverdue(t: TaskWithProject): boolean {
  if (!t.due_date) return false
  return new Date(t.due_date + 'T00:00:00') < startOfToday() && t.status !== 'done'
}


/** "Today" / "Tomorrow" / "April 22" style. */
function formatDueLabel(due: string | null): string {
  if (!due) return '—'
  const d = new Date(due + 'T00:00:00')
  const today = startOfToday()
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

/**
 * Source label for a task:
 *  - From a meeting → "MeetingName, Apr 10"
 *  - Manually created by someone → "Creator Name, Apr 10"
 *  - Otherwise → null
 */
function formatSource(t: TaskWithProject): string | null {
  const shortDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  if (t.source_meeting_name) {
    return t.source_meeting_scheduled_at
      ? `${t.source_meeting_name}, ${shortDate(t.source_meeting_scheduled_at)}`
      : t.source_meeting_name
  }
  if (t.creator_name) {
    return `${t.creator_name}, ${shortDate(t.created_at)}`
  }
  return null
}

export default function ActionItemsPage() {
  return (
    <>
      <Head>
        <title>plinq · Tasks</title>
      </Head>
      <PersonalAppShell active="tasks">
        <ActionItemsBody />
      </PersonalAppShell>
    </>
  )
}

function ActionItemsBody() {
  const createNew = useCreateNew()
  const { data: user } = useCurrentUser()
  const activeOrg = useActiveOrg(user?.id)
  const { data: tasks = [], isLoading } = useUserActionItems(user?.id, {
    includeDone: true,
    orgId: activeOrg?.id ?? null,
  })
  const { mutate: updateTaskStatus } = useUpdateTaskStatus()
  const deleteTask = useDeleteTask()
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('due')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState<TaskWithProject | null>(null)
  const [openTask, setOpenTask] = useState<TaskWithProject | null>(null)
  const [priorityFilter, setPriorityFilter] = useState<Set<TaskPriorityDb>>(
    () => new Set(PRIORITY_OPTIONS.map((p) => p.key))
  )
  const [projectFilter, setProjectFilter] = useState<Set<string> | null>(null)

  const priorityCounts = useMemo(() => {
    const m = new Map<TaskPriorityDb, number>()
    for (const t of tasks) m.set(t.priority, (m.get(t.priority) ?? 0) + 1)
    return m
  }, [tasks])

  const projectCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of tasks) {
      const key = t.project_name ?? 'No project'
      m.set(key, (m.get(key) ?? 0) + 1)
    }
    return m
  }, [tasks])

  const filteredTasks = useMemo(() => {
    let arr = tasks.filter((t) => priorityFilter.has(t.priority))
    if (projectFilter)
      arr = arr.filter((t) => projectFilter.has(t.project_name ?? 'No project'))
    if (search.trim()) {
      const q = search.toLowerCase()
      arr = arr.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.project_name?.toLowerCase().includes(q)
      )
    }
    // Sort
    const sorted = [...arr]
    if (sortBy === 'status') {
      sorted.sort(
        (a, b) =>
          (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)
      )
    } else if (sortBy === 'priority') {
      sorted.sort(
        (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      )
    } else {
      // 'due' — nulls last, ascending
      sorted.sort((a, b) => {
        const ad = a.due_date ?? '9999-12-31'
        const bd = b.due_date ?? '9999-12-31'
        return ad.localeCompare(bd)
      })
    }
    return sorted
  }, [tasks, priorityFilter, projectFilter, search, sortBy])

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { color: string | null; tasks: TaskWithProject[] }
    >()
    for (const t of filteredTasks) {
      const key = t.project_name ?? 'No project'
      const entry = map.get(key) ?? { color: t.project_color, tasks: [] }
      entry.tasks.push(t)
      map.set(key, entry)
    }
    return Array.from(map.entries())
  }, [filteredTasks])

  const projectOptions = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of tasks) {
      const name = t.project_name ?? 'No project'
      if (!m.has(name)) m.set(name, resolveProjectColor(t.project_color))
    }
    return Array.from(m, ([name, color]) => ({ name, color }))
  }, [tasks])

  // Auto-init project filter to "all selected" once options arrive.
  useEffect(() => {
    if (projectFilter === null && projectOptions.length > 0) {
      setProjectFilter(new Set(projectOptions.map((o) => o.name)))
    }
  }, [projectOptions, projectFilter])

  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const togglePriority = (key: TaskPriorityDb) => {
    setPriorityFilter((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const togglePriorityAll = () => {
    setPriorityFilter((prev) =>
      prev.size === PRIORITY_OPTIONS.length
        ? new Set()
        : new Set(PRIORITY_OPTIONS.map((p) => p.key))
    )
  }

  const toggleProject = (key: string) => {
    setProjectFilter((prev) => {
      const next = new Set(prev ?? projectOptions.map((o) => o.name))
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleProjectAll = () => {
    setProjectFilter((prev) => {
      const all = projectOptions.map((o) => o.name)
      return (prev ?? new Set(all)).size === all.length ? new Set() : new Set(all)
    })
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col p-6 gap-6">
      {/* Toolbar */}
      <div className="shrink-0 flex items-end justify-between gap-4">
        <h1 className="flex items-center gap-[5px] leading-none whitespace-nowrap text-[35px]">
          <span className="text-black font-semibold">Grouped by</span>
          <em
            className="italic text-gray-main font-semibold"
            style={{ fontFamily: 'Inter, ui-sans-serif, sans-serif' }}
          >
            project.
          </em>
        </h1>
        <div className="flex items-center gap-[10px]">
          <Input
            variant="search"
            placeholder="Search for a task..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <PriorityFilterButton
            selected={priorityFilter}
            counts={priorityCounts}
            onToggle={togglePriority}
            onToggleAll={togglePriorityAll}
            sortBy={sortBy}
            onSortChange={setSortBy}
          />
          <ProjectFilterButton
            options={projectOptions}
            selected={projectFilter ?? new Set(projectOptions.map((o) => o.name))}
            counts={projectCounts}
            onToggle={toggleProject}
            onToggleAll={toggleProjectAll}
          />
          <Button size="compact" iconLeft="Add" onClick={() => createNew.open('task')}>
            New Task
          </Button>
        </div>
      </div>

      {/* Grouped tables — shrinks to content when items are few, scrolls when overflowing */}
      <div className="min-h-0 overflow-y-auto">
      {isLoading && tasks.length === 0 ? (
        <p className="text-gray-secondary text-[12px]">Loading…</p>
      ) : grouped.length === 0 ? (
        <div className="bg-white-white border border-gray-border-light rounded-[10px] p-12 text-center">
          <p className="text-gray-secondary text-[14px]">
            {tasks.length === 0
              ? "You don't have any action items yet."
              : 'No tasks match this filter.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-[10px]">
          {grouped.map(([projectName, { color, tasks: rows }]) => {
            const isCollapsed = collapsed.has(projectName)
            const open = rows.filter((t) => t.status !== 'done').length
            return (
              <div key={projectName} className="flex flex-col gap-[10px]">
                {/* Group header */}
                <button
                  type="button"
                  onClick={() => toggleCollapse(projectName)}
                  className="flex items-center gap-[20px] self-start"
                >
                  <div className="flex items-center gap-[5px]">
                    <span
                      className="text-gray-main inline-flex items-center justify-center"
                      style={{
                        transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.15s',
                      }}
                    >
                      <Icon name="Low" size={15} />
                    </span>
                    <ProjectLabel name={projectName} color={color ?? 'blue'} size="sm" />
                    <span className="text-black text-[14px] font-semibold">
                      {projectName}
                    </span>
                  </div>
                  <span
                    className="text-gray-main text-[10px] font-semibold tracking-[1px]"
                    style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
                  >
                    {open} open · {rows.length} total
                  </span>
                </button>

                {/* Table card */}
                {!isCollapsed && (
                  <Table>
                    <TableHeader columns={COLS} className="!gap-[12px] !px-[16px]" />
                    {rows.map((t, i) => {
                      const isDone = t.status === 'done'
                      const overdue = isOverdue(t)
                      const dueLabel = formatDueLabel(t.due_date)
                      const source = formatSource(t)
                      return (
                        <TableRow
                          key={t.id}
                          isLast={i === rows.length - 1}
                          onClick={() => setOpenTask(t)}
                          className="!gap-[12px] !px-[16px]"
                        >
                          <TableCell width="flex-1">
                            <span onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={isDone}
                                onChange={(next) =>
                                  updateTaskStatus({
                                    taskId: t.id,
                                    status: next ? 'done' : 'in_progress',
                                  })
                                }
                              />
                            </span>
                            <span
                              className={`text-[12px] font-medium truncate min-w-0 ${
                                isDone
                                  ? 'text-gray-secondary line-through'
                                  : 'text-black'
                              }`}
                            >
                              {t.title}
                            </span>
                          </TableCell>
                          <TableCell width="w-[150px]">
                            <span
                              className={`text-[12px] font-medium truncate ${
                                isDone ? 'text-gray-secondary' : 'text-gray-main'
                              }`}
                            >
                              {source ?? '—'}
                            </span>
                          </TableCell>
                          <TableCell width="w-[102px]">
                            <StatusLabelBig status={dbStatusToUi(t.status)} size="md" />
                          </TableCell>
                          <TableCell width="w-[76px]">
                            <PriorityTag priority={dbPriorityToUi(t.priority)} />
                          </TableCell>
                          <TableCell width="w-[70px]">
                            <span
                              className={`text-[12px] font-semibold tracking-[-0.2px] ${
                                isDone
                                  ? 'text-gray-secondary'
                                  : overdue || dueLabel === 'Today'
                                    ? 'text-red-main'
                                    : 'text-gray-main'
                              }`}
                              style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
                            >
                              {dueLabel}
                            </span>
                          </TableCell>
                          <TableCell width="w-[30px]" align="right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeleting(t)
                              }}
                              className="text-red-main hover:bg-red-50 inline-flex items-center justify-center w-[24px] h-[24px] rounded transition-colors"
                              aria-label="Delete task"
                            >
                              <Icon name="Trash" size={15} />
                            </button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </Table>
                )}
              </div>
            )
          })}
        </div>
      )}
      </div>

      <DeleteConfirmModal
        open={deleting !== null}
        type="task"
        title="Delete this task?"
        body={
          <>
            This action is <strong className="font-bold">permanent</strong>. The
            task will be removed from your action items.
          </>
        }
        subject={
          deleting && (
            <div className="flex flex-col gap-[3px] min-w-0">
              <p className="text-black text-[12px] font-semibold truncate">
                {deleting.title}
              </p>
              <p className="text-gray-main text-[10px] truncate">
                {deleting.project_name ?? 'No project'}
                {deleting.due_date ? ` · Due ${deleting.due_date}` : ''}
              </p>
            </div>
          )
        }
        consequences={
          deleting
            ? [
                'Removed from your action items',
                deleting.project_id
                  ? 'Removed from the project backlog'
                  : 'Standalone task — nothing else is touched',
              ]
            : []
        }
        confirmLabel="Delete task"
        submitting={deleteTask.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return
          deleteTask.mutate(deleting.id, {
            onSuccess: () => setDeleting(null),
          })
        }}
      />

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
    </div>
  )
}

/** Closes the popover when clicking outside or pressing Escape. */
function useClickOutside(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [open, onClose])
  return ref
}

/** Combined Priority filter + Sort picker. Single "Filter" button opens a
 *  two-column dropdown: priority checklist on the left, sort radio on the
 *  right. (The user requested merging sort into the filter rather than a
 *  separate button.) */
function PriorityFilterButton({
  selected,
  counts,
  onToggle,
  onToggleAll,
  sortBy,
  onSortChange,
}: {
  selected: Set<TaskPriorityDb>
  counts: Map<TaskPriorityDb, number>
  onToggle: (key: TaskPriorityDb) => void
  onToggleAll: () => void
  sortBy: SortKey
  onSortChange: (next: SortKey) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useClickOutside(open, () => setOpen(false))
  const allSelected = selected.size === PRIORITY_OPTIONS.length
  const totalCount = PRIORITY_OPTIONS.reduce(
    (sum, p) => sum + (counts.get(p.key) ?? 0),
    0
  )
  // Counter chip on the button only when the user has narrowed something.
  const narrowed = !allSelected
  const label = narrowed ? `Filter · ${selected.size}` : 'Filter'

  return (
    <div ref={ref} className="relative">
      <Button
        size="compact"
        variant="secondary"
        iconLeft="Filter"
        onClick={() => setOpen((s) => !s)}
      >
        {label}
      </Button>
      {open && (
        <div className="absolute top-[40px] right-0 z-20 bg-white-white border border-solid border-gray-border-light rounded-[5px] shadow-md p-[10px] flex items-start gap-[15px]">
          {/* Priority — left column. We pass `!w-full` to FilterChecklist so
              it stretches to fill this column instead of locking at 225px. */}
          <div className="w-[160px] shrink-0 flex flex-col gap-[2px]">
            <p className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px] px-[2px] mb-[5px]">
              Priority
            </p>
            <FilterChecklist
              label="All"
              count={totalCount}
              color="#455E6A"
              checked={allSelected}
              onChange={onToggleAll}
              className="!w-full"
            />
            <div className="h-px bg-gray-border-light my-[5px]" />
            {PRIORITY_OPTIONS.map((p) => (
              <FilterChecklist
                key={p.key}
                label={p.label}
                count={counts.get(p.key) ?? 0}
                color={p.color}
                checked={selected.has(p.key)}
                onChange={() => onToggle(p.key)}
                className="!w-full"
              />
            ))}
          </div>

          <div className="w-px self-stretch bg-gray-border-light" />

          {/* Sort — right column */}
          <div className="w-[170px] shrink-0 flex flex-col gap-[2px]">
            <p className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px] px-[2px] mb-[5px]">
              Sort by
            </p>
            {SORT_OPTIONS.map((o) => {
              const isSel = o.key === sortBy
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => onSortChange(o.key)}
                  className={`flex items-center justify-between px-[8px] py-[6px] rounded-[3px] text-left text-[12px] transition-colors ${
                    isSel
                      ? 'bg-white-item text-black font-semibold'
                      : 'text-black hover:bg-white-item'
                  }`}
                >
                  <span>{o.label}</span>
                  {isSel && (
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 12 12"
                      fill="none"
                      aria-hidden
                    >
                      <path
                        d="M2 6.5L4.8 9L10 3.5"
                        stroke="#455E6A"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function ProjectFilterButton({
  options,
  selected,
  counts,
  onToggle,
  onToggleAll,
}: {
  options: { name: string; color: string }[]
  selected: Set<string>
  counts: Map<string, number>
  onToggle: (key: string) => void
  onToggleAll: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useClickOutside(open, () => setOpen(false))
  const allSelected = selected.size === options.length
  const label = allSelected ? 'Project: All' : `Project · ${selected.size}`
  const totalCount = options.reduce(
    (sum, o) => sum + (counts.get(o.name) ?? 0),
    0
  )

  return (
    <div ref={ref} className="relative">
      <Button
        size="compact"
        variant="secondary"
        onClick={() => setOpen((s) => !s)}
      >
        {label}
        <Icon
          name="ArrowRight"
          size={15}
          style={{
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.1s',
          }}
        />
      </Button>
      {open && (
        <div className="absolute top-[40px] right-0 z-20 bg-white-white border border-solid border-gray-border-light rounded-[5px] shadow-md p-[10px] flex flex-col gap-[2px] min-w-[240px] max-h-[320px] overflow-y-auto">
          {options.length === 0 ? (
            <p className="text-gray-secondary text-[12px] px-[2px] py-[5px]">
              No projects yet.
            </p>
          ) : (
            <>
              <FilterChecklist
                label="All"
                count={totalCount}
                color="#455E6A"
                checked={allSelected}
                onChange={onToggleAll}
              />
              <div className="h-px bg-gray-border-light my-[5px]" />
              {options.map((opt) => (
                <FilterChecklist
                  key={opt.name}
                  label={opt.name}
                  count={counts.get(opt.name) ?? 0}
                  color={opt.color}
                  checked={selected.has(opt.name)}
                  onChange={() => onToggle(opt.name)}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

