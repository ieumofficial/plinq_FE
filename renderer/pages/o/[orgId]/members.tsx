import { useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import OrganizationAppShell from '../../../components/OrganizationAppShell'
import Button from '../../../components/ui/Button'
import Input from '../../../components/ui/Input'
import UserGroup from '../../../components/ui/UserGroup'
import Icon from '../../../components/ui/Icon'
import FilterChecklist from '../../../components/ui/FilterChecklist'
import InviteToOrgModal from '../../../components/InviteToOrgModal'
import DeleteConfirmModal from '../../../components/DeleteConfirmModal'
import PermissionDropdown, {
  type PermissionOption,
} from '../../../components/PermissionDropdown'
import Table, {
  TableHeader,
  TableRow,
  TableCell,
  type Column,
} from '../../../components/ui/Table'
import {
  useCurrentUser,
  useInviteToOrg,
  useMyOrg,
  useOrgMembersWithRoles,
  useRemoveOrgMember,
  useUpdateOrgMemberRole,
  useUserProjects,
} from '../../../lib/hooks'
import { userToMember, type OrgRoleDb } from '../../../lib/types'
import type { OrgMemberWithRole } from '../../../lib/queries'

const COLS: Column[] = [
  { key: 'member', label: 'Member', width: 'flex-[2]' },
  { key: 'role', label: 'Role', width: 'flex-1' },
  { key: 'email', label: 'Email', width: 'flex-[1.5]' },
  { key: 'projects', label: 'Projects', width: 'w-[80px]', align: 'center' },
  { key: 'permission', label: 'Permission', width: 'w-[120px]' },
  { key: 'more', label: '', width: 'w-[30px]' },
]

const PERMISSION_LABEL: Record<OrgRoleDb, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
}

const PERMISSION_BG: Record<OrgRoleDb, string> = {
  owner: 'bg-gray-main',
  admin: 'bg-gray-secondary',
  member: 'bg-gray-light',
}

const PERMISSION_FILTER_COLOR: Record<OrgRoleDb, string> = {
  owner: '#16242E',
  admin: '#5A6A75',
  member: '#A4B0BA',
}

const PERMISSION_KEYS: OrgRoleDb[] = ['owner', 'admin', 'member']

/** Roles the PermissionDropdown can grant on an org member. Owner is never
 *  reassigned through this UI — ownership transfer is a separate flow. */
