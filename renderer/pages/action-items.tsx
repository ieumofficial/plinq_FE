import { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import PersonalAppShell from '../components/PersonalAppShell'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import Filter from '../components/ui/Filter'
import Checkbox from '../components/ui/Checkbox'
import StatusLabelBig from '../components/ui/StatusLabelBig'
import PriorityTag from '../components/ui/PriorityTag'
import Table, { TableHeader, TableRow, TableCell, type Column } from '../components/ui/Table'
import {
  getCurrentUser,
  getUserActionItems,
  type TaskWithProject,
} from '../lib/queries'
import {
  dbStatusToUi,
  dbPriorityToUi,
  formatDueDate,
  type UserRow,
} from '../lib/types'

type FilterKey = 'all' | 'mine' | 'overdue' | 'completed'

const COLS: Column[] = [
  { key: 'task', label: 'Action', width: 'flex-[2]' },
  { key: 'status', label: 'Status', width: 'w-[130px]' },
  { key: 'priority', label: 'Priority', width: 'w-[90px]' },
  { key: 'due', label: 'Due', width: 'w-[100px]' },
]

function isOverdue(t: TaskWithProject): boolean {
  if (!t.due_date) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(t.due_date + 'T00:00:00') < today && t.status !== 'done'
}

export default function ActionItemsPage() {
  const router = useRouter()
  const [, setUser] = useState<UserRow | null>(null)
  const [tasks, setTasks] = useState<TaskWithProject[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const u = await getCurrentUser()
      if (cancelled) return
      if (!u) {
        router.push('/')
        return
      }
      setUser(u)
      const ts = await getUserActionItems(u.id, { includeDone: true })
      if (cancelled) return
      setTasks(ts)
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [router])

  const counts = useMemo(() => {
    const all = tasks.length
    const mine = tasks.filter((t) => t.status !== 'done').length
    const overdue = tasks.filter(isOverdue).length
    const completed = tasks.filter((t) => t.status === 'done').length
    return { all, mine, overdue, completed }
  }, [tasks])

  const filteredTasks = useMemo(() => {
    let arr = tasks
    if (filter === 'mine') arr = arr.filter((t) => t.status !== 'done')
    if (filter === 'overdue') arr = arr.filter(isOverdue)
    if (filter === 'completed') arr = arr.filter((t) => t.status === 'done')
    if (search.trim()) {
      const q = search.toLowerCase()
      arr = arr.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.project_name?.toLowerCase().includes(q)
      )
    }
    return arr
  }, [tasks, filter, search])

  const grouped = useMemo(() => {
    const map = new Map<string, TaskWithProject[]>()
    for (const t of filteredTasks) {
      const key = t.project_name ?? 'No project'
      const arr = map.get(key) ?? []
      arr.push(t)
      map.set(key, arr)
    }
    return Array.from(map.entries())
  }, [filteredTasks])

  return (
    <>
      <Head>
        <title>plinq · Action Items</title>
      </Head>
      <PersonalAppShell active="tasks">
        <div className="p-6 flex flex-col gap-6">
          {/* Toolbar */}
          <div className="flex items-end justify-between gap-4">
            <h1 className="text-black text-[28px] font-semibold leading-tight">
              Grouped by{' '}
              <em
                className="not-italic italic text-blue-main font-medium"
                style={{ fontFamily: 'Inter, ui-sans-serif, sans-serif' }}
              >
                project.
              </em>
            </h1>
            <div className="flex items-center gap-[10px]">
              <div className="bg-gray-extra-light rounded-[5px] p-1 inline-flex gap-1">
                <Filter
                  label="All"
                  count={counts.all}
                  selected={filter === 'all'}
                  onClick={() => setFilter('all')}
                />
                <Filter
                  label="Mine"
                  count={counts.mine}
                  selected={filter === 'mine'}
                  onClick={() => setFilter('mine')}
                />
                <Filter
                  label="Overdue"
                  count={counts.overdue}
                  selected={filter === 'overdue'}
                  onClick={() => setFilter('overdue')}
                />
                <Filter
                  label="Done"
                  count={counts.completed}
                  selected={filter === 'completed'}
                  onClick={() => setFilter('completed')}
                />
              </div>
              <Input
                variant="search"
                placeholder="Search tasks"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Button size="compact" variant="secondary" iconLeft="Filter">
                Sort
              </Button>
              <Button size="compact" iconLeft="Add">
                New task
              </Button>
            </div>
          </div>

          {/* Tables grouped by project */}
          {loading ? (
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
            <div className="flex flex-col gap-4">
              {grouped.map(([projectName, rows]) => (
                <div key={projectName} className="flex flex-col gap-2">
                  <h2 className="text-black text-[14px] font-semibold uppercase tracking-[1px]">
                    {projectName} <span className="text-gray-secondary">· {rows.length}</span>
                  </h2>
                  <Table>
                    <TableHeader columns={COLS} />
                    {rows.map((t, i) => (
                      <TableRow key={t.id} isLast={i === rows.length - 1}>
                        <TableCell width="flex-[2]">
                          <Checkbox checked={t.status === 'done'} />
                          <span
                            className={`text-[14px] ${
                              t.status === 'done'
                                ? 'text-gray-secondary line-through'
                                : 'text-black'
                            }`}
                          >
                            {t.title}
                          </span>
                        </TableCell>
                        <TableCell width="w-[130px]">
                          <StatusLabelBig status={dbStatusToUi(t.status)} size="md" />
                        </TableCell>
                        <TableCell width="w-[90px]">
                          <PriorityTag priority={dbPriorityToUi(t.priority)} size="sm" />
                        </TableCell>
                        <TableCell width="w-[100px]">
                          <span
                            className={`text-[14px] font-semibold tracking-[-0.2px] ${
                              isOverdue(t) ? 'text-red-main' : 'text-gray-main'
                            }`}
                            style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
                          >
                            {formatDueDate(t.due_date) ?? '—'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </Table>
                </div>
              ))}
            </div>
          )}
        </div>
      </PersonalAppShell>
    </>
  )
}
