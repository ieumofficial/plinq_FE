import { useEffect, useMemo, useRef, useState } from 'react'
import DatePicker from './ui/DatePicker'
import Input from './ui/Input'
import Button from './ui/Button'
import Icon from './ui/Icon'
import { useQueryClient } from '@tanstack/react-query'
import { createProject } from '../lib/queries'
import { useCurrentUser, useOrgMembers } from '../lib/hooks'
import { queryKeys } from '../lib/queryKeys'
import type { ProjectRoleDb, ProjectStatusDb, UserRow } from '../lib/types'
import InviteByEmailModal from './InviteByEmailModal'

type Props = {
  open: boolean
  /** Org context — used to pull candidate members. */
  orgId: string | null
  orgName?: string | null
  onClose: () => void
  onCreated?: (id: string) => void
}

type ColorKey = 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'turquoise'

const COLORS: { key: ColorKey; bg: string; fg: string; ring: string }[] = [
  { key: 'blue', bg: 'bg-blue-light', fg: 'text-blue-main', ring: 'border-blue-main' },
  { key: 'green', bg: 'bg-[#DCEBE0]', fg: 'text-green-main', ring: 'border-green-main' },
  { key: 'amber', bg: 'bg-brown-light', fg: 'text-brown-med', ring: 'border-brown-med' },
  { key: 'red', bg: 'bg-red-light', fg: 'text-red-main', ring: 'border-red-main' },
  { key: 'purple', bg: 'bg-purple-light', fg: 'text-purple-main', ring: 'border-purple-main' },
  { key: 'turquoise', bg: 'bg-turquoise-light', fg: 'text-turquoise-main', ring: 'border-turquoise-main' },
]

// Status pill colors (matches StatusLabelBig at md size)
const STATUSES: { key: ProjectStatusDb; label: string; activeBg: string; activeText: string }[] = [
  { key: 'planned', label: 'Planned', activeBg: 'bg-[#E6ECEF]', activeText: 'text-primary-main' },
  { key: 'in_progress', label: 'In progress', activeBg: 'bg-blue-light', activeText: 'text-blue-main' },
  { key: 'review', label: 'Review', activeBg: 'bg-brown-light', activeText: 'text-brown-med' },
  { key: 'blocked', label: 'Blocked', activeBg: 'bg-red-light', activeText: 'text-red-main' },
  { key: 'done', label: 'Done', activeBg: 'bg-[#DCEBE0]', activeText: 'text-green-main' },
]

function memberLabel(u: UserRow) {
  return u.nickname || `${u.first_name} ${u.last_name}`.trim() || u.email
}

type RoleKey = 'editor' | 'admin' | 'readonly'
const ROLE_STYLES: Record<
  RoleKey,
  { label: string; bg: string; text: string }
> = {
  editor: { label: 'Editor', bg: 'bg-blue-light', text: 'text-blue-main' },
  admin: { label: 'Admin', bg: 'bg-primary-dark', text: 'text-white' },
  readonly: { label: 'Read-only', bg: 'bg-gray-extra-light', text: 'text-gray-main' },
}
const ROLE_ORDER: RoleKey[] = ['editor', 'admin', 'readonly']