const ORG_PERMISSION_OPTIONS: PermissionOption[] = [
  {
    key: 'admin',
    label: 'Admin',
    bg: 'bg-gray-main',
    desc: 'Full access to the organization — members, settings.',
  },
  {
    key: 'member',
    label: 'Member',
    bg: 'bg-gray-light',
    desc: 'Standard access to projects shared with them.',
  },
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
    <div className="flex-1 min-w-0 bg-white-white border border-gray-border-light rounded-[10px] px-[15px] py-[15px] flex items-end justify-between gap-[10px]">
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

function PermissionFilter({
  counts,
  selected,
  onToggle,
  onToggleAll,
}: {
  counts: Map<OrgRoleDb, number>
  selected: Set<OrgRoleDb>
  onToggle: (key: OrgRoleDb) => void
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

  const allOn = selected.size === PERMISSION_KEYS.length
  const label =
    allOn || selected.size === 0 ? 'Filter' : `Filter · ${selected.size}`
  const totalCount = Array.from(counts.values()).reduce((a, b) => a + b, 0)

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
            count={totalCount}
            color="#16242E"
            checked={allOn}
            onChange={(next) => onToggleAll(next)}
          />
          <div className="border-t border-solid border-gray-border-light my-[3px]" />
          {PERMISSION_KEYS.map((k) => (
            <FilterChecklist
              key={k}
              label={PERMISSION_LABEL[k]}
              count={counts.get(k) ?? 0}
              color={PERMISSION_FILTER_COLOR[k]}
              checked={selected.has(k)}
              onChange={() => onToggle(k)}
            />
          ))}
        </div>
      )}
    </div>
  )
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
  const { data: user } = useCurrentUser()
  const { data: org } = useMyOrg(user?.id)
  const orgName = org?.name ?? 'Organization'
  const { data: members = [] } = useOrgMembersWithRoles(orgId)
  const { data: allProjects = [] } = useUserProjects(user?.id)
  const removeMember = useRemoveOrgMember(orgId)
  const inviteMember = useInviteToOrg(orgId)
  const updateRole = useUpdateOrgMemberRole(orgId)
  const [search, setSearch] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [deleting, setDeleting] = useState<OrgMemberWithRole | null>(null)
  const [permEditor, setPermEditor] = useState<{
    member: OrgMemberWithRole
    rect: DOMRect
  } | null>(null)
  const [permissionFilter, setPermissionFilter] = useState<Set<OrgRoleDb>>(
    () => new Set(PERMISSION_KEYS)
  )
  const togglePermission = (k: OrgRoleDb) => {
    setPermissionFilter((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }
  const toggleAllPermissions = (next: boolean) => {
    setPermissionFilter(next ? new Set(PERMISSION_KEYS) : new Set())
  }

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

  const permissionCounts = useMemo(() => {
    const m = new Map<OrgRoleDb, number>()
    for (const k of PERMISSION_KEYS) m.set(k, 0)
    for (const mem of members) m.set(mem.role, (m.get(mem.role) ?? 0) + 1)
    return m
  }, [members])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const permActive =
      permissionFilter.size > 0 && permissionFilter.size < PERMISSION_KEYS.length
    return members.filter((m) => {
      if (permActive && !permissionFilter.has(m.role)) return false
      if (!q) return true
      const name = `${m.first_name} ${m.last_name}`.toLowerCase()
      return (
        name.includes(q) ||
        (m.nickname ?? '').toLowerCase().includes(q) ||
        (m.email ?? '').toLowerCase().includes(q) ||
        (m.job_title ?? '').toLowerCase().includes(q)
      )
    })
  }, [members, search, permissionFilter])

  const activeCount = members.length
  const recentlyJoined = 0 // No created_at on member view; placeholder 0.

  const deletingDisplayName = deleting
    ? deleting.nickname || `${deleting.first_name} ${deleting.last_name}`.trim()
    : ''
  const deletingProjectCount = deleting
    ? projectsByMember.get(deleting.id) ?? 0
    : 0

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
          <PermissionFilter
            counts={permissionCounts}
            selected={permissionFilter}
            onToggle={togglePermission}
            onToggleAll={toggleAllPermissions}
          />
          <Button
            size="compact"
            iconLeft="Add"
            onClick={() => setInviteOpen(true)}
          >
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

      {/* TABLE — hugs content; scrolls only if it can't fit. */}
      <Table className="min-h-0 flex flex-col overflow-hidden">
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
              return (
                <TableRow key={m.id} isLast={i === filtered.length - 1}>
                  <TableCell width="flex-[2]">
                    <UserGroup members={[userToMember(m)]} size={25} />
                    <div className="flex flex-col min-w-0">
                      <span className="text-black text-[14px] font-semibold truncate">
                        {displayName}
                      </span>
                      <span className="text-gray-secondary text-[11px] truncate">
                        {mockJoinedDate(m.id)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell width="flex-1">
                    <span className="text-gray-main text-[13px] truncate">
                      {m.job_title ?? '—'}
                    </span>
                  </TableCell>
                  <TableCell width="flex-[1.5]">
                    <span className="text-gray-main text-[13px] truncate">
                      {m.email ?? '—'}
                    </span>
                  </TableCell>
                  <TableCell width="w-[80px]" align="center">
                    <span className="text-gray-main text-[13px]">
                      {projectCount}
                    </span>
                  </TableCell>
                  <TableCell width="w-[120px]">
                    <button
                      type="button"
                      disabled={m.role === 'owner'}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (m.role === 'owner') return
                        setPermEditor({
                          member: m,
                          rect: e.currentTarget.getBoundingClientRect(),
                        })
                      }}
                      className={`inline-flex items-center justify-center w-[110px] h-[22px] rounded-[2px] text-[12px] font-semibold leading-none whitespace-nowrap text-white text-center ${PERMISSION_BG[m.role]} ${
                        m.role === 'owner'
                          ? 'cursor-default'
                          : 'hover:opacity-90 cursor-pointer'
                      }`}
                    >
                      {PERMISSION_LABEL[m.role]}
                    </button>
                  </TableCell>
                  <TableCell width="w-[30px]" align="right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (user && m.id === user.id) {
                          window.alert("You can't remove yourself from the organization.")
                          return
                        }
                        setDeleting(m)
                      }}
                      className="text-red-main hover:bg-red-50 inline-flex items-center justify-center w-[24px] h-[24px] rounded transition-colors"
                      aria-label="Remove member"
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

      <InviteToOrgModal
        open={inviteOpen}
        orgName={orgName}
        onClose={() => setInviteOpen(false)}
        onSubmit={async ({ email, role }) => {
          await inviteMember.mutateAsync({ email, role })
        }}
      />

      <DeleteConfirmModal
        open={deleting !== null}
        type="member"
        title="Delete this member?"
        body={
          <>
            This action is <strong className="font-bold">permanent</strong>. The
            member will be removed for everyone in the workspace.
          </>
        }
        subject={
          deleting && (
            <div className="flex items-center gap-[10px] min-w-0">
              <UserGroup members={[userToMember(deleting)]} size={25} />
              <div className="flex flex-col gap-[3px] min-w-0">
                <p className="text-black text-[12px] font-semibold truncate">
                  {deletingDisplayName}
                </p>
                <p className="text-gray-main text-[8px] truncate">
                  {deleting.job_title ?? 'Member'} · {mockJoinedDate(deleting.id)}{' '}
                  · {deletingProjectCount} active project
                  {deletingProjectCount === 1 ? '' : 's'}
                </p>
              </div>
            </div>
          )
        }
        consequences={
          deleting
            ? [
                `Removed from ${deletingProjectCount} active project${
                  deletingProjectCount === 1 ? '' : 's'
                }`,
                `Tasks assigned to ${deletingDisplayName} become unassigned`,
                'Loses access to all project pages and channels',
              ]
            : []
        }
        confirmLabel="Delete member"
        submitting={removeMember.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return
          removeMember.mutate(deleting.id, {
            onSuccess: () => setDeleting(null),
            onError: (err) => window.alert(err.message),
          })
        }}
      />

      {permEditor && (
        <PermissionDropdown
          anchorRect={permEditor.rect}
          current={permEditor.member.role}
          options={ORG_PERMISSION_OPTIONS}
          onClose={() => setPermEditor(null)}
          onSave={(next) => {
            updateRole.mutate(
              { userId: permEditor.member.id, role: next as OrgRoleDb },
              { onSuccess: () => setPermEditor(null) }
            )
          }}
        />
      )}
    </div>
  )
}
