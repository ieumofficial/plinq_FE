/**
 * Project preview modal — Figma 1614:26391. Shown whenever the user clicks on
 * a project anywhere in the app, *before* we route them to the dashboard.
 * The "Open project dashboard" footer button does the actual navigation.
 *
 * Per the design, the In Progress status chip has no trailing arrow (the
 * Figma includes one, but the user explicitly asked to drop it).
 */
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import Button from './ui/Button'
import Icon from './ui/Icon'
import StatusLabelBig from './ui/StatusLabelBig'
import UserGroup, { type Member } from './ui/UserGroup'
import {
  useCurrentUser,
  useMyOrg,
  useProject,
  useProjectCounts,
  useProjectMembersWithRoles,
} from '../lib/hooks'
import { resolveProjectColor } from '../lib/projectColors'
import {
  dbStatusToUi,
  formatDueDate,
  userToMember,
  type UserRow,
} from '../lib/types'

type Props = {
  open: boolean
  projectId: string | null
  onClose: () => void
}

function memberLabel(u: UserRow): string {
  return u.nickname || `${u.first_name} ${u.last_name}`.trim() || u.email
}

function dayDiffFromToday(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return ''
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.round((d.getTime() - today.getTime()) / 86400000)
  if (days === 0) return 'Today'
  if (days > 0) return `+${days}d`
  return `${days}d`
}

