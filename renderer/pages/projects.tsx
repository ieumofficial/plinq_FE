import { useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import PersonalAppShell, { useCreateNew } from '../components/PersonalAppShell'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import Icon, { type IconName } from '../components/ui/Icon'
import ProjectListCard from '../components/ui/ProjectListCard'
import FilterChecklist from '../components/ui/FilterChecklist'
import { useActiveOrg, useCurrentUser, useDeleteProject, useUserProjects } from '../lib/hooks'
import { useAllPinnedProjects } from '../lib/pinPref'
import { useProjectPreview } from '../components/ProjectPreviewProvider'
import {
  dbStatusToUi,
  formatDueDate,
  userToMember,
  type ProjectStatusDb,
} from '../lib/types'
import type { Member } from '../components/ui/UserGroup'

const STATUS_FILTERS: { key: ProjectStatusDb; label: string; color: string }[] = [
  { key: 'planned', label: 'Planned', color: '#455E6A' },
  { key: 'in_progress', label: 'In Progress', color: '#2D5A9E' },
  { key: 'review', label: 'Review', color: '#B68A48' },
  { key: 'blocked', label: 'Blocked', color: '#9B3838' },
  { key: 'done', label: 'Done', color: '#2F6B45' },
]

export default function ProjectsPage() {
  return (
    <>
      <Head>
        <title>plinq · Projects</title>
      </Head>
      <PersonalAppShell active="projects">
        <ProjectsPageBody />
      </PersonalAppShell>
    </>
  )
}

type MenuAction = 'open' | 'delete'

type MenuItem = {
  key: MenuAction
  label: string
  icon: IconName
  danger?: boolean
}

const MENU_ITEMS: MenuItem[] = [
  { key: 'open', label: 'Open project', icon: 'ArrowRight' },
  { key: 'delete', label: 'Delete project', icon: 'Cross', danger: true },
]

function ProjectActionMenu({
  open,
  canDelete,
  onClose,
  onPick,
}: {
  open: boolean
  canDelete: boolean
  onClose: () => void
  onPick: (action: MenuAction) => void
}) {
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

  if (!open) return null

  return (
    <div
      ref={ref}
      className="absolute top-[42px] right-[12px] z-20 bg-white-white border border-solid border-gray-border-light rounded-[5px] shadow-md py-[5px] flex flex-col min-w-[160px]"
    >
      {MENU_ITEMS.map((it) => {
        const disabled = it.key === 'delete' && !canDelete
        const colorClass = disabled
          ? 'text-gray-secondary cursor-not-allowed'
          : it.danger
            ? 'text-red-main hover:bg-white-item'
            : 'text-black hover:bg-white-item'
        return (
          <button
            key={it.key}
            type="button"
            disabled={disabled}
            title={disabled ? 'Only the project lead can delete this project.' : undefined}
            onClick={(e) => {
              e.stopPropagation()
              if (disabled) return
              onPick(it.key)
            }}
            className={`flex items-center gap-[10px] px-[10px] py-[7px] text-[12px] text-left transition-colors ${colorClass}`}
          >
            <Icon name={it.icon} size={15} />
            <span>{it.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function ProjectCardWithMenu({
  id,
  name,
  color,
  description,
  status,
  progress,
  tasksDone,
  tasksTotal,
  due,
  lead,
  members,
  canDelete,
  pinned,
  onOpen,
  onDelete,
  onTogglePin,
}: {
  id: string
  name: string
  color?: string | null
  description?: string
  status: ReturnType<typeof dbStatusToUi>
  progress: number
  tasksDone: number
  tasksTotal: number
  due?: string
  lead?: Member
  members: Member[]
  canDelete: boolean
  pinned?: boolean
  onOpen: () => void
  onDelete: (id: string, name: string) => void
  onTogglePin?: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <ProjectListCard
        name={name}
        color={color}
        description={description}
        status={status}
        progress={progress}
        tasksDone={tasksDone}
        tasksTotal={tasksTotal}
        due={due}
        lead={lead}
        members={members}
        pinned={pinned}
        onOpen={onOpen}
        onMenuClick={() => setOpen((s) => !s)}
        onTogglePin={onTogglePin}
      />
      <ProjectActionMenu
        open={open}
        canDelete={canDelete}
        onClose={() => setOpen(false)}
        onPick={(action) => {
          setOpen(false)
          if (action === 'open') onOpen()
          else if (action === 'delete') onDelete(id, name)
        }}
      />
    </div>
  )
}

function StatusFilterButton({
  projects,
  selected,
  onToggle,
}: {
  projects: { status: ProjectStatusDb }[]
  selected: Set<ProjectStatusDb>
  onToggle: (key: ProjectStatusDb) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [open])

  const counts = useMemo(() => {
    const m = new Map<ProjectStatusDb, number>()
    for (const p of projects) m.set(p.status, (m.get(p.status) ?? 0) + 1)
    return m
  }, [projects])

  const allSelected = selected.size === STATUS_FILTERS.length
  const label = allSelected ? 'Status' : `Status · ${selected.size}`

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
          {STATUS_FILTERS.map((s) => (
            <FilterChecklist
              key={s.key}
              label={s.label}
              count={counts.get(s.key) ?? 0}
              color={s.color}
              checked={selected.has(s.key)}
              onChange={() => onToggle(s.key)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ProjectsPageBody() {
  const router = useRouter()
  const preview = useProjectPreview()
  const createNew = useCreateNew()
  const { data: user } = useCurrentUser()
  const activeOrg = useActiveOrg(user?.id)
  const { data: projects = [], isLoading } = useUserProjects(user?.id, {
    orgId: activeOrg?.id ?? null,
  })
  const { mutate: deleteProject } = useDeleteProject()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<Set<ProjectStatusDb>>(
    () => new Set(STATUS_FILTERS.map((s) => s.key))
  )

  // Pin state spans every org represented in the user's project list, so
  // pinning here reflects on each project's owning org's dashboard too.
  const orgIds = useMemo(
    () => Array.from(new Set(projects.map((p) => p.org_id))),
    [projects]
  )
  const { pinned, isPinned, toggle: togglePinned } =
    useAllPinnedProjects(orgIds)

  const toggleStatus = (key: ProjectStatusDb) => {
    setStatusFilter((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const filtered = useMemo(() => {
    let arr = projects.filter((p) => statusFilter.has(p.status))
    if (search.trim()) {
      const q = search.toLowerCase()
      arr = arr.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
      )
    }
    // Pinned projects float to the top of the grid.
    return [...arr].sort((a, b) => {
      const ap = pinned.has(a.id) ? 1 : 0
      const bp = pinned.has(b.id) ? 1 : 0
      return bp - ap
    })
  }, [projects, search, statusFilter, pinned])

  const handleDelete = (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return
    deleteProject(id)
  }

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* Toolbar */}
      <div className="flex items-end justify-between gap-4">
        <h1 className="flex items-center gap-[5px] leading-none whitespace-nowrap text-[35px]">
          <span className="text-black font-semibold">Open a project to</span>
          <em
            className="italic text-gray-main font-semibold"
            style={{ fontFamily: 'Inter, ui-sans-serif, sans-serif' }}
          >
            focus.
          </em>
        </h1>
        <div className="flex items-center gap-[10px]">
          <Input
            variant="search"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <StatusFilterButton
            projects={projects}
            selected={statusFilter}
            onToggle={toggleStatus}
          />
          <Button size="compact" iconLeft="Add" onClick={() => createNew.open('project')}>
            New project
          </Button>
        </div>
      </div>

      {/* Grid */}
      {isLoading && projects.length === 0 ? (
        <p className="text-gray-secondary text-[12px]">Loading projects…</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white-white border border-gray-border-light rounded-[10px] p-12 text-center flex flex-col items-center gap-4">
          <p className="text-gray-secondary text-[14px]">
            {projects.length === 0
              ? 'No projects yet.'
              : 'No projects match your search.'}
          </p>
          {projects.length === 0 && (
            <Button iconLeft="Add" onClick={() => createNew.open('project')}>
              Create your first project
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-[10px]">
          {filtered.map((p) => {
            const lead = p.members.find((m) => m.id === p.lead_id)
            const others = p.members.filter((m) => m.id !== p.lead_id)
            return (
              <ProjectCardWithMenu
                key={p.id}
                id={p.id}
                name={p.name}
                color={p.color}
                description={p.description ?? undefined}
                status={dbStatusToUi(p.status)}
                progress={p.progressPct ?? 0}
                tasksDone={p.tasksDone}
                tasksTotal={p.tasksTotal}
                due={formatDueDate(p.dueDate)}
                lead={lead ? userToMember(lead) : undefined}
                members={others.map(userToMember)}
                canDelete={!!user && p.lead_id === user.id}
                pinned={isPinned(p.id)}
                onOpen={() => preview.open(p.id)}
                onDelete={handleDelete}
                onTogglePin={() => togglePinned(p.org_id, p.id)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

