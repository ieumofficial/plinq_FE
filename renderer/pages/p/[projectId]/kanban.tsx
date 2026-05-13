import { useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import ProjectAppShell, { useCreateNew } from '../../../components/ProjectAppShell'
import Task from '../../../components/ui/Task'
import Button from '../../../components/ui/Button'
import Icon from '../../../components/ui/Icon'
import FilterChecklist from '../../../components/ui/FilterChecklist'
import { useProject, useProjectTasks } from '../../../lib/hooks'
import {
  dbPriorityToUi,
  formatShortDate,
  userToMember,
  type TaskPriorityDb,
  type TaskStatusDb,
} from '../../../lib/types'

// Per Figma 972:3003 — column dot + label colors mirror the dashboard.
const COLUMNS: {
  key: TaskStatusDb
  status: 'planned' | 'in-progress' | 'review' | 'done'
  label: string
  dot: string
}[] = [
  { key: 'planned', status: 'planned', label: 'Planned', dot: '#C7CFD4' },
  { key: 'in_progress', status: 'in-progress', label: 'In Progress', dot: '#5B7FB6' },
  { key: 'review', status: 'review', label: 'Review', dot: '#B68A48' },
  { key: 'done', status: 'done', label: 'Done', dot: '#588F6E' },
]

const PRIORITY_OPTIONS: { key: TaskPriorityDb; label: string; color: string }[] = [
  { key: 'urgent', label: 'Highest', color: '#9B3838' },
  { key: 'high', label: 'High', color: '#9B3838' },
  { key: 'medium', label: 'Medium', color: '#B68A48' },
  { key: 'low', label: 'Low', color: '#2D5A9E' },
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

export default function KanbanPage() {
  const router = useRouter()
  const projectId = router.query.projectId as string | undefined
  if (!projectId) return null
  return (
    <>
      <Head>
        <title>plinq · Kanban</title>
      </Head>
      <ProjectAppShell projectId={projectId} active="kanban">
        <KanbanBody projectId={projectId} />
      </ProjectAppShell>
    </>
  )
}

function KanbanBody({ projectId }: { projectId: string }) {
  const { open } = useCreateNew()
  const { data: project } = useProject(projectId)
  const { data: tasks = [] } = useProjectTasks(projectId)

  // Filters — default to "all checked" so the user sees everything until they
  // narrow down.
  const [statusFilter, setStatusFilter] = useState<Set<TaskStatusDb>>(
    () => new Set(COLUMNS.map((c) => c.key))
  )
  const [priorityFilter, setPriorityFilter] = useState<Set<TaskPriorityDb>>(
    () => new Set(PRIORITY_OPTIONS.map((p) => p.key))
  )
  const [filterOpen, setFilterOpen] = useState(false)
  const filterRef = useClickOutside(filterOpen, () => setFilterOpen(false))

  // Unfiltered counts per status / priority — shown next to each checklist row.
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

  const toggleStatus = (key: TaskStatusDb) => {
    setStatusFilter((prev) => {
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
  const toggleAllStatus = () => {
    setStatusFilter((prev) =>
      prev.size === COLUMNS.length
        ? new Set()
        : new Set(COLUMNS.map((c) => c.key))
    )
  }
  const toggleAllPriority = () => {
    setPriorityFilter((prev) =>
      prev.size === PRIORITY_OPTIONS.length
        ? new Set()
        : new Set(PRIORITY_OPTIONS.map((p) => p.key))
    )
  }

  // Columns to render: filtered by status, with priority-filtered tasks inside.
  const columns = useMemo(() => {
    const order = new Map(tasks.map((t, i) => [t.id, i]))
    return COLUMNS.filter((c) => statusFilter.has(c.key)).map((c) => ({
      ...c,
      items: tasks
        .filter((t) => t.status === c.key && priorityFilter.has(t.priority))
        .map((t) => ({ ...t, _idx: order.get(t.id) ?? 0 })),
    }))
  }, [tasks, statusFilter, priorityFilter])

  const totalVisible = columns.reduce((s, c) => s + c.items.length, 0)
  const allStatusOn = statusFilter.size === COLUMNS.length
  const allPriorityOn = priorityFilter.size === PRIORITY_OPTIONS.length
  const filtersDirty = !allStatusOn || !allPriorityOn
  const filterLabel = filtersDirty
    ? `Filter · ${statusFilter.size + priorityFilter.size}`
    : 'Filter'

  return (
    <div className="p-[15px] flex flex-col gap-[15px] h-full min-h-0">
      {/* Title row */}
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-[5px]">
          <p className="text-blue-main text-[10px] font-medium uppercase tracking-[1.5px]">
            {(project?.name ?? '').toUpperCase()} · KANBAN BOARD
          </p>
          <h1 className="text-black text-[35px] font-semibold leading-tight">
            {totalVisible} {totalVisible === 1 ? 'task' : 'tasks'} across{' '}
            <em
              className="italic font-semibold text-gray-main"
              style={{ fontFamily: 'Inter, ui-sans-serif, sans-serif' }}
            >
              {columns.length} {columns.length === 1 ? 'column' : 'columns'}.
            </em>
          </h1>
        </div>
        <div className="flex items-center gap-[10px]">
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
                {/* PROGRESS */}
                <div className="flex flex-col gap-[2px] w-[230px]">
                  <p className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px] px-[2px] mb-[5px]">
                    Progress
                  </p>
                  <FilterChecklist
                    label="All"
                    count={tasks.length}
                    color="#455E6A"
                    checked={allStatusOn}
                    onChange={toggleAllStatus}
                  />
                  <div className="h-px bg-gray-border-light my-[5px]" />
                  {COLUMNS.map((c) => (
                    <FilterChecklist
                      key={c.key}
                      label={c.label}
                      count={statusCounts.get(c.key) ?? 0}
                      color={c.dot}
                      checked={statusFilter.has(c.key)}
                      onChange={() => toggleStatus(c.key)}
                    />
                  ))}
                </div>

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
              </div>
            )}
          </div>
          <Button size="compact" iconLeft="Add" onClick={() => open('task')}>
            New Task
          </Button>
        </div>
      </div>

      {/* Columns */}
      <div className="flex gap-[10px] flex-1 min-h-0">
        {columns.length === 0 ? (
          <p className="text-gray-secondary text-[12px] py-[40px] text-center w-full">
            No columns match the current filter.
          </p>
        ) : (
          columns.map((c) => (
            <div
              key={c.key}
              className="flex-1 min-w-0 flex flex-col gap-[10px] bg-white-main rounded-[10px] p-[10px]"
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-[3px] h-[28px]">
                <div className="flex items-center gap-[10px]">
                  <span className="inline-flex items-center gap-[8px]">
                    <span
                      className="w-[9px] h-[9px] rounded-full shrink-0"
                      style={{ backgroundColor: c.dot }}
                    />
                    <span className="text-[12px] font-semibold text-black">
                      {c.label}
                    </span>
                  </span>
                  <span
                    className="text-gray-secondary text-[12px] font-medium"
                    style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
                  >
                    {c.items.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => open('task')}
                  aria-label={`Add task to ${c.label}`}
                  className="text-gray-main hover:bg-gray-extra-light rounded transition-colors inline-flex items-center justify-center w-[20px] h-[20px]"
                >
                  <Icon name="Add" size={13} />
                </button>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-[10px] overflow-y-auto">
                {c.items.map((t) => (
                  <Task
                    key={t.id}
                    id={ticketId(project?.name ?? 'TSK', t._idx)}
                    title={t.title}
                    status={c.status}
                    priority={dbPriorityToUi(t.priority)}
                    dueDate={formatShortDate(t.due_date) ?? undefined}
                    assignees={t.assignees.map(userToMember)}
                  />
                ))}
                {c.items.length === 0 && (
                  <p className="text-gray-secondary text-[11px] px-[5px] py-[15px] text-center">
                    No tasks here.
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
