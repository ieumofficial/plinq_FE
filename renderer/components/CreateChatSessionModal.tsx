/**
 * "New chat session" modal — single dialog with three member-source modes:
 *  - 'project' : assign the channel to a project; members auto-sync
 *  - 'members' : pick individual members (free-form group)
 *  - 'dm'      : single-recipient direct message (uses chat_sessions.kind='dm')
 *
 * Figma frames 1421:24602 (project) / 1421:24776 (members) /
 *               1421:25921 (DM via radio) / 1421:26428 (DM-only locked).
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Input from './ui/Input'
import Button from './ui/Button'
import Icon from './ui/Icon'
import ProjectLabel from './ui/ProjectLabel'
import UserGroup from './ui/UserGroup'
import { createChatSession, getOrCreateDm } from '../lib/queries'
import { useCurrentUser, useOrgMembers, useUserProjects } from '../lib/hooks'
import { queryKeys } from '../lib/queryKeys'
import { userToMember, type UserRow } from '../lib/types'

type Mode = 'project' | 'members' | 'dm'

type Props = {
  open: boolean
  orgId: string | null
  /** Lock the modal to a single mode (hides the radio + irrelevant fields).
   *  Pass 'dm' from the DM section "+" button to get the simplified DM dialog. */
  lockMode?: Mode
  onClose: () => void
  onCreated?: (id: string) => void
}

function memberLabel(u: UserRow) {
  return u.nickname || `${u.first_name} ${u.last_name}`.trim() || u.email
}

// ─── Radio option ──────────────────────────────────────────────────────────

type IconName = 'Folder' | 'People' | 'Person'

