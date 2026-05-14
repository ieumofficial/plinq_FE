import { useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import PersonalAppShell, { useCreateNew } from '../components/PersonalAppShell'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import Filter from '../components/ui/Filter'
import FilterChecklist from '../components/ui/FilterChecklist'
import Checkbox from '../components/ui/Checkbox'
import StatusLabelBig from '../components/ui/StatusLabelBig'
import PriorityTag from '../components/ui/PriorityTag'
import ProjectLabel from '../components/ui/ProjectLabel'
import Icon from '../components/ui/Icon'
import Table, { TableHeader, TableRow, TableCell, type Column } from '../components/ui/Table'
import { useCurrentUser, useUpdateTaskStatus, useUserActionItems } from '../lib/hooks'
import { type TaskWithProject } from '../lib/queries'
import { dbStatusToUi, dbPriorityToUi, type TaskPriorityDb } from '../lib/types'

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

type FilterKey = 'all' | 'today' | 'overdue'

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

function isDueToday(t: TaskWithProject): boolean {
  if (!t.due_date) return false
  const today = startOfToday()
  const due = new Date(t.due_date + 'T00:00:00')
  return due.getTime() === today.getTime() && t.status !== 'done'
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
  const router = useRouter()
  const createNew = useCreateNew()
  const { data: user } = useCurrentUser()
  const { data: tasks = [], isLoading } = useUserActionItems(user?.id, { includeDone: true })
  const { mutate: updateTaskStatus } = useUpdateTaskStatus()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [openMenuTaskId, setOpenMenuTaskId] = useState<string | null>(null)
  const [menuAnchorRect, setMenuAnchorRect] = useState<DOMRect | null>(null)
  const closeRowMenu = () => {
    setOpenMenuTaskId(null)
    setMenuAnchorRect(null)
  }
  const [priorityFilter, setPriorityFilter] = useState<Set<TaskPriorityDb>>(
    () => new Set(PRIORITY_OPTIONS.map((p) => p.key))
  )
  const [projectFilter, setProjectFilter] = useState<Set<string> | null>(null)

  const counts = useMemo(() => {
    const all = tasks.length
    const today = tasks.filter(isDueToday).length
    const overdue = tasks.filter(isOverdue).length
    return { all, today, overdue }
  }, [tasks])

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
    let arr = tasks
    if (filter === 'today') arr = arr.filter(isDueToday)
    if (filter === 'overdue') arr = arr.filter(isOverdue)
    arr = arr.filter((t) => priorityFilter.has(t.priority))
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
    return arr
  }, [tasks, filter, priorityFilter, projectFilter, search])

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
          <Filter
            label="All"
            count={counts.all}
            selected={filter === 'all'}
            onClick={() => setFilter('all')}
          />
          <Filter
            label="Today"
            count={counts.today}
            selected={filter === 'today'}
            onClick={() => setFilter('today')}
          />
          <Filter
            label="Overdue"
            count={counts.overdue}
            selected={filter === 'overdue'}
            onClick={() => setFilter('overdue')}
          />
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
                    <TableHeader columns={COLS} />
                    {rows.map((t, i) => {
                      const isDone = t.status === 'done'
                      const overdue = isOverdue(t)
                      const dueLabel = formatDueLabel(t.due_date)
                      const source = formatSource(t)
                      return (
                        <TableRow key={t.id} isLast={i === rows.length - 1}>
                          <TableCell width="flex-1">
                            <Checkbox
                              checked={isDone}
                              onChange={(next) =>
                                updateTaskStatus({
                                  taskId: t.id,
                                  status: next ? 'done' : 'in_progress',
                                })
                              }
                            />
                            <span
                              className={`text-[14px] font-medium truncate min-w-0 ${
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
                              className={`text-[14px] font-medium truncate ${
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
                              className={`text-[14px] font-semibold tracking-[-0.2px] ${
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
                            <div onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  if (openMenuTaskId === t.id) {
                                    closeRowMenu()
                                  } else {
                                    setMenuAnchorRect(
                                      e.currentTarget.getBoundingClientRect()
                                    )
                                    setOpenMenuTaskId(t.id)
                                  }
                                }}
                                className="text-gray-secondary hover:text-black inline-flex items-center justify-center w-[24px] h-[24px] rounded transition-colors"
                                aria-label="More"
                              >
                                <Icon name="Dot-Menu" size={15} />
                              </button>
                              <TaskRowMenu
                                open={openMenuTaskId === t.id}
                                anchorRect={
                                  openMenuTaskId === t.id ? menuAnchorRect : null
                                }
                                isDone={isDone}
                                hasProject={!!t.project_id}
                                onClose={closeRowMenu}
                                onOpenProject={() => {
                                  closeRowMenu()
                                  if (t.project_id) {
                                    router.push(`/p/${t.project_id}/backlog`)
                                  }
                                }}
                                onToggleDone={() => {
                                  updateTaskStatus({
                                    taskId: t.id,
                                    status: isDone ? 'in_progress' : 'done',
                                  })
                                  closeRowMenu()
                                }}
                              />
                            </div>
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

function PriorityFilterButton({
  selected,
  counts,
  onToggle,
  onToggleAll,
}: {
  selected: Set<TaskPriorityDb>
  counts: Map<TaskPriorityDb, number>
  onToggle: (key: TaskPriorityDb) => void
  onToggleAll: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useClickOutside(open, () => setOpen(false))
  const allSelected = selected.size === PRIORITY_OPTIONS.length
  const label = allSelected ? 'Priority' : `Priority · ${selected.size}`
  const totalCount = PRIORITY_OPTIONS.reduce(
    (sum, p) => sum + (counts.get(p.key) ?? 0),
    0
  )

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
        <div className="absolute top-[40px] right-0 z-20 bg-white-white border border-solid border-gray-border-light rounded-[5px] shadow-md p-[10px] flex flex-col gap-[2px] min-w-[240px]">
          <FilterChecklist
            label="All"
            count={totalCount}
            color="#455E6A"
            checked={allSelected}
            onChange={onToggleAll}
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
            />
          ))}
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

function TaskRowMenu({
  open,
  anchorRect,
  isDone,
  hasProject,
  onClose,
  onOpenProject,
  onToggleDone,
}: {
  open: boolean
  /** Trigger button's bounding rect — used so the menu can render with
   *  `position: fixed` and escape the page's `overflow-y-auto` scroll
   *  container without needing a portal. Null when closed. */
  anchorRect: DOMRect | null
  isDone: boolean
  hasProject: boolean
  onClose: () => void
  onOpenProject: () => void
  onToggleDone: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    function onScrollOrResize() {
      onClose()
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [open, onClose])

  if (!open || !anchorRect || typeof window === 'undefined') return null

  const style: React.CSSProperties = {
    position: 'fixed',
    top: anchorRect.bottom + 4,
    right: Math.max(8, window.innerWidth - anchorRect.right),
    minWidth: 180,
  }

  return (
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      style={style}
      className="z-50 bg-white-white border border-solid border-gray-border-light rounded-[5px] shadow-md py-[5px]"
    >
      <button
        type="button"
        disabled={!hasProject}
        title={hasProject ? undefined : 'This task is not attached to a project'}
        onClick={(e) => {
          e.stopPropagation()
          onOpenProject()
        }}
        className="w-full flex items-center gap-[10px] px-[10px] py-[7px] text-[12px] text-left text-black hover:bg-white-item transition-colors disabled:text-gray-secondary disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        <Icon name="ArrowRight" size={13} className="text-gray-main" />
        <span>Open in project</span>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onToggleDone()
        }}
        className="w-full flex items-center gap-[10px] px-[10px] py-[7px] text-[12px] text-left text-black hover:bg-white-item transition-colors"
      >
        <Icon name="Task" size={13} className="text-gray-main" />
        <span>{isDone ? 'Mark as not done' : 'Mark as done'}</span>
      </button>
    </div>
  )
}
