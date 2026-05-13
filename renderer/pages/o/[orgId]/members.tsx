import { useMemo, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import OrganizationAppShell, { useCreateNew } from '../../../components/OrganizationAppShell'
import Button from '../../../components/ui/Button'
import Input from '../../../components/ui/Input'
import UserGroup from '../../../components/ui/UserGroup'
import MemberStatus, { type Presence } from '../../../components/ui/MemberStatus'
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
import { userToMember } from '../../../lib/types'

const COLS: Column[] = [
  { key: 'member', label: 'Member', width: 'flex-[2]' },
  { key: 'role', label: 'Role', width: 'flex-1' },
  { key: 'email', label: 'Email', width: 'flex-[1.5]' },
  { key: 'projects', label: 'Projects', width: 'w-[80px]' },
  { key: 'status', label: 'Status', width: 'w-[120px]' },
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

/** Stable mock joined-date keyed off user id so the column is deterministic
 *  while the schema doesn't expose a real org-membership created_at yet. */
function mockJoinedDate(userId: string): string {
  let h = 0
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) | 0
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec',
  ]
  const month = months[Math.abs(h) % 12]
  const day = String((Math.abs(h >> 4) % 28) + 1).padStart(2, '0')
  return `Joined ${month} ${day}`
}

/** Stable mock presence keyed off user id so the table is deterministic. */
function mockPresence(userId: string): Presence {
  let h = 0
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) | 0
  const pool: Presence[] = [
    'available',
    'available',
    'in_meeting',
    'unavailable',
    'available',
  ]
  return pool[Math.abs(h) % pool.length]
}

export default function OrgMembersPage() {
  const router = useRouter()
  const orgId = router.query.orgId as string | undefined
  if (!orgId) return null
  return (
    <>
      <Head>
        <title>plinq · Organization · Members</title>
      </Head>
      <OrganizationAppShell orgId={orgId} active="members">
        <OrgMembersBody orgId={orgId} />
      </OrganizationAppShell>
    </>
  )
}

function OrgMembersBody({ orgId }: { orgId: string }) {
  const { openMenu } = useCreateNew()
  const { data: user } = useCurrentUser()
  const { data: org } = useMyOrg(user?.id)
  const orgName = org?.name ?? 'Organization'
  const { data: members = [] } = useOrgMembers(orgId)
  const { data: allProjects = [] } = useUserProjects(user?.id)
  const [search, setSearch] = useState('')

  const projectsByMember = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of allProjects) {
      for (const m of p.members) {
        map.set(m.id, (map.get(m.id) ?? 0) + 1)
      }
    }
    return map
  }, [allProjects])

  const roleCount = useMemo(() => {
    const s = new Set<string>()
    for (const m of members) if (m.job_title) s.add(m.job_title)
    return s.size
  }, [members])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return members
    return members.filter((m) => {
      const name = `${m.first_name} ${m.last_name}`.toLowerCase()
      return (
        name.includes(q) ||
        (m.nickname ?? '').toLowerCase().includes(q) ||
        (m.email ?? '').toLowerCase().includes(q) ||
        (m.job_title ?? '').toLowerCase().includes(q)
      )
    })
  }, [members, search])

  const activeCount = members.length
  const recentlyJoined = 0 // No created_at on member view; placeholder 0.

  return (
    <div className="flex-1 min-h-0 p-6 flex flex-col gap-[10px] overflow-hidden">
      {/* TITLE ROW */}
      <div className="shrink-0 flex items-end justify-between gap-[10px]">
        <div className="flex flex-col gap-[5px]">
          <p className="text-[#2d5a9e] text-[10px] font-medium uppercase tracking-[1.5px]">
            {orgName} · Members
          </p>
          <h1 className="text-black text-[35px] font-semibold leading-tight">
            {members.length} people across{' '}
            <em
              className="italic font-semibold text-gray-main"
              style={{ fontFamily: 'Inter, ui-sans-serif, sans-serif' }}
            >
              {roleCount} roles.
            </em>
          </h1>
        </div>
        <div className="flex items-center gap-[10px]">
          <Input
            variant="search"
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-[240px]"
          />
          <Button size="compact" variant="secondary" iconLeft="Filter">
            Filter
          </Button>
          <Button size="compact" iconLeft="Add" onClick={openMenu}>
            Invite
          </Button>
        </div>
      </div>

      {/* STATS ROW */}
      <div className="shrink-0 flex gap-[10px]">
        <StatCard
          eyebrow="Total members"
          value={members.length}
          pillBg="#DDE7F4"
          pillDotColor="#2D5A9E"
          pillText="+12 this quarter"
          pillTextColor="#2D5A9E"
        />
        <StatCard
          eyebrow="Active"
          value={activeCount}
          pillBg="#DCEBE0"
          pillDotColor="#2F6B45"
          pillText={
            members.length > 0
              ? `${Math.round((activeCount / members.length) * 100)}% of org`
              : '—'
          }
          pillTextColor="#2F6B45"
        />
        <StatCard
          eyebrow="Recently joined"
          value={recentlyJoined}
          pillBg="#F4E6CD"
          pillDotColor="#B68A48"
          pillText="+1 in the last 30 days"
          pillTextColor="#8A5A1E"
        />
        <StatCard
          eyebrow="On leave / etc."
          value={0}
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
          {filtered.length === 0 ? (
            <div className="px-[25px] py-[20px] text-gray-secondary text-[12px]">
              {members.length === 0 ? 'No members yet.' : 'No matches.'}
            </div>
          ) : (
            filtered.map((m, i) => {
              const displayName =
                m.nickname || `${m.first_name} ${m.last_name}`.trim()
              const projectCount = projectsByMember.get(m.id) ?? 0
              const presence = mockPresence(m.id)
              return (
                <TableRow key={m.id} isLast={i === filtered.length - 1}>
                  <TableCell width="flex-[2]">
                    <UserGroup members={[userToMember(m)]} size={25} />
                    <div className="flex flex-col min-w-0">
                      <span className="text-black text-[14px] font-semibold truncate">
                        {displayName}
                      </span>
                      <span
                        className="text-gray-secondary text-[10px] truncate"
                        style={{
                          fontFamily: 'Geist Mono, ui-monospace, monospace',
                        }}
                      >
                        {mockJoinedDate(m.id)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell width="flex-1">
                    <span className="text-black text-[12px] truncate">
                      {m.job_title ?? '—'}
                    </span>
                  </TableCell>
                  <TableCell width="flex-[1.5]">
                    <span className="text-black text-[12px] truncate">
                      {m.email ?? '—'}
                    </span>
                  </TableCell>
                  <TableCell width="w-[80px]">
                    <span
                      className="text-black text-[12px]"
                      style={{
                        fontFamily: 'Geist Mono, ui-monospace, monospace',
                      }}
                    >
                      {projectCount}
                    </span>
                  </TableCell>
                  <TableCell width="w-[120px]">
                    <MemberStatus variant="presence" status={presence} />
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