export default function CreateProjectModal({
  open,
  orgId,
  orgName,
  onClose,
  onCreated,
}: Props) {
  const { data: meRaw } = useCurrentUser()
  const me: UserRow | null = meRaw ?? null
  const { data: orgMembers = [] } = useOrgMembers(orgId)
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [color, setColor] = useState<ColorKey>('blue')
  const [customHex, setCustomHex] = useState<string | null>(null)
  const [hexInputOpen, setHexInputOpen] = useState(false)
  const [hexInput, setHexInput] = useState('')
  const [description, setDescription] = useState('')
  const [leadId, setLeadId] = useState<string | null>(null)
  const [leadPickerOpen, setLeadPickerOpen] = useState(false)
  const [leadAnchor, setLeadAnchor] = useState<DOMRect | null>(null)
  const leadTriggerRef = useRef<HTMLButtonElement>(null)
  const [status, setStatus] = useState<ProjectStatusDb>('planned')
  /** Project due date (YYYY-MM-DD). Persisted to projects.due_date. */
  const [dueDate, setDueDate] = useState<string>('')
  const [datePickerAnchor, setDatePickerAnchor] = useState<DOMRect | null>(null)
  const dateTriggerRef = useRef<HTMLButtonElement>(null)
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [memberRoles, setMemberRoles] = useState<Record<string, 'editor' | 'admin' | 'readonly'>>({})
  const [memberSearch, setMemberSearch] = useState('')
  const [emailInvites, setEmailInvites] = useState<{ email: string; role: ProjectRoleDb }[]>([])
  const [inviteOpen, setInviteOpen] = useState(false)
  /** Which member-row's permission dropdown is open, and where the chip is.
   *  `kind=user` keys to memberIds, `kind=invite` keys to emailInvites index. */
  const [roleDropdown, setRoleDropdown] = useState<
    | { kind: 'user'; id: string; rect: DOMRect }
    | { kind: 'invite'; idx: number; rect: DOMRect }
    | null
  >(null)

  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Reset on open
  useEffect(() => {
    if (!open) return
    setName('')
    setColor('blue')
    setCustomHex(null)
    setHexInputOpen(false)
    setHexInput('')
    setDescription('')
    setStatus('planned')
    setMemberIds([])
    setMemberSearch('')
    setEmailInvites([])
    setInviteOpen(false)
    setError('')
    setSubmitting(false)
  }, [open])

  // Default lead = current user when modal opens
  useEffect(() => {
    if (open && me && !leadId) setLeadId(me.id)
  }, [open, me, leadId])

  // Esc / Cmd+Enter — Esc closes any open dropdown / sub-modal first; only
  // closes the modal when nothing transient is showing.
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (inviteOpen) return // InviteByEmailModal owns its own Esc handling
        if (roleDropdown) {
          setRoleDropdown(null)
          return
        }
        if (hexInputOpen) {
          setHexInputOpen(false)
          return
        }
        if (leadPickerOpen) {
          setLeadPickerOpen(false)
          return
        }
        onClose()
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        void submit()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    name,
    color,
    description,
    status,
    leadId,
    memberIds,
    hexInputOpen,
    leadPickerOpen,
    inviteOpen,
    roleDropdown,
  ])

  // Role dropdown auto-close on outside click, scroll, or window resize.
  // We need the ref so clicks INSIDE the dropdown aren't treated as outside —
  // otherwise the dropdown unmounts before its onClick can fire, the click
  // bubbles to the overlay, and the whole modal closes.
  const roleDropdownPopupRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!roleDropdown) return
    const onMouseDown = (e: MouseEvent) => {
      if (roleDropdownPopupRef.current?.contains(e.target as Node)) return
      setRoleDropdown(null)
    }
    const onScrollOrResize = () => setRoleDropdown(null)
    const id = setTimeout(() => {
      document.addEventListener('mousedown', onMouseDown)
    }, 0)
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      clearTimeout(id)
      document.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [roleDropdown])

  const addedMembers = useMemo(
    () => orgMembers.filter((u) => memberIds.includes(u.id)),
    [orgMembers, memberIds]
  )
  const candidateMembers = useMemo(() => {
    const q = memberSearch.toLowerCase().trim()
    return orgMembers.filter((u) => {
      if (memberIds.includes(u.id)) return false
      if (u.id === leadId) return false
      if (!q) return true
      return (
        memberLabel(u).toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      )
    })
  }, [orgMembers, memberIds, leadId, memberSearch])

  const colorMeta = COLORS.find((c) => c.key === color)!
  const initial = (name.trim() || 'A').charAt(0).toUpperCase()

  const isValidHex = (h: string) => /^#[0-9A-Fa-f]{6}$/.test(h.trim())
  const applyCustomHex = () => {
    if (isValidHex(hexInput)) {
      setCustomHex(hexInput.trim().toUpperCase())
      setHexInputOpen(false)
    }
  }

  const submit = async () => {
    if (!name.trim()) {
      setError('Project name is required.')
      return
    }
    if (!leadId) {
      setError('Project lead is required.')
      return
    }
    setError('')
    setSubmitting(true)
    const result = await createProject({
      name,
      description: description || undefined,
      color: customHex ?? color,
      status,
      // Pass the org explicitly. The shells already wire orgId from
      // `useActiveOrg`; without forwarding it here, createProject falls
      // back to "user's single org" and errors out for multi-org users.
      org_id: orgId ?? undefined,
      due_date: dueDate || null,
      members: memberIds.map((uid) => {
        const r = memberRoles[uid] ?? 'editor'
        return {
          user_id: uid,
          role:
            r === 'editor' ? 'editor' : r === 'admin' ? 'admin' : 'readonly',
        }
      }),
      emailInvites: emailInvites.length > 0 ? emailInvites : undefined,
    })
    setSubmitting(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })
    queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all })
    onCreated?.(result.id)
    onClose()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white-white rounded-[10px] shadow-2xl w-[717px] max-w-[95vw] max-h-[92vh] overflow-y-auto overflow-x-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-[20px] pt-[20px] pb-[20px] border-b border-gray-border-light">
          <p className="text-blue-main text-[10px] font-semibold uppercase tracking-[1.5px]">
            New Project · {orgName ?? 'Org Name'}
          </p>
          <h2 className="text-black text-[20px] font-semibold mt-2">Spin up a new project</h2>
          <p className="text-gray-main text-[12px] mt-1">
            Projects own tasks, meetings, channels, and a knowledge base. You can change all
            of these later.
          </p>
        </div>

        {/* Body */}
        <div className="px-[20px] py-[20px] flex flex-col gap-[15px]">
          {/* Avatar + Name */}
          <div className="flex items-end gap-4">
            {customHex ? (
              <span
                className="w-[50px] h-[50px] rounded-[6px] inline-flex items-center justify-center text-[24px] font-bold uppercase shrink-0"
                style={{
                  backgroundColor: customHex,
                  color: '#FFFFFF',
                  fontFamily: 'Geist Mono, ui-monospace, monospace',
                }}
              >
                {initial}
              </span>
            ) : (
              <span
                className={`w-[50px] h-[50px] rounded-[6px] inline-flex items-center justify-center text-[24px] font-bold uppercase shrink-0 ${colorMeta.bg} ${colorMeta.fg}`}
                style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
              >
                {initial}
              </span>
            )}
            <div className="flex-1">
              <Input
                label="PROJECT NAME *"
                placeholder="Apollo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                className="!max-w-none"
              />
            </div>
          </div>

          {/* Color picker */}
          <div className="flex items-end justify-between">
            <div>
              <p className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px] mb-2">
                Project colour
              </p>
              <div className="flex items-center gap-[5px]">
                {COLORS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => {
                      setColor(c.key)
                      setCustomHex(null)
                    }}
                    className={`w-[30px] h-[30px] rounded-[5px] inline-flex items-center justify-center text-[14px] font-bold uppercase ${c.bg} ${c.fg} border-2 ${
                      color === c.key && !customHex ? c.ring : 'border-transparent'
                    }`}
                    style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
                    aria-label={`Color ${c.key}`}
                  >
                    {initial}
                  </button>
                ))}
                {customHex && (
                  <button
                    type="button"
                    onClick={() => setHexInputOpen(true)}
                    className="w-[30px] h-[30px] rounded-[5px] inline-flex items-center justify-center text-[14px] font-bold uppercase text-white border-2"
                    style={{
                      backgroundColor: customHex,
                      borderColor: customHex,
                      fontFamily: 'Geist Mono, ui-monospace, monospace',
                    }}
                    aria-label="Custom color"
                  >
                    {initial}
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hexInputOpen && (
                <input
                  type="text"
                  value={hexInput}
                  onChange={(e) => setHexInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      applyCustomHex()
                    }
                    if (e.key === 'Escape') setHexInputOpen(false)
                  }}
                  placeholder="#16242E"
                  autoFocus
                  className="bg-white-white border border-gray-border rounded-[5px] px-[10px] py-[4px] text-[12px] text-black outline-none focus:border-primary-main w-[90px]"
                  style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
                />
              )}
              <button
                type="button"
                onClick={() => {
                  if (hexInputOpen && isValidHex(hexInput)) applyCustomHex()
                  else setHexInputOpen(!hexInputOpen)
                }}
                className="bg-white-white border border-gray-border-light rounded-[5px] px-[12px] py-[6px] text-[12px] text-black inline-flex items-center gap-1 hover:bg-white-item"
              >
                🎨 {hexInputOpen ? 'Apply' : 'Custom hex'}
              </button>
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline gap-2">
              <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                Description
              </label>
              <span className="text-gray-secondary text-[10px]">markdown supported</span>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="bg-white-white border border-gray-border rounded-lg px-4 py-3 text-[12px] text-black outline-none focus:border-primary-main resize-none"
              placeholder="What is this project about?"
            />
          </div>

          {/* Lead + Status — Figma: 283.5px + 15gap + 355px */}
          <div className="grid grid-cols-[283.5px_355px] gap-[15px]">
            <div className="flex flex-col gap-1 relative">
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
                className="bg-white-white border border-gray-border rounded-lg px-3 py-1.5 text-left flex items-center gap-2 h-[39px] hover:border-primary-main"
              >
                {(() => {
                  const lead = orgMembers.find((u) => u.id === leadId) ?? me
                  if (!lead) return <span className="text-gray-secondary text-[12px]">— select —</span>
                  return (
                    <>
                      <span className="w-[25px] h-[25px] rounded-full bg-gray-extra-light inline-flex items-center justify-center text-[10px] font-semibold text-gray-main shrink-0">
                        {memberLabel(lead).charAt(0).toUpperCase()}
                      </span>
                      <span className="flex flex-col min-w-0 flex-1">
                        <span className="text-[12px] text-black font-semibold truncate leading-tight">
                          {memberLabel(lead)}
                        </span>
                        {lead.job_title && (
                          <span className="text-[9px] text-gray-secondary truncate leading-tight">
                            {lead.job_title}
                          </span>
                        )}
                      </span>
                      <Icon
                        name="ArrowRight"
                        size={12}
                        style={{ color: '#94A0AA' }}
                        className={`transition-transform ${
                          leadPickerOpen ? 'rotate-90' : ''
                        }`}
                      />
                    </>
                  )
                })()}
              </button>
              {leadPickerOpen && leadAnchor && (
                <div
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'fixed',
                    top: leadAnchor.bottom + 4,
                    left: leadAnchor.left,
                    width: leadAnchor.width,
                    zIndex: 100,
                  }}
                  className="bg-white-white border border-gray-border rounded-lg shadow-lg max-h-[260px] overflow-y-auto">
                  {[...(me ? [me] : []), ...orgMembers.filter((u) => u.id !== me?.id)].map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        setLeadId(u.id)
                        setLeadPickerOpen(false)
                        setLeadAnchor(null)
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-white-item text-left ${
                        leadId === u.id ? 'bg-blue-light/30' : ''
                      }`}
                    >
                      <span className="w-[25px] h-[25px] rounded-full bg-gray-extra-light inline-flex items-center justify-center text-[10px] font-semibold text-gray-main shrink-0">
                        {memberLabel(u).charAt(0).toUpperCase()}
                      </span>
                      <span className="flex flex-col min-w-0 flex-1">
                        <span className="text-[12px] text-black truncate">
                          {memberLabel(u)}
                          {u.id === me?.id && <span className="text-gray-secondary"> (you)</span>}
                        </span>
                        {u.job_title && (
                          <span className="text-[10px] text-gray-secondary truncate">
                            {u.job_title}
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                Status *
              </label>
              <div className="bg-white-item flex items-start gap-[5px] p-[5px] rounded-[5px] h-[39px]">
                {STATUSES.map((s) => {
                  const selected = status === s.key
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setStatus(s.key)}
                      className={`flex items-center justify-center px-[10px] py-[5px] rounded-[5px] text-[12px] font-semibold whitespace-nowrap transition-colors ${
                        selected
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

          {/* Due Date — Figma 1054:11820 adds this. Stored locally only since
              `projects` table has no due_date column today. */}
          <div className="flex flex-col gap-1 w-[200px]">
            <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
              Due Date
            </label>
            <button
              ref={dateTriggerRef}
              type="button"
              title="Project due date isn't stored yet — visual only."
              onClick={() => {
                if (datePickerAnchor) setDatePickerAnchor(null)
                else
                  setDatePickerAnchor(
                    dateTriggerRef.current?.getBoundingClientRect() ?? null
                  )
              }}
              className="bg-white-white border border-gray-border rounded-lg px-3 h-[39px] flex items-center gap-[8px] text-left hover:border-primary-main"
            >
              <Icon
                name="Calendar"
                size={13}
                className="text-gray-secondary shrink-0"
              />
              <span
                className={`flex-1 text-[12px] ${
                  dueDate ? 'text-black font-semibold' : 'text-gray-secondary'
                }`}
              >
                {dueDate
                  ? new Date(dueDate + 'T00:00:00').toLocaleDateString(
                      'en-US',
                      { month: 'long', day: 'numeric', year: 'numeric' }
                    )
                  : 'Pick a date'}
              </span>
            </button>
          </div>

          {/* Members */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-2">
                <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                  Members
                </label>
                <span className="text-gray-secondary text-[10px]">
                  {memberIds.length + emailInvites.length} added
                </span>
              </div>
              <button
                type="button"
                onClick={() => setInviteOpen(true)}
                className="text-gray-main text-[11px] inline-flex items-center gap-1 hover:text-black"
              >
                <Icon name="Add" size={12} />
                Invite by email
              </button>
            </div>

            <div className="border border-gray-border rounded-lg overflow-hidden">
              {/* Search */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-border-light">
                <Icon name="Search" size={15} style={{ color: '#94A0AA' }} />
                <input
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Add team or member · Start typing a name"
                  className="flex-1 bg-transparent outline-none text-[12px] text-black placeholder:text-gray-secondary"
                />
              </div>

              {/* Search results (collapsed if no query) */}
              {memberSearch.trim() && (
                <div className="max-h-[140px] overflow-y-auto border-b border-gray-border-light">
                  {candidateMembers.length === 0 ? (
                    <p className="px-3 py-2 text-gray-secondary text-[11px]">No matches</p>
                  ) : (
                    candidateMembers.slice(0, 8).map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setMemberIds((prev) => [...prev, u.id])
                          setMemberSearch('')
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-white-item flex items-center gap-2"
                      >
                        <span className="w-6 h-6 rounded-full bg-gray-extra-light inline-flex items-center justify-center text-[10px] font-semibold text-gray-main">
                          {memberLabel(u).charAt(0).toUpperCase()}
                        </span>
                        <span className="text-[12px] text-black">{memberLabel(u)}</span>
                        {u.job_title && (
                          <span className="text-[10px] text-gray-secondary">{u.job_title}</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Added members list */}
              {addedMembers.length > 0 && (
                <div className="divide-y divide-gray-border-light">
                  {addedMembers.map((u) => {
                    const role = memberRoles[u.id] ?? 'editor'
                    const r = ROLE_STYLES[role]
                    const dropdownOpen =
                      roleDropdown?.kind === 'user' && roleDropdown.id === u.id
                    return (
                      <div key={u.id} className="flex items-center justify-between px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-[25px] h-[25px] rounded-full bg-gray-extra-light inline-flex items-center justify-center text-[10px] font-semibold text-gray-main shrink-0">
                            {memberLabel(u).charAt(0).toUpperCase()}
                          </span>
                          <div className="flex flex-col min-w-0">
                            <span className="text-[12px] text-black font-semibold truncate leading-tight">
                              {memberLabel(u)}
                            </span>
                            {u.job_title && (
                              <span className="text-[9px] text-gray-secondary truncate leading-tight">
                                {u.job_title}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              if (dropdownOpen) {
                                setRoleDropdown(null)
                                return
                              }
                              const rect = (
                                e.currentTarget as HTMLButtonElement
                              ).getBoundingClientRect()
                              setRoleDropdown({ kind: 'user', id: u.id, rect })
                            }}
                            className={`inline-flex items-center gap-1 px-[10px] py-[4px] rounded-[5px] text-[10px] font-semibold uppercase tracking-[0.3px] ${r.bg} ${r.text} hover:opacity-90`}
                          >
                            {r.label}
                            <Icon
                              name="ArrowRight"
                              size={11}
                              className={`transition-transform ${
                                dropdownOpen ? 'rotate-90' : ''
                              }`}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setMemberIds((prev) => prev.filter((id) => id !== u.id))
                            }
                            className="text-gray-secondary hover:text-red-main p-1"
                            aria-label="Remove"
                          >
                            <Icon name="Cross" size={12} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Email invites (pending) */}
              {emailInvites.length > 0 && (
                <div className="divide-y divide-gray-border-light border-t border-gray-border-light">
                  {emailInvites.map((inv, i) => {
                    const r = ROLE_STYLES[inv.role as RoleKey]
                    const dropdownOpen =
                      roleDropdown?.kind === 'invite' && roleDropdown.idx === i
                    return (
                      <div
                        key={`${inv.email}-${i}`}
                        className="flex items-center justify-between px-3 py-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-[25px] h-[25px] rounded-full bg-gray-extra-light inline-flex items-center justify-center text-gray-secondary shrink-0">
                            <Icon name="Email" size={12} />
                          </span>
                          <div className="flex flex-col min-w-0">
                            <span className="text-[12px] text-black truncate leading-tight">
                              {inv.email}
                            </span>
                            <span className="text-[9px] text-gray-secondary leading-tight">
                              Pending invite
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              if (dropdownOpen) {
                                setRoleDropdown(null)
                                return
                              }
                              const rect = (
                                e.currentTarget as HTMLButtonElement
                              ).getBoundingClientRect()
                              setRoleDropdown({ kind: 'invite', idx: i, rect })
                            }}
                            className={`inline-flex items-center gap-1 px-[10px] py-[4px] rounded-[5px] text-[10px] font-semibold uppercase tracking-[0.3px] ${r.bg} ${r.text} hover:opacity-90`}
                          >
                            {r.label}
                            <Icon
                              name="ArrowRight"
                              size={11}
                              className={`transition-transform ${
                                dropdownOpen ? 'rotate-90' : ''
                              }`}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setEmailInvites((prev) => prev.filter((_, idx) => idx !== i))
                            }
                            className="text-gray-secondary hover:text-red-main p-1"
                            aria-label="Remove invite"
                          >
                            <Icon name="Cross" size={12} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {error && <p className="text-red-main text-[12px]">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-[20px] py-[15px] border-t border-gray-border-light flex items-center justify-between">
          <p className="text-gray-secondary text-[11px]">⌘ ↵ to create</p>
          <div className="flex items-center gap-3">
            <span className="text-gray-main text-[11px]">
              {memberIds.length + emailInvites.length} members + 1 lead
            </span>
            <Button variant="subtle" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={submitting || !name.trim() || !leadId}>
              {submitting ? 'Creating…' : 'Create Project'}
            </Button>
          </div>
        </div>
      </div>

      <InviteByEmailModal
        open={inviteOpen}
        variant="project"
        onClose={() => setInviteOpen(false)}
        onSubmit={async ({ email, role }) => {
          if (emailInvites.some((i) => i.email === email)) {
            throw new Error('Already invited.')
          }
          setEmailInvites((prev) => [...prev, { email, role: role ?? 'editor' }])
        }}
      />

      {/* Floating date picker for the due-date field */}
      <DatePicker
        anchorRect={datePickerAnchor}
        value={dueDate || null}
        onChange={(next) => setDueDate(next ?? '')}
        onClose={() => setDatePickerAnchor(null)}
      />

      {/* Floating role dropdown — shared between member rows and email-invite
       *  rows. Closed by clicking outside the modal, Esc, or scroll/resize. */}
      {roleDropdown && (
        <div
          ref={roleDropdownPopupRef}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: roleDropdown.rect.bottom + 4,
            left: Math.max(8, roleDropdown.rect.right - 130),
            width: 130,
            zIndex: 110,
          }}
          className="bg-white-white border border-gray-border rounded-lg shadow-lg overflow-hidden"
        >
          {ROLE_ORDER.map((key) => {
            const meta = ROLE_STYLES[key]
            const currentRole =
              roleDropdown.kind === 'user'
                ? memberRoles[roleDropdown.id] ?? 'editor'
                : emailInvites[roleDropdown.idx]?.role ?? 'editor'
            const active = key === currentRole
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  if (roleDropdown.kind === 'user') {
                    setMemberRoles((prev) => ({ ...prev, [roleDropdown.id]: key }))
                  } else {
                    const idx = roleDropdown.idx
                    setEmailInvites((prev) =>
                      prev.map((inv, i) => (i === idx ? { ...inv, role: key } : inv))
                    )
                  }
                  setRoleDropdown(null)
                }}
                className={`w-full px-3 py-2 text-left text-[11px] flex items-center justify-between hover:bg-white-item ${
                  active ? 'bg-white-item' : ''
                }`}
              >
                <span className={`font-semibold ${active ? 'text-black' : 'text-gray-main'}`}>
                  {meta.label}
                </span>
                {active && (
                  <span
                    aria-hidden
                    className="text-primary-main text-[10px] font-bold"
                  >
                    ✓
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
