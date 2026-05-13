import { useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import OrganizationAppShell from '../../../components/OrganizationAppShell'
import Button from '../../../components/ui/Button'
import Tag from '../../../components/ui/Tag'
import ProjectLabel from '../../../components/ui/ProjectLabel'
import UserGroup, { type Member } from '../../../components/ui/UserGroup'
import Icon from '../../../components/ui/Icon'
import {
  useCurrentUser,
  useMyOrg,
  useOrgMembers,
  useUserProjects,
} from '../../../lib/hooks'
import { userToMember } from '../../../lib/types'
import type { ProjectStatusDb } from '../../../lib/types'
import { usePinnedProjects } from '../../../lib/pinPref'

// ─── Health helpers ───────────────────────────────────────────────────────────

type Health = 'on-track' | 'at-risk' | 'delayed' | 'healthy'

const HEALTH_LABEL: Record<Health, string> = {
  'on-track': 'On track',
  'at-risk': 'At risk',
  delayed: 'Delayed',
  healthy: 'Healthy',
}

const HEALTH_COLOR: Record<Health, 'green' | 'amber' | 'red'> = {
  'on-track': 'green',
  'at-risk': 'amber',
  delayed: 'red',
  healthy: 'green',
}

function projectHealth(p: { status: ProjectStatusDb; nextDueDate: string | null }): Health {
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

// ─── Small building blocks ────────────────────────────────────────────────────

function SectionEyebrow({
  eyebrow,
  title,
  colorClass = 'text-red-main',
}: {
  eyebrow: string
  title: string
  colorClass?: string
}) {
  return (
    <div className="flex flex-col gap-[5px]">
      <p className={`text-[10px] font-medium uppercase tracking-[1.5px] ${colorClass}`}>
        {eyebrow}
      </p>
      <h2 className="text-black text-[20px] font-semibold leading-none">{title}</h2>
    </div>
  )
}

function MetricCard({
  eyebrow,
  eyebrowColor,
  value,
  hint,
}: {
  eyebrow: string
  eyebrowColor: string
  value: number | string
  hint: string
}) {
  return (
    <div className="flex-1 min-w-0 bg-white-white border border-gray-border-light rounded-[10px] px-[20px] py-[20px] flex flex-col gap-[3px]">
      <p
        className="text-[10px] font-medium uppercase tracking-[1.5px]"
        style={{ color: eyebrowColor }}
      >
        {eyebrow}
      </p>
      <p className="text-black text-[38px] font-semibold leading-none">{value}</p>
      <p className="text-gray-main text-[10px] leading-[1.5]">{hint}</p>
    </div>
  )
}

function FeatureCallout({
  eyebrow,
  title,
  body,
  ctaLabel,
  onCta,
}: {
  eyebrow: string
  title: string
  body: string
  ctaLabel: string
  onCta?: () => void
}) {
  return (
    <div
      className="flex-1 min-w-0 border border-gray-border-light rounded-[10px] px-[20px] py-[20px] flex flex-col gap-[8px] items-start"
      style={{
        backgroundImage:
          'linear-gradient(167deg, rgb(46, 67, 78) 0%, rgb(31, 47, 56) 100%)',
      }}
    >
      <p className="text-[10px] font-medium uppercase tracking-[1.5px] text-[#b8c5cf] w-full">
        {eyebrow}
      </p>
      <p className="text-white text-[14px] font-semibold leading-tight w-full line-clamp-2">
        {title}
      </p>
      <p className="text-[#b5c2cc] text-[10px] leading-[1.4] w-full line-clamp-2">
        {body}
      </p>
      <button
        type="button"
        onClick={onCta}
        className="mt-auto bg-white border border-gray-border-light rounded-[5px] px-[15px] py-[6px] text-black text-[11px]"
      >
        {ctaLabel}
      </button>
    </div>
  )
}

function ProjectMiniCard({
  name,
  color,
  description,
  members,
  progress,
  health,
  onOpen,
}: {
  name: string
  color?: string | null
  description: string
  members: Member[]
  progress: number
  health: Health
  onOpen?: () => void
}) {
  const pct = Math.max(0, Math.min(100, progress))
  const healthColor = HEALTH_COLOR[health]
  return (
    <button
      type="button"
      onClick={onOpen}
      className="bg-[#f8fafb] rounded-[10px] p-[15px] flex flex-col justify-between min-h-[115px] gap-[12px] text-left hover:bg-[#eef3f5] transition-colors"
    >
      {/* Top — name + description tight together. */}
      <div className="flex flex-col gap-[4px] w-full min-w-0">
        <div className="flex items-center justify-between gap-[10px]">
          <div className="flex items-center gap-[10px] min-w-0">
            <ProjectLabel name={name} color={color ?? 'blue'} size="md" />
            <span className="text-black text-[20px] font-semibold truncate">
              {name}
            </span>
          </div>
          <div className="flex items-center gap-[5px] shrink-0">
            <Tag color={healthColor} size="md">
              {HEALTH_LABEL[health]}
            </Tag>
            <Icon name="ArrowRight" size={15} />
          </div>
        </div>
        <p className="text-gray-main text-[10px] leading-[1.4] line-clamp-1 pl-[38px]">
          {description}
        </p>
      </div>
      {/* Bottom — avatars + progress bar + % */}
      <div className="flex items-center gap-[15px] w-full">
        {members.length > 0 && (
          <UserGroup members={members} size={15} max={5} overflowVariant="blue" />
        )}
        <div className="bg-gray-progress flex-1 h-[7px] rounded-full overflow-hidden">
          <div className="bg-blue-main h-full rounded-full" style={{ width: `${pct}%` }} />
        </div>
        <span
          className="text-black text-[13px] font-semibold tracking-[0.5px] shrink-0"
          style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
        >
          {pct}%
        </span>
      </div>
    </button>
  )
}

function MemberOverviewRow({
  label,
  count,
  avatars,
  caption,
  badge,
  badgeColor,
}: {
  label: string
  count: number
  avatars: Member[]
  caption: string
  badge?: string
  badgeColor?: 'green' | 'blue' | 'purple'
}) {
  return (
    <div className="bg-[#f8fafb] rounded-[8px] p-[10px] flex items-center justify-between gap-[10px]">
      <div className="flex items-center gap-[10px] min-w-0">
        {avatars.length > 0 ? (
          <UserGroup members={avatars} size={15} max={5} />
        ) : (
          <span className="w-[15px] h-[15px] rounded-full bg-gray-extra-light" />
        )}
        <span className="text-black text-[12px] font-semibold truncate">{label}</span>
      </div>
      <span
        className="text-gray-main text-[10px] font-semibold tracking-[1px] shrink-0"
        style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
      >
        {count} members
      </span>
      <span className="flex-1 text-gray-main text-[10px] truncate hidden md:block">
        {caption}
      </span>
      {badge && (
        <Tag color={badgeColor ?? 'green'} size="md" className="shrink-0">
          {badge}
        </Tag>
      )}
    </div>
  )
}

type Stage = {
  key: 'planned' | 'in_progress' | 'review' | 'done' | 'blocked'
  label: string
  bg: string
  textColor: string
  dot: string
  examples: string
}

const STAGES: Stage[] = [
  {
    key: 'planned',
    label: 'Planned',
    bg: '#e6ecef',
    textColor: '#455e6a',
    dot: '#455e6a',
    examples: 'Backlog, scoping, kickoff prep',
  },
  {
    key: 'in_progress',
    label: 'In Progress',
    bg: '#dde7f4',
    textColor: '#2d5a9e',
    dot: '#5b7fb6',
    examples: 'Active build, in-flight work',
  },
  {
    key: 'review',
    label: 'Review',
    bg: '#f4e6cd',
    textColor: '#8a5a1e',
    dot: '#8a5a1e',
    examples: 'PRs, design reviews, QA',
  },
  {
    key: 'done',
    label: 'Done',
    bg: '#dcebe0',
    textColor: '#2f6b45',
    dot: '#2f6b45',
    examples: 'Shipped, closed out',
  },
  {
    key: 'blocked',
    label: 'Blocked',
    bg: '#f2dede',
    textColor: '#9b3838',
    dot: '#9b3838',
    examples: 'Waiting on dependencies',
  },
]

function WorkByStage({ counts }: { counts: Record<Stage['key'], number> }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  return (
    <div className="bg-white-white border border-gray-border-light rounded-[10px] px-[20px] py-[15px] flex flex-col gap-[10px] w-[509px] max-w-[45%] shrink min-w-0 overflow-hidden">
      <SectionEyebrow
        eyebrow="Pipeline · total tasks"
        title="Work by stage"
        colorClass="text-[#8a5a1e]"
      />
      <div className="flex h-[35px] rounded-[8px] overflow-hidden shadow-[0px_2px_2px_0px_rgba(22,36,46,0.03)] w-full">
        {STAGES.map((s) => {
          const c = counts[s.key]
          const pct = total > 0 ? Math.round((c / total) * 100) : 0
          if (pct === 0) return null
          return (
            <div
              key={s.key}
              className="flex items-center justify-center text-[10px] font-semibold tracking-[1px]"
              style={{
                width: `${pct}%`,
                backgroundColor: s.bg,
                color: s.textColor,
                fontFamily: 'Geist Mono, ui-monospace, monospace',
              }}
            >
              {pct}%
            </div>
          )
        })}
      </div>
      <div className="flex flex-col gap-[12px]">
        {STAGES.map((s) => (
          <div key={s.key} className="flex items-center gap-[26px]">
            <div className="flex items-center gap-[10px] w-[88px] shrink-0">
              <span
                className="w-[7px] h-[7px] rounded-full"
                style={{ backgroundColor: s.dot }}
              />
              <span className="text-black text-[12px] font-semibold">{s.label}</span>
            </div>
            <span
              className="text-gray-main text-[10px] font-semibold tracking-[1px] shrink-0"
              style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
            >
              {counts[s.key]} tasks
            </span>
            <span className="text-gray-main text-[10px] truncate">{s.examples}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrgDashboardPage() {
  const router = useRouter()
  const orgId = router.query.orgId as string | undefined
  if (!orgId) return null

  return (
    <>
      <Head>
        <title>plinq · Organization</title>
      </Head>
      <OrganizationAppShell orgId={orgId} active="dashboard">
        <OrgDashboardBody orgId={orgId} />
      </OrganizationAppShell>
    </>
  )
}

function OrgDashboardBody({ orgId }: { orgId: string }) {
  const router = useRouter()
  const { data: user } = useCurrentUser()
  const userId = user?.id

  const { data: org } = useMyOrg(userId)
  const orgName = org?.name ?? 'Your organization'

  const { data: members = [] } = useOrgMembers(orgId)
  const { data: allProjects = [] } = useUserProjects(userId)
  const { pinned: pinnedProjectIds } = usePinnedProjects(orgId)

  // Quarter picker — initialized to today's quarter; user can rewind a
  // couple of years if they want a historical view.
  const today = useMemo(() => new Date(), [])
  const currentYear = today.getFullYear()
  const currentQuarter: Quarter = (`Q${Math.floor(today.getMonth() / 3) + 1}` as Quarter)
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [selectedQuarter, setSelectedQuarter] = useState<Quarter>(currentQuarter)

  // Projects whose next-due date sits inside the selected quarter. If a
  // project has no due date yet we fall back to "include only when the
  // selected quarter is the current one" so the dashboard isn't blank for
  // an org that has only just-started projects.
  const quarterProjects = useMemo(() => {
    const qIndex = QUARTERS.indexOf(selectedQuarter)
    const start = new Date(selectedYear, qIndex * 3, 1).getTime()
    const end = new Date(selectedYear, qIndex * 3 + 3, 0, 23, 59, 59, 999).getTime()
    const isCurrent =
      selectedYear === currentYear && selectedQuarter === currentQuarter
    return allProjects.filter((p) => {
      if (p.nextDueDate) {
        const t = new Date(p.nextDueDate).getTime()
        return t >= start && t <= end
      }
      return isCurrent
    })
  }, [allProjects, selectedYear, selectedQuarter, currentYear, currentQuarter])

  const activeProjects = useMemo(
    () =>
      quarterProjects.filter((p) =>
        (['planned', 'in_progress', 'review'] as ProjectStatusDb[]).includes(p.status)
      ),
    [quarterProjects]
  )

  const onTrackCount = useMemo(
    () => activeProjects.filter((p) => projectHealth(p) === 'on-track').length,
    [activeProjects]
  )
  const atRiskCount = useMemo(() => {
    let n = 0
    for (const p of activeProjects) {
      const h = projectHealth(p)
      if (h === 'at-risk' || h === 'delayed') n++
    }
    return n
  }, [activeProjects])
  const plannedCount = useMemo(
    () => quarterProjects.filter((p) => p.status === 'planned').length,
    [quarterProjects]
  )

  const stageCounts = useMemo<Record<Stage['key'], number>>(() => {
    const acc: Record<Stage['key'], number> = {
      planned: 0,
      in_progress: 0,
      review: 0,
      done: 0,
      blocked: 0,
    }
    for (const p of quarterProjects) {
      acc[p.status] += p.tasksTotal
    }
    return acc
  }, [quarterProjects])

  const leadIds = useMemo(() => {
    const s = new Set<string>()
    for (const p of quarterProjects) if (p.lead_id) s.add(p.lead_id)
    return s
  }, [quarterProjects])
  const contributorIds = useMemo(() => {
    const s = new Set<string>()
    for (const p of quarterProjects) for (const m of p.members) s.add(m.id)
    for (const id of leadIds) s.delete(id)
    return s
  }, [quarterProjects, leadIds])

  const leadAvatars = useMemo(
    () => members.filter((m) => leadIds.has(m.id)).slice(0, 5).map(userToMember),
    [members, leadIds]
  )
  const contributorAvatars = useMemo(
    () =>
      members.filter((m) => contributorIds.has(m.id)).slice(0, 5).map(userToMember),
    [members, contributorIds]
  )
  const allMemberAvatars = useMemo(
    () => members.slice(0, 5).map(userToMember),
    [members]
  )

  return (
    <div className="flex-1 min-h-0 p-6 flex flex-col gap-[10px] overflow-hidden">
      {/* TITLE ROW */}
      <div className="shrink-0 flex items-end justify-between gap-[10px]">
        <div className="flex flex-col gap-[5px]">
          <p className="text-red-main text-[10px] font-medium uppercase tracking-[1.5px]">
            {orgName} · {selectedQuarter} {selectedYear}
          </p>
          <h1 className="text-black text-[35px] font-semibold leading-tight">
            {members.length} people, {quarterProjects.length} projects,{' '}
            <em
              className="italic font-semibold text-gray-main"
              style={{ fontFamily: 'Inter, ui-sans-serif, sans-serif' }}
            >
              one direction.
            </em>
          </h1>
        </div>
        <QuarterPicker
          year={selectedYear}
          quarter={selectedQuarter}
          years={[currentYear - 2, currentYear - 1, currentYear]}
          onChange={({ year, quarter }) => {
            setSelectedYear(year)
            setSelectedQuarter(quarter)
          }}
        />
      </div>

      {/* STATS ROW */}
      <div className="shrink-0 flex gap-[10px]">
        <MetricCard
          eyebrow="Total projects"
          eyebrowColor="#2d5a9e"
          value={quarterProjects.length}
          hint={`+${quarterProjects.length} this quarter`}
        />
        <MetricCard
          eyebrow="On track"
          eyebrowColor="#2f6b45"
          value={onTrackCount}
          hint={
            activeProjects.length > 0
              ? `${Math.round((onTrackCount / activeProjects.length) * 100)}% of active projects`
              : 'No active projects'
          }
        />
        <MetricCard
          eyebrow="At risk / delayed"
          eyebrowColor="#9b3838"
          value={atRiskCount}
          hint={`${atRiskCount} need attention`}
        />
        <MetricCard
          eyebrow="Planned work"
          eyebrowColor="#b68a48"
          value={plannedCount}
          hint={`${plannedCount} projects in pipeline`}
        />
        <FeatureCallout
          eyebrow="This week"
          title={
            atRiskCount > 0
              ? `${atRiskCount} critical project${atRiskCount === 1 ? '' : 's'} need attention.`
              : 'All projects look healthy.'
          }
          body="Review at-risk and delayed projects before the next sync."
          ctaLabel="View brief"
          onCta={() => router.push(`/o/${orgId}/projects`)}
        />
      </div>

      {/* ACTIVE PROJECTS — the Portfolio is the centerpiece, so it gets
          the heavier share of the leftover space. The bottom strip clips
          overflowing rows rather than scrolls. */}
      <section className="flex-[1.6] min-h-0 bg-white-white border border-gray-border-light rounded-[10px] px-[20px] py-[15px] flex flex-col gap-[10px] overflow-hidden">
        <div className="shrink-0 flex items-center justify-between">
          <SectionEyebrow eyebrow="Portfolio" title="Active projects" />
          <div className="flex items-center gap-[10px]">
            <Tag color="gray" size="md" icon="Pin">
              {`${pinnedProjectIds.size} pinned`}
            </Tag>
            <Tag color="red" size="md">
              {`${atRiskCount} delayed`}
            </Tag>
            <Button
              size="mini"
              variant="subtle"
              iconRight="ArrowRight"
              onClick={() => router.push(`/o/${orgId}/projects`)}
            >
              {`View all ${quarterProjects.length}`}
            </Button>
          </div>
        </div>
        {activeProjects.length === 0 ? (
          <p className="text-gray-secondary text-[12px]">
            No active projects this quarter.
          </p>
        ) : (
          <div className="flex-1 min-h-0 grid grid-cols-3 grid-rows-2 gap-[10px] overflow-hidden">
            {activeProjects.slice(0, 6).map((p) => (
              <ProjectMiniCard
                key={p.id}
                name={p.name}
                color={p.color}
                description={p.description ?? '—'}
                members={p.members.map(userToMember)}
                progress={p.progressPct ?? 0}
                health={projectHealth(p)}
                onOpen={() => router.push(`/p/${p.id}/dashboard`)}
              />
            ))}
          </div>
        )}
      </section>

      {/* BOTTOM ROW — slimmer strip beneath the Portfolio; clips overflow
          rather than scrolls. */}
      <div className="flex-1 min-h-0 flex gap-[10px]">
        <section className="flex-1 min-w-0 bg-white-white border border-gray-border-light rounded-[10px] px-[20px] py-[15px] flex flex-col gap-[10px] overflow-hidden">
          <div className="flex items-center justify-between">
            <SectionEyebrow
              eyebrow="Members"
              title="Member Overview"
              colorClass="text-[#2f6b45]"
            />
            <Button
              size="mini"
              variant="subtle"
              iconRight="ArrowRight"
              onClick={() => router.push(`/o/${orgId}/members`)}
            >
              {`View all ${members.length}`}
            </Button>
          </div>
          <MemberOverviewRow
            label="Project Leads"
            count={leadIds.size}
            avatars={leadAvatars}
            caption={`Leading ${allProjects.length} projects`}
            badge="On track"
            badgeColor="green"
          />
          <MemberOverviewRow
            label="Active Contributors"
            count={contributorIds.size}
            avatars={contributorAvatars}
            caption={`Across ${activeProjects.length} active projects`}
            badge="On track"
            badgeColor="blue"
          />
          <MemberOverviewRow
            label="New members"
            count={members.length}
            avatars={allMemberAvatars}
            caption={`Recently added to ${orgName}`}
            badge="Healthy"
            badgeColor="purple"
          />
        </section>

        <WorkByStage counts={stageCounts} />
      </div>
    </div>
  )
}
