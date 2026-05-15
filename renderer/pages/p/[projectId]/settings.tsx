import { useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import ProjectAppShell from '../../../components/ProjectAppShell'
import Button from '../../../components/ui/Button'
import Input from '../../../components/ui/Input'
import Icon from '../../../components/ui/Icon'
import UserGroup from '../../../components/ui/UserGroup'
import ProjectLabel from '../../../components/ui/ProjectLabel'
import DatePicker from '../../../components/ui/DatePicker'
import {
  useCurrentUser,
  useMyOrg,
  useProject,
  useProjectMembersWithRoles,
  useUpdateProject,
} from '../../../lib/hooks'
import {
  userToMember,
  type ProjectStatusDb,
  type UserRow,
} from '../../../lib/types'
import { resolveProjectColor } from '../../../lib/projectColors'

type ColorKey = 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'turquoise'

const COLORS: { key: ColorKey; bg: string; fg: string; ring: string }[] = [
  { key: 'blue', bg: 'bg-blue-light', fg: 'text-blue-main', ring: 'border-blue-main' },
  { key: 'green', bg: 'bg-[#DCEBE0]', fg: 'text-green-main', ring: 'border-green-main' },
  { key: 'amber', bg: 'bg-brown-light', fg: 'text-brown-med', ring: 'border-brown-med' },
  { key: 'red', bg: 'bg-red-light', fg: 'text-red-main', ring: 'border-red-main' },
  { key: 'purple', bg: 'bg-purple-light', fg: 'text-purple-main', ring: 'border-purple-main' },
  { key: 'turquoise', bg: 'bg-turquoise-light', fg: 'text-turquoise-main', ring: 'border-turquoise-main' },
]

const STATUSES: { key: ProjectStatusDb; label: string; activeBg: string; activeText: string }[] = [
  { key: 'planned', label: 'Planned', activeBg: 'bg-[#E6ECEF]', activeText: 'text-primary-main' },
  { key: 'in_progress', label: 'In progress', activeBg: 'bg-blue-light', activeText: 'text-blue-main' },
  { key: 'review', label: 'Review', activeBg: 'bg-brown-light', activeText: 'text-brown-med' },
  { key: 'blocked', label: 'Blocked', activeBg: 'bg-red-light', activeText: 'text-red-main' },
  { key: 'done', label: 'Done', activeBg: 'bg-[#DCEBE0]', activeText: 'text-green-main' },
]

function memberLabel(u: UserRow): string {
  return u.nickname || `${u.first_name} ${u.last_name}`.trim() || u.email
}

/** Closes the dropdown when clicking outside both the trigger and the floating
 *  popup. Both refs are needed because the popup is rendered in a different
 *  part of the DOM (fixed-positioned sibling) than the trigger button. */
function useFloatingClose(
  open: boolean,
  onClose: () => void,
  triggerRef: React.RefObject<HTMLElement>,
  popupRef: React.RefObject<HTMLElement>
) {
  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t)) return
      if (popupRef.current?.contains(t)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onScrollOrResize = () => onClose()
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [open, onClose, triggerRef, popupRef])
}

export default function ProjectSettingsPage() {
  const router = useRouter()
  const projectId = router.query.projectId as string | undefined
  if (!projectId) return null
  return (
    <>
      <Head>
        <title>plinq · Settings</title>
      </Head>
      <ProjectAppShell projectId={projectId} active="settings">
        <SettingsBody projectId={projectId} />
      </ProjectAppShell>
    </>
  )
}

