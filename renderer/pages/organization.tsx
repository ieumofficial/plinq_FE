import { useMemo } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import PersonalAppShell from '../components/PersonalAppShell'
import Button from '../components/ui/Button'
import Tag from '../components/ui/Tag'
import ProjectLabel from '../components/ui/ProjectLabel'
import UserGroup, { type Member } from '../components/ui/UserGroup'
import Icon from '../components/ui/Icon'
import {
  useCurrentUser,
  useMyOrg,
  useOrgMembers,
  useUserProjects,
} from '../lib/hooks'
import { userToMember } from '../lib/types'
import type { ProjectStatusDb } from '../lib/types'

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

/** Rough health derivation from status + due date. */
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
      <p
        className={`text-[10px] font-medium uppercase tracking-[1.5px] ${colorClass}`}
      >
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
    <div className="flex-1 min-w-0 bg-white-white border border-gray-border-light rounded-[10px] px-[20px] py-[15px] flex flex-col gap-[5px]">
      <p
        className="text-[10px] font-medium uppercase tracking-[1.5px]"
        style={{ color: eyebrowColor }}
      >
        {eyebrow}
      </p>
      <p className="text-black text-[35px] font-semibold leading-none">{value}</p>
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
      className="flex-1 min-w-0 border border-gray-border-light rounded-[10px] px-[20px] py-[15px] flex flex-col gap-[9px] items-start"
      style={{
        backgroundImage:
          'linear-gradient(167deg, rgb(46, 67, 78) 0%, rgb(31, 47, 56) 100%)',
      }}
    >
      <p className="text-[10px] font-medium uppercase tracking-[1.5px] text-[#b8c5cf] w-full">
        {eyebrow}
      </p>
      <p className="text-white text-[20px] font-semibold leading-tight w-full">
        {title}
      </p>
      <p className="text-[#b5c2cc] text-[10px] leading-[1.5] w-full">{body}</p>
      <button
        type="button"
        onClick={onCta}
        className="bg-white border border-gray-border-light rounded-[5px] px-[25px] py-[10px] text-black text-[12px]"
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
}: {
  name: string
  color?: string | null
  description: string
  members: Member[]
  /** 0–100 */
  progress: number
  health: Health
}) {
  const pct = Math.max(0, Math.min(100, progress))
  const healthColor = HEALTH_COLOR[health]
  return (
    <div className="bg-[#f8fafb] rounded-[10px] p-[15px] flex flex-col justify-between min-h-[115px] gap-[10px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[10px] min-w-0">
          <ProjectLabel name={name} color={color ?? 'blue'} size="md" />
          <span className="text-black text-[20px] font-semibold truncate">{name}</span>
        </div>
        <div className="flex items-center gap-[5px] shrink-0">
          <Tag color={healthColor} size="md">
            {HEALTH_LABEL[health]}
          </Tag>
          <Icon name="Pin" size={12} />
        </div>
      </div>
      <p className="text-gray-main text-[10px] leading-[1.5] line-clamp-1">{description}</p>
      <div className="flex items-center gap-[15px]">
        {members.length > 0 && (
          <UserGroup members={members} size={15} max={5} overflowVariant="blue" />
        )}
        <div className="bg-gray-progress flex-1 h-[4px] rounded-full overflow-hidden">
          <div className="bg-blue-main h-full rounded-full" style={{ width: `${pct}%` }} />
        </div>
        <span
          className="text-black text-[10px] font-semibold tracking-[1px]"
          style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
        >
          {pct}%
        </span>
      </div>
    </div>
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
    examples: 'Apollo migration, onboarding flow, pricing audit',
  },
  {
    key: 'in_progress',
    label: 'In Progress',
    bg: '#dde7f4',
    textColor: '#2d5a9e',
    dot: '#5b7fb6',
    examples: 'Apollo migration, onboarding flow, pricing audit',
  },
  {
    key: 'review',
    label: 'Review',
    bg: '#f4e6cd',
    textColor: '#8a5a1e',
    dot: '#8a5a1e',
    examples: 'Apollo migration, onboarding flow, pricing audit',
  },
  {
    key: 'done',
    label: 'Done',
    bg: '#dcebe0',
    textColor: '#2f6b45',
    dot: '#2f6b45',
    examples: 'Apollo migration, onboarding flow, pricing audit',
  },
  {
    key: 'blocked',
    label: 'Blocked',
    bg: '#f2dede',
    textColor: '#9b3838',
    dot: '#9b3838',
    examples: 'Apollo migration, onboarding flow, pricing audit',
  },
]

