import { useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import OrganizationAppShell, { useCreateNew } from '../../../components/OrganizationAppShell'
import Button from '../../../components/ui/Button'
import Tag from '../../../components/ui/Tag'
import ProjectLabel from '../../../components/ui/ProjectLabel'
import UserGroup from '../../../components/ui/UserGroup'
import Icon from '../../../components/ui/Icon'
import FilterChecklist from '../../../components/ui/FilterChecklist'
import Table, {
  TableHeader,
  TableRow,
  TableCell,
  type Column,
} from '../../../components/ui/Table'
import {
  useCurrentUser,
  useDeleteProject,
  useMyOrg,
  useOrgMembers,
  useOrgProjects,
} from '../../../lib/hooks'
import { usePinnedProjects } from '../../../lib/pinPref'
import { userToMember, type ProjectStatusDb } from '../../../lib/types'
import type { ProjectWithStats } from '../../../lib/queries'
import DeleteConfirmModal from '../../../components/DeleteConfirmModal'

type Health = 'on-track' | 'at-risk' | 'delayed' | 'healthy'

function projectHealth(p: {
  status: ProjectStatusDb
  nextDueDate: string | null
}): Health {
  if (p.status === 'blocked') return 'delayed'
  if (p.nextDueDate) {
    const due = new Date(p.nextDueDate).getTime()
    const now = Date.now()
    if (due < now) return 'delayed'
    if (due - now < 7 * 24 * 60 * 60 * 1000) return 'at-risk'
  }
  if (p.status === 'done') return 'healthy'
  return 'on-track'
}

// ─── Quarter picker ──────────────────────────────────────────────────────────

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'] as const
type Quarter = (typeof QUARTERS)[number]

function QuarterPicker({
  year,
  quarter,
  years,
  onChange,
}: {
  year: number
  quarter: Quarter
  years: number[]
  onChange: (next: { year: number; quarter: Quarter }) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="h-[32px] px-[12px] inline-flex items-center gap-[6px] rounded-[5px] border border-solid border-gray-border-light bg-white-white hover:bg-white-item text-black text-[12px]"
      >
        <span>
          {quarter} {year}
        </span>
        <Icon name="ArrowRight" size={13} />
      </button>
      {open && (
        <div className="absolute right-0 top-[36px] z-20 w-[200px] bg-white-white border border-gray-border-light rounded-[8px] shadow-[0_8px_24px_rgba(22,36,46,0.12)] overflow-hidden">
          <ul className="flex flex-col py-[5px]">
            {years.map((y) => {
              const active = y === year
              return (
                <li key={y}>
                  <button
                    type="button"
                    onClick={() => onChange({ year: y, quarter })}
                    className={`w-full px-[15px] py-[6px] text-left text-[12px] hover:bg-white-item ${
                      active ? 'text-black font-semibold' : 'text-gray-main'
                    }`}
                  >
                    {y}
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="border-t border-solid border-gray-border-light grid grid-cols-4 p-[5px] gap-[3px]">
            {QUARTERS.map((q) => {
              const active = q === quarter
              return (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    onChange({ year, quarter: q })
                    setOpen(false)
                  }}
                  className={`py-[6px] text-[12px] rounded-[5px] ${
                    active
                      ? 'bg-white-item text-black font-semibold'
                      : 'text-gray-main hover:bg-white-item'
                  }`}
                >
                  {q}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Status filter ───────────────────────────────────────────────────────────

type FilterKey = 'active' | 'on-track' | 'at-risk' | 'blocked' | 'planned'

const FILTER_OPTIONS: { key: FilterKey; label: string; color: string }[] = [
  { key: 'active', label: 'Active', color: '#2D5A9E' },
  { key: 'on-track', label: 'On track', color: '#2F6B45' },
  { key: 'at-risk', label: 'At risk', color: '#B68A48' },
  { key: 'blocked', label: 'Blocked', color: '#9B3838' },
  { key: 'planned', label: 'Planned', color: '#455E6A' },
]

/** Each project falls into exactly one of the 5 filter categories — same
 *  precedence as the Health column tag (Blocked → At risk → Planned →
 *  Active → On track). Using the single-category logic for both the
 *  filter counts AND the filtering predicate guarantees that the sum of
 *  filter-row counts equals the total project count, so the numbers on
 *  the dropdown line up with what's shown in the title / table. */
function matchFilter(p: ProjectWithStats, key: FilterKey): boolean {
  return projectCategory(p) === key
}

/** Single category to display in the Health column — the most informative
 *  filter label for the project. Precedence: Blocked → At risk → Planned
 *  → Active (in-progress) → On track (review/done/healthy). */
function projectCategory(p: ProjectWithStats): FilterKey {
  if (p.status === 'blocked') return 'blocked'
  const h = projectHealth(p)
  if (h === 'at-risk' || h === 'delayed') return 'at-risk'
  if (p.status === 'planned') return 'planned'
  if (p.status === 'in_progress') return 'active'
  return 'on-track'
}

const CATEGORY_LABEL: Record<FilterKey, string> = {
  active: 'Active',
  'on-track': 'On track',
  'at-risk': 'At risk',
  blocked: 'Blocked',
  planned: 'Planned',
}

const CATEGORY_TAG_COLOR: Record<
  FilterKey,
  'blue' | 'green' | 'amber' | 'red' | 'gray'
> = {
  active: 'blue',
  'on-track': 'green',
  'at-risk': 'amber',
  blocked: 'red',
  planned: 'gray',
}

const CATEGORY_BAR_COLOR: Record<FilterKey, string> = {
  active: '#2D5A9E',
  'on-track': '#2F6B45',
  'at-risk': '#B68A48',
  blocked: '#9B3838',
  planned: '#455E6A',
}

function StatusFilter({
  projects,
  selected,
  onToggle,
  onToggleAll,
}: {
  projects: ProjectWithStats[]
  selected: Set<FilterKey>
  onToggle: (key: FilterKey) => void
  onToggleAll: (next: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const counts = useMemo(() => {
    const m = new Map<FilterKey, number>()
    for (const opt of FILTER_OPTIONS) {
      m.set(opt.key, projects.filter((p) => matchFilter(p, opt.key)).length)
    }
    return m
  }, [projects])

  const allOn = selected.size === FILTER_OPTIONS.length
  const label =
    allOn || selected.size === 0 ? 'Filter' : `Filter · ${selected.size}`

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
            count={projects.length}
            color="#16242E"
            checked={allOn}
            onChange={(next) => onToggleAll(next)}
          />
          <div className="border-t border-solid border-gray-border-light my-[3px]" />
          {FILTER_OPTIONS.map((opt) => (
            <FilterChecklist
              key={opt.key}
              label={opt.label}
              count={counts.get(opt.key) ?? 0}
              color={opt.color}
              checked={selected.has(opt.key)}
              onChange={() => onToggle(opt.key)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Stat card ───────────────────────────────────────────────────────────────

const COLS: Column[] = [
  { key: 'project', label: 'Project', width: 'flex-[2]' },
  { key: 'lead', label: 'Lead', width: 'flex-1' },
  { key: 'health', label: 'Health', width: 'w-[120px]' },
  { key: 'progress', label: 'Progress', width: 'flex-1' },
  { key: 'due', label: 'Due', width: 'w-[100px]' },
  { key: 'more', label: '', width: 'w-[30px]' },
]

function StatCard({
  eyebrow,
  eyebrowColor,
  value,
  pillDotColor,
  pillText,
  pillBg,
  pillTextColor,
}: {
  eyebrow: string
  eyebrowColor: string
  value: number | string
  pillDotColor: string
  pillText: string
  pillBg: string
  pillTextColor: string
}) {
  return (
    <div className="flex-1 min-w-0 bg-white-white border border-gray-border-light rounded-[10px] px-[15px] py-[15px] flex items-end justify-between gap-[10px]">
      <div className="flex flex-col gap-[5px] min-w-0">
        <p
          className="text-[10px] font-medium uppercase tracking-[1.5px] truncate"
          style={{ color: eyebrowColor }}
        >
          {eyebrow}
        </p>
        <p
          className="text-black text-[28px] font-semibold leading-none"
          style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
        >
          {value}
        </p>
      </div>
      <span
        className="shrink-0 inline-flex items-center gap-[5px] rounded-[2px] px-[8px] py-[3px]"
        style={{ backgroundColor: pillBg }}
      >
        <span
          className="w-[6px] h-[6px] rounded-full shrink-0"
          style={{ backgroundColor: pillDotColor }}
        />
        <span
          className="text-[10px] font-medium whitespace-nowrap"
          style={{ color: pillTextColor }}
        >
          {pillText}
        </span>
      </span>
    </div>
  )
}

function formatDue(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sept',
    'Oct',
    'Nov',
    'Dec',
  ]
  return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}`
}

export default function OrgProjectsPage() {
  const router = useRouter()
  const orgId = router.query.orgId as string | undefined
  if (!orgId) return null
  return (
    <>
      <Head>
        <title>plinq · Organization · Projects</title>
      </Head>
      <OrganizationAppShell orgId={orgId} active="projects">
        <OrgProjectsBody orgId={orgId} />
      </OrganizationAppShell>
    </>
  )
}

function OrgProjectsBody({ orgId }: { orgId: string }) {
  const router = useRouter()
  const { open } = useCreateNew()
  const { data: user } = useCurrentUser()
  const { data: org } = useMyOrg(user?.id)
  const orgName = org?.name ?? 'Organization'
  const { data: members = [] } = useOrgMembers(orgId)
  const { data: allProjects = [] } = useOrgProjects(orgId)
  const { isPinned } = usePinnedProjects(orgId)
  const deleteProject = useDeleteProject()
  const [deleting, setDeleting] = useState<ProjectWithStats | null>(null)

  // Quarter picker — initialized to today's quarter.
  const today = useMemo(() => new Date(), [])
  const currentYear = today.getFullYear()
  const currentQuarter: Quarter = (`Q${Math.floor(today.getMonth() / 3) + 1}` as Quarter)
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [selectedQuarter, setSelectedQuarter] = useState<Quarter>(currentQuarter)

  // Category filter — all selected by default.
  const [statusFilter, setStatusFilter] = useState<Set<FilterKey>>(
    () => new Set(FILTER_OPTIONS.map((opt) => opt.key))
  )
  const toggleFilter = (key: FilterKey) => {
    setStatusFilter((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  const toggleAllFilters = (next: boolean) => {
    setStatusFilter(next ? new Set(FILTER_OPTIONS.map((o) => o.key)) : new Set())
  }

  // Quarter scope — by `dueDate` (latest task due date = project end).
  // Projects without any dated tasks are not surfaced; they need at least
  // one task with a due date to be placed on the calendar.
  const quarterScoped = useMemo(() => {
    const qIndex = QUARTERS.indexOf(selectedQuarter)
    const start = new Date(selectedYear, qIndex * 3, 1).getTime()
    const end = new Date(selectedYear, qIndex * 3 + 3, 0, 23, 59, 59, 999).getTime()
    return allProjects.filter((p) => {
      if (!p.dueDate) return false
      const t = new Date(p.dueDate).getTime()
      return t >= start && t <= end
    })
  }, [allProjects, selectedYear, selectedQuarter])

  const filteredProjects = useMemo(() => {
    if (statusFilter.size === 0 || statusFilter.size === FILTER_OPTIONS.length) {
      return quarterScoped
    }
    return quarterScoped.filter((p) =>
      Array.from(statusFilter).some((k) => matchFilter(p, k))
    )
  }, [quarterScoped, statusFilter])

  const sortedProjects = useMemo(() => {
    return [...filteredProjects].sort((a, b) => {
      const ap = isPinned(a.id) ? 1 : 0
      const bp = isPinned(b.id) ? 1 : 0
      if (ap !== bp) return bp - ap
      return 0
    })
  }, [filteredProjects, isPinned])

  const counts = useMemo(() => {
    let active = 0
    let onTrack = 0
    let atRisk = 0
    let blocked = 0
    let planned = 0
    for (const p of quarterScoped) {
      if (matchFilter(p, 'active')) active++
      if (matchFilter(p, 'on-track')) onTrack++
      if (matchFilter(p, 'at-risk')) atRisk++
      if (matchFilter(p, 'blocked')) blocked++
      if (matchFilter(p, 'planned')) planned++
    }
    return { active, onTrack, atRisk, blocked, planned }
  }, [quarterScoped])

  const memberById = useMemo(() => {
    const map = new Map<string, (typeof members)[number]>()
    for (const m of members) map.set(m.id, m)
    return map
  }, [members])

  return (
    <div className="flex-1 min-h-0 p-6 flex flex-col gap-[10px] overflow-hidden">
      {/* TITLE ROW */}
      <div className="shrink-0 flex items-end justify-between gap-[10px]">
        <div className="flex flex-col gap-[5px]">
          <p className="text-[#8a5a1e] text-[10px] font-medium uppercase tracking-[1.5px]">
            {orgName} · {selectedQuarter} {selectedYear}
          </p>
          <h1 className="text-black text-[35px] font-semibold leading-tight">
            {quarterScoped.length} projects{' '}
            <em
              className="italic font-semibold text-gray-main"
              style={{ fontFamily: 'Inter, ui-sans-serif, sans-serif' }}
            >
              underway.
            </em>
          </h1>
        </div>
        <div className="flex items-center gap-[10px]">
          <QuarterPicker
            year={selectedYear}
            quarter={selectedQuarter}
            years={[currentYear - 1, currentYear, currentYear + 1]}
            onChange={({ year, quarter }) => {
              setSelectedYear(year)
              setSelectedQuarter(quarter)
            }}
          />
          <StatusFilter
            projects={quarterScoped}
            selected={statusFilter}
            onToggle={toggleFilter}
            onToggleAll={toggleAllFilters}
          />
          <Button size="compact" iconLeft="Add" onClick={() => open('project')}>
            New project
          </Button>
        </div>
      </div>

      {/* STATS ROW — 5 cards */}
      <div className="shrink-0 flex gap-[10px]">
        <StatCard
          eyebrow="Active"
          eyebrowColor="#2D5A9E"
          value={counts.active}
          pillBg="#DDE7F4"
          pillDotColor="#2D5A9E"
          pillText={`+${counts.active > 0 ? Math.min(4, counts.active) : 0} this quarter`}
          pillTextColor="#2D5A9E"
        />
        <StatCard
          eyebrow="On track"
          eyebrowColor="#2F6B45"
          value={counts.onTrack}
          pillBg="#DCEBE0"
          pillDotColor="#2F6B45"
          pillText={
            counts.active > 0
              ? `${Math.round((counts.onTrack / counts.active) * 100)}% of portfolio`
              : '—'
          }
          pillTextColor="#2F6B45"
        />
        <StatCard
          eyebrow="At risk"
          eyebrowColor="#B68A48"
          value={counts.atRisk}
          pillBg="#F4E6CD"
          pillDotColor="#B68A48"
          pillText={`+${counts.atRisk} since last week`}
          pillTextColor="#8A5A1E"
        />
        <StatCard
          eyebrow="Blocked"
          eyebrowColor="#9B3838"
          value={counts.blocked}
          pillBg="#F2DEDE"
          pillDotColor="#9B3838"
          pillText={`${counts.blocked} awaiting`}
          pillTextColor="#9B3838"
        />
        <StatCard
          eyebrow="Planned"
          eyebrowColor="#455E6A"
          value={counts.planned}
          pillBg="#E6ECEF"
          pillDotColor="#455E6A"
          pillText="kicking off in Q3"
          pillTextColor="#455E6A"
        />
      </div>

      {/* TABLE — hugs content when short, scrolls internally when overflowing */}
      <Table className="min-h-0 flex flex-col overflow-hidden">
        <TableHeader className="shrink-0" columns={COLS} />
        <div className="min-h-0 overflow-y-auto">
          {sortedProjects.length === 0 ? (
            <div className="px-[25px] py-[20px] text-gray-secondary text-[12px]">
              {allProjects.length === 0
                ? 'No projects yet.'
                : 'No projects match the filter.'}
            </div>
          ) : (
            sortedProjects.map((p, i) => {
              const cat = projectCategory(p)
              const pct = Math.max(0, Math.min(100, p.progressPct ?? 0))
              const lead = p.lead_id ? memberById.get(p.lead_id) : null
              const pinned = isPinned(p.id)
              return (
                <TableRow
                  key={p.id}
                  isLast={i === sortedProjects.length - 1}
                  onClick={() => router.push(`/p/${p.id}/dashboard`)}
                >
                  <TableCell width="flex-[2]">
                    <ProjectLabel name={p.name} color={p.color ?? 'blue'} size="sm" />
                    <span className="text-black text-[14px] font-semibold truncate">
                      {p.name}
                    </span>
                    {pinned && (
                      <Icon name="Pin" size={12} className="text-gray-main shrink-0" />
                    )}
                  </TableCell>
                  <TableCell width="flex-1">
                    {lead ? (
                      <>
                        <UserGroup members={[userToMember(lead)]} size={20} />
                        <span className="text-black text-[12px] truncate">
                          {lead.nickname ||
                            `${lead.first_name} ${lead.last_name}`.trim()}
                        </span>
                      </>
                    ) : (
                      <span className="text-gray-secondary text-[12px]">—</span>
                    )}
                  </TableCell>
                  <TableCell width="w-[120px]">
                    <Tag color={CATEGORY_TAG_COLOR[cat]} size="md">
                      {CATEGORY_LABEL[cat]}
                    </Tag>
                  </TableCell>
                  <TableCell width="flex-1">
                    <span className="flex-1 h-[6px] bg-gray-extra-light rounded-full overflow-hidden">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: CATEGORY_BAR_COLOR[cat] }}
                      />
                    </span>
                    <span
                      className="text-black text-[12px] font-semibold shrink-0 w-[34px] text-right"
                      style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
                    >
                      {pct}%
                    </span>
                  </TableCell>
                  <TableCell width="w-[100px]">
                    <span
                      className="text-gray-main text-[12px]"
                      style={{ fontFamily: 'Wanted Sans, ui-sans-serif, sans-serif' }}
                    >
                      {formatDue(p.dueDate)}
                    </span>
                  </TableCell>
                  <TableCell width="w-[30px]" align="right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleting(p)
                      }}
                      className="text-red-main hover:bg-red-50 inline-flex items-center justify-center w-[24px] h-[24px] rounded transition-colors"
                      aria-label="Delete project"
                    >
                      <Icon name="Trash" size={15} />
                    </button>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </div>
      </Table>

      <DeleteConfirmModal
        open={deleting !== null}
        type="project"
        title="Delete this project?"
        body={
          <>
            This action is <strong className="font-bold">permanent</strong>. The
            project will be removed for everyone in the workspace.
          </>
        }
        subject={
          deleting && (
            <div className="flex items-center gap-[10px] min-w-0">
              <ProjectLabel
                name={deleting.name}
                color={deleting.color ?? 'blue'}
                size="md"
              />
              <div className="flex flex-col gap-[3px] min-w-0">
                <p className="text-black text-[12px] font-semibold truncate">
                  {deleting.name}
                </p>
                <p className="text-gray-main text-[8px] truncate">
                  {deleting.members.length} member
                  {deleting.members.length === 1 ? '' : 's'} ·{' '}
                  {deleting.tasksTotal} task
                  {deleting.tasksTotal === 1 ? '' : 's'}
                  {deleting.dueDate ? ` · due ${formatDue(deleting.dueDate)}` : ''}
                </p>
              </div>
            </div>
          )
        }
        consequences={
          deleting
            ? [
                `All ${deleting.tasksTotal} task${
                  deleting.tasksTotal === 1 ? '' : 's'
                }, meeting transcripts, recordings, and AI summaries will be deleted`,
                'All files from the knowledge base will be deleted',
                `Notifies all ${deleting.members.length} member${
                  deleting.members.length === 1 ? '' : 's'
                } · they will see the project removed from their end immediately`,
              ]
            : []
        }
        confirmLabel="Delete project"
        submitting={deleteProject.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return
          deleteProject.mutate(deleting.id, {
            onSuccess: () => setDeleting(null),
          })
        }}
      />
    </div>
  )
}