export default function ProjectPreviewModal({
  open,
  projectId,
  onClose,
}: Props) {
  const router = useRouter()
  const { data: user } = useCurrentUser()
  const { data: project } = useProject(projectId ?? undefined)
  const { data: members = [] } = useProjectMembersWithRoles(projectId)
  const { data: counts } = useProjectCounts(projectId ?? undefined)
  const { data: org } = useMyOrg(user?.id)

  const lead = project ? members.find((m) => m.id === project.lead_id) ?? null : null
  const otherMembers: Member[] = members
    .filter((m) => !lead || m.id !== lead.id)
    .map((m) => userToMember(m))

  // Esc to close · ⌘+Enter to open.
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        if (projectId) {
          router.push(`/p/${projectId}/dashboard`)
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, projectId, onClose, router])

  if (!open || !projectId) return null

  const goDashboard = () => {
    router.push(`/p/${projectId}/dashboard`)
    onClose()
  }

  const status = project ? dbStatusToUi(project.status) : 'in-progress'
  const projectName = project?.name ?? 'Project'
  const projectColor = project?.color ?? 'blue'
  const orgName = org?.name ?? 'Organization'
  const description = project?.description ?? ''
  const dueLabel = formatDueDate(project?.due_date ?? null)
  const dueDiff = dayDiffFromToday(project?.due_date ?? null)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white-white rounded-[15px] shadow-2xl w-[508px] max-w-[95vw] max-h-[92vh] overflow-y-auto flex flex-col gap-[20px]"
      >
        {/* Header — breadcrumb + status + close */}
        <div className="px-[20px] py-[20px] border-b border-solid border-gray-border-light flex items-center justify-between">
          <div className="flex items-center gap-[15px]">
            <div className="flex items-center gap-[5px]">
              <Icon name="Folder" size={15} className="text-black" />
              <span className="text-black text-[12px]">{projectName}</span>
              <span className="text-gray-main text-[12px]">/</span>
            </div>
            <StatusLabelBig status={status} size="md" />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-main hover:text-black w-[20px] h-[20px] inline-flex items-center justify-center"
          >
            <Icon name="Cross" size={11} />
          </button>
        </div>

        {/* Project identity */}
        <div className="px-[20px] pb-[15px] border-b border-solid border-gray-border-light flex flex-col gap-[10px]">
          <div className="flex items-start gap-[15px] py-[10px]">
            {/* Hero project badge — 50x50, single letter (matches Figma). */}
            <span
              aria-hidden
              className="w-[50px] h-[50px] rounded-[10px] inline-flex items-center justify-center text-[24px] font-semibold shrink-0"
              style={{
                backgroundColor: `${resolveProjectColor(projectColor)}20`,
                color: resolveProjectColor(projectColor),
                fontFamily: 'Geist Mono, ui-monospace, monospace',
              }}
            >
              {projectName.charAt(0).toUpperCase()}
            </span>
            <div className="flex flex-col gap-[5px] min-w-0 flex-1">
              <p className="text-blue-main text-[10px] font-medium uppercase tracking-[1.5px]">
                project · {orgName}
              </p>
              <p className="text-black text-[20px] font-semibold leading-none">
                {projectName}
              </p>
              <p className="text-gray-main text-[12px] leading-[1.3]">
                {description || '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Lead + Status + Due */}
        <div className="px-[20px] flex flex-col gap-[20px]">
          <div className="flex items-start gap-[15px]">
            {/* Project lead card */}
            <div className="flex flex-col gap-[5px] w-[225px] self-stretch">
              <p className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                project lead
              </p>
              <div className="flex-1 bg-white-item border border-solid border-gray-border rounded-[8px] p-[15px] flex flex-col gap-[10px] justify-center">
                {lead ? (
                  <div className="flex items-center justify-center gap-[10px] w-full">
                    <UserGroup members={[userToMember(lead)]} size={32} />
                    <div className="flex flex-col gap-[3px] min-w-0 flex-1">
                      <p className="text-black text-[14px] font-semibold truncate">
                        {memberLabel(lead)}
                      </p>
                      <p className="text-gray-main text-[10px]">Project Lead</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-secondary text-[12px]">No lead</p>
                )}
                <div className="h-px bg-gray-border-light w-full" />
                <div className="flex items-center justify-between">
                  {otherMembers.length > 0 ? (
                    <UserGroup
                      members={otherMembers}
                      size={15}
                      max={5}
                      overflowVariant="blue"
                    />
                  ) : (
                    <span />
                  )}
                  <p className="text-primary-main text-[10px]">
                    {members.length} {members.length === 1 ? 'member' : 'members'}
                  </p>
                </div>
              </div>
            </div>

            {/* Status + Due Date stacked */}
            <div className="flex-1 flex flex-col gap-[10px] min-w-0">
              <div className="flex flex-col gap-[5px]">
                <p className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                  status
                </p>
                {/* In Progress style chip — arrow intentionally omitted per
                    the user's design tweak from the Figma reference. */}
                <div className="bg-blue-light border border-solid border-blue-main rounded-[8px] h-[39px] px-[10px] py-[7px] flex items-center">
                  <div className="flex items-center gap-[5px]">
                    <span className="w-[6px] h-[6px] rounded-full bg-blue-main" />
                    <p className="text-blue-main text-[12px] font-semibold">
                      {status === 'in-progress'
                        ? 'In progress'
                        : status === 'planned'
                          ? 'Planned'
                          : status === 'review'
                            ? 'Review'
                            : status === 'blocked'
                              ? 'Blocked'
                              : 'Done'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-[5px]">
                <p className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                  due date
                </p>
                <div className="bg-white-item border border-solid border-gray-border rounded-[8px] h-[34px] px-[10px] py-[7px] flex items-center justify-between">
                  <div className="flex items-center gap-[10px]">
                    <Icon
                      name="Calendar"
                      size={15}
                      className="text-gray-secondary"
                    />
                    <p className="text-black text-[12px] font-semibold">
                      {dueLabel}
                    </p>
                  </div>
                  {dueDiff && (
                    <p
                      className="text-gray-main text-[10px] font-semibold tracking-[1px]"
                      style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
                    >
                      {dueDiff}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Jump straight to */}
          <div className="flex flex-col gap-[5px]">
            <p className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
              jump straight to
            </p>
            <div className="flex items-stretch gap-[5px]">
              <JumpCard
                icon="Kanban"
                iconBg="bg-blue-light"
                iconColor="text-blue-main"
                title="Kanban"
                subtitle={
                  counts?.tasks
                    ? `${counts.tasks} ${counts.tasks === 1 ? 'task' : 'tasks'}`
                    : 'Board view'
                }
                onClick={() => {
                  router.push(`/p/${projectId}/kanban`)
                  onClose()
                }}
              />
              <JumpCard
                icon="Task"
                iconBg="bg-[#DCEBE0]"
                iconColor="text-green-main"
                title="Backlog"
                subtitle={
                  counts?.tasks
                    ? `${counts.tasks} ${counts.tasks === 1 ? 'task' : 'tasks'} total`
                    : 'All tasks'
                }
                onClick={() => {
                  router.push(`/p/${projectId}/backlog`)
                  onClose()
                }}
              />
              <JumpCard
                icon="Meeting"
                iconBg="bg-purple-light"
                iconColor="text-purple-main"
                title="Meetings"
                subtitle={
                  counts?.meetings
                    ? `${counts.meetings} recorded`
                    : 'Meetings & notes'
                }
                onClick={() => {
                  router.push(`/p/${projectId}/meetings`)
                  onClose()
                }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white-item border-t border-solid border-gray-border-light rounded-bl-[15px] rounded-br-[15px] px-[20px] py-[15px] flex items-center justify-between">
          <div className="flex items-center gap-[5px] text-gray-main text-[10px]">
            <span className="bg-white-white border border-solid border-gray-border-light rounded-[5px] px-[5px] py-[5px]">
              esc
            </span>
            <span>to close ·</span>
            <span className="bg-white-white border border-solid border-gray-border-light rounded-[5px] px-[5px] py-[5px]">
              ⌘ ⏎
            </span>
            <span>to open</span>
          </div>
          <div className="flex items-center gap-[10px]">
            <Button variant="secondary" size="compact" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="compact"
              iconRight="ArrowRight"
              onClick={goDashboard}
            >
              Open project dashboard
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function JumpCard({
  icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  onClick,
}: {
  icon: 'Kanban' | 'Task' | 'Meeting'
  iconBg: string
  iconColor: string
  title: string
  subtitle: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 bg-white-white border border-solid border-gray-border-light rounded-[7px] p-[15px] flex flex-col gap-[10px] items-start text-left hover:bg-white-item transition-colors"
    >
      <span
        className={`${iconBg} ${iconColor} rounded-[3px] w-[30px] h-[30px] inline-flex items-center justify-center`}
      >
        <Icon name={icon} size={18} />
      </span>
      <span className="flex flex-col gap-[3px] w-full">
        <span className="text-black text-[12px] font-semibold">{title}</span>
        <span className="text-gray-main text-[10px]">{subtitle}</span>
      </span>
    </button>
  )
}
