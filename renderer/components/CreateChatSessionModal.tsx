/**
 * "New chat session" modal — single dialog with two member-source modes:
 *  - 'project' : assign the channel to a project; members auto-sync
 *  - 'members' : pick individual members (free-form group)
 *
 * Figma frames 1184:9728 (project mode) and 1184:10254 (members mode).
 */

import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Input from './ui/Input'
import Button from './ui/Button'
import Icon from './ui/Icon'
import Option from './ui/Option'
import ProjectLabel from './ui/ProjectLabel'
import { createChatSession } from '../lib/queries'
import { useCurrentUser, useOrgMembers, useUserProjects } from '../lib/hooks'
import { queryKeys } from '../lib/queryKeys'
import type { UserRow } from '../lib/types'

type Mode = 'project' | 'members'

type Props = {
  open: boolean
  orgId: string | null
  onClose: () => void
  onCreated?: (id: string) => void
}

function memberLabel(u: UserRow) {
  return u.nickname || `${u.first_name} ${u.last_name}`.trim() || u.email
}

export default function CreateChatSessionModal({
  open,
  orgId,
  onClose,
  onCreated,
}: Props) {
  const { data: me } = useCurrentUser()
  const { data: projects = [] } = useUserProjects(me?.id)
  const { data: orgMembers = [] } = useOrgMembers(orgId)
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [mode, setMode] = useState<Mode>('project')
  const [projectId, setProjectId] = useState<string | null>(null)
  const [projectPickerOpen, setProjectPickerOpen] = useState(false)
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [memberQuery, setMemberQuery] = useState('')

  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Reset on open
  useEffect(() => {
    if (!open) return
    setName('')
    setDescription('')
    setMode('project')
    setProjectId(null)
    setMemberIds([])
    setMemberQuery('')
    setError('')
    setSubmitting(false)
  }, [open])

  // Default project = first one when switching to project mode
  useEffect(() => {
    if (open && mode === 'project' && !projectId && projects.length > 0) {
      setProjectId(projects[0].id)
    }
  }, [open, mode, projectId, projects])

  // ESC closes the picker first, then the modal
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
    () => memberIds.map((id) => orgMembers.find((u) => u.id === id)).filter(Boolean) as UserRow[],
    [memberIds, orgMembers]
  )

  const counterLabel =
    mode === 'project'
      ? project
        ? '— members sync automatically'
        : ''
      : `${memberIds.length} ${memberIds.length === 1 ? 'member' : 'members'}`

  const submit = async () => {
    if (!orgId) {
      setError('Org context missing.')
      return
    }
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
    setError('')
    setSubmitting(true)
    const result = await createChatSession({
      org_id: orgId,
      name: name.trim().replace(/^#/, ''),
      description: description || undefined,
      project_id: mode === 'project' ? projectId : null,
      member_user_ids: mode === 'members' ? memberIds : undefined,
    })
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
            New Chat · Sessions
          </p>
          <h2 className="text-black text-[20px] font-semibold mt-2">
            New chat session
          </h2>
          <p className="text-gray-main text-[12px] mt-1">
            Sessions can live independently of projects. Choose how to invite members.
          </p>
        </div>

        {/* Body */}
        <div className="px-[20px] py-[20px] flex flex-col gap-[15px]">
          {/* Session name */}
          <div className="flex flex-col gap-1 relative">
            <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
              Session Name *
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
                className="w-full bg-white-white border border-gray-border rounded-lg pl-7 pr-3 py-2 text-[12px] text-black outline-none focus:border-primary-main h-[39px]"
              />
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
              rows={2}
              placeholder="Coordination space for the May 11 cutover. Decisions, runbooks, and incident comments."
              className="bg-white-white border border-gray-border rounded-lg px-4 py-3 text-[12px] text-black outline-none focus:border-primary-main resize-none"
            />
          </div>

          {/* WHO CAN SEE THE SESSION — two Options */}
          <div className="flex flex-col gap-1">
            <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
              Who can see the session
            </label>
            <div className="bg-white-item rounded-[5px] grid grid-cols-2 gap-[5px] p-[5px]">
              <Option
                icon="Folder"
                title="Assign to a project"
                subtitle="Members sync from selected project below"
                selected={mode === 'project'}
                onSelect={() => setMode('project')}
              />
              <Option
                icon="People"
                title="Pick members directly"
                subtitle="Invite individuals"
                selected={mode === 'members'}
                onSelect={() => setMode('members')}
              />
            </div>
          </div>

          {/* Project picker (mode='project') */}
          {mode === 'project' && (
            <div className="flex flex-col gap-1 relative">
              <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                Project *
              </label>
              <button
                type="button"
                onClick={() => setProjectPickerOpen((v) => !v)}
                className="bg-white-white border border-gray-border rounded-lg px-3 py-2 text-left flex items-center gap-2 h-[39px] hover:border-primary-main"
              >
                {project ? (
                  <>
                    <ProjectLabel name={project.name} color={project.color} size="sm" />
                    <span className="text-[13px] text-black font-semibold">{project.name}</span>
                    <span className="ml-auto text-gray-secondary">
                      <Icon name="ArrowRight" size={12} />
                    </span>
                  </>
                ) : (
                  <span className="text-gray-secondary text-[12px]">— select project —</span>
                )}
              </button>
              {projectPickerOpen && (
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
              <p className="text-gray-secondary text-[10px] flex items-center gap-[5px] mt-1">
                <Icon name="Sparkle" size={11} />
                Members will sync automatically from{' '}
                <strong className="text-black font-semibold">{project?.name ?? 'project'}</strong>
                . New project members are auto-added.
              </p>
            </div>
          )}

          {/* Member picker (mode='members') */}
          {mode === 'members' && (
            <div className="flex flex-col gap-1 relative">
              <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                Attendees *
              </label>
              <Input
                variant="search"
                placeholder="Add team or member · Start typing a name"
                value={memberQuery}
                onChange={(e) => setMemberQuery(e.target.value)}
                className="!max-w-none"
              />
              {memberQuery.trim() && memberSuggestions.length > 0 && (
                <div className="bg-white-white border border-gray-border rounded-lg shadow-lg max-h-[160px] overflow-y-auto">
                  {memberSuggestions.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        setMemberIds((prev) => [...prev, u.id])
                        setMemberQuery('')
                      }}
                      className="w-full flex items-center gap-[8px] px-3 py-2 hover:bg-white-item text-left"
                    >
                      <span className="size-[20px] rounded-full bg-primary-main text-white inline-flex items-center justify-center text-[10px] font-semibold uppercase shrink-0">
                        {memberLabel(u).charAt(0)}
                      </span>
                      <span className="text-[12px] text-black">{memberLabel(u)}</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedMembers.length > 0 && (
                <div className="flex flex-wrap gap-[5px] mt-1">
                  {selectedMembers.map((u) => (
                    <span
                      key={u.id}
                      className="bg-white-item border border-gray-border-light rounded-full pl-[5px] pr-[8px] py-[2px] inline-flex items-center gap-[5px] text-[12px] text-black"
                    >
                      <span className="size-[20px] rounded-full bg-primary-main text-white inline-flex items-center justify-center text-[10px] font-semibold uppercase">
                        {memberLabel(u).charAt(0)}
                      </span>
                      {memberLabel(u)}
                      <button
                        type="button"
                        onClick={() =>
                          setMemberIds((prev) => prev.filter((id) => id !== u.id))
                        }
                        className="text-gray-secondary hover:text-black ml-[2px]"
                        aria-label={`Remove ${memberLabel(u)}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && <p className="text-red-main text-[12px]">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-[20px] py-[15px] border-t border-gray-border-light flex items-center justify-between">
          <p className="text-gray-secondary text-[11px]">⌘ ↵ to create</p>
          <div className="flex items-center gap-3">
            {counterLabel && (
              <span className="text-gray-secondary text-[11px]">{counterLabel}</span>
            )}
            <Button variant="subtle" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={
                submitting ||
                !name.trim() ||
                (mode === 'project' && !projectId) ||
                (mode === 'members' && memberIds.length === 0)
              }
            >
              {submitting ? 'Creating…' : 'Create session'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
