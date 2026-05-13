import { useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import ProjectAppShell, { useCreateNew } from '../../../components/ProjectAppShell'
import StatusLabelBig from '../../../components/ui/StatusLabelBig'
import PriorityTag from '../../../components/ui/PriorityTag'
import Input from '../../../components/ui/Input'
import Button from '../../../components/ui/Button'
import UserGroup from '../../../components/ui/UserGroup'
import FilterChecklist from '../../../components/ui/FilterChecklist'
import Table, {
  TableHeader,
  TableRow,
  TableCell,
  type Column,
} from '../../../components/ui/Table'
import { useProject, useProjectMembers, useProjectTasks } from '../../../lib/hooks'
import {
  dbPriorityToUi,
  dbStatusToUi,
  formatShortDate,
  userToMember,
  type TaskPriorityDb,
  type TaskStatusDb,
  type UserRow,
} from '../../../lib/types'

const PROGRESS_FILTERS: { key: TaskStatusDb; label: string; chipClass: string }[] = [
  { key: 'planned', label: 'Planned', chipClass: 'bg-[#E6ECEF] text-black' },
  { key: 'in_progress', label: 'In Progress', chipClass: 'bg-blue-light text-blue-main' },
  { key: 'review', label: 'Review', chipClass: 'bg-brown-light text-brown-med' },
  { key: 'blocked', label: 'Blocked', chipClass: 'bg-red-light text-red-main' },
  { key: 'done', label: 'Done', chipClass: 'bg-green-light text-green-main' },
]

const PRIORITY_OPTIONS: { key: TaskPriorityDb; label: string; color: string }[] = [
  { key: 'urgent', label: 'Highest', color: '#9B3838' },
  { key: 'high', label: 'High', color: '#9B3838' },
  { key: 'medium', label: 'Medium', color: '#B68A48' },
  { key: 'low', label: 'Low', color: '#2D5A9E' },
]

type SortKey = 'id' | 'due' | 'priority' | 'progress'
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'id', label: 'By ID' },
  { key: 'due', label: 'By Due Date' },
  { key: 'progress', label: 'By Progress' },
  { key: 'priority', label: 'By Priority' },
]

const PRIORITY_RANK: Record<TaskPriorityDb, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
}

const STATUS_RANK: Record<TaskStatusDb, number> = {
  planned: 0,
  in_progress: 1,
  review: 2,
  blocked: 3,
  done: 4,
}

const COLS: Column[] = [
  { key: 'id', label: '', width: 'w-[80px]' },
  { key: 'task', label: 'Task', width: 'flex-1' },
  { key: 'assignee', label: 'Assignee', width: 'w-[160px]' },
  { key: 'due', label: 'Due', width: 'w-[80px]' },
  { key: 'status', label: 'Status', width: 'w-[130px]' },
  { key: 'priority', label: 'Priority', width: 'w-[100px]' },
]

function ticketId(projectName: string, idx: number): string {
  const prefix = projectName
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .join('')
    .slice(0, 3)
    .toUpperCase()
  return `${prefix || 'TSK'}-${(idx + 100).toString().padStart(3, '0')}`
}

function memberLabel(u: UserRow): string {
  return u.nickname || `${u.first_name} ${u.last_name}`.trim() || u.email
}

/** Close popover on outside-click + Escape. */
function useClickOutside(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])
  return ref
}

export default function BacklogPage() {
  const router = useRouter()
  const projectId = router.query.projectId as string | undefined
  if (!projectId) return null
  return (
    <>
      <Head>
        <title>plinq · Backlog</title>
      </Head>
      <ProjectAppShell projectId={projectId} active="backlog">
        <BacklogBody projectId={projectId} />
      </ProjectAppShell>
    </>
  )
}

