import { useMemo } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import ProjectAppShell, { useCreateNew } from '../../../components/ProjectAppShell'
import StatusLabelBig from '../../../components/ui/StatusLabelBig'
import Task from '../../../components/ui/Task'
import Button from '../../../components/ui/Button'
import { useProject, useProjectTasks } from '../../../lib/hooks'
import {
  dbPriorityToUi,
  formatShortDate,
  userToMember,
  type TaskStatusDb,
} from '../../../lib/types'

const COLUMNS: { key: TaskStatusDb; label: string; status: 'planned' | 'in-progress' | 'review' | 'done' }[] = [
  { key: 'planned', label: 'Planned', status: 'planned' },
  { key: 'in_progress', label: 'In Progress', status: 'in-progress' },
  { key: 'review', label: 'Review', status: 'review' },
  { key: 'done', label: 'Done', status: 'done' },
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

  const columns = useMemo(() => {
    const order = new Map(tasks.map((t, i) => [t.id, i]))
    return COLUMNS.map((c) => ({
      ...c,
      items: tasks
        .filter((t) => t.status === c.key)
        .map((t) => ({ ...t, _idx: order.get(t.id) ?? 0 })),
    }))
  }, [tasks])

  const totalVisible = columns.reduce((s, c) => s + c.items.length, 0)

  return (
    <div className="p-6 flex flex-col gap-6">
          {/* Toolbar */}
          <div className="flex items-end justify-between gap-4">
            <div className="flex flex-col gap-[5px]">
              <p className="text-blue-main text-[10px] font-medium uppercase tracking-[1.5px]">
                {(project?.name ?? '').toUpperCase()} · KANBAN BOARD
              </p>
              <h1 className="text-black text-[28px] font-semibold leading-tight">
                {totalVisible} {totalVisible === 1 ? 'task' : 'tasks'} across{' '}
                <em
                  className="italic text-blue-main font-medium"
                  style={{ fontFamily: 'Inter, ui-sans-serif, sans-serif' }}
                >
                  {columns.length} columns.
                </em>
              </h1>
            </div>
            <div className="flex items-center gap-[10px]">
              <Button size="compact" variant="secondary" iconLeft="Filter">
                Filter
              </Button>
              <Button size="compact" iconLeft="Add" onClick={() => open('task')}>
                New Task
              </Button>
            </div>
          </div>

          {/* Columns */}
          <div className="flex gap-[15px] overflow-x-auto">
            {columns.map((c) => (
              <div key={c.key} className="w-[280px] shrink-0 flex flex-col gap-[10px]">
                <div className="flex items-center justify-between px-[5px] h-[30px]">
                  <div className="flex items-center gap-[10px]">
                    <StatusLabelBig status={c.status} size="md" />
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
                    aria-label="Add task"
                    className="text-gray-main hover:bg-gray-extra-light p-1 rounded transition-colors"
                  >
                    <span className="text-[16px] leading-none">+</span>
                  </button>
                </div>
                <div className="flex flex-col gap-[10px]">
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
                    <p className="text-gray-secondary text-[12px] px-2 py-4">
                      No tasks here.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
    </div>
  )
}