function SettingsBody({ projectId }: { projectId: string }) {
  const { data: project } = useProject(projectId)
  const { data: me } = useCurrentUser()
  const { data: org } = useMyOrg(me?.id)
  const { data: members = [] } = useProjectMembersWithRoles(projectId)
  const { mutate: updateProject, isPending } = useUpdateProject()

  // Can the current user actually persist changes? RLS `projects_update_lead`
  // allows the project lead and admins through; everyone else's save is
  // silently dropped.
  const canEdit = useMemo(() => {
    if (!me || !project) return false
    if (project.lead_id === me.id) return true
    return members.some((m) => m.id === me.id && m.role === 'admin')
  }, [me, project, members])

  // Local form state — initialised from server data.
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>('blue')
  const [customHexInput, setCustomHexInput] = useState('')
  const [customHexOpen, setCustomHexOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [leadId, setLeadId] = useState<string | null>(null)
  const [leadPickerOpen, setLeadPickerOpen] = useState(false)
  const [leadAnchor, setLeadAnchor] = useState<DOMRect | null>(null)
  const leadTriggerRef = useRef<HTMLButtonElement>(null)
  const leadPopupRef = useRef<HTMLDivElement>(null)
  const [customHexAnchor, setCustomHexAnchor] = useState<DOMRect | null>(null)
  const customHexTriggerRef = useRef<HTMLButtonElement>(null)
  const customHexPopupRef = useRef<HTMLDivElement>(null)
  useFloatingClose(
    leadPickerOpen,
    () => {
      setLeadPickerOpen(false)
      setLeadAnchor(null)
    },
    leadTriggerRef,
    leadPopupRef
  )
  useFloatingClose(
    customHexOpen,
    () => {
      setCustomHexOpen(false)
      setCustomHexAnchor(null)
    },
    customHexTriggerRef,
    customHexPopupRef
  )
  const [status, setStatus] = useState<ProjectStatusDb>('planned')
  const [dueDate, setDueDate] = useState<string>('')
  const [datePickerAnchor, setDatePickerAnchor] = useState<DOMRect | null>(null)
  const dateTriggerRef = useRef<HTMLButtonElement>(null)
  const [error, setError] = useState('')
  const [memberSearch, setMemberSearch] = useState('')

  useEffect(() => {
    if (!project) return
    setName(project.name)
    setColor(project.color)
    setDescription(project.description ?? '')
    setLeadId(project.lead_id)
    setStatus(project.status)
    setDueDate(project.due_date ?? '')
    setError('')
  }, [project])

  const lead = useMemo(
    () => members.find((m) => m.id === leadId),
    [members, leadId]
  )

  const isCustomHex = !COLORS.some((c) => c.key === color)
  const colorMeta = COLORS.find((c) => c.key === color)

  const dirty =
    !!project &&
    (name !== project.name ||
      color !== project.color ||
      description !== (project.description ?? '') ||
      leadId !== project.lead_id ||
      status !== project.status ||
      (dueDate || null) !== (project.due_date ?? null))

  const onSave = () => {
    if (!name.trim()) {
      setError('Project name is required.')
      return
    }
    setError('')
    updateProject(
      {
        projectId,
        patch: {
          name: name.trim(),
          color,
          description: description.trim() || null,
          lead_id: leadId,
          status,
          due_date: dueDate || null,
        },
      },
      {
        onError: (e) => setError(e.message),
      }
    )
  }

  const applyCustomHex = () => {
    const hex = customHexInput.trim().replace(/^#?/, '#')
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
      setError('Use a 6-digit hex like #4F8FE6.')
      return
    }
    setError('')
    setColor(hex)
    setCustomHexOpen(false)
  }

  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return members
    const q = memberSearch.toLowerCase()
    return members.filter(
      (m) =>
        memberLabel(m).toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
    )
  }, [members, memberSearch])

  return (
    <div className="flex-1 min-h-0 flex flex-col p-6 gap-6">
      {/* Toolbar */}
      <div className="shrink-0 flex flex-col gap-[5px]">
        <p
          className="text-[10px] font-medium uppercase tracking-[1.5px]"
          style={{ color: resolveProjectColor(project?.color) }}
        >
          {(project?.name ?? '').toUpperCase()} · SETTINGS
        </p>
        <h1 className="text-black text-[35px] font-semibold leading-tight">
          Project{' '}
          <em
            className="italic font-semibold text-gray-main"
            style={{ fontFamily: 'Inter, ui-sans-serif, sans-serif' }}
          >
            details.
          </em>
        </h1>
      </div>

      {!canEdit && project && (
        <div className="shrink-0 bg-brown-light border border-solid border-brown-med/30 rounded-[8px] px-[15px] py-[10px] flex items-center gap-[10px]">
          <Icon name="Pin" size={13} className="text-brown-med" />
          <p className="text-brown-med text-[12px]">
            You're viewing in read-only mode. Only the project lead or an admin
            can edit these details.
          </p>
        </div>
      )}

      {/* Form card — internally scrolls so Save card below stays visible */}
      <div className="flex-1 min-h-0 bg-white-white border border-gray-border-light rounded-[10px] p-[25px] flex flex-col gap-[20px] overflow-y-auto">
        {/* Project header */}
        <div className="flex items-center gap-[15px] pb-[10px]">
          <span
            className={`w-[58px] h-[58px] rounded-[8px] inline-flex items-center justify-center text-[28px] font-bold uppercase shrink-0 ${
              colorMeta?.bg ?? 'bg-blue-light'
            } ${colorMeta?.fg ?? 'text-blue-main'}`}
            style={
              isCustomHex
                ? { backgroundColor: color + '33', color }
                : undefined
            }
          >
            {(name || project?.name || '?').charAt(0)}
          </span>
          <div className="flex flex-col gap-[2px] min-w-0">
            <span className="text-black text-[24px] font-semibold truncate">
              {name || project?.name || 'Project'}
            </span>
            <span className="text-gray-secondary text-[12px]">
              {org?.name ?? 'Organization Name'}
            </span>
          </div>
        </div>

        {/* Name + Colour row */}
        <div className="grid grid-cols-[1fr_auto_auto] gap-[15px] items-end">
          <Input
            label="PROJECT NAME"
            placeholder="Apollo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="!max-w-none"
          />
          <div className="flex flex-col gap-[5px]">
            <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
              Project Colour
            </label>
            <div className="bg-white-white flex items-center gap-[5px] p-[3px] rounded-[8px] border border-gray-border h-[39px]">
              {COLORS.map((c) => {
                const active = color === c.key
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setColor(c.key)}
                    className={`w-[31px] h-[31px] rounded-[3px] inline-flex items-center justify-center text-[14px] font-bold uppercase transition-all ${
                      c.bg
                    } ${c.fg} ${
                      active ? `border-2 border-solid ${c.ring}` : 'border border-transparent'
                    }`}
                    aria-pressed={active}
                  >
                    A
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex flex-col gap-[5px]">
            <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px] invisible">
              .
            </label>
            <button
              ref={customHexTriggerRef}
              type="button"
              onClick={() => {
                if (customHexOpen) {
                  setCustomHexOpen(false)
                  setCustomHexAnchor(null)
                  return
                }
                setCustomHexInput(isCustomHex ? color : '')
                setCustomHexAnchor(
                  customHexTriggerRef.current?.getBoundingClientRect() ?? null
                )
                setCustomHexOpen(true)
              }}
              className={`h-[39px] px-[12px] rounded-[8px] border border-solid border-gray-border bg-white-white text-[12px] inline-flex items-center gap-[6px] hover:bg-white-item transition-colors ${
                isCustomHex ? 'text-black font-semibold' : 'text-black'
              }`}
            >
              🎨 Custom hex
            </button>
          </div>
        </div>

        {/* Description */}
        <div className="flex flex-col gap-[5px]">
          <div className="flex items-baseline gap-[8px]">
            <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
              Description
            </label>
            <span className="text-gray-secondary text-[10px]">markdown supported</span>
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What's this project about?"
            className="bg-white-white border border-solid border-gray-border rounded-[8px] px-[14px] py-[10px] text-[12px] text-black outline-none focus:border-primary-main resize-none"
          />
        </div>

        {/* Lead + Due date + Status row */}
        <div className="grid grid-cols-[1fr_180px_1fr] gap-[15px] items-end">
          <div className="flex flex-col gap-[5px]">
            <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
              Project Lead *
            </label>
            <button
              ref={leadTriggerRef}
              type="button"
              onClick={() => {
                if (leadPickerOpen) {
                  setLeadPickerOpen(false)
                  setLeadAnchor(null)
                } else {
                  setLeadAnchor(
                    leadTriggerRef.current?.getBoundingClientRect() ?? null
                  )
                  setLeadPickerOpen(true)
                }
              }}
              className="bg-white-white border border-solid border-gray-border rounded-[8px] px-[12px] py-[6px] h-[48px] flex items-center gap-[10px] hover:border-primary-main"
            >
              {lead ? (
                <>
                  <UserGroup members={[userToMember(lead)]} size={28} />
                  <span className="flex flex-col items-start min-w-0">
                    <span className="text-black text-[13px] font-semibold truncate">
                      {memberLabel(lead)}
                    </span>
                    {lead.job_title && (
                      <span className="text-gray-secondary text-[10px] truncate">
                        {lead.job_title}
                      </span>
                    )}
                  </span>
                </>
              ) : (
                <span className="text-gray-secondary text-[12px]">— pick lead —</span>
              )}
              <Icon
                name="ArrowRight"
                size={12}
                className={`ml-auto text-gray-secondary transition-transform ${
                  leadPickerOpen ? 'rotate-90' : ''
                }`}
              />
            </button>
          </div>

          {/* Due date — same floating DatePicker the create-project modal uses,
              persisted to projects.due_date on Save. */}
          <div className="flex flex-col gap-[5px]">
            <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
              Due Date
            </label>
            <button
              ref={dateTriggerRef}
              type="button"
              disabled={!canEdit}
              onClick={() => {
                if (datePickerAnchor) setDatePickerAnchor(null)
                else
                  setDatePickerAnchor(
                    dateTriggerRef.current?.getBoundingClientRect() ?? null,
                  )
              }}
              className="bg-white-item border border-solid border-gray-border rounded-[8px] px-[12px] h-[48px] flex items-center gap-[8px] text-left hover:border-primary-main disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Icon name="Calendar" size={13} className="text-gray-secondary shrink-0" />
              <span
                className={`flex-1 text-[12px] ${
                  dueDate ? 'text-black font-semibold' : 'text-gray-secondary'
                }`}
              >
                {dueDate
                  ? new Date(dueDate + 'T00:00:00').toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'Pick a date'}
              </span>
              <Icon
                name="ArrowRight"
                size={12}
                className={`ml-auto text-gray-secondary transition-transform ${
                  datePickerAnchor ? 'rotate-90' : ''
                }`}
              />
            </button>
          </div>

          {/* Status */}
          <div className="flex flex-col gap-[5px]">
            <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
              Status *
            </label>
            <div className="bg-white-item flex items-center gap-[3px] p-[3px] rounded-[8px] h-[48px]">
              {STATUSES.map((s) => {
                const active = status === s.key
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setStatus(s.key)}
                    className={`flex-1 flex items-center justify-center px-[8px] py-[5px] rounded-[3px] text-[12px] font-semibold whitespace-nowrap transition-colors ${
                      active
                        ? `${s.activeBg} ${s.activeText}`
                        : 'bg-white-item text-black hover:bg-white-white'
                    }`}
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Members */}
        <div className="flex flex-col gap-[10px] pt-[5px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-[8px]">
              <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                Members
              </label>
              <span
                className="text-gray-secondary text-[10px] tracking-[0.5px]"
                style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
              >
                {members.length} added
              </span>
            </div>
            <button
              type="button"
              disabled
              title="Inviting members is not available yet"
              className="inline-flex items-center gap-[6px] text-[10px] font-semibold uppercase tracking-[1px] text-gray-secondary cursor-not-allowed"
            >
              <Icon name="Add" size={12} />
              Invite by email
            </button>
          </div>

          {/* Member search (disabled — admin add not yet supported) */}
          <div
            title="Adding members is not available yet"
            className="bg-gray-extra-light border border-solid border-gray-border rounded-[8px] px-[14px] py-[10px] flex items-center gap-[8px] text-gray-secondary text-[12px] cursor-not-allowed"
          >
            <Icon name="Search" size={13} />
            <span>Add member · Start typing a name</span>
          </div>

          {/* Members list */}
          <div className="flex flex-col gap-[5px]">
            {filteredMembers.length === 0 ? (
              <p className="px-[10px] py-[15px] text-gray-secondary text-[11px] text-center">
                No members yet.
              </p>
            ) : (
              filteredMembers.map((m) => (
                <div
                  key={m.id}
                  className="bg-white-main border border-solid border-gray-border-light rounded-[8px] px-[14px] py-[8px] flex items-center justify-between gap-[10px]"
                >
                  <span className="flex items-center gap-[10px] min-w-0">
                    <UserGroup members={[userToMember(m)]} size={28} />
                    <span className="flex flex-col min-w-0">
                      <span className="text-black text-[13px] font-semibold truncate">
                        {memberLabel(m)}
                      </span>
                      {m.job_title && (
                        <span className="text-gray-secondary text-[10px] truncate">
                          {m.job_title}
                        </span>
                      )}
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled
                    title="Removing members is not available yet"
                    aria-label="Remove member"
                    className="text-gray-secondary cursor-not-allowed inline-flex items-center justify-center w-[24px] h-[24px]"
                  >
                    <Icon name="Cross" size={12} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Suggested footer */}
          <div className="bg-white-main border border-solid border-gray-border-light rounded-[8px] px-[12px] py-[8px] flex items-center gap-[8px] text-[11px] text-gray-main">
            <span>💡</span>
            <span className="text-gray-secondary uppercase tracking-[0.5px] text-[10px]">
              Suggested from past work:
            </span>
            <span className="text-gray-secondary">Coming soon</span>
          </div>
        </div>

        {error && <p className="text-red-main text-[12px]">{error}</p>}
      </div>

      {/* Save card — always visible at the bottom */}
      <div className="shrink-0 bg-white-white border border-gray-border-light rounded-[10px] px-[25px] py-[15px] flex items-center justify-end gap-[15px]">
        <span
          className="text-gray-secondary text-[12px] tracking-[0.5px]"
          style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
        >
          {members.length} members
        </span>
        <Button
          size="compact"
          onClick={onSave}
          disabled={!dirty || isPending || !canEdit}
          title={
            !canEdit
              ? 'Only the project lead or an admin can save changes'
              : !dirty
                ? 'No changes to save'
                : undefined
          }
        >
          {isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>

      {/* Floating custom-hex popover — `position: fixed` so it escapes the
       *  scrolling form-card overflow. */}
      {customHexOpen && customHexAnchor && (
        <div
          ref={customHexPopupRef}
          style={{
            position: 'fixed',
            top: customHexAnchor.bottom + 4,
            left: Math.max(8, customHexAnchor.right - 200),
            width: 200,
            zIndex: 100,
          }}
          className="bg-white-white border border-solid border-gray-border-light rounded-[8px] shadow-md p-[10px] flex flex-col gap-[6px]"
        >
          <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
            Hex value
          </label>
          <input
            type="text"
            placeholder="#4F8FE6"
            value={customHexInput}
            onChange={(e) => setCustomHexInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyCustomHex()
            }}
            autoFocus
            className="bg-white-white border border-solid border-gray-border rounded-[8px] px-[10px] py-[6px] text-[12px] outline-none focus:border-primary-main"
          />
          <Button size="compact" onClick={applyCustomHex}>
            Apply
          </Button>
        </div>
      )}

      {/* Floating lead picker — same fixed-positioning pattern as the rest of
       *  the app's dropdowns. */}
      {leadPickerOpen && leadAnchor && (
        <div
          ref={leadPopupRef}
          style={{
            position: 'fixed',
            top: leadAnchor.bottom + 4,
            left: leadAnchor.left,
            width: leadAnchor.width,
            zIndex: 100,
          }}
          className="bg-white-white border border-solid border-gray-border rounded-[8px] shadow-md max-h-[260px] overflow-y-auto"
        >
          {members.length === 0 ? (
            <p className="px-[12px] py-[8px] text-gray-secondary text-[11px]">
              No members yet.
            </p>
          ) : (
            members.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setLeadId(m.id)
                  setLeadPickerOpen(false)
                  setLeadAnchor(null)
                }}
                className={`w-full flex items-center gap-[10px] px-[12px] py-[8px] text-left hover:bg-white-item ${
                  leadId === m.id ? 'bg-blue-light/30' : ''
                }`}
              >
                <UserGroup members={[userToMember(m)]} size={24} />
                <span className="flex flex-col min-w-0">
                  <span className="text-black text-[12px] truncate">
                    {memberLabel(m)}
                  </span>
                  {m.job_title && (
                    <span className="text-gray-secondary text-[10px] truncate">
                      {m.job_title}
                    </span>
                  )}
                </span>
              </button>
            ))
          )}
        </div>
      )}

      {/* Floating date picker for the due-date field — same component the
          create-project modal uses. */}
      <DatePicker
        anchorRect={datePickerAnchor}
        value={dueDate || null}
        onChange={(next) => setDueDate(next ?? '')}
        onClose={() => setDatePickerAnchor(null)}
      />
    </div>
  )
}
