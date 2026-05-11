import { useEffect, useMemo, useState } from 'react'
import Input from './ui/Input'
import Button from './ui/Button'
import Icon from './ui/Icon'
import ProjectLabel from './ui/ProjectLabel'
import { useQueryClient } from '@tanstack/react-query'
import { createMeeting } from '../lib/queries'
import { useCurrentUser, useProjectMembers, useUserProjects } from '../lib/hooks'
import { queryKeys } from '../lib/queryKeys'
import type { MeetingRecurrence, MeetingType, UserRow } from '../lib/types'
import InviteByEmailModal from './InviteByEmailModal'

type Props = {
  open: boolean
  defaultProjectId?: string | null
  /** When true, project picker is locked to defaultProjectId (cannot be changed). */
  lockProject?: boolean
  onClose: () => void
  onCreated?: (id: string) => void
}

const MEETING_TYPES: {
  key: MeetingType
  label: string
  activeBg: string
  activeText: string
}[] = [
  { key: 'planning', label: 'Planning', activeBg: 'bg-[#E6ECEF]', activeText: 'text-primary-main' },
  { key: 'check_in', label: 'Check-in', activeBg: 'bg-[#DCEBE0]', activeText: 'text-green-main' },
  { key: 'review', label: 'Review', activeBg: 'bg-brown-light', activeText: 'text-brown-med' },
  {
    key: 'retrospective',
    label: 'Retrospective',
    activeBg: 'bg-purple-light',
    activeText: 'text-purple-main',
  },
]

const LOCATIONS: { key: 'zoom' | 'in_person'; label: string }[] = [
  { key: 'zoom', label: 'Zoom' },
  { key: 'in_person', label: 'In-person' },
]

const RECURRENCES: { key: MeetingRecurrence; label: string }[] = [
  { key: 'once', label: 'Once' },
  { key: 'every_day', label: 'Every day' },
  { key: 'every_week', label: 'Every week' },
  { key: 'every_year', label: 'Every year' },
]

function memberLabel(u: UserRow) {
  return u.nickname || `${u.first_name} ${u.last_name}`.trim() || u.email
}

function combineDateTime(date: string, time: string): string {
  if (!date || !time) return ''
  return new Date(`${date}T${time}`).toISOString()
}

function durationMinutes(start: string, end: string): number {
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return Math.max(0, eh * 60 + em - (sh * 60 + sm))
}

