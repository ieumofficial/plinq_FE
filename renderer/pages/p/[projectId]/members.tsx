import { useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import ProjectAppShell from '../../../components/ProjectAppShell'
import Button from '../../../components/ui/Button'
import Input from '../../../components/ui/Input'
import UserGroup from '../../../components/ui/UserGroup'
import MemberStatus, { type Presence } from '../../../components/ui/MemberStatus'
import FilterChecklist from '../../../components/ui/FilterChecklist'
import Icon from '../../../components/ui/Icon'
import Table, {
  TableHeader,
  TableRow,
  TableCell,
  type Column,
} from '../../../components/ui/Table'
import PermissionDropdown, {
  type PermissionOption,
} from '../../../components/PermissionDropdown'
import DeleteConfirmModal from '../../../components/DeleteConfirmModal'
import InviteByEmailModal from '../../../components/InviteByEmailModal'
import {
  useCurrentUser,
  useInviteToProject,
  useProject,
  useProjectMembersWithRoles,
  useRemoveProjectMember,
  useUpdateProjectMemberRole,
} from '../../../lib/hooks'
import { userToMember, type ProjectRoleDb } from '../../../lib/types'
import type { ProjectMember } from '../../../lib/queries'
import { resolveProjectColor } from '../../../lib/projectColors'
import ProjectPermissionDropdown from '../../../components/ProjectPermissionDropdown'

const COLS: Column[] = [
  { key: 'member', label: 'Member', width: 'flex-[2]' },
  { key: 'role', label: 'Role', width: 'flex-1' },
  { key: 'email', label: 'Email', width: 'flex-1' },
  { key: 'permission', label: 'Permission', width: 'w-[120px]' },
  { key: 'status', label: 'Status', width: 'w-[140px]' },
  { key: 'delete', label: '', width: 'w-[40px]' },
]

/** Project-level roles the PermissionDropdown can grant. Order matches the
 *  Figma "Set Permission" panel (admin → editor → read-only). */
const PROJECT_PERMISSION_OPTIONS: PermissionOption[] = [
  {
    key: 'admin',
    label: 'Admin',
    bg: 'bg-gray-main',
    desc: 'Full access to project configuration — members, settings.',
  },
  {
    key: 'editor',
    label: 'Editor',
    bg: 'bg-gray-secondary',
    desc: 'Default — limited access to project data, no project settings.',
  },
  {
    key: 'readonly',
    label: 'Read-only',
    bg: 'bg-gray-light',
    desc: 'Read-only access all tasks within this project.',
  },
]

const PRESENCE_OPTIONS: { key: Presence; label: string; color: string }[] = [
  { key: 'available', label: 'Available', color: '#2F6B45' },
  { key: 'in_meeting', label: 'In meeting', color: '#B68A48' },
  { key: 'unavailable', label: 'Unavailable', color: '#9B3838' },
]

// Real presence now lives on `users.status` and is auto-flipped by
// LiveKit join/leave webhooks. The old mockPresence(userId) hash helper
// is gone — see `m.status ?? 'available'` at the call site.

function memberDisplayName(m: {
  nickname: string | null
  first_name: string
  last_name: string
}) {
  return m.nickname || `${m.first_name} ${m.last_name}`.trim()
}

function useClickOutside(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])
  return ref
}

