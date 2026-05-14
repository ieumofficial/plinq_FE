import { useEffect, useMemo, useState } from 'react'
import Input from './ui/Input'
import Button from './ui/Button'
import Icon from './ui/Icon'
import InviteByEmailModal from './InviteByEmailModal'
import { useQueryClient } from '@tanstack/react-query'
import { useCurrentUser, useMyOrg, useOrgMembers } from '../lib/hooks'
import { supabase } from '../lib/supabase'
import { inviteToOrganization } from '../lib/queries'
import type { UserRow } from '../lib/types'

type Props = {
  open: boolean
  onClose: () => void
  onCreated?: (id: string) => void
}

type ColorKey = 'blue' | 'green' | 'red' | 'brown' | 'purple' | 'turquoise'

const COLORS: { key: ColorKey; hex: string }[] = [
  { key: 'blue', hex: '#2D5A9E' },
  { key: 'green', hex: '#2F6B45' },
  { key: 'red', hex: '#9B3838' },
  { key: 'brown', hex: '#8A5A1E' },
  { key: 'purple', hex: '#5B3D8A' },
  { key: 'turquoise', hex: '#558589' },
]

function memberLabel(u: UserRow) {
  return u.nickname || `${u.first_name} ${u.last_name}`.trim() || u.email
}