function WorkByStage({ counts }: { counts: Record<Stage['key'], number> }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  return (
    <div className="bg-white-white border border-gray-border-light rounded-[10px] px-[20px] py-[15px] flex flex-col gap-[10px] w-[509px] shrink-0">
      <SectionEyebrow
        eyebrow="Pipeline · total tasks"
        title="Work by stage"
        colorClass="text-[#8a5a1e]"
      />
      {/* Stacked bar */}
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
      {/* Legend */}
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

export default function OrganizationPage() {
  const router = useRouter()
  const { data: user } = useCurrentUser()
  const userId = user?.id

  const { data: org } = useMyOrg(userId)
  const orgId = org?.id ?? null
  const orgName = org?.name ?? 'Your organization'

  const { data: members = [] } = useOrgMembers(orgId)
  const { data: allProjects = [] } = useUserProjects(userId)

  const activeProjects = useMemo(
    () =>
      allProjects.filter((p) =>
        (['planned', 'in_progress', 'review'] as ProjectStatusDb[]).includes(p.status)
      ),
    [allProjects]
  )

  const onTrackCount = useMemo(
    () =>
      activeProjects.filter((p) => projectHealth(p) === 'on-track').length,
    [activeProjects]
  )
  const atRiskCount = useMemo(
    () => {
      let n = 0
      for (const p of activeProjects) {
        const h = projectHealth(p)
        if (h === 'at-risk' || h === 'delayed') n++
      }
      return n
    },
    [activeProjects]
  )
  const plannedCount = useMemo(
    () => allProjects.filter((p) => p.status === 'planned').length,
    [allProjects]
  )

  const stageCounts = useMemo<Record<Stage['key'], number>>(() => {
    const acc: Record<Stage['key'], number> = {
      planned: 0,
      in_progress: 0,
      review: 0,
      done: 0,
      blocked: 0,
    }
    for (const p of allProjects) {
      // approximate: count tasks remaining vs done using project status
      acc[p.status] += p.tasksTotal
    }
    return acc
  }, [allProjects])

  // Member overview groupings.
  const leadIds = useMemo(() => {
    const s = new Set<string>()
    for (const p of allProjects) if (p.lead_id) s.add(p.lead_id)
    return s
  }, [allProjects])
  const contributorIds = useMemo(() => {
    const s = new Set<string>()
    for (const p of allProjects) for (const m of p.members) s.add(m.id)
    for (const id of leadIds) s.delete(id)
    return s
  }, [allProjects, leadIds])

  const leadAvatars = useMemo(
    () =>
      members.filter((m) => leadIds.has(m.id)).slice(0, 5).map(userToMember),
    [members, leadIds]
  )
  const contributorAvatars = useMemo(
    () =>
      members
        .filter((m) => contributorIds.has(m.id))
        .slice(0, 5)
        .map(userToMember),
    [members, contributorIds]
  )
  const allMemberAvatars = useMemo(
    () => members.slice(0, 5).map(userToMember),
    [members]
  )

  return (
    <>
      <Head>
        <title>plinq · Organization</title>
      </Head>
      <PersonalAppShell
        active="organization"
        headerEyebrow={`${orgName} · Q2 ${new Date().getFullYear()}`}
        headerTitle="Organization"
      >
        <div className="p-6 flex flex-col gap-[10px] min-h-full">
          {/* TITLE ROW */}
          <div className="flex items-end justify-between gap-[10px]">
            <div className="flex flex-col gap-[5px]">
              <p className="text-red-main text-[10px] font-medium uppercase tracking-[1.5px]">
                {orgName} · Q2 {new Date().getFullYear()}
              </p>
              <h1 className="text-black text-[35px] font-semibold leading-tight">
                {members.length} people, {allProjects.length} projects,{' '}
                <em
                  className="italic font-semibold text-gray-main"
                  style={{ fontFamily: 'Inter, ui-sans-serif, sans-serif' }}
                >
                  one direction.
                </em>
              </h1>
            </div>
            <div className="flex items-center gap-[10px]">
              <Button size="compact" variant="secondary">
                Q2 {new Date().getFullYear()}
              </Button>
              <Button size="compact" variant="secondary" iconLeft="Filter">
                Filter
              </Button>
            </div>
          </div>

          {/* STATS ROW */}
          <div className="flex gap-[10px]">
            <MetricCard
              eyebrow="Total projects"
              eyebrowColor="#2d5a9e"
              value={allProjects.length}
              hint={`${activeProjects.length} active`}
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
              onCta={() => router.push('/projects')}
            />
          </div>

          {/* ACTIVE PROJECTS */}
          <section className="bg-white-white border border-gray-border-light rounded-[10px] px-[20px] py-[15px] flex flex-col gap-[10px]">
            <div className="flex items-center justify-between">
              <SectionEyebrow eyebrow="Portfolio" title="Active projects" />
              <div className="flex items-center gap-[10px]">
                <Tag color="gray" size="md" icon="Pin">
                  {`${activeProjects.length} active`}
                </Tag>
                <Tag color="red" size="md">
                  {`${atRiskCount} delayed`}
                </Tag>
                <Button
                  size="mini"
                  variant="subtle"
                  iconRight="ArrowRight"
                  onClick={() => router.push('/projects')}
                >
                  {`View all ${allProjects.length}`}
                </Button>
              </div>
            </div>
            {activeProjects.length === 0 ? (
              <p className="text-gray-secondary text-[12px]">
                No active projects yet.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-[10px]">
                {activeProjects.map((p) => (
                  <ProjectMiniCard
                    key={p.id}
                    name={p.name}
                    color={p.color}
                    description={p.description ?? '—'}
                    members={p.members.map(userToMember)}
                    progress={p.progressPct ?? 0}
                    health={projectHealth(p)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* BOTTOM ROW */}
          <div className="flex gap-[10px] flex-1 min-h-0">
            {/* Member Overview */}
            <section className="flex-1 bg-white-white border border-gray-border-light rounded-[10px] px-[20px] py-[15px] flex flex-col gap-[10px] min-w-0">
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
                  onClick={() => router.push('/projects')}
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
                label="All Members"
                count={members.length}
                avatars={allMemberAvatars}
                caption={`Total in ${orgName}`}
                badge="Healthy"
                badgeColor="purple"
              />
            </section>

            {/* Work by stage */}
            <WorkByStage counts={stageCounts} />
          </div>
        </div>
      </PersonalAppShell>
    </>
  )
}