function BacklogBody({ projectId }: { projectId: string }) {
  const { open } = useCreateNew()
  const { data: project } = useProject(projectId)
  const { data: tasks = [] } = useProjectTasks(projectId)
  const { data: members = [] } = useProjectMembers(projectId)
  const [search, setSearch] = useState('')

  // Filter state — default = all selected (no filtering).
  const [statusFilter, setStatusFilter] = useState<Set<TaskStatusDb>>(
    () => new Set(PROGRESS_FILTERS.map((f) => f.key))
  )
  const [priorityFilter, setPriorityFilter] = useState<Set<TaskPriorityDb>>(
    () => new Set(PRIORITY_OPTIONS.map((p) => p.key))
  )
  /** Member ids + special 'unassigned' token. `null` = not yet initialized
   *  (waiting for members to load); any non-null Set means the user has the
   *  filter in some state — possibly empty, which should hide all rows. */
  const [assigneeFilter, setAssigneeFilter] = useState<Set<string> | null>(null)
  // Initialize once members load (only if user hasn't touched it yet).
  useEffect(() => {
    if (assigneeFilter !== null) return
    if (members.length === 0) return
    const initial = new Set<string>(members.map((m) => m.id))
    initial.add('unassigned')
    setAssigneeFilter(initial)
  }, [members, assigneeFilter])

  const [sortBy, setSortBy] = useState<SortKey>('id')

  const [filterOpen, setFilterOpen] = useState(false)
  const filterRef = useClickOutside(filterOpen, () => setFilterOpen(false))

  // Counts shown next to each filter row — unfiltered totals.
  const statusCounts = useMemo(() => {
    const m = new Map<TaskStatusDb, number>()
    for (const t of tasks) m.set(t.status, (m.get(t.status) ?? 0) + 1)
    return m
  }, [tasks])
  const priorityCounts = useMemo(() => {
    const m = new Map<TaskPriorityDb, number>()
    for (const t of tasks) m.set(t.priority, (m.get(t.priority) ?? 0) + 1)
    return m
  }, [tasks])
  const assigneeCounts = useMemo(() => {
    const m = new Map<string, number>()
    let unassigned = 0
    for (const t of tasks) {
      if (t.assignees.length === 0) {
        unassigned += 1
        continue
      }
      for (const a of t.assignees) {
        m.set(a.id, (m.get(a.id) ?? 0) + 1)
      }
    }
    m.set('unassigned', unassigned)
    return m
  }, [tasks])

  const toggleStatus = (key: TaskStatusDb) => {
    setStatusFilter((prev) => {
      // Switch from "All" mode → narrow to just this one status.
      if (prev.size === PROGRESS_FILTERS.length) return new Set([key])
      // Already narrowed → toggle the clicked status in/out of the set.
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
  const toggleAssignee = (key: string) => {
    setAssigneeFilter((prev) => {
      const next = new Set(prev ?? [])
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  const toggleAllStatus = () => {
    setStatusFilter((prev) =>
      prev.size === PROGRESS_FILTERS.length
        ? new Set()
        : new Set(PROGRESS_FILTERS.map((f) => f.key))
    )
  }
  const toggleAllPriority = () => {
    setPriorityFilter((prev) =>
      prev.size === PRIORITY_OPTIONS.length
        ? new Set()
        : new Set(PRIORITY_OPTIONS.map((p) => p.key))
    )
  }
  const toggleAllAssignee = () => {
    const total = members.length + 1 // members + unassigned
    setAssigneeFilter((prev) => {
      if (prev && prev.size === total) return new Set()
      const next = new Set<string>(members.map((m) => m.id))
      next.add('unassigned')
      return next
    })
  }

  // Apply all filters → then sort.
  const filtered = useMemo(() => {
    let arr = tasks
    if (statusFilter.size < PROGRESS_FILTERS.length) {
      arr = arr.filter((t) => statusFilter.has(t.status))
    }
    if (priorityFilter.size < PRIORITY_OPTIONS.length) {
      arr = arr.filter((t) => priorityFilter.has(t.priority))
    }
    if (assigneeFilter !== null) {
      arr = arr.filter((t) => {
        if (t.assignees.length === 0) return assigneeFilter.has('unassigned')
        return t.assignees.some((a) => assigneeFilter.has(a.id))
      })
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      arr = arr.filter((t) => t.title.toLowerCase().includes(q))
    }
    return arr
  }, [tasks, statusFilter, priorityFilter, assigneeFilter, search])

  const sorted = useMemo(() => {
    if (sortBy === 'id') return filtered
    const arr = [...filtered]
    if (sortBy === 'due') {
      arr.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return a.due_date.localeCompare(b.due_date)
      })
    } else if (sortBy === 'priority') {
      arr.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
    } else if (sortBy === 'progress') {
      arr.sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status])
    }
    return arr
  }, [filtered, sortBy])

  const allStatusOn = statusFilter.size === PROGRESS_FILTERS.length
  const allPriorityOn = priorityFilter.size === PRIORITY_OPTIONS.length
  const allAssigneeOn =
    assigneeFilter !== null && assigneeFilter.size === members.length + 1
  const activeFilterCount =
    (allStatusOn ? 0 : 1) +
    (allPriorityOn ? 0 : 1) +
    (allAssigneeOn ? 0 : 1) +
    (sortBy === 'id' ? 0 : 1)
  const filterLabel = activeFilterCount > 0 ? `Filter · ${activeFilterCount}` : 'Filter'

  return (
    <div className="flex-1 min-h-0 flex flex-col p-6 gap-6">
      {/* Toolbar */}
      <div className="shrink-0 flex items-end justify-between gap-4">
        <div className="flex flex-col gap-[5px]">
          <p className="text-blue-main text-[10px] font-medium uppercase tracking-[1.5px]">
            {(project?.name ?? '').toUpperCase()} · BACKLOG
          </p>
          <h1 className="text-black text-[35px] font-semibold leading-tight">
            {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} in{' '}
            <em
              className="italic font-semibold text-gray-main"
              style={{ fontFamily: 'Inter, ui-sans-serif, sans-serif' }}
            >
              {project?.name ?? 'project'}.
            </em>
          </h1>
        </div>
        <div className="flex items-center gap-[10px]">
          <Input
            variant="search"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div ref={filterRef} className="relative">
            <Button
              size="compact"
              variant="secondary"
              iconLeft="Filter"
              onClick={() => setFilterOpen((s) => !s)}
            >
              {filterLabel}
            </Button>
            {filterOpen && (
              <div className="absolute top-[40px] right-0 z-20 bg-white-white border border-solid border-gray-border-light rounded-[5px] shadow-md p-[15px] flex items-start gap-[20px]">
                {/* PRIORITY */}
                <div className="flex flex-col gap-[2px] w-[230px]">
                  <p className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px] px-[2px] mb-[5px]">
                    Priority
                  </p>
                  <FilterChecklist
                    label="All"
                    count={tasks.length}
                    color="#455E6A"
                    checked={allPriorityOn}
                    onChange={toggleAllPriority}
                  />
                  <div className="h-px bg-gray-border-light my-[5px]" />
                  {PRIORITY_OPTIONS.map((p) => (
                    <FilterChecklist
                      key={p.key}
                      label={p.label}
                      count={priorityCounts.get(p.key) ?? 0}
                      color={p.color}
                      checked={priorityFilter.has(p.key)}
                      onChange={() => togglePriority(p.key)}
                    />
                  ))}
                </div>

                {/* ASSIGNEE */}
                <div className="flex flex-col gap-[2px] w-[230px] max-h-[360px] overflow-y-auto">
                  <p className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px] px-[2px] mb-[5px]">
                    Assignee
                  </p>
                  <FilterChecklist
                    label="All"
                    count={tasks.length}
                    color="#455E6A"
                    checked={allAssigneeOn}
                    onChange={toggleAllAssignee}
                  />
                  <div className="h-px bg-gray-border-light my-[5px]" />
                  {members.length === 0 ? (
                    <p className="px-[10px] py-[5px] text-gray-secondary text-[11px]">
                      No project members.
                    </p>
                  ) : (
                    members.map((m) => (
                      <FilterChecklist
                        key={m.id}
                        label={memberLabel(m)}
                        count={assigneeCounts.get(m.id) ?? 0}
                        color="#5B7FB6"
                        checked={assigneeFilter?.has(m.id) ?? false}
                        onChange={() => toggleAssignee(m.id)}
                      />
                    ))
                  )}
                  <FilterChecklist
                    label="Unassigned"
                    count={assigneeCounts.get('unassigned') ?? 0}
                    color="#94A0AA"
                    checked={assigneeFilter?.has('unassigned') ?? false}
                    onChange={() => toggleAssignee('unassigned')}
                  />
                </div>

                {/* SORT */}
                <div className="flex flex-col gap-[2px] w-[180px]">
                  <p className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px] px-[2px] mb-[5px]">
                    Sort
                  </p>
                  {SORT_OPTIONS.map((opt) => {
                    const active = sortBy === opt.key
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setSortBy(opt.key)}
                        className={`flex items-center justify-between w-full px-[6px] py-[6px] rounded-[3px] text-[12px] text-left transition-colors ${
                          active
                            ? 'text-black font-semibold'
                            : 'text-gray-main hover:bg-white-item/60'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {active && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path
                              d="M2 6.5L4.8 9L10 3.5"
                              stroke="#2D5A9E"
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
          <Button size="compact" iconLeft="Add" onClick={() => open('task')}>
            New Task
          </Button>
        </div>
      </div>

      {/* Progress filter pills — multi-select */}
      <div className="shrink-0 flex items-center gap-[10px] flex-wrap">
        <button
          type="button"
          onClick={toggleAllStatus}
          className={`px-[10px] py-[5px] rounded-[3px] text-[12px] font-semibold uppercase tracking-[1px] transition-opacity bg-purple-light text-purple-main ${
            allStatusOn ? 'opacity-100' : 'opacity-40 hover:opacity-70'
          }`}
        >
          All
        </button>
        {PROGRESS_FILTERS.map((f) => {
          // While "All" is the active mode, individual pills appear dim. As
          // soon as the user narrows down, only their picks light up.
          const active = !allStatusOn && statusFilter.has(f.key)
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => toggleStatus(f.key)}
              className={`px-[10px] py-[5px] rounded-[3px] text-[12px] font-semibold uppercase tracking-[1px] transition-opacity ${
                f.chipClass
              } ${active ? 'opacity-100' : 'opacity-40 hover:opacity-70'}`}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {/* Table — shrinks to content when rows are few, scrolls internally when overflowing */}
      <div className="min-h-0 bg-white-white rounded-[10px] border border-gray-border-light flex flex-col overflow-hidden">
        <TableHeader columns={COLS} className="shrink-0" />
        <div className="min-h-0 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-secondary text-[12px]">
            No tasks match.
          </div>
        ) : (
          sorted.map((t, i) => {
            const isDone = t.status === 'done'
            return (
              <TableRow key={t.id} isLast={i === sorted.length - 1}>
                <TableCell width="w-[80px]">
                  <span
                    className={`text-[10px] font-semibold tracking-[1px] ${
                      isDone ? 'text-gray-secondary' : 'text-gray-main'
                    }`}
                    style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
                  >
                    {ticketId(project?.name ?? 'TSK', i)}
                  </span>
                </TableCell>
                <TableCell width="flex-1">
                  <span
                    className={`text-[14px] ${
                      isDone ? 'text-gray-secondary line-through' : 'text-black'
                    }`}
                  >
                    {t.title}
                  </span>
                </TableCell>
                <TableCell width="w-[160px]">
                  {t.assignees.length > 0 ? (
                    <span className="flex items-center gap-[8px] min-w-0">
                      <UserGroup
                        members={t.assignees.map(userToMember)}
                        size={20}
                        max={3}
                      />
                      <span className="text-[12px] text-black truncate">
                        {t.assignees.length === 1
                          ? memberLabel(t.assignees[0])
                          : `${t.assignees.length} people`}
                      </span>
                    </span>
                  ) : (
                    <span className="text-gray-secondary text-[12px]">—</span>
                  )}
                </TableCell>
                <TableCell width="w-[80px]">
                  <span
                    className="text-[12px] font-semibold tracking-[-0.2px] text-gray-main"
                    style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
                  >
                    {formatShortDate(t.due_date) ?? '—'}
                  </span>
                </TableCell>
                <TableCell width="w-[130px]">
                  <StatusLabelBig status={dbStatusToUi(t.status)} size="md" />
                </TableCell>
                <TableCell width="w-[100px]">
                  <PriorityTag priority={dbPriorityToUi(t.priority)} />
                </TableCell>
              </TableRow>
            )
          })
        )}
        </div>
      </div>
    </div>
  )
}
