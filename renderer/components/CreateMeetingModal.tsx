import { useEffect, useMemo, useRef, useState } from 'react'
import Input from './ui/Input'
import Button from './ui/Button'
import Icon from './ui/Icon'
import ProjectLabel from './ui/ProjectLabel'
import DatePicker from './ui/DatePicker'
import TimePicker from './ui/TimePicker'
import { useQueryClient } from '@tanstack/react-query'
import { createMeeting } from '../lib/queries'
import { useCurrentUser, useProjectMembers, useUserProjects } from '../lib/hooks'
import { queryKeys } from '../lib/queryKeys'
import type { MeetingRecurrence, MeetingType, UserRow } from '../lib/types'
import InviteByEmailModal from './InviteByEmailModal'
import { zoomBackend } from '../lib/zoomBackend'
import { supabase } from '../lib/supabase'

type WhenMode = 'now' | 'later'

/** YYYY-MM-DD in local time. */
function localDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
/** HH:MM (24h) in local time. */
function localTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

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

// `disabled: true` keeps the option visible (so future Zoom support
// has a stable slot) but the toggle won't switch to it. Phase 3.5
// flips this back on alongside the zoom-* endpoints in plinq_ai.
const LOCATIONS: { key: 'zoom' | 'in_person'; label: string; disabled?: boolean }[] = [
  { key: 'in_person', label: 'In-person' },
  { key: 'zoom', label: 'Zoom (soon)', disabled: true },
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

/** Strip everything but digits + colon and cap at 5 chars ("HH:MM"). */
function filterTimeInput(s: string): string {
  return s.replace(/[^0-9:]/g, '').slice(0, 5)
}

/** Normalize "9", "9:5", "14", "14:00" → "HH:MM" 24-hour. Used on blur
 *  so the field renders identically to the Figma reference (no AM/PM
 *  marker injected by the Korean locale native time picker). */
function normalizeTime(s: string): string {
  if (!s) return ''
  const [rawH = '0', rawM = '0'] = s.split(':')
  const h = Math.min(23, Math.max(0, parseInt(rawH, 10) || 0))
  const m = Math.min(59, Math.max(0, parseInt(rawM, 10) || 0))
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
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
  const [when, setWhen] = useState<WhenMode>('later')
  const [location, setLocation] = useState<'zoom' | 'in_person'>('in_person')
  const [projectId, setProjectId] = useState<string | null>(defaultProjectId ?? null)
  const [projectPickerOpen, setProjectPickerOpen] = useState(false)
  const [projectAnchor, setProjectAnchor] = useState<DOMRect | null>(null)
  const projectTriggerRef = useRef<HTMLButtonElement>(null)
  const [meetingType, setMeetingType] = useState<MeetingType>('planning')
  const [date, setDate] = useState('')
  const [datePickerAnchor, setDatePickerAnchor] = useState<DOMRect | null>(null)
  const dateTriggerRef = useRef<HTMLButtonElement>(null)
  const [startTime, setStartTime] = useState('14:00')
  const [startPickerAnchor, setStartPickerAnchor] = useState<DOMRect | null>(null)
  const startTriggerRef = useRef<HTMLButtonElement>(null)
  const [endTime, setEndTime] = useState('14:30')
  const [endPickerAnchor, setEndPickerAnchor] = useState<DOMRect | null>(null)
  const endTriggerRef = useRef<HTMLButtonElement>(null)
  const [recurrence, setRecurrence] = useState<MeetingRecurrence>('once')
  const [recurrencePickerOpen, setRecurrencePickerOpen] = useState(false)
  const [recurrenceAnchor, setRecurrenceAnchor] = useState<DOMRect | null>(null)
  const recurrenceTriggerRef = useRef<HTMLButtonElement>(null)
  const [recurrenceUntil, setRecurrenceUntil] = useState('')
  const [untilPickerAnchor, setUntilPickerAnchor] = useState<DOMRect | null>(null)
  const untilTriggerRef = useRef<HTMLButtonElement>(null)
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
    setWhen('later')
    setLocation('in_person')
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
          setProjectAnchor(null)
          return
        }
        if (recurrencePickerOpen) {
          setRecurrencePickerOpen(false)
          setRecurrenceAnchor(null)
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
    when,
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

    // Resolve effective date/time. "Now" mode auto-fills with current
    // wall-clock time + 30min duration so the user doesn't have to pick.
    let effDate = date
    let effStart = startTime
    let effEnd = endTime
    if (when === 'now') {
      const now = new Date()
      effDate = localDate(now)
      effStart = localTime(now)
      effEnd = localTime(new Date(now.getTime() + 30 * 60 * 1000))
    } else if (!effDate) {
      setError('Date is required.')
      return
    }

    const effDuration = durationMinutes(effStart, effEnd)
    if (effDuration <= 0) {
      setError('End time must be after start time.')
      return
    }
    if (recurrence !== 'once' && !recurrenceUntil) {
      setError('Repeat until date is required for recurring meetings.')
      return
    }
    setError('')
    setSubmitting(true)

    // For Zoom meetings we ask Zoom to create the meeting first so we can
    // store the real join_url in `meetings.location_or_url` and (for "Now")
    // launch the host start_url immediately after the row lands.
    let zoomJoinUrl: string | null = null
    let zoomStartUrl: string | null = null
    if (location === 'zoom') {
      try {
        const z = await zoomBackend.createMeeting(
          when === 'now'
            ? { topic: title.trim(), type: 1 }
            : {
                topic: title.trim(),
                type: 2,
                start_time: combineDateTime(effDate, effStart),
                duration: effDuration,
              },
        )
        zoomJoinUrl = z.join_url
        zoomStartUrl = z.start_url
      } catch (e) {
        setError(`Zoom 회의 생성 실패: ${(e as Error).message}`)
        setSubmitting(false)
        return
      }
    }

    const result = await createMeeting({
      name: title,
      project_id: projectId,
      scheduled_at: combineDateTime(effDate, effStart),
      duration_min: effDuration,
      location_or_url: zoomJoinUrl, // null for in-person
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

    // Right now + Zoom → launch the host (start_url) in the system browser
    // so the Zoom desktop app comes up and recording starts.
    if (when === 'now' && zoomStartUrl) {
      if (typeof window !== 'undefined' && window.ipc) {
        window.ipc.send('open-external', zoomStartUrl)
      } else {
        window.open(zoomStartUrl, '_blank')
      }
    }

    // For "Right now" meetings, flip status to `recording` immediately so
    // the card lands in live mode (Open Zoom + End meeting buttons) instead
    // of looking like a stale `planned` row.
    if (when === 'now') {
      await supabase
        .from('meetings')
        .update({ status: 'recording' })
        .eq('id', result.id)
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
          {/* Title + Location — Location now takes the room it needs so the
              "Zoom (soon)" disabled pill no longer overflows the column. */}
          <div className="grid grid-cols-[1fr_auto] gap-[15px]">
            <Input
              label={
                <>
                  MEETING TITLE <span className="text-red-main">*</span>
                </>
              }
              placeholder="Cutover dry-run"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              className="!max-w-none"
            />
            <div className="flex flex-col gap-1">
              <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                Location <span className="text-red-main">*</span>
              </label>
              <div className="bg-white-item flex items-center gap-[5px] p-[5px] rounded-[5px] h-[39px]">
                {LOCATIONS.map((l) => {
                  const selected = location === l.key
                  const disabled = !!l.disabled
                  return (
                    <button
                      key={l.key}
                      type="button"
                      onClick={() => !disabled && setLocation(l.key)}
                      disabled={disabled}
                      title={disabled ? 'Coming in a future release' : undefined}
                      className={`flex items-center justify-center px-[8px] py-[4px] rounded-[5px] text-[11px] font-semibold whitespace-nowrap transition-colors ${
                        selected
                          ? 'bg-[#E6ECEF] text-primary-main'
                          : disabled
                            ? 'bg-white-item text-gray-secondary cursor-not-allowed opacity-60'
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
            <div className="flex flex-col gap-1">
              <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                Project <span className="text-red-main">*</span>
              </label>
              <button
                ref={projectTriggerRef}
                type="button"
                onClick={() => {
                  if (lockProject) return
                  if (projectPickerOpen) {
                    setProjectPickerOpen(false)
                    setProjectAnchor(null)
                  } else {
                    setProjectAnchor(
                      projectTriggerRef.current?.getBoundingClientRect() ?? null
                    )
                    setProjectPickerOpen(true)
                  }
                }}
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
                        <Icon
                          name="ArrowRight"
                          size={12}
                          className={`transition-transform ${
                            projectPickerOpen ? 'rotate-90' : ''
                          }`}
                        />
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-gray-secondary text-[12px]">— select project —</span>
                )}
              </button>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                Meeting Type <span className="text-red-main">*</span>
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

          {/* When: Right now (instant Zoom + autostart) vs Schedule for later */}
          <div className="flex items-center gap-3">
            <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
              When <span className="text-red-main">*</span>
            </label>
            <div className="bg-white-item flex items-start gap-[5px] p-[5px] rounded-[5px]">
              {(['now', 'later'] as const).map((w) => {
                const selected = when === w
                return (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setWhen(w)}
                    className={`flex items-center justify-center px-[10px] py-[5px] rounded-[5px] text-[12px] font-semibold whitespace-nowrap transition-colors ${
                      selected
                        ? 'bg-[#E6ECEF] text-primary-main'
                        : 'bg-white-item text-black hover:bg-white-white'
                    }`}
                  >
                    {w === 'now' ? 'Right now' : 'Schedule for later'}
                  </button>
                )
              })}
            </div>
            {when === 'now' && (
              <span className="text-gray-secondary text-[11px]">
                {location === 'zoom'
                  ? 'Zoom will open immediately · 30 min default'
                  : 'Starts now · 30 min default'}
              </span>
            )}
          </div>

          {/* Date / Start / End / Repeat / Repeat Until — only when scheduling.
              Wider START/END columns so Korean locale "오후 02:00" fits
              without truncating the AM/PM marker. */}
          {when === 'later' && (
          <div className="grid grid-cols-[180px_110px_110px_100px_130px] gap-[8px]">
            {/* Date */}
            <div className="flex flex-col gap-1">
              <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                Date <span className="text-red-main">*</span>
              </label>
              <button
                ref={dateTriggerRef}
                type="button"
                onClick={() => {
                  if (datePickerAnchor) {
                    setDatePickerAnchor(null)
                  } else {
                    setDatePickerAnchor(
                      dateTriggerRef.current?.getBoundingClientRect() ?? null
                    )
                  }
                }}
                className="bg-white-white border border-gray-border rounded-lg pl-3 pr-3 h-[39px] flex items-center gap-[8px] text-left hover:border-primary-main"
              >
                <Icon
                  name="Calendar"
                  size={13}
                  className="text-gray-secondary shrink-0"
                />
                <span
                  className={`flex-1 text-[12px] truncate ${
                    date ? 'text-black font-semibold' : 'text-gray-secondary'
                  }`}
                >
                  {date
                    ? new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })
                    : 'Pick a date'}
                </span>
                {date && (
                  <span
                    className="text-gray-secondary text-[10px] shrink-0"
                    style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
                  >
                    {dayDiffFromToday(date)}
                  </span>
                )}
              </button>
            </div>
            {/* Start — TimePicker dropdown, 24-hour. */}
            <div className="flex flex-col gap-1">
              <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                Start <span className="text-red-main">*</span>
              </label>
              <button
                ref={startTriggerRef}
                type="button"
                onClick={() => {
                  if (startPickerAnchor) {
                    setStartPickerAnchor(null)
                  } else {
                    setStartPickerAnchor(
                      startTriggerRef.current?.getBoundingClientRect() ?? null
                    )
                  }
                }}
                className="bg-white-white border border-gray-border rounded-lg px-3 h-[39px] flex items-center justify-between gap-[8px] text-left hover:border-primary-main text-[12px] text-black"
              >
                <span>{startTime}</span>
                <Icon
                  name="ArrowRight"
                  size={12}
                  style={{ color: '#94A0AA' }}
                  className={`transition-transform ${
                    startPickerAnchor ? 'rotate-90' : ''
                  }`}
                />
              </button>
            </div>
            {/* End */}
            <div className="flex flex-col gap-1">
              <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                End <span className="text-red-main">*</span>
              </label>
              <button
                ref={endTriggerRef}
                type="button"
                onClick={() => {
                  if (endPickerAnchor) {
                    setEndPickerAnchor(null)
                  } else {
                    setEndPickerAnchor(
                      endTriggerRef.current?.getBoundingClientRect() ?? null
                    )
                  }
                }}
                className="bg-white-white border border-gray-border rounded-lg px-3 h-[39px] flex items-center justify-between gap-[8px] text-left hover:border-primary-main text-[12px] text-black"
              >
                <span>{endTime}</span>
                <Icon
                  name="ArrowRight"
                  size={12}
                  style={{ color: '#94A0AA' }}
                  className={`transition-transform ${
                    endPickerAnchor ? 'rotate-90' : ''
                  }`}
                />
              </button>
            </div>
            {/* Repeat */}
            <div className="flex flex-col gap-1">
              <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                Repeat
              </label>
              <button
                ref={recurrenceTriggerRef}
                type="button"
                onClick={() => {
                  if (recurrencePickerOpen) {
                    setRecurrencePickerOpen(false)
                    setRecurrenceAnchor(null)
                  } else {
                    setRecurrenceAnchor(
                      recurrenceTriggerRef.current?.getBoundingClientRect() ??
                        null
                    )
                    setRecurrencePickerOpen(true)
                  }
                }}
                className="bg-white-white border border-gray-border rounded-lg px-3 py-2 text-left flex items-center justify-between h-[39px] hover:border-primary-main"
              >
                <span className="text-[12px] text-black">
                  {RECURRENCES.find((r) => r.key === recurrence)?.label ?? 'Once'}
                </span>
                <Icon
                  name="ArrowRight"
                  size={12}
                  style={{ color: '#94A0AA' }}
                  className={`transition-transform ${
                    recurrencePickerOpen ? 'rotate-90' : ''
                  }`}
                />
              </button>
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
              <button
                ref={untilTriggerRef}
                type="button"
                disabled={recurrence === 'once'}
                onClick={() => {
                  if (untilPickerAnchor) {
                    setUntilPickerAnchor(null)
                  } else {
                    setUntilPickerAnchor(
                      untilTriggerRef.current?.getBoundingClientRect() ?? null
                    )
                  }
                }}
                className="bg-white-white border border-gray-border rounded-lg pl-3 pr-3 h-[39px] flex items-center gap-[8px] text-left hover:border-primary-main disabled:bg-white-item disabled:cursor-not-allowed"
              >
                <Icon
                  name="Calendar"
                  size={13}
                  className={`shrink-0 ${
                    recurrence === 'once'
                      ? 'text-gray-secondary'
                      : 'text-gray-secondary'
                  }`}
                />
                <span
                  className={`flex-1 text-[12px] truncate ${
                    recurrenceUntil && recurrence !== 'once'
                      ? 'text-black font-semibold'
                      : 'text-gray-secondary'
                  }`}
                >
                  {recurrenceUntil
                    ? new Date(recurrenceUntil + 'T00:00:00').toLocaleDateString(
                        'en-US',
                        { month: 'short', day: 'numeric' }
                      )
                    : 'Pick a date'}
                </span>
              </button>
            </div>
          </div>
          )}

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
                Attendees <span className="text-red-main">*</span>{' '}
                <span className="text-gray-secondary normal-case tracking-normal">
                  {addedAttendees.length + emailInvites.length} added
                </span>
              </label>
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
              disabled={
                submitting ||
                !title.trim() ||
                !projectId ||
                (when === 'later' && !date)
              }
            >
              {submitting
                ? when === 'now'
                  ? 'Starting…'
                  : 'Scheduling…'
                : when === 'now'
                  ? location === 'zoom'
                    ? 'Start Zoom'
                    : 'Start Meeting'
                  : 'Schedule Meeting'}
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

      {/* Floating project picker — sibling so it escapes the modal's
       *  overflow-y-auto clipping. Anchor rect captured on toggle. */}
      {projectPickerOpen && !lockProject && projectAnchor && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: projectAnchor.bottom + 4,
            left: projectAnchor.left,
            width: projectAnchor.width,
            zIndex: 100,
          }}
          className="bg-white-white border border-gray-border rounded-lg shadow-lg max-h-[200px] overflow-y-auto"
        >
          {projects.length === 0 ? (
            <p className="px-3 py-2 text-gray-secondary text-[11px]">
              No projects yet
            </p>
          ) : (
            projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setProjectId(p.id)
                  setProjectPickerOpen(false)
                  setProjectAnchor(null)
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

      {/* Floating recurrence picker */}
      {recurrencePickerOpen && recurrenceAnchor && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: recurrenceAnchor.bottom + 4,
            left: recurrenceAnchor.left,
            width: recurrenceAnchor.width,
            zIndex: 100,
          }}
          className="bg-white-white border border-gray-border rounded-lg shadow-lg"
        >
          {RECURRENCES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => {
                setRecurrence(r.key)
                setRecurrencePickerOpen(false)
                setRecurrenceAnchor(null)
              }}
              className={`w-full text-left px-3 py-2 text-[12px] hover:bg-white-item ${
                recurrence === r.key
                  ? 'bg-blue-light/30 text-black font-semibold'
                  : 'text-black'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      {/* Floating date picker for the meeting date */}
      <DatePicker
        anchorRect={datePickerAnchor}
        value={date || null}
        onChange={(next) => setDate(next ?? '')}
        onClose={() => setDatePickerAnchor(null)}
      />

      {/* Floating date picker for "Repeat until" */}
      <DatePicker
        anchorRect={untilPickerAnchor}
        value={recurrenceUntil || null}
        onChange={(next) => setRecurrenceUntil(next ?? '')}
        onClose={() => setUntilPickerAnchor(null)}
      />

      {/* Floating time pickers for Start / End */}
      <TimePicker
        anchorRect={startPickerAnchor}
        value={startTime}
        onChange={(next) => setStartTime(next)}
        onClose={() => setStartPickerAnchor(null)}
      />
      <TimePicker
        anchorRect={endPickerAnchor}
        value={endTime}
        onChange={(next) => setEndTime(next)}
        onClose={() => setEndPickerAnchor(null)}
      />
    </div>
  )
}
