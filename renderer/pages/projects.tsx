import { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import PersonalAppShell, { useCreateNew } from '../components/PersonalAppShell'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import ProjectListCard from '../components/ui/ProjectListCard'
import {
  getCurrentUser,
  getUserProjects,
  type ProjectWithStats,
} from '../lib/queries'
import { dbStatusToUi, formatDueDate, userToMember, type UserRow } from '../lib/types'

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

function ProjectsPageBody() {
  const router = useRouter()
  const createNew = useCreateNew()
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
        p.description?.toLowerCase().includes(q)
    )
  }, [projects, search])

  return (
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
          <Button size="compact" iconLeft="Add" onClick={() => createNew.open('project')}>
            New project
          </Button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
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
              <ProjectListCard
                key={p.id}
                name={p.name}
                description={p.description ?? undefined}
                status={dbStatusToUi(p.status)}
                progress={p.progressPct ?? 0}
                tasksDone={p.tasksDone}
                tasksTotal={p.tasksTotal}
                due={formatDueDate(p.nextDueDate)}
                lead={lead ? userToMember(lead) : undefined}
                members={others.map(userToMember)}
                onOpen={() => router.push(`/projects/${p.id}`)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