function StatCard({
  eyebrow,
  eyebrowColor,
  value,
  subtitle,
}: {
  eyebrow: string
  /** Hex color for the eyebrow text. */
  eyebrowColor: string
  value: string | number
  subtitle: string
}) {
  return (
    <div className="bg-white-white border border-gray-border-light rounded-[10px] p-[20px] flex-1 flex flex-col gap-[10px]">
      <p
        className="text-[10px] font-medium uppercase tracking-[1.5px]"
        style={{ color: eyebrowColor }}
      >
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
  if (!projectId) return null
  return (
    <>
      <Head>
        <title>plinq · Members</title>
      </Head>
      <ProjectAppShell projectId={projectId} active="members">
        <MembersBody projectId={projectId} />
      </ProjectAppShell>
    </>
  )
}

function MembersBody({ projectId }: { projectId: string }) {
  const { data: user } = useCurrentUser()
  const { data: project } = useProject(projectId)
  const { data: members = [] } = useProjectMembersWithRoles(projectId)
  const updateRole = useUpdateProjectMemberRole(projectId)
  const removeMember = useRemoveProjectMember(projectId)
  const inviteMember = useInviteToProject(projectId)

  const [search, setSearch] = useState('')

  // Status filter — multi-select. Default = all three presences.
  const [presenceFilter, setPresenceFilter] = useState<Set<Presence>>(
    () => new Set(PRESENCE_OPTIONS.map((p) => p.key))
  )
  const [statusOpen, setStatusOpen] = useState(false)
  const statusRef = useClickOutside(statusOpen, () => setStatusOpen(false))

  // Modals / panels
  const [detailMember, setDetailMember] = useState<ProjectMember | null>(null)
  const [permEditor, setPermEditor] = useState<{
    member: ProjectMember
    rect: DOMRect
  } | null>(null)
  const [deletingMember, setDeletingMember] = useState<ProjectMember | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)

  const filtered = useMemo(() => {
    let arr = members
    if (presenceFilter.size < PRESENCE_OPTIONS.length) {
      arr = arr.filter((m) => presenceFilter.has(m.status ?? 'available'))
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      arr = arr.filter(
        (m) =>
          m.email.toLowerCase().includes(q) ||
          `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
          m.nickname?.toLowerCase().includes(q) ||
          m.job_title?.toLowerCase().includes(q)
      )
    }
    return arr
  }, [members, presenceFilter, search])

  const stats = useMemo(() => {
    const roles = new Set<string>()
    let inMeeting = 0
    for (const m of members) {
      if (m.job_title) roles.add(m.job_title)
      if ((m.status ?? 'available') === 'in_meeting') inMeeting += 1
    }
    return {
      total: members.length,
      roles: roles.size,
      roleNames: Array.from(roles),
      inMeeting,
      recentlyJoined: 0, // requires joined_at column
    }
  }, [members])

  const allPresenceOn = presenceFilter.size === PRESENCE_OPTIONS.length
  const togglePresence = (key: Presence) => {
    setPresenceFilter((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  const toggleAllPresence = () => {
    setPresenceFilter((prev) =>
      prev.size === PRESENCE_OPTIONS.length
        ? new Set()
        : new Set(PRESENCE_OPTIONS.map((p) => p.key))
    )
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col p-6 gap-6">
      {/* Toolbar */}
      <div className="shrink-0 flex items-end justify-between gap-4">
        <div className="flex flex-col gap-[5px]">
          <p
            className="text-[10px] font-medium uppercase tracking-[1.5px]"
            style={{ color: resolveProjectColor(project?.color) }}
          >
            {(project?.name ?? '').toUpperCase()} · MEMBERS · {stats.total} ACTIVE
          </p>
          <h1 className="text-black text-[35px] font-semibold leading-tight">
            {stats.total} {stats.total === 1 ? 'talent' : 'talents'} across{' '}
            <em
              className="italic font-semibold text-gray-main"
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
          <div ref={statusRef} className="relative">
            <Button
              size="compact"
              variant="secondary"
              iconLeft="Filter"
              onClick={() => setStatusOpen((s) => !s)}
            >
              {allPresenceOn ? 'Status' : `Status · ${presenceFilter.size}`}
            </Button>
            {statusOpen && (
              <div className="absolute top-[40px] right-0 z-20 bg-white-white border border-solid border-gray-border-light rounded-[5px] shadow-md p-[10px] flex flex-col gap-[2px] min-w-[220px]">
                <p className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px] px-[2px] mb-[5px]">
                  Status
                </p>
                <FilterChecklist
                  label="All"
                  count={members.length}
                  color="#455E6A"
                  checked={allPresenceOn}
                  onChange={toggleAllPresence}
                />
                <div className="h-px bg-gray-border-light my-[5px]" />
                {PRESENCE_OPTIONS.map((p) => (
                  <FilterChecklist
                    key={p.key}
                    label={p.label}
                    count={members.filter((m) => (m.status ?? 'available') === p.key).length}
                    color={p.color}
                    checked={presenceFilter.has(p.key)}
                    onChange={() => togglePresence(p.key)}
                  />
                ))}
              </div>
            )}
          </div>
          <Button
            size="compact"
            iconLeft="Invite"
            onClick={() => setInviteOpen(true)}
          >
            Invite
          </Button>
        </div>
      </div>

      {/* Stats — eyebrow colors per Figma 976:4138 */}
      <div className="shrink-0 flex gap-[10px]">
        <StatCard
          eyebrow="Total Members"
          eyebrowColor="#2D5A9E"
          value={stats.total}
          subtitle="people in this project"
        />
        <StatCard
          eyebrow="Roles Covered"
          eyebrowColor="#2F6B45"
          value={stats.roles}
          subtitle={
            stats.roleNames.length === 0
              ? 'no roles set yet'
              : `across ${stats.roleNames.slice(0, 3).join(', ').toLowerCase()} ...`
          }
        />
        <StatCard
          eyebrow="In Meetings Now"
          eyebrowColor="#5B3D8A"
          value={stats.inMeeting}
          subtitle={`of ${stats.total} members`}
        />
        <StatCard
          eyebrow="Recently Joined"
          eyebrowColor="#B68A48"
          value={stats.recentlyJoined}
          subtitle="added in the last 30 days"
        />
      </div>

      {/* Table — shrinks to content when rows are few, scrolls internally when overflowing */}
      <div className="min-h-0 bg-white-white rounded-[10px] border border-gray-border-light flex flex-col overflow-hidden">
        <TableHeader columns={COLS} className="shrink-0 !gap-[12px] !px-[16px]" />
        <div className="min-h-0 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-secondary text-[12px]">
            No members match.
          </div>
        ) : (
          filtered.map((m, i) => {
            const presence: Presence = m.status ?? 'available'
            return (
              <TableRow
                key={m.id}
                isLast={i === filtered.length - 1}
                onClick={() => setDetailMember(m)}
                className="!gap-[12px] !px-[16px]"
              >
                <TableCell width="flex-[2]">
                  <span className="flex items-center gap-[10px]">
                    <UserGroup members={[userToMember(m)]} size={28} />
                    <span className="text-black text-[12px] font-semibold">
                      {memberDisplayName(m)}
                    </span>
                  </span>
                </TableCell>
                <TableCell width="flex-1">
                  <span className="text-[12px] text-gray-main">
                    {m.job_title ?? '—'}
                  </span>
                </TableCell>
                <TableCell width="flex-1">
                  <span className="text-[12px] text-gray-main">{m.email}</span>
                </TableCell>
                <TableCell width="w-[120px]">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setPermEditor({
                        member: m,
                        rect: e.currentTarget.getBoundingClientRect(),
                      })
                    }}
                    className="inline-flex items-center hover:opacity-90 cursor-pointer"
                    aria-label="Change permission"
                  >
                    <MemberStatus variant="permission" status={m.role} />
                  </button>
                </TableCell>
                <TableCell width="w-[140px]">
                  <MemberStatus variant="presence" status={presence} />
                </TableCell>
                <TableCell width="w-[40px]">
                  {user && m.id !== user.id ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeletingMember(m)
                      }}
                      className="text-red-main hover:bg-red-50 inline-flex items-center justify-center w-[24px] h-[24px] rounded transition-colors"
                      aria-label="Remove member"
                    >
                      <Icon name="Trash" size={15} />
                    </button>
                  ) : null}
                </TableCell>
              </TableRow>
            )
          })
        )}
        </div>
      </div>

      {/* Detail side panel */}
      {detailMember && (
        <MemberDetailPanel
          member={detailMember}
          presence={detailMember.status ?? 'available'}
          onClose={() => setDetailMember(null)}
        />
      )}

      {/* Permission dropdown */}
      {permEditor && (
        <PermissionDropdown
          anchorRect={permEditor.rect}
          current={permEditor.member.role}
          options={PROJECT_PERMISSION_OPTIONS}
          onClose={() => setPermEditor(null)}
          onSave={(next) => {
            updateRole.mutate(
              { userId: permEditor.member.id, role: next as ProjectRoleDb },
              {
                onSuccess: () => setPermEditor(null),
                onError: (err) => window.alert(err.message),
              }
            )
          }}
        />
      )}

      {/* Invite modal */}
      <InviteByEmailModal
        open={inviteOpen}
        variant="project"
        onClose={() => setInviteOpen(false)}
        onSubmit={async ({ email, role }) => {
          await inviteMember.mutateAsync({ email, role: role ?? 'editor' })
        }}
      />

      {/* Delete confirmation */}
      <DeleteConfirmModal
        open={deletingMember !== null}
        type="member"
        title="Delete this member?"
        body={
          <>
            This action is <strong className="font-bold">permanent</strong>. The
            member will be removed for everyone in the workspace.
          </>
        }
        subject={
          deletingMember && (
            <div className="flex items-center gap-[10px] min-w-0">
              <UserGroup members={[userToMember(deletingMember)]} size={28} />
              <div className="flex flex-col gap-[3px] min-w-0">
                <p className="text-black text-[12px] font-semibold truncate">
                  {memberDisplayName(deletingMember)}
                </p>
                <p className="text-gray-main text-[8px] truncate">
                  {deletingMember.job_title ?? 'Member'}
                  {deletingMember.email ? ` · ${deletingMember.email}` : ''}
                </p>
              </div>
            </div>
          )
        }
        consequences={
          deletingMember
            ? [
                `Removed from ${project?.name ?? 'this project'}`,
                `Tasks assigned to ${memberDisplayName(deletingMember)} become unassigned`,
                'Loses access to project pages and channels',
              ]
            : []
        }
        confirmLabel="Delete member"
        submitting={removeMember.isPending}
        onClose={() => setDeletingMember(null)}
        onConfirm={() => {
          if (!deletingMember) return
          removeMember.mutate(deletingMember.id, {
            onSuccess: () => setDeletingMember(null),
            onError: (err) => window.alert(err.message),
          })
        }}
      />
    </div>
  )
}

function MemberDetailPanel({
  member,
  presence,
  onClose,
}: {
  member: ProjectMember
  presence: Presence
  onClose: () => void
}) {
  // Esc to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <aside
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 bottom-0 w-[400px] max-w-[90vw] bg-white-white shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between px-[20px] pt-[20px] pb-[15px] border-b border-gray-border-light">
          <p className="text-blue-main text-[10px] font-semibold uppercase tracking-[1.5px]">
            Member · Profile
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-main hover:bg-white-item rounded p-1 transition-colors"
          >
            <Icon name="Cross" size={13} />
          </button>
        </div>

        <div className="px-[20px] py-[20px] flex flex-col gap-[20px] overflow-y-auto">
          {/* Avatar + name block */}
          <div className="flex items-center gap-[15px]">
            <UserGroup members={[userToMember(member)]} size={60} />
            <div className="flex flex-col gap-[3px] min-w-0">
              <span className="text-black text-[18px] font-semibold truncate">
                {memberDisplayName(member)}
              </span>
              <span className="text-gray-main text-[12px] truncate">
                {member.job_title ?? '—'}
              </span>
              <span className="mt-[3px]">
                <MemberStatus variant="presence" status={presence} />
              </span>
            </div>
          </div>

          {/* Field rows */}
          <div className="flex flex-col gap-[10px]">
            <Field label="Email" value={member.email} mono />
            <Field
              label="Permission"
              value={<MemberStatus variant="permission" status={member.role} />}
            />
            <Field label="Role" value={member.job_title ?? '—'} />
            <Field
              label="Display name"
              value={
                member.nickname ?? `${member.first_name} ${member.last_name}`.trim()
              }
            />
          </div>
        </div>
      </aside>
    </div>
  )
}

function Field({
  label,
  value,
  mono,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="flex flex-col gap-[3px]">
      <p className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
        {label}
      </p>
      {typeof value === 'string' ? (
        <p
          className="text-black text-[13px]"
          style={mono ? { fontFamily: 'Geist Mono, ui-monospace, monospace' } : undefined}
        >
          {value}
        </p>
      ) : (
        value
      )}
    </div>
  )
}
