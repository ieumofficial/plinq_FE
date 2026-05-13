import { useMemo } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import OrganizationAppShell, { useCreateNew } from '../../../components/OrganizationAppShell'
import Button from '../../../components/ui/Button'
import Tag from '../../../components/ui/Tag'
import ProjectLabel from '../../../components/ui/ProjectLabel'
import UserGroup from '../../../components/ui/UserGroup'
import Icon from '../../../components/ui/Icon'
import Table, {
  TableHeader,
  TableRow,
  TableCell,
  type Column,
} from '../../../components/ui/Table'
import {
  useCurrentUser,
  useMyOrg,
  useOrgMembers,
  useUserProjects,
} from '../../../lib/hooks'
import { userToMember, type ProjectStatusDb } from '../../../lib/types'

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

const HEALTH_BAR: Record<Health, string> = {
  'on-track': '#2F6B45',
  'at-risk': '#B68A48',
  delayed: '#9B3838',
  healthy: '#2F6B45',
}

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
  value,
  pillDotColor,
  pillText,
  pillBg,
  pillTextColor,
}: {
  eyebrow: string
  value: number | string
  pillDotColor: string
  pillText: string
  pillBg: string
  pillTextColor: string
}) {
  return (
    <div className="flex-1 min-w-0 bg-white-white border border-gray-border-light rounded-[10px] px-[15px] py-[15px] flex items-center justify-between gap-[10px]">
      <div className="flex flex-col gap-[5px] min-w-0">
        <p className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px] truncate">
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
        className="shrink-0 inline-flex items-center gap-[5px] rounded-[20px] px-[8px] py-[3px]"
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
  const { data: allProjects = [] } = useUserProjects(user?.id)

  const counts = useMemo(() => {
    let active = 0
    let onTrack = 0
    let atRisk = 0
    let blocked = 0
    let planned = 0
    for (const p of allProjects) {
      if (
        (['planned', 'in_progress', 'review'] as ProjectStatusDb[]).includes(
          p.status
        )
      ) {
        active++
      }
      if (p.status === 'planned') planned++
      if (p.status === 'blocked') blocked++
      const h = projectHealth(p)
      if (h === 'on-track' || h === 'healthy') onTrack++
      if (h === 'at-risk') atRisk++
    }
    return { active, onTrack, atRisk, blocked, planned }
  }, [allProjects])

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
            {orgName} · Projects
          </p>
          <h1 className="text-black text-[35px] font-semibold leading-tight">
            {allProjects.length} active projects{' '}
            <em
              className="italic font-semibold text-gray-main"
              style={{ fontFamily: 'Inter, ui-sans-serif, sans-serif' }}
            >
              underway.
            </em>
          </h1>
        </div>
        <div className="flex items-center gap-[10px]">
          <Button size="compact" variant="secondary" iconRight="ArrowRight">
            Q2 {new Date().getFullYear()}
          </Button>
          <Button size="compact" variant="secondary" iconLeft="Filter">
            Filter
          </Button>
          <Button size="compact" iconLeft="Add" onClick={() => open('project')}>
            New project
          </Button>
        </div>
      </div>

      {/* STATS ROW — 5 cards */}
      <div className="shrink-0 flex gap-[10px]">
        <StatCard
          eyebrow="Active"
          value={counts.active}
          pillBg="#DDE7F4"
          pillDotColor="#2D5A9E"
          pillText={`+${counts.active > 0 ? Math.min(4, counts.active) : 0} this quarter`}
          pillTextColor="#2D5A9E"
        />
        <StatCard
          eyebrow="On track"
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
          value={counts.atRisk}
          pillBg="#F4E6CD"
          pillDotColor="#B68A48"
          pillText={`+${counts.atRisk} since last week`}
          pillTextColor="#8A5A1E"
        />
        <StatCard
          eyebrow="Blocked"
          value={counts.blocked}
          pillBg="#F2DEDE"
          pillDotColor="#9B3838"
          pillText={`${counts.blocked} awaiting`}
          pillTextColor="#9B3838"
        />
        <StatCard
          eyebrow="Planned"
          value={counts.planned}
          pillBg="#E6ECEF"
          pillDotColor="#455E6A"
          pillText="kicking off in Q3"
          pillTextColor="#455E6A"
        />
      </div>

      {/* TABLE */}
      <Table className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <TableHeader className="shrink-0" columns={COLS} />
        <div className="min-h-0 overflow-y-auto">
          {allProjects.length === 0 ? (
            <div className="px-[25px] py-[20px] text-gray-secondary text-[12px]">
              No projects yet.
            </div>
          ) : (
            allProjects.map((p, i) => {
              const h = projectHealth(p)
              const pct = Math.max(0, Math.min(100, p.progressPct ?? 0))
              const lead = p.lead_id ? memberById.get(p.lead_id) : null
              return (
                <TableRow
                  key={p.id}
                  isLast={i === allProjects.length - 1}
                  onClick={() => router.push(`/p/${p.id}/dashboard`)}
                >
                  <TableCell width="flex-[2]">
                    <ProjectLabel name={p.name} color={p.color ?? 'blue'} size="sm" />
                    <span className="text-black text-[14px] font-semibold truncate">
                      {p.name}
                    </span>
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
                    <Tag color={HEALTH_COLOR[h]} size="md">
                      {HEALTH_LABEL[h]}
                    </Tag>
                  </TableCell>
                  <TableCell width="flex-1">
                    <span className="flex-1 h-[6px] bg-gray-extra-light rounded-full overflow-hidden">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: HEALTH_BAR[h] }}
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
                    <span className="text-black text-[12px]">
                      {formatDue(p.nextDueDate)}
                    </span>
                  </TableCell>
                  <TableCell width="w-[30px]" align="right">
                    <button
                      type="button"
                      onClick={(e) => e.stopPropagation()}
                      className="text-gray-secondary hover:text-black"
                      aria-label="More"
                    >
                      <Icon name="Dot-Menu" size={15} />
                    </button>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </div>
      </Table>
    </div>
  )
}