export default function CreateOrganizationModal({ open, onClose, onCreated }: Props) {
  const { data: meRaw } = useCurrentUser()
  const me: UserRow | null = meRaw ?? null
  const { data: currentOrg } = useMyOrg(me?.id)
  /** Candidate pool for the member picker — people the user already collaborates
   *  with in their current org. There's no "members of the new org" yet, so this
   *  is the closest available proxy. */
  const { data: candidatePool = [] } = useOrgMembers(currentOrg?.id ?? null)
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [color, setColor] = useState<ColorKey>('blue')
  const [customHex, setCustomHex] = useState<string | null>(null)
  const [hexInputOpen, setHexInputOpen] = useState(false)
  const [hexInput, setHexInput] = useState('')

  const [memberIds, setMemberIds] = useState<string[]>([])
  const [memberSearch, setMemberSearch] = useState('')
  const [emailInvites, setEmailInvites] = useState<string[]>([])
  const [inviteOpen, setInviteOpen] = useState(false)

  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setName('')
    setColor('blue')
    setCustomHex(null)
    setHexInputOpen(false)
    setHexInput('')
    setMemberIds([])
    setMemberSearch('')
    setEmailInvites([])
    setInviteOpen(false)
    setError('')
    setSubmitting(false)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (inviteOpen) return
        if (hexInputOpen) {
          setHexInputOpen(false)
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
  }, [open, name, color, customHex, memberIds, emailInvites, inviteOpen, hexInputOpen])

  const addedMembers = useMemo(
    () => candidatePool.filter((u) => memberIds.includes(u.id)),
    [candidatePool, memberIds]
  )
  const candidateMembers = useMemo(() => {
    const q = memberSearch.toLowerCase().trim()
    return candidatePool.filter((u) => {
      if (memberIds.includes(u.id)) return false
      if (u.id === me?.id) return false
      if (!q) return true
      return (
        memberLabel(u).toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      )
    })
  }, [candidatePool, memberIds, me?.id, memberSearch])

  const swatchHex = customHex ?? COLORS.find((c) => c.key === color)!.hex
  const initial = (name.trim() || 'A').charAt(0).toUpperCase()

  const isValidHex = (h: string) => /^#[0-9A-Fa-f]{6}$/.test(h.trim())
  const applyCustomHex = () => {
    if (isValidHex(hexInput)) {
      setCustomHex(hexInput.trim().toUpperCase())
      setHexInputOpen(false)
    }
  }

  const totalMembers = memberIds.length + emailInvites.length

  const submit = async () => {
    if (!name.trim()) {
      setError('Organization name is required.')
      return
    }
    if (!me?.id) {
      setError('Not signed in.')
      return
    }
    setError('')
    setSubmitting(true)

    // 1. Create the org. owner_id triggers an auto-membership row server-side
    // (existing flow in pages/create-org.tsx relies on the same behavior).
    const { data: orgRow, error: orgError } = await supabase
      .from('organizations')
      .insert({ name: name.trim(), owner_id: me.id })
      .select('id')
      .single()

    if (orgError || !orgRow) {
      setSubmitting(false)
      setError(orgError?.message ?? 'Failed to create organization.')
      return
    }
    const newOrgId = orgRow.id as string

    // 2. Add picked members + email invites in parallel. Collect partial
    // failures — we don't roll back the org because the user has already
    // committed to creating it; surface the names that didn't make it.
    const memberFailures: string[] = []
    const inviteFailures: string[] = []

    await Promise.all([
      ...memberIds.map(async (uid) => {
        const { error: memErr } = await supabase
          .from('organization_members')
          .insert({ org_id: newOrgId, user_id: uid, role: 'member' })
        if (memErr && memErr.code !== '23505') {
          const u = candidatePool.find((c) => c.id === uid)
          memberFailures.push(u ? memberLabel(u) : uid)
        }
      }),
      ...emailInvites.map(async (email) => {
        const result = await inviteToOrganization({
          org_id: newOrgId,
          email,
          role: 'member',
        })
        if ('error' in result && result.error !== 'already_member') {
          inviteFailures.push(email)
        }
      }),
    ])

    queryClient.invalidateQueries({ queryKey: ['myOrgs'] })
    queryClient.invalidateQueries({ queryKey: ['members', 'org', newOrgId] })
    setSubmitting(false)

    if (memberFailures.length || inviteFailures.length) {
      // The org row exists, so we don't block the user inside the modal —
      // re-clicking Create would attempt a duplicate. Log it; the user lands
      // on the new org dashboard and can re-add anyone missing from there.
      console.warn('[CreateOrganization] partial failures', {
        memberFailures,
        inviteFailures,
      })
    }

    onCreated?.(newOrgId)
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
        className="bg-white-white rounded-[15px] shadow-2xl w-[600px] max-w-[95vw] max-h-[92vh] overflow-y-auto overflow-x-hidden flex flex-col gap-[20px] pt-[20px]"
      >
        {/* Header */}
        <div className="flex flex-col gap-[5px] px-[20px]">
          <p className="text-turquoise-main text-[10px] font-medium uppercase tracking-[1.5px]">
            new organization
          </p>
          <h2 className="text-black text-[20px] font-semibold">
            Set up a new organization
          </h2>
          <p className="text-gray-main text-[12px]">
            Bring your members, teams, projects, and shared knowledge into one space.
            You can update these settings later.
          </p>
        </div>

        <div className="h-px bg-gray-border-light w-full" />

        {/* Body */}
        <div className="flex flex-col gap-[15px] px-[20px]">
          {/* Avatar + Name */}
          <div className="flex items-center gap-[15px]">
            <span
              className="w-[50px] h-[50px] rounded-[10px] inline-flex items-center justify-center text-[24px] font-semibold text-white-item shrink-0"
              style={{
                backgroundColor: swatchHex,
                fontFamily: 'Geist Mono, ui-monospace, monospace',
              }}
            >
              {initial}
            </span>
            <div className="flex-1 min-w-0">
              <Input
                label={
                  <>
                    Organization name <span className="text-red-main">*</span>
                  </>
                }
                placeholder="Strato Labs"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                className="!max-w-none"
              />
            </div>
          </div>

          {/* Color picker */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-[5px] w-[205px]">
              <p className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                organization colour
              </p>
              <div className="flex items-center gap-[5px]">
                {COLORS.map((c) => {
                  const active = !customHex && color === c.key
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => {
                        setColor(c.key)
                        setCustomHex(null)
                      }}
                      className={`w-[30px] h-[30px] rounded-[5px] inline-flex items-center justify-center text-[14px] font-bold text-white ${
                        active ? 'border-[1.5px] border-solid border-primary-main' : ''
                      }`}
                      style={{
                        backgroundColor: c.hex,
                        fontFamily: 'Geist Mono, ui-monospace, monospace',
                      }}
                      aria-label={`Color ${c.key}`}
                    >
                      {initial}
                    </button>
                  )
                })}
                {customHex && (
                  <button
                    type="button"
                    onClick={() => setHexInputOpen(true)}
                    className="w-[30px] h-[30px] rounded-[5px] inline-flex items-center justify-center text-[14px] font-bold text-white border-[1.5px] border-solid border-primary-main"
                    style={{
                      backgroundColor: customHex,
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
                className="bg-white-white border border-gray-border-light rounded-[5px] h-[32px] px-[15px] py-[10px] text-[12px] text-black inline-flex items-center gap-[5px] hover:bg-white-item"
              >
                🎨 {hexInputOpen ? 'Apply' : 'Custom hex'}
              </button>
            </div>
          </div>

          {/* Members */}
          <div className="flex flex-col gap-[5px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-[10px]">
                <label className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                  members
                </label>
                <span className="text-gray-secondary text-[10px]">
                  {totalMembers} added
                </span>
              </div>
              <button
                type="button"
                onClick={() => setInviteOpen(true)}
                className="text-black text-[10px] uppercase inline-flex items-center gap-[5px] pl-[10px] pr-[5px] py-[5px] rounded-[5px] hover:bg-white-item"
              >
                <Icon name="Add" size={10} />
                invite by email
              </button>
            </div>

            <div className="border border-gray-border rounded-[8px] overflow-hidden flex flex-col">
              {/* Search */}
              <div className="flex items-center gap-[10px] px-[10px] py-[10px] bg-white-item border-b border-gray-border-light">
                <Icon name="Search" size={15} style={{ color: '#6B7B86' }} />
                <input
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Add team or member  ·  Start typing a name"
                  className="flex-1 bg-transparent outline-none text-[12px] text-black placeholder:text-gray-main"
                />
              </div>

              {/* Search results */}
              {memberSearch.trim() && (
                <div className="max-h-[140px] overflow-y-auto border-b border-gray-border-light">
                  {candidateMembers.length === 0 ? (
                    <p className="px-[10px] py-[8px] text-gray-secondary text-[11px]">
                      No matches
                    </p>
                  ) : (
                    candidateMembers.slice(0, 8).map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setMemberIds((prev) => [...prev, u.id])
                          setMemberSearch('')
                        }}
                        className="w-full text-left px-[10px] py-[8px] hover:bg-white-item flex items-center gap-[10px]"
                      >
                        <span className="w-[25px] h-[25px] rounded-full bg-gray-disabled inline-flex items-center justify-center text-[10px] font-semibold text-gray-main shrink-0">
                          {memberLabel(u).charAt(0).toUpperCase()}
                        </span>
                        <span className="text-[12px] text-black">
                          {memberLabel(u)}
                        </span>
                        {u.job_title && (
                          <span className="text-[10px] text-gray-secondary">
                            {u.job_title}
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Added members */}
              {addedMembers.length > 0 && (
                <div className="divide-y divide-gray-border-light">
                  {addedMembers.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between px-[10px] py-[10px]"
                    >
                      <div className="flex items-center gap-[10px] min-w-0">
                        <span className="w-[25px] h-[25px] rounded-full bg-gray-disabled inline-flex items-center justify-center text-[10px] font-semibold text-gray-main shrink-0">
                          {memberLabel(u).charAt(0).toUpperCase()}
                        </span>
                        <div className="flex flex-col gap-[3px] min-w-0">
                          <span className="text-[12px] text-black font-semibold truncate leading-none">
                            {memberLabel(u)}
                          </span>
                          {u.job_title && (
                            <span className="text-[8px] text-gray-main truncate leading-none">
                              {u.job_title}
                            </span>
                          )}
                        </div>
                      </div>
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
                  ))}
                </div>
              )}

              {/* Email invites (pending) */}
              {emailInvites.length > 0 && (
                <div className="divide-y divide-gray-border-light border-t border-gray-border-light">
                  {emailInvites.map((email, i) => (
                    <div
                      key={`${email}-${i}`}
                      className="flex items-center justify-between px-[10px] py-[10px]"
                    >
                      <div className="flex items-center gap-[10px] min-w-0">
                        <span className="w-[25px] h-[25px] rounded-full bg-gray-disabled inline-flex items-center justify-center text-gray-secondary shrink-0">
                          <Icon name="Email" size={12} />
                        </span>
                        <div className="flex flex-col gap-[3px] min-w-0">
                          <span className="text-[12px] text-black truncate leading-none">
                            {email}
                          </span>
                          <span className="text-[8px] text-gray-main leading-none">
                            Pending invite
                          </span>
                        </div>
                      </div>
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
                  ))}
                </div>
              )}

              {/* Suggestion footer */}
              <div className="bg-white-item border-t border-gray-border-light px-[10px] py-[5px] flex items-center gap-[5px] text-[10px] leading-[1.3]">
                <span className="text-[12px]">💡</span>
                <span className="text-gray-main">Suggested from past work: </span>
                <span className="text-black font-semibold">(none yet)</span>
              </div>
            </div>
          </div>

          {error && <p className="text-red-main text-[12px]">{error}</p>}
        </div>

        {/* Footer */}
        <div className="bg-white-item border-t border-gray-border-light px-[20px] py-[15px] rounded-b-[15px] flex items-center justify-between">
          <div className="flex items-center gap-[5px]">
            <span className="bg-white-white border border-gray-border-light rounded-[5px] p-[5px] text-gray-main text-[10px]">
              ⌘ ⏎
            </span>
            <span className="text-gray-main text-[10px]">to create</span>
          </div>
          <div className="flex items-center gap-[10px]">
            <span className="text-primary-main text-[10px]">
              {totalMembers} {totalMembers === 1 ? 'member' : 'members'}
            </span>
            <Button variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={submitting || !name.trim()}
            >
              {submitting ? 'Creating…' : 'Create Organization'}
            </Button>
          </div>
        </div>
      </div>

      {/* Email invite sub-modal — reuses the 'meeting' variant, which omits the
          per-invite role picker (the org modal in Figma doesn't show roles). */}
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