function dayDiffFromToday(iso: string): string {
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

export default function CreateMeetingModal({
  open,
  defaultProjectId,
  lockProject = false,
  onClose,
  onCreated,
}: Props) {
  const { data: meRaw } = useCurrentUser()
  const me: UserRow | null = meRaw ?? null
  const { data: projects = [] } = useUserProjects(me?.id)
  const queryClient = useQueryClient()

  const [title, setTitle] = useState('')
  const [location, setLocation] = useState<'zoom' | 'in_person'>('zoom')
  const [projectId, setProjectId] = useState<string | null>(defaultProjectId ?? null)
  const [projectPickerOpen, setProjectPickerOpen] = useState(false)
  const [meetingType, setMeetingType] = useState<MeetingType>('planning')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('14:00')
  const [endTime, setEndTime] = useState('14:30')
  const [recurrence, setRecurrence] = useState<MeetingRecurrence>('once')
  const [recurrencePickerOpen, setRecurrencePickerOpen] = useState(false)
  const [recurrenceUntil, setRecurrenceUntil] = useState('')
  const [attendeeIds, setAttendeeIds] = useState<string[]>([])
  const [attendeeSearch, setAttendeeSearch] = useState('')
  const [emailInvites, setEmailInvites] = useState<string[]>([])
  const [inviteOpen, setInviteOpen] = useState(false)
  const [agenda, setAgenda] = useState<string[]>([''])

  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Reset on open
  useEffect(() => {
    if (!open) return
    setTitle('')
    setLocation('zoom')
    setProjectId(defaultProjectId ?? null)
    setMeetingType('planning')
    setDate('')
    setStartTime('14:00')
    setEndTime('14:30')
    setRecurrence('once')
    setRecurrenceUntil('')
    setAttendeeIds([])
    setAttendeeSearch('')
    setEmailInvites([])
    setInviteOpen(false)
    setAgenda([''])
    setError('')
    setSubmitting(false)
  }, [open, defaultProjectId])

  // Pre-fill self as attendee + default project
  useEffect(() => {
    if (!open || !me) return
    setAttendeeIds((prev) => (prev.includes(me.id) ? prev : [me.id, ...prev]))
  }, [open, me])

  useEffect(() => {
    if (open && !projectId && projects.length > 0) setProjectId(projects[0].id)
  }, [open, projectId, projects])

  const { data: members = [] } = useProjectMembers(projectId)

  // Esc / Cmd+Enter — Esc closes any open dropdown first; only closes the modal
  // when no dropdown is showing.
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (projectPickerOpen) {
          setProjectPickerOpen(false)
          return
        }
        if (recurrencePickerOpen) {
          setRecurrencePickerOpen(false)
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
    title,
    location,
    projectId,
    meetingType,
    date,
    startTime,
    endTime,
    recurrence,
    recurrenceUntil,
    attendeeIds,
    emailInvites,
    agenda,
    projectPickerOpen,
    recurrencePickerOpen,
  ])

  const project = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId]
  )

  // Pool of users to choose from = project members + current user (in case
  // the user isn't a project member yet, they're still pre-selected as creator).
  const pool = useMemo(() => {
    const seen = new Set<string>()
    const out: UserRow[] = []
    if (me) {
      out.push(me)
      seen.add(me.id)
    }
    for (const m of members) {
      if (!seen.has(m.id)) {
        out.push(m)
        seen.add(m.id)
      }
    }
    return out
  }, [me, members])

  const candidateMembers = useMemo(() => {
    const q = attendeeSearch.toLowerCase().trim()
    return pool.filter((u) => {
      if (attendeeIds.includes(u.id)) return false
      if (!q) return true
      return memberLabel(u).toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    })
  }, [pool, attendeeIds, attendeeSearch])

  const addedAttendees = useMemo(
    () => pool.filter((u) => attendeeIds.includes(u.id)),
    [pool, attendeeIds]
  )

  const totalMin = durationMinutes(startTime, endTime)

  const submit = async () => {
    if (!title.trim()) {
      setError('Meeting title is required.')
      return
    }
    if (!projectId) {
      setError('Project is required.')
      return
    }
    if (!date) {
      setError('Date is required.')
      return
    }
    if (totalMin <= 0) {
      setError('End time must be after start time.')
      return
    }
    if (recurrence !== 'once' && !recurrenceUntil) {
      setError('Repeat until date is required for recurring meetings.')
      return
    }
    setError('')
    setSubmitting(true)
    const result = await createMeeting({
      name: title,
      project_id: projectId,
      scheduled_at: combineDateTime(date, startTime),
      duration_min: totalMin,
      location_or_url: location === 'zoom' ? 'Zoom' : 'In-person',
      meeting_type: meetingType,
      recurrence,
      recurrence_until: recurrence !== 'once' ? recurrenceUntil : null,
      attendeeIds,
      emailInvites,
      agenda: agenda.map((a) => a.trim()).filter(Boolean),
    })
    setSubmitting(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.meetings.all })
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
            New Meeting
            {project ? ` · ${project.name}` : ''}
          </p>
          <h2 className="text-black text-[20px] font-semibold mt-2">
            {title.trim() || 'Untitled meeting'}
          </h2>
          <p className="text-gray-main text-[12px] mt-1">
            AI will draft notes during the meeting and post & assign action items afterwards.
          </p>
        </div>

        {/* Body */}
        <div className="px-[20px] py-[20px] flex flex-col gap-[15px]">
          {/* Title + Location — Figma: 519 + 15gap + 143 = 677 */}
          <div className="grid grid-cols-[519px_143px] gap-[15px]">
            <Input
              label="MEETING TITLE *"
              placeholder="Cutover dry-run"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              className="!max-w-none"
            />
            <div className="flex flex-col gap-1 w-[143px]">
              <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                Location *
              </label>
              <div className="bg-white-item flex items-start gap-[5px] p-[5px] rounded-[5px] h-[39px]">
                {LOCATIONS.map((l) => {
                  const selected = location === l.key
                  return (
                    <button
                      key={l.key}
                      type="button"
                      onClick={() => setLocation(l.key)}
                      className={`flex items-center justify-center px-[10px] py-[5px] rounded-[5px] text-[12px] font-semibold whitespace-nowrap transition-colors ${
                        selected
                          ? 'bg-[#E6ECEF] text-primary-main'
                          : 'bg-white-item text-black hover:bg-white-white'
                      }`}
                    >
                      {l.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Project + Meeting Type — Figma: 337px + 15gap + 325px = 677px */}
          <div className="grid grid-cols-[337px_1fr] gap-[15px]">
            <div className="flex flex-col gap-1 relative">
              <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                Project *
              </label>
              <button
                type="button"
                onClick={() => !lockProject && setProjectPickerOpen((v) => !v)}
                disabled={lockProject}
                className={`bg-white-white border border-gray-border rounded-lg px-3 py-2 text-left flex items-center gap-2 h-[39px] ${
                  lockProject ? 'cursor-not-allowed opacity-90' : 'hover:border-primary-main'
                }`}
              >
                {project ? (
                  <>
                    <ProjectLabel name={project.name} color={project.color} size="sm" />
                    <span className="text-[13px] text-black font-semibold truncate">
                      {project.name}
                    </span>
                    <span className="text-[12px] text-gray-secondary truncate">· Org name</span>
                    {!lockProject && (
                      <span className="ml-auto text-gray-secondary shrink-0">
                        <Icon name="ArrowRight" size={12} />
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-gray-secondary text-[12px]">— select project —</span>
                )}
              </button>
              {projectPickerOpen && !lockProject && (
                <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white-white border border-gray-border rounded-lg shadow-lg z-10 max-h-[200px] overflow-y-auto">
                  {projects.length === 0 ? (
                    <p className="px-3 py-2 text-gray-secondary text-[11px]">No projects yet</p>
                  ) : (
                    projects.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setProjectId(p.id)
                          setProjectPickerOpen(false)
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 hover:bg-white-item text-left ${
                          projectId === p.id ? 'bg-blue-light/30' : ''
                        }`}
                      >
                        <ProjectLabel name={p.name} color={p.color} size="sm" />
                        <span className="text-[12px] text-black">{p.name}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                Meeting Type *
              </label>
              <div className="bg-white-item flex items-start gap-[5px] p-[5px] rounded-[5px] h-[39px]">
                {MEETING_TYPES.map((t) => {
                  const selected = meetingType === t.key
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setMeetingType(t.key)}
                      className={`flex items-center justify-center px-[10px] py-[5px] rounded-[5px] text-[12px] font-semibold whitespace-nowrap transition-colors ${
                        selected
                          ? `${t.activeBg} ${t.activeText}`
                          : 'bg-white-item text-black hover:bg-white-white'
                      }`}
                    >
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Date / Start / End / Repeat / Repeat Until — fits in 677px interior */}
          <div className="grid grid-cols-[210px_85px_85px_105px_150px] gap-[8px]">
            {/* Date */}
            <div className="flex flex-col gap-1">
              <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                Date *
              </label>
              <div className="relative">
                <Icon
                  name="Calendar"
                  size={13}
                  className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: '#94A0AA' }}
                />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-white-white border border-gray-border rounded-lg pl-9 pr-12 py-2 text-[12px] text-black outline-none focus:border-primary-main h-[39px]"
                />
                {date && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-secondary text-[10px]">
                    {dayDiffFromToday(date)}
                  </span>
                )}
              </div>
            </div>
            {/* Start */}
            <div className="flex flex-col gap-1">
              <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                Start *
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="bg-white-white border border-gray-border rounded-lg px-3 py-2 text-[12px] text-black outline-none focus:border-primary-main h-[39px]"
                style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
              />
            </div>
            {/* End */}
            <div className="flex flex-col gap-1">
              <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                End *
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="bg-white-white border border-gray-border rounded-lg px-3 py-2 text-[12px] text-black outline-none focus:border-primary-main h-[39px]"
                style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
              />
            </div>
            {/* Repeat */}
            <div className="flex flex-col gap-1 relative">
              <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                Repeat
              </label>
              <button
                type="button"
                onClick={() => setRecurrencePickerOpen((v) => !v)}
                className="bg-white-white border border-gray-border rounded-lg px-3 py-2 text-left flex items-center justify-between h-[39px] hover:border-primary-main"
              >
                <span className="text-[12px] text-black">
                  {RECURRENCES.find((r) => r.key === recurrence)?.label ?? 'Once'}
                </span>
                <Icon name="ArrowRight" size={12} style={{ color: '#94A0AA' }} />
              </button>
              {recurrencePickerOpen && (
                <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white-white border border-gray-border rounded-lg shadow-lg z-10">
                  {RECURRENCES.map((r) => (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => {
                        setRecurrence(r.key)
                        setRecurrencePickerOpen(false)
                      }}
                      className={`w-full text-left px-3 py-2 text-[12px] hover:bg-white-item ${
                        recurrence === r.key ? 'bg-blue-light/30 text-black font-semibold' : 'text-black'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Repeat Until */}
            <div className="flex flex-col gap-1">
              <label
                className={`text-[10px] font-medium uppercase tracking-[1.5px] ${
                  recurrence === 'once' ? 'text-gray-secondary' : 'text-gray-main'
                }`}
              >
                Repeat Until
              </label>
              <div className="relative">
                <Icon
                  name="Calendar"
                  size={13}
                  className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: '#94A0AA' }}
                />
                <input
                  type="date"
                  value={recurrenceUntil}
                  onChange={(e) => setRecurrenceUntil(e.target.value)}
                  disabled={recurrence === 'once'}
                  className="w-full bg-white-white border border-gray-border rounded-lg pl-9 pr-3 py-2 text-[12px] text-black outline-none focus:border-primary-main h-[39px] disabled:bg-white-item disabled:text-gray-secondary"
                />
              </div>
            </div>
          </div>

          {/* Conflict warning placeholder */}
          {addedAttendees.length > 0 && (
            <div className="bg-brown-light rounded-[5px] px-4 py-3 flex items-center justify-between gap-3">
              <p className="text-[12px] text-[#8A5A1E] flex items-center gap-2 min-w-0">
                <span className="shrink-0">⚠</span>
                <span className="truncate">
                  AI conflict detection coming soon — verify attendees&apos; calendars manually.
                </span>
              </p>
              <button
                type="button"
                className="text-brown-med text-[12px] font-semibold shrink-0 hover:underline"
                disabled
              >
                Apply
              </button>
            </div>
          )}

          {/* Attendees */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                Attendees * <span className="text-gray-secondary normal-case tracking-normal">{addedAttendees.length + emailInvites.length} added</span>
              </label>
              <button
                type="button"
                onClick={() => setInviteOpen(true)}
                className="text-gray-main text-[11px] inline-flex items-center gap-1 hover:text-black"
              >
                <Icon name="Email" size={12} />
                Invite by email
              </button>
            </div>
            <div className="border border-gray-border rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-border-light">
                <Icon name="Search" size={15} style={{ color: '#94A0AA' }} />
                <input
                  value={attendeeSearch}
                  onChange={(e) => setAttendeeSearch(e.target.value)}
                  placeholder="Add team or member · Start typing a name"
                  className="flex-1 bg-transparent outline-none text-[12px] text-black placeholder:text-gray-secondary"
                />
              </div>
              {attendeeSearch.trim() && (
                <div className="max-h-[140px] overflow-y-auto border-b border-gray-border-light">
                  {candidateMembers.length === 0 ? (
                    <p className="px-3 py-2 text-gray-secondary text-[11px]">No matches</p>
                  ) : (
                    candidateMembers.slice(0, 8).map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setAttendeeIds((p) => [...p, u.id])
                          setAttendeeSearch('')
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-white-item flex items-center gap-2"
                      >
                        <span className="w-6 h-6 rounded-full bg-gray-extra-light inline-flex items-center justify-center text-[10px] font-semibold text-gray-main">
                          {memberLabel(u).charAt(0).toUpperCase()}
                        </span>
                        <span className="text-[12px] text-black">{memberLabel(u)}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
              {(addedAttendees.length > 0 || emailInvites.length > 0) && (
                <div className="flex flex-wrap gap-2 p-3">
                  {addedAttendees.map((u) => (
                    <span
                      key={u.id}
                      className="inline-flex items-center gap-2 bg-white-item border border-gray-border-light rounded-full pl-1 pr-2 py-1"
                    >
                      <span className="w-5 h-5 rounded-full bg-gray-extra-light inline-flex items-center justify-center text-[10px] font-semibold text-gray-main">
                        {memberLabel(u).charAt(0).toUpperCase()}
                      </span>
                      <span className="text-[12px] text-black">{memberLabel(u)}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setAttendeeIds((p) => p.filter((id) => id !== u.id))
                        }
                        className="text-gray-secondary hover:text-red-main"
                        aria-label="Remove"
                      >
                        <Icon name="Cross" size={10} />
                      </button>
                    </span>
                  ))}
                  {emailInvites.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-2 bg-white-item border border-gray-border-light rounded-full pl-1 pr-2 py-1"
                      title="Pending invite"
                    >
                      <span className="w-5 h-5 rounded-full bg-gray-extra-light inline-flex items-center justify-center text-gray-secondary">
                        <Icon name="Email" size={10} />
                      </span>
                      <span className="text-[12px] text-gray-main italic">{email}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setEmailInvites((p) => p.filter((e) => e !== email))
                        }
                        className="text-gray-secondary hover:text-red-main"
                        aria-label="Remove invite"
                      >
                        <Icon name="Cross" size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Agenda */}
          <div className="flex flex-col gap-2">
            <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
              Agenda <span className="text-gray-secondary normal-case tracking-normal">{totalMin} min total</span>
            </label>
            <div className="border border-gray-border rounded-lg overflow-hidden">
              {agenda.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 px-3 py-2 border-b border-gray-border-light last:border-b-0"
                >
                  <span
                    className="text-gray-secondary text-[12px] w-4 text-right"
                    style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
                  >
                    {idx + 1}
                  </span>
                  <input
                    value={item}
                    onChange={(e) =>
                      setAgenda((prev) =>
                        prev.map((it, i) => (i === idx ? e.target.value : it))
                      )
                    }
                    placeholder="Agenda item"
                    className="flex-1 bg-transparent outline-none text-[12px] text-black placeholder:text-gray-secondary"
                  />
                  {agenda.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setAgenda((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="text-gray-secondary hover:text-red-main"
                      aria-label="Remove agenda item"
                    >
                      <Icon name="Cross" size={12} />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setAgenda((prev) => [...prev, ''])}
                className="w-full px-3 py-2 text-left text-[12px] text-gray-main hover:bg-white-item inline-flex items-center gap-2"
              >
                <Icon name="Add" size={12} />
                Add agenda item
              </button>
            </div>
          </div>

          {error && <p className="text-red-main text-[12px]">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-[20px] py-[15px] border-t border-gray-border-light flex items-center justify-between">
          <p className="text-gray-secondary text-[11px]">⌘ ↵ to create</p>
          <div className="flex items-center gap-3">
            <span className="text-gray-main text-[11px]">
              {addedAttendees.length} attendees ·{' '}
              {location === 'zoom' ? 'Zoom Meeting' : 'In-person'}
            </span>
            <Button variant="subtle" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={submitting || !title.trim() || !projectId || !date}
            >
              {submitting ? 'Scheduling…' : 'Schedule Meeting'}
            </Button>
          </div>
        </div>
      </div>

      <InviteByEmailModal
        open={inviteOpen}
        variant="meeting"
        onClose={() => setInviteOpen(false)}
        onSubmit={async ({ email }) => {
          if (emailInvites.includes(email)) {
            throw new Error('Already invited.')
          }
          setEmailInvites((prev) => [...prev, email])
        }}
      />
    </div>
  )
}
