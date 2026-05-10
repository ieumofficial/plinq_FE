import { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import PersonalAppShell from '../components/PersonalAppShell'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import Tag from '../components/ui/Tag'
import UserGroup from '../components/ui/UserGroup'
import Icon from '../components/ui/Icon'
import {
  getCurrentUser,
  getUserProjects,
  type ProjectWithStats,
} from '../lib/queries'
import { formatDueDate, userToMember, type UserRow } from '../lib/types'

export default function ProjectsPage() {
  const router = useRouter()
  const [, setUser] = useState<UserRow | null>(null)
  const [projects, setProjects] = useState<ProjectWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

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
      const ps = await getUserProjects(u.id)
      if (cancelled) return
      setProjects(ps)
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [router])

  const filtered = useMemo(() => {
    if (!search.trim()) return projects
    const q = search.toLowerCase()
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
    )
  }, [projects, search])

  return (
    <>
      <Head>
        <title>plinq · Projects</title>
      </Head>
      <PersonalAppShell active="projects">
        <div className="p-6 flex flex-col gap-6">
          {/* Toolbar */}
          <div className="flex items-end justify-between gap-4">
            <h1 className="text-black text-[28px] font-semibold leading-tight">
              Open a project to{' '}
              <em
                className="not-italic italic text-blue-main font-medium"
                style={{ fontFamily: 'Inter, ui-sans-serif, sans-serif' }}
              >
                focus.
              </em>
            </h1>
            <div className="flex items-center gap-[10px]">
              <Input
                variant="search"
                placeholder="Search projects"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Button size="compact" variant="secondary" iconLeft="Filter">
                Sort
              </Button>
              <Button size="compact" iconLeft="Add">
                New project
              </Button>
            </div>
          </div>

          {/* Grid */}
          {loading ? (
            <p className="text-gray-secondary text-[12px]">Loading projects…</p>
          ) : filtered.length === 0 ? (
            <div className="bg-white-white border border-gray-border-light rounded-[10px] p-12 text-center">
              <p className="text-gray-secondary text-[14px]">
                {projects.length === 0
                  ? 'No projects yet. Create your first one above.'
                  : 'No projects match your search.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-[10px]">
              {filtered.map((p) => (
                <ProjectListCard
                  key={p.id}
                  project={p}
                  onOpen={() => router.push(`/projects/${p.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </PersonalAppShell>
    </>
  )
}

/**
 * Larger project card used on the dedicated Projects page.
 * Shows extra stats (progress, status, created) compared to the dashboard
 * widget's compact ProjectCard.
 */
function ProjectListCard({
  project,
  onOpen,
}: {
  project: ProjectWithStats
  onOpen: () => void
}) {
  const lead = project.members.find((m) => m.id === project.lead_id)
  const others = project.members.filter((m) => m.id !== project.lead_id)
  const pct = project.progressPct ?? 0

  return (
    <div
      onClick={onOpen}
      className="bg-white-white border border-gray-border-light rounded-[10px] p-[20px] flex flex-col gap-4 cursor-pointer hover:shadow-sm transition-shadow"
    >
      {/* Header: tag + dot menu */}
      <div className="flex items-start justify-between">
        {project.category ? (
          <Tag color="blue" size="sm">
            {project.category}
          </Tag>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            // TODO: open project menu
          }}
          className="text-gray-secondary hover:text-black p-1 rounded"
          aria-label="Project options"
        >
          <Icon name="Dot-Menu" size={15} />
        </button>
      </div>

      {/* Title + description */}
      <div className="flex items-center gap-[10px]">
        <span className="bg-primary-main text-white rounded-[6px] w-[28px] h-[28px] inline-flex items-center justify-center text-[14px] font-bold uppercase shrink-0">
          {project.name.charAt(0)}
        </span>
        <span className="text-black text-[20px] font-semibold truncate">{project.name}</span>
      </div>
      {project.description && (
        <p
          className="text-gray-main text-[12px] leading-snug line-clamp-2"
          style={{ fontFamily: 'Inter, ui-sans-serif, sans-serif' }}
        >
          {project.description}
        </p>
      )}

      {/* Progress bar + stats */}
      <div className="flex flex-col gap-[10px] mt-auto">
        <div className="bg-gray-progress h-[3px] rounded-full overflow-hidden w-full">
          <div className="bg-blue-med h-full" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between gap-3 text-[12px]">
          <Stat label="Progress" value={`${pct}%`} />
          <Stat label="Status" value={project.status.replace('_', ' ')} />
          <Stat
            label="Created"
            value={formatDueDate(project.created_at.slice(0, 10)) ?? '—'}
          />
        </div>
      </div>

      {/* Lead + members */}
      <div className="flex items-center justify-between border-t border-gray-border-light pt-3">
        <div className="flex items-center gap-2 min-w-0">
          {lead && (
            <>
              <UserGroup members={[userToMember(lead)]} size={15} />
              <span className="text-gray-main text-[11px] uppercase tracking-[1px]">Lead</span>
              <span className="text-gray-main">·</span>
              <span className="text-black text-[12px] font-medium truncate">
                {lead.nickname || `${lead.first_name} ${lead.last_name}`}
              </span>
            </>
          )}
        </div>
        {others.length > 0 && (
          <UserGroup members={others.map(userToMember)} size={15} max={5} />
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-[2px]">
      <span className="text-gray-main text-[10px] uppercase tracking-[1px]">{label}</span>
      <span
        className="text-black text-[14px] font-semibold capitalize"
        style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
      >
        {value}
      </span>
    </div>
  )
}
