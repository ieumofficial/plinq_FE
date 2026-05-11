import { useMemo, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import ProjectAppShell from '../../../components/ProjectAppShell'
import Button from '../../../components/ui/Button'
import Input from '../../../components/ui/Input'
import UserGroup from '../../../components/ui/UserGroup'
import MemberStatus from '../../../components/ui/MemberStatus'
import Table, {
  TableHeader,
  TableRow,
  TableCell,
  type Column,
} from '../../../components/ui/Table'
import { useProject, useProjectMembersWithRoles } from '../../../lib/hooks'
import { userToMember } from '../../../lib/types'

const COLS: Column[] = [
  { key: 'member', label: 'Member', width: 'flex-[2]' },
  { key: 'role', label: 'Role', width: 'flex-1' },
  { key: 'email', label: 'Email', width: 'flex-1' },
  { key: 'permission', label: 'Permission', width: 'w-[120px]' },
  { key: 'status', label: 'Status', width: 'w-[140px]' },
  { key: 'more', label: '', width: 'w-[40px]' },
]

function joinedLabel(iso: string): string {
  const d = new Date(iso)
  return `Joined ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

function StatCard({
  eyebrow,
  value,
  subtitle,
}: {
  eyebrow: string
  value: string | number
  subtitle: string
}) {
  return (
    <div className="bg-white-white border border-gray-border-light rounded-[10px] p-[20px] flex-1 flex flex-col gap-[10px]">
      <p className="text-blue-main text-[10px] font-medium uppercase tracking-[1.5px]">
        {eyebrow}
      </p>
      <p
        className="text-black text-[36px] font-semibold leading-none"
        style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
      >
        {value}
      </p>
      <p className="text-gray-secondary text-[12px]">{subtitle}</p>
    </div>
  )
}

export default function MembersPage() {
  const router = useRouter()
  const projectId = router.query.projectId as string | undefined
  const { data: project } = useProject(projectId)
  const { data: members = [] } = useProjectMembersWithRoles(projectId)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return members
    const q = search.toLowerCase()
    return members.filter(
      (m) =>
        m.email.toLowerCase().includes(q) ||
        `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
        m.nickname?.toLowerCase().includes(q) ||
        m.job_title?.toLowerCase().includes(q)
    )
  }, [members, search])

  const stats = useMemo(() => {
    const roles = new Set<string>()
    let recent = 0
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
    for (const m of members) {
      if (m.job_title) roles.add(m.job_title)
      if (new Date(m.joined_at).getTime() > cutoff) recent += 1
    }
    return {
      total: members.length,
      roles: roles.size,
      inMeeting: 0, // requires live presence; placeholder
      recent,
    }
  }, [members])

  if (!projectId) return null

  return (
    <>
      <Head>
        <title>plinq · Members</title>
      </Head>
      <ProjectAppShell projectId={projectId} active="members">
        <div className="p-6 flex flex-col gap-6">
          {/* Toolbar */}
          <div className="flex items-end justify-between gap-4">
            <div className="flex flex-col gap-[5px]">
              <p className="text-blue-main text-[10px] font-medium uppercase tracking-[1.5px]">
                {(project?.name ?? '').toUpperCase()} · MEMBERS · {stats.total} ACTIVE
              </p>
              <h1 className="text-black text-[28px] font-semibold leading-tight">
                {stats.total} {stats.total === 1 ? 'talent' : 'talents'} across{' '}
                <em
                  className="not-italic italic text-blue-main font-medium"
                  style={{ fontFamily: 'Inter, ui-sans-serif, sans-serif' }}
                >
                  {stats.roles} {stats.roles === 1 ? 'role' : 'roles'}.
                </em>
              </h1>
            </div>
            <div className="flex items-center gap-[10px]">
              <Input
                variant="search"
                placeholder="Find a member..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Button size="compact" variant="secondary" iconLeft="Filter">
                Status
              </Button>
              <Button size="compact" iconLeft="Invite">
                Invite
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-[10px]">
            <StatCard
              eyebrow="Total Members"
              value={stats.total}
              subtitle="people in this project"
            />
            <StatCard
              eyebrow="Roles Covered"
              value={stats.roles}
              subtitle="distinct job titles"
            />
            <StatCard
              eyebrow="In Meetings Now"
              value={stats.inMeeting}
              subtitle={`of ${stats.total} members`}
            />
            <StatCard
              eyebrow="Recently Joined"
              value={stats.recent}
              subtitle="added in the last 30 days"
            />
          </div>

          {/* Table */}
          <Table>
            <TableHeader columns={COLS} />
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-secondary text-[12px]">
                No members match.
              </div>
            ) : (
              filtered.map((m, i) => (
                <TableRow key={m.id} isLast={i === filtered.length - 1}>
                  <TableCell width="flex-[2]">
                    <span className="flex items-center gap-[10px]">
                      <UserGroup members={[userToMember(m)]} size={28} />
                      <span className="flex flex-col">
                        <span className="text-black text-[14px] font-semibold">
                          {m.nickname || `${m.first_name} ${m.last_name}`.trim()}
                        </span>
                        <span className="text-gray-secondary text-[10px]">
                          {joinedLabel(m.joined_at)}
                        </span>
                      </span>
                    </span>
                  </TableCell>
                  <TableCell width="flex-1">
                    <span className="text-[14px] text-black">
                      {m.job_title ?? '—'}
                    </span>
                  </TableCell>
                  <TableCell width="flex-1">
                    <span className="text-[14px] text-black">{m.email}</span>
                  </TableCell>
                  <TableCell width="w-[120px]">
                    <MemberStatus variant="permission" status={m.role} />
                  </TableCell>
                  <TableCell width="w-[140px]">
                    <MemberStatus variant="presence" status="available" />
                  </TableCell>
                  <TableCell width="w-[40px]">
                    <button
                      type="button"
                      className="text-gray-main hover:bg-gray-extra-light p-1 rounded transition-colors"
                      aria-label="More"
                    >
                      ⋯
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </Table>
        </div>
      </ProjectAppShell>
    </>
  )
}
