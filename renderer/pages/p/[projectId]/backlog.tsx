import { useMemo, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import ProjectAppShell, { useCreateNew } from '../../../components/ProjectAppShell'
import StatusLabelBig from '../../../components/ui/StatusLabelBig'
import PriorityTag from '../../../components/ui/PriorityTag'
import Input from '../../../components/ui/Input'
import Button from '../../../components/ui/Button'
import UserGroup from '../../../components/ui/UserGroup'
import Table, {
  TableHeader,
  TableRow,
  TableCell,
  type Column,
} from '../../../components/ui/Table'
import { useProject, useProjectTasks } from '../../../lib/hooks'
import {
  dbPriorityToUi,
  dbStatusToUi,
  formatShortDate,
  userToMember,
  type TaskStatusDb,
} from '../../../lib/types'

type FilterKey = 'all' | TaskStatusDb

const FILTERS: { key: FilterKey; label: string; chipClass: string }[] = [
  { key: 'all', label: 'All', chipClass: 'bg-purple-light text-purple-main' },
  { key: 'planned', label: 'Planned', chipClass: 'bg-[#E6ECEF] text-black' },
  { key: 'in_progress', label: 'In Progress', chipClass: 'bg-blue-light text-blue-main' },
  { key: 'review', label: 'Review', chipClass: 'bg-amber-light text-amber-main' },
  { key: 'blocked', label: 'Blocked', chipClass: 'bg-red-light text-red-main' },
  { key: 'done', label: 'Done', chipClass: 'bg-green-light text-green-main' },
]

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
  const [filter, setFilter] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    let arr = tasks
    if (filter !== 'all') arr = arr.filter((t) => t.status === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      arr = arr.filter((t) => t.title.toLowerCase().includes(q))
    }
    return arr
  }, [tasks, filter, search])

  return (
    <div className="p-6 flex flex-col gap-6">
          {/* Toolbar */}
          <div className="flex items-end justify-between gap-4">
            <div className="flex flex-col gap-[5px]">
              <p className="text-blue-main text-[10px] font-medium uppercase tracking-[1.5px]">
                {(project?.name ?? '').toUpperCase()} · BACKLOG
              </p>
              <h1 className="text-black text-[28px] font-semibold leading-tight">
                {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} in{' '}
                <em
                  className="not-italic italic text-blue-main font-medium"
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
              <Button size="compact" variant="secondary" iconLeft="Filter">
                Filter
              </Button>
              <Button size="compact" iconLeft="Add" onClick={() => open('task')}>
                New Task
              </Button>
            </div>
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-[10px]">
            {FILTERS.map((f) => {
              const active = f.key === filter
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={`px-[10px] py-[5px] rounded-[3px] text-[12px] font-semibold uppercase tracking-[1px] transition-opacity ${
                    f.chipClass
                  } ${active ? 'opacity-100' : 'opacity-40 hover:opacity-70'}`}
                >
                  {f.label}
                </button>
              )
            })}
          </div>

          {/* Table */}
          <Table>
            <TableHeader columns={COLS} />
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-secondary text-[12px]">
                No tasks match.
              </div>
            ) : (
              filtered.map((t, i) => {
                const isDone = t.status === 'done'
                return (
                  <TableRow key={t.id} isLast={i === filtered.length - 1}>
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
                          isDone
                            ? 'text-gray-secondary line-through'
                            : 'text-black'
                        }`}
                      >
                        {t.title}
                      </span>
                    </TableCell>
                    <TableCell width="w-[160px]">
                      {t.assignees.length > 0 ? (
                        <span className="flex items-center gap-[8px]">
                          <UserGroup members={[userToMember(t.assignees[0])]} size={20} />
                          <span className="text-[12px] text-black">
                            {t.assignees[0].nickname ||
                              `${t.assignees[0].first_name} ${t.assignees[0].last_name}`.trim()}
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
                      <PriorityTag priority={dbPriorityToUi(t.priority)} size="sm" />
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </Table>
    </div>
  )
}