function ModeOption({
  iconName,
  title,
  subtitle,
  selected,
  onSelect,
}: {
  iconName: 'Folder' | 'People' | 'Person'
  title: string
  subtitle: string
  selected: boolean
  onSelect: () => void
}) {
  // The "Person" icon doesn't exist in our icon set yet — fall back to
  // "People" but render slightly differently. For now reuse People.
  const renderedIcon = iconName === 'Person' ? 'People' : iconName
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex-1 min-w-0 flex items-center gap-[10px] p-[15px] rounded-[5px] text-left transition-colors ${
        selected ? 'bg-white-white' : 'bg-transparent hover:bg-white-white/60'
      }`}
    >
      <span
        className={`inline-flex items-center justify-center p-[7px] rounded-[5px] shrink-0 ${
          selected ? 'bg-primary-light' : ''
        }`}
      >
        <Icon
          name={renderedIcon as IconName extends 'Person' ? 'People' : IconName}
          size={15}
          className={selected ? 'text-black' : 'text-gray-main'}
        />
      </span>
      <span className="flex-1 min-w-0 flex flex-col gap-[3px]">
        <span
          className={`text-[12px] font-semibold ${
            selected ? 'text-black' : 'text-gray-main'
          }`}
        >
          {title}
        </span>
        <span
          className={`text-[10px] leading-[1.5] ${
            selected ? 'text-gray-main' : 'text-gray-main'
          }`}
        >
          {subtitle}
        </span>
      </span>
      <span
        className={`shrink-0 w-[12px] h-[12px] rounded-full border-[1.5px] flex items-center justify-center ${
          selected ? 'border-primary-main' : 'border-gray-secondary'
        }`}
        aria-hidden
      >
        {selected && (
          <span className="w-[5px] h-[5px] rounded-full bg-primary-main" />
        )}
      </span>
    </button>
  )
}

// ─── Modal ─────────────────────────────────────────────────────────────────

export default function CreateChatSessionModal({
  open,
  orgId,
  lockMode,
  onClose,
  onCreated,
}: Props) {
  const { data: me } = useCurrentUser()
  const { data: projects = [] } = useUserProjects(me?.id)
  const { data: orgMembers = [] } = useOrgMembers(orgId)
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [mode, setMode] = useState<Mode>(lockMode ?? 'project')
  const [projectId, setProjectId] = useState<string | null>(null)
  const [projectPickerOpen, setProjectPickerOpen] = useState(false)
  const [memberIds, setMemberIds] = useState<string[]>([])
  /** DM mode picks exactly one recipient; we still store as array internally
   *  so the same picker UI works, but only the first id is used on submit. */
  const [memberQuery, setMemberQuery] = useState('')

  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const projectPickerRef = useRef<HTMLDivElement>(null)
  /** Bounding rect of the project trigger button — captured when the dropdown
   *  opens so we can portal it with `position: fixed`. This way the dropdown
   *  escapes the modal's `overflow-y-auto` (no clipping on long lists). */
  const [projectAnchorRect, setProjectAnchorRect] = useState<DOMRect | null>(null)
  const projectTriggerRef = useRef<HTMLButtonElement>(null)
  const [memberSuggestRect, setMemberSuggestRect] = useState<DOMRect | null>(null)
  const memberSuggestAnchor = useRef<HTMLDivElement>(null)

  // Reset on open
  useEffect(() => {
    if (!open) return
    setName('')
    setDescription('')
    setMode(lockMode ?? 'project')
    setProjectId(null)
    setMemberIds([])
    setMemberQuery('')
    setError('')
    setSubmitting(false)
  }, [open, lockMode])

  // Default project = first one when switching to project mode
  useEffect(() => {
    if (open && mode === 'project' && !projectId && projects.length > 0) {
      setProjectId(projects[0].id)
    }
  }, [open, mode, projectId, projects])

  // Close project picker on outside click. The dropdown is rendered as a
  // fixed-position portal-like element (not inside the trigger's subtree), so
  // we need to ignore clicks that land on either the trigger or the floating
  // dropdown by tagging both with a data attribute.
  useEffect(() => {
    if (!projectPickerOpen) return
    function onDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (target.closest('[data-project-dropdown]')) return
      if (target.closest('[data-project-trigger]')) return
      setProjectPickerOpen(false)
    }
    function onScrollOrResize() {
      // Anchor rect goes stale on scroll/resize — close rather than try to
      // reposition (matches the patterns elsewhere in the codebase).
      setProjectPickerOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [projectPickerOpen])

  // ESC closes the picker first, then the modal. ⌘⏎ submits.
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (projectPickerOpen) {
          setProjectPickerOpen(false)
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
  }, [open, name, description, mode, projectId, memberIds, projectPickerOpen])

  const project = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId]
  )

  const memberSuggestions = useMemo(() => {
    const q = memberQuery.trim().toLowerCase()
    return orgMembers
      .filter((u) => u.id !== me?.id && !memberIds.includes(u.id))
      .filter((u) => {
        if (!q) return true
        return (
          memberLabel(u).toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
        )
      })
      .slice(0, 6)
  }, [orgMembers, me, memberIds, memberQuery])

  const selectedMembers = useMemo(
    () =>
      memberIds
        .map((id) => orgMembers.find((u) => u.id === id))
        .filter(Boolean) as UserRow[],
    [memberIds, orgMembers]
  )

  const isDm = mode === 'dm'
  const dmRecipient = isDm ? selectedMembers[0] : null

  const memberCountLabel =
    mode === 'project'
      ? '— members sync automatically'
      : mode === 'members'
        ? `${memberIds.length} member${memberIds.length === 1 ? '' : 's'}`
        : ''

  // Header eyebrow + title vary for the DM-only variant
  const isDmLocked = lockMode === 'dm'
  const headerEyebrow = isDmLocked ? 'NEW DM · SESSIONS' : 'NEW CHAT · SESSIONS'
  const headerTitle = isDmLocked ? 'Direct message' : 'New chat session'

  const submit = async () => {
    if (!orgId) {
      setError('Org context missing.')
      return
    }
    if (!isDm) {
      if (!name.trim()) {
        setError('Session name is required.')
        return
      }
      if (mode === 'project' && !projectId) {
        setError('Pick a project.')
        return
      }
      if (mode === 'members' && memberIds.length === 0) {
        setError('Pick at least one member.')
        return
      }
    } else {
      if (memberIds.length === 0 || !dmRecipient) {
        setError('Pick a recipient.')
        return
      }
    }
    setError('')
    setSubmitting(true)

    let result: { id: string } | { error: string }
    if (isDm && dmRecipient) {
      result = await getOrCreateDm(orgId, dmRecipient.id)
    } else {
      result = await createChatSession({
        org_id: orgId,
        name: name.trim().replace(/^#/, ''),
        description: description || undefined,
        project_id: mode === 'project' ? projectId : null,
        member_user_ids: mode === 'members' ? memberIds : undefined,
      })
    }
    setSubmitting(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.chat.all })
    onCreated?.(result.id)
    onClose()
  }

  if (!open) return null

  const showRadio = !lockMode
  const showNameAndDescription = !isDm
  const showProjectPicker = mode === 'project'
  const showMembersPicker = mode === 'members'
  const showDmPicker = isDm

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white-white rounded-[15px] shadow-2xl ${
          isDmLocked ? 'w-[480px]' : 'w-[717px]'
        } max-w-[95vw] max-h-[92vh] overflow-y-auto overflow-x-hidden flex flex-col`}
      >
        {/* Header */}
        <div className="px-[20px] pt-[20px] pb-[20px] border-b border-gray-border-light flex flex-col gap-[5px]">
          <p className="text-blue-main text-[10px] font-medium uppercase tracking-[1.5px]">
            {headerEyebrow}
          </p>
          <h2 className="text-black text-[20px] font-semibold">{headerTitle}</h2>
          {!isDmLocked && (
            <p className="text-gray-main text-[12px]">
              Sessions can live independently of projects. Choose how to invite
              members.
            </p>
          )}
        </div>

        {/* Body */}
        <div className="px-[20px] py-[20px] flex flex-col gap-[15px]">
          {showRadio && (
            <div className="flex flex-col gap-[5px]">
              <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                Who can see this session
              </label>
              <div className="bg-white-item rounded-[5px] flex gap-[5px] p-[5px]">
                <ModeOption
                  iconName="Folder"
                  title="Assign to a project"
                  subtitle="Members sync from selected project below"
                  selected={mode === 'project'}
                  onSelect={() => setMode('project')}
                />
                <ModeOption
                  iconName="People"
                  title="Pick members directly"
                  subtitle="Invite individuals"
                  selected={mode === 'members'}
                  onSelect={() => setMode('members')}
                />
                <ModeOption
                  iconName="Person"
                  title="Send a DM"
                  subtitle="A conversation between you and another individual"
                  selected={mode === 'dm'}
                  onSelect={() => setMode('dm')}
                />
              </div>
            </div>
          )}

          {showNameAndDescription && (
            <>
              {/* Session name */}
              <div className="flex flex-col gap-[5px] relative">
                <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                  Session Name <span className="text-red-main">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-secondary text-[12px] pointer-events-none">
                    #
                  </span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="cutover-war-room"
                    autoFocus
                    className="w-full bg-white-white border border-gray-border rounded-lg pl-7 pr-3 py-2 text-[12px] text-black outline-none focus:border-primary-main h-[34px]"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-[5px]">
                <div className="flex items-baseline gap-2">
                  <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                    Description
                  </label>
                  <span className="text-gray-secondary text-[10px]">
                    markdown supported
                  </span>
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Coordination space for the May 11 cutover. Decisions, runbooks, and incident comments."
                  className="bg-white-white border border-gray-border rounded-lg px-4 py-3 text-[12px] text-black outline-none focus:border-primary-main resize-none"
                />
              </div>
            </>
          )}

          {/* Project picker */}
          {showProjectPicker && (
            <div ref={projectPickerRef} className="flex flex-col gap-[5px]">
              <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                Project <span className="text-red-main">*</span>
              </label>
              <button
                ref={projectTriggerRef}
                data-project-trigger
                type="button"
                onClick={() => {
                  if (projectPickerOpen) {
                    setProjectPickerOpen(false)
                    setProjectAnchorRect(null)
                  } else {
                    setProjectAnchorRect(
                      projectTriggerRef.current?.getBoundingClientRect() ?? null
                    )
                    setProjectPickerOpen(true)
                  }
                }}
                className="bg-white-white border border-gray-border rounded-lg px-[10px] py-[7px] text-left flex items-center justify-between gap-2 hover:border-primary-main"
              >
                {project ? (
                  <span className="flex items-center gap-[10px] min-w-0">
                    <ProjectLabel
                      name={project.name}
                      color={project.color}
                      size="sm"
                    />
                    <span className="text-[12px] text-black font-semibold truncate">
                      {project.name}
                    </span>
                    <span className="text-gray-main text-[10px]">
                      · {project.members.length} members
                    </span>
                  </span>
                ) : (
                  <span className="text-gray-secondary text-[12px]">
                    — select project —
                  </span>
                )}
                <Icon
                  name="ArrowRight"
                  size={12}
                  className={`text-gray-secondary shrink-0 transition-transform ${
                    projectPickerOpen ? 'rotate-90' : ''
                  }`}
                />
              </button>
              {project && (
                <div className="bg-white-item rounded-[5px] px-[10px] py-[10px] flex items-center gap-[5px] text-primary-main text-[12px]">
                  <Icon name="Sparkle" size={11} className="shrink-0" />
                  <span>
                    Members will sync automatically from{' '}
                    <strong className="font-bold">{project.name}</strong> · New
                    project members are auto-added.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Members picker */}
          {showMembersPicker && (
            <div className="flex flex-col gap-[5px]">
              <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                Attendees <span className="text-red-main">*</span>
              </label>
              <div
                ref={memberSuggestAnchor}
                onFocus={() =>
                  setMemberSuggestRect(
                    memberSuggestAnchor.current?.getBoundingClientRect() ?? null
                  )
                }
              >
                <Input
                  variant="search"
                  placeholder="Add member · Start typing a name"
                  value={memberQuery}
                  onChange={(e) => {
                    setMemberQuery(e.target.value)
                    setMemberSuggestRect(
                      memberSuggestAnchor.current?.getBoundingClientRect() ??
                        null
                    )
                  }}
                  className="!max-w-none"
                />
              </div>
              {selectedMembers.length > 0 && (
                <div className="bg-white-item rounded-[8px] p-[10px] flex flex-wrap gap-[5px]">
                  {selectedMembers.map((u) => (
                    <span
                      key={u.id}
                      className="bg-white-white border border-solid border-gray-border rounded-full pl-[5px] pr-[10px] py-[7px] inline-flex items-center gap-[10px] text-[12px] text-black"
                    >
                      <UserGroup members={[userToMember(u)]} size={25} />
                      <span className="font-semibold">{memberLabel(u)}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setMemberIds((prev) => prev.filter((id) => id !== u.id))
                        }
                        className="text-gray-secondary hover:text-black"
                        aria-label={`Remove ${memberLabel(u)}`}
                      >
                        <Icon name="Cross" size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* DM recipient picker */}
          {showDmPicker && (
            <div className="flex flex-col gap-[5px]">
              <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                Send a message to... <span className="text-red-main">*</span>
              </label>
              <div
                ref={memberSuggestAnchor}
                onFocus={() =>
                  setMemberSuggestRect(
                    memberSuggestAnchor.current?.getBoundingClientRect() ?? null
                  )
                }
              >
                <Input
                  variant="search"
                  placeholder="Start typing a name"
                  value={memberQuery}
                  onChange={(e) => {
                    setMemberQuery(e.target.value)
                    setMemberSuggestRect(
                      memberSuggestAnchor.current?.getBoundingClientRect() ??
                        null
                    )
                  }}
                  className="!max-w-none"
                />
              </div>
              {dmRecipient && (
                <div className="bg-white-item rounded-[8px] p-[10px] flex items-center justify-between">
                  <span className="flex items-center gap-[10px] min-w-0">
                    <UserGroup
                      members={[userToMember(dmRecipient)]}
                      size={30}
                    />
                    <span className="flex flex-col gap-[3px] min-w-0">
                      <span className="text-black text-[14px] font-semibold truncate">
                        {memberLabel(dmRecipient)}
                      </span>
                      {dmRecipient.job_title && (
                        <span className="text-black text-[12px]">
                          {dmRecipient.job_title}
                        </span>
                      )}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setMemberIds([])}
                    className="text-gray-secondary hover:text-black shrink-0"
                    aria-label="Remove recipient"
                  >
                    <Icon name="Cross" size={11} />
                  </button>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-red-main text-[12px]">{error}</p>}
        </div>

        {/* Footer */}
        <div className="bg-white-item border-t border-solid border-gray-border-light rounded-bl-[15px] rounded-br-[15px] flex items-center justify-between px-[20px] py-[15px]">
          <div className="flex items-center gap-[5px]">
            <span className="bg-white-white border border-solid border-gray-border-light rounded-[5px] px-[5px] py-[2px] text-gray-main text-[10px]">
              ⌘ ⏎
            </span>
            <span className="text-gray-main text-[10px]">to create</span>
          </div>
          <div className="flex items-center gap-[10px]">
            {memberCountLabel && (
              <span className="text-primary-main text-[10px]">
                {memberCountLabel}
              </span>
            )}
            <Button variant="subtle" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={
                submitting ||
                (!isDm && !name.trim()) ||
                (mode === 'project' && !projectId) ||
                (mode === 'members' && memberIds.length === 0) ||
                (isDm && memberIds.length === 0)
              }
            >
              {submitting ? 'Creating…' : 'Create session'}
            </Button>
          </div>
        </div>
      </div>

      {/* Floating dropdowns — rendered as siblings of the modal body so they
       *  escape its overflow clipping. `position: fixed` anchors them to the
       *  trigger's bounding rect (captured when the dropdown opened). */}
      {projectPickerOpen && projectAnchorRect && (
        <div
          data-project-dropdown
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: projectAnchorRect.bottom + 4,
            left: projectAnchorRect.left,
            width: projectAnchorRect.width,
            zIndex: 100,
          }}
          className="bg-white-white border border-gray-border rounded-lg shadow-lg max-h-[260px] overflow-y-auto"
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
                  setProjectAnchorRect(null)
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

      {(showMembersPicker || (showDmPicker && !dmRecipient)) &&
        memberSuggestRect &&
        memberQuery.trim() &&
        memberSuggestions.length > 0 && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: memberSuggestRect.bottom + 4,
              left: memberSuggestRect.left,
              width: memberSuggestRect.width,
              zIndex: 100,
            }}
            className="bg-white-white border border-gray-border rounded-lg shadow-lg max-h-[200px] overflow-y-auto"
          >
            {memberSuggestions.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  if (showDmPicker) setMemberIds([u.id])
                  else setMemberIds((prev) => [...prev, u.id])
                  setMemberQuery('')
                }}
                className="w-full flex items-center gap-[8px] px-3 py-2 hover:bg-white-item text-left"
              >
                <UserGroup members={[userToMember(u)]} size={20} />
                <span className="text-[12px] text-black">{memberLabel(u)}</span>
              </button>
            ))}
          </div>
        )}
    </div>
  )
}
