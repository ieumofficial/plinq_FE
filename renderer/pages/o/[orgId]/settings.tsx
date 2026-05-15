import { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useQueryClient } from '@tanstack/react-query'
import OrganizationAppShell from '../../../components/OrganizationAppShell'
import Button from '../../../components/ui/Button'
import Input from '../../../components/ui/Input'
import UserGroup from '../../../components/ui/UserGroup'
import Icon from '../../../components/ui/Icon'
import InviteByEmailModal from '../../../components/InviteByEmailModal'
import {
  useCurrentUser,
  useInviteToOrg,
  useMyOrgsWithStats,
  useOrgMembers,
} from '../../../lib/hooks'
import { queryKeys } from '../../../lib/queryKeys'
import { supabase } from '../../../lib/supabase'
import { useToast } from '../../../lib/toast'
import { userToMember } from '../../../lib/types'

type OrgColorKey =
  | 'blue'
  | 'green'
  | 'red'
  | 'brown'
  | 'purple'
  | 'turquoise'

const PALETTE: { key: OrgColorKey; hex: string }[] = [
  { key: 'blue', hex: '#2D5A9E' },
  { key: 'green', hex: '#2F6B45' },
  { key: 'red', hex: '#9B3838' },
  { key: 'brown', hex: '#8A5A1E' },
  { key: 'purple', hex: '#5B3D8A' },
  { key: 'turquoise', hex: '#558589' },
]

function colorMatches(stored: string | null | undefined, key: OrgColorKey) {
  if (!stored) return key === 'blue'
  return stored === key
}

export default function OrgSettingsPage() {
  const router = useRouter()
  const orgId = router.query.orgId as string | undefined
  if (!orgId) return null
  return (
    <>
      <Head>
        <title>plinq · Organization · Settings</title>
      </Head>
      <OrganizationAppShell orgId={orgId} active="settings">
        <OrgSettingsBody orgId={orgId} />
      </OrganizationAppShell>
    </>
  )
}

function OrgSettingsBody({ orgId }: { orgId: string }) {
  const { data: user } = useCurrentUser()
  // Resolve the org from the URL's orgId — NOT useMyOrg (which returns the
  // user's *primary* org and would show the wrong org's name here).
  const { data: orgs = [] } = useMyOrgsWithStats(user?.id)
  const org = orgs.find((o) => o.id === orgId) ?? null
  const { data: members = [] } = useOrgMembers(orgId)
  const queryClient = useQueryClient()
  const toast = useToast()

  // `color` is interactive but client-only: the `organizations` table has no
  // colour column yet, so it can't persist. Name persists; see onSave.
  const inviteOrg = useInviteToOrg(orgId)

  const [name, setName] = useState('')
  const [color, setColor] = useState<string>('blue')
  const [memberSearch, setMemberSearch] = useState('')
  const [pickedMemberIds, setPickedMemberIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  // Set true once we confirm `organizations.color` exists (migration applied).
  // Until then the colour picker works locally but can't persist.
  const [colorColumnReady, setColorColumnReady] = useState(false)
  // The colour currently persisted in the DB — used to detect a dirty change.
  const [savedColor, setSavedColor] = useState<string | null>(null)
  // Org creation timestamp (real data — replaces the old static "2019").
  const [createdAt, setCreatedAt] = useState<string | null>(null)

  // Real org-created date. `organizations.created_at` exists today; there's no
  // per-membership join timestamp in the schema, so this is the only truthful
  // date we can show. Separate from the colour probe so a 42703 there doesn't
  // also lose this read.
  useEffect(() => {
    let cancelled = false
    supabase
      .from('organizations')
      .select('created_at')
      .eq('id', orgId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error) return
        const ts = (data as { created_at: string | null } | null)?.created_at
        if (ts) setCreatedAt(ts)
      })
    return () => {
      cancelled = true
    }
  }, [orgId])

  // Resilient colour read: the `organizations.color` column only exists after
  // the migration in supabase/migrations is applied. Probe it directly; if
  // Postgres reports 42703 (undefined column) we silently keep the default
  // and leave persistence disabled rather than breaking the page.
  useEffect(() => {
    let cancelled = false
    supabase
      .from('organizations')
      .select('color')
      .eq('id', orgId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) return // 42703 (no column) or RLS — leave default
        setColorColumnReady(true)
        const c = (data as { color: string | null } | null)?.color
        if (c) {
          setColor(c)
          setSavedColor(c)
        } else {
          setSavedColor('blue')
        }
      })
    return () => {
      cancelled = true
    }
  }, [orgId])

  // Sync the editable name from the canonical org name. Keyed on id+name (not
  // the object) so typing isn't clobbered every render, and so a post-save
  // refetch with the same name is a harmless no-op.
  useEffect(() => {
    if (org) setName(org.name)
  }, [org?.id, org?.name])

  // Keep the visible list in sync with the org's REAL membership so the count
  // always matches the sidebar's "N members total" — including right after an
  // invite (useInviteToOrg invalidates the members cache → this refetches).
  useEffect(() => {
    setPickedMemberIds(new Set(members.map((m) => m.id)))
  }, [members])

  const pickedMembers = useMemo(
    () => members.filter((m) => pickedMemberIds.has(m.id)),
    [members, pickedMemberIds]
  )

  const filteredSearchPool = useMemo(() => {
    const q = memberSearch.trim().toLowerCase()
    if (!q) return [] as typeof members
    return members
      .filter((m) => !pickedMemberIds.has(m.id))
      .filter((m) => {
        const nm = `${m.first_name} ${m.last_name}`.toLowerCase()
        return nm.includes(q) || (m.email ?? '').toLowerCase().includes(q)
      })
      .slice(0, 5)
  }, [members, pickedMemberIds, memberSearch])

  function togglePicked(id: string, on: boolean) {
    setPickedMemberIds((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const trimmedName = name.trim()
  const nameDirty = !!org && trimmedName.length > 0 && trimmedName !== org.name
  // Baseline colour: the persisted value if we have one, else the 'blue'
  // default. A colour change ALWAYS counts as dirty so Save enables even for
  // a colour-only edit — independent of whether the DB column exists yet.
  const baselineColor = savedColor ?? 'blue'
  const colorDirty = color !== baselineColor
  const isDirty = nameDirty || colorDirty
  const canSave = isDirty && !saving

  async function onSave() {
    if (!canSave || !org) return
    setSaving(true)
    setSaveError('')
    // Only include `color` when the column exists, so a pre-migration save
    // still persists the name instead of failing the whole update with 42703.
    const patch: { name: string; color?: string } = { name: trimmedName }
    if (colorColumnReady) patch.color = color
    const { error } = await supabase
      .from('organizations')
      .update(patch)
      .eq('id', orgId)
    setSaving(false)
    if (error) {
      setSaveError(error.message)
      toast.error('Error saving changes', error.message)
      return
    }
    // Sync the baseline so the form returns to a clean (Save-disabled) state.
    // When the column exists this reflects real persistence; when it doesn't,
    // the colour is session-local — the inline hint by the picker makes that
    // explicit so the cleared state isn't misleading.
    setSavedColor(color)
    // Refresh everything that renders the org name (sidebar header, org
    // switcher, this page's title). useMyOrgsWithStats keys under 'myOrgs';
    // useMyOrg (used elsewhere) keys under queryKeys.myOrg.
    queryClient.invalidateQueries({ queryKey: ['myOrgs'] })
    queryClient.invalidateQueries({ queryKey: queryKeys.myOrg(user?.id) })
    toast.success('Changes saved')
  }

  const initialLetter = (name || org?.name || '?').charAt(0).toUpperCase()
  const orgName = org?.name ?? 'Organization'
  const selectedHex =
    PALETTE.find((p) => p.key === color)?.hex ?? PALETTE[0].hex
  const createdLabel = createdAt
    ? `Created · ${new Date(createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}`
    : 'Created · —'

  return (
    <div className="flex-1 min-h-0 p-[50px] flex flex-col gap-[15px] overflow-y-auto">
      {/* TITLE */}
      <div className="shrink-0 flex flex-col gap-[5px]">
        <p className="text-[#9b3838] text-[10px] font-medium uppercase tracking-[1.5px]">
          {orgName} · Settings
        </p>
        <h1 className="text-black text-[35px] font-semibold leading-tight">
          Organization{' '}
          <em
            className="italic font-semibold text-gray-main"
            style={{ fontFamily: 'Inter, ui-sans-serif, sans-serif' }}
          >
            details.
          </em>
        </h1>
      </div>

      {/* MAIN CARD */}
      <div className="shrink-0 flex flex-col gap-[10px]">
        <div className="bg-white-white border border-gray-border-light rounded-[15px] p-[25px] flex flex-col gap-[25px]">
          {/* Header — big avatar + name + joined */}
          <div className="flex items-center gap-[15px]">
            <span
              className="w-[65px] h-[65px] inline-flex items-center justify-center rounded-[10px] text-white transition-colors"
              style={{
                backgroundColor: selectedHex,
                fontFamily: 'Geist Mono, ui-monospace, monospace',
                fontSize: '42px',
                fontWeight: 700,
              }}
              aria-hidden
            >
              {initialLetter}
            </span>
            <div className="flex flex-col gap-[3px] min-w-0">
              <span className="text-black text-[28px] font-semibold leading-tight truncate">
                {name || orgName}
              </span>
              <span
                className="text-gray-secondary text-[12px]"
                style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
              >
                {createdLabel}
              </span>
            </div>
          </div>

          {/* Organization name */}
          <Input
            label="Organization name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="!max-w-none"
          />

          {/* Organization colour */}
          <div className="flex items-end justify-between gap-[10px]">
            <div className="flex flex-col gap-[10px]">
              <p className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                Organization colour
              </p>
              <div className="flex items-center gap-[5px]">
                {PALETTE.map(({ key, hex }) => {
                  const selected = colorMatches(color, key)
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setColor(key)}
                      style={{
                        backgroundColor: hex,
                        borderColor: selected ? '#455E6A' : 'transparent',
                      }}
                      className="w-[30px] h-[30px] rounded-[5px] border-[1.5px] border-solid inline-flex items-center justify-center transition-colors"
                      aria-label={`Use ${key} palette`}
                      aria-pressed={selected}
                    >
                      <span
                        className="text-white text-[14px] font-bold uppercase"
                        style={{
                          fontFamily: 'Geist Mono, ui-monospace, monospace',
                        }}
                      >
                        {initialLetter}
                      </span>
                    </button>
                  )
                })}
              </div>
              {!colorColumnReady && (
                <p className="text-gray-secondary text-[10px] leading-[1.4] max-w-[280px]">
                  Colour changes apply locally for now. They’ll persist once the
                  one-time database migration is applied.
                </p>
              )}
            </div>
            <Button
              size="compact"
              variant="secondary"
              disabled
              title="Custom colors aren't wired up yet."
            >
              🎨 Custom hex
            </Button>
          </div>

          {/* Members editor */}
          <div className="flex flex-col gap-[15px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-[10px]">
                <span className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                  Members
                </span>
                <span className="text-gray-secondary text-[12px]">
                  {pickedMembers.length} added
                </span>
              </div>
              <button
                type="button"
                onClick={() => setInviteOpen(true)}
                className="inline-flex items-center gap-[5px] text-black text-[10px] font-medium uppercase tracking-[1.5px] hover:text-primary-main"
              >
                <Icon name="Add" size={13} />
                Invite by email
              </button>
            </div>

            <div className="border border-gray-border-light rounded-[5px] overflow-hidden">
              {/* Search */}
              <div className="flex items-center gap-[10px] px-[10px] py-[10px] bg-white-item border-b border-solid border-gray-border-light">
                <Icon name="Search" size={15} className="text-gray-main" />
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Add team or member · Start typing a name"
                  className="flex-1 bg-transparent outline-none text-[12px] text-black placeholder:text-gray-main"
                />
              </div>

              {/* Search dropdown — appears while typing */}
              {filteredSearchPool.length > 0 && (
                <div className="border-b border-solid border-gray-border-light bg-white-item">
                  {filteredSearchPool.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        togglePicked(m.id, true)
                        setMemberSearch('')
                      }}
                      className="w-full flex items-center gap-[10px] px-[10px] py-[8px] hover:bg-white-white text-left"
                    >
                      <UserGroup members={[userToMember(m)]} size={25} />
                      <div className="flex flex-col min-w-0">
                        <span className="text-black text-[12px] font-medium truncate">
                          {m.nickname ||
                            `${m.first_name} ${m.last_name}`.trim()}
                        </span>
                        <span className="text-gray-secondary text-[8px] truncate">
                          {m.job_title ?? '—'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Picked members */}
              {pickedMembers.map((m, i) => (
                <div
                  key={m.id}
                  className={`flex items-center justify-between gap-[10px] px-[10px] py-[10px] ${
                    i < pickedMembers.length - 1
                      ? 'border-b border-solid border-gray-border-light'
                      : ''
                  }`}
                >
                  <div className="flex items-center gap-[10px] min-w-0">
                    <UserGroup members={[userToMember(m)]} size={25} />
                    <div className="flex flex-col min-w-0">
                      <span className="text-black text-[12px] font-medium truncate">
                        {m.nickname ||
                          `${m.first_name} ${m.last_name}`.trim()}
                      </span>
                      <span className="text-gray-secondary text-[8px] truncate">
                        {m.job_title ?? '—'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => togglePicked(m.id, false)}
                    className="shrink-0 text-gray-secondary hover:text-black"
                    aria-label="Remove member"
                  >
                    <Icon name="Cross" size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SAVE BAR */}
        <div className="shrink-0 bg-white-white border border-gray-border-light rounded-[15px] px-[20px] py-[20px] flex items-center justify-end gap-[15px]">
          {saveError ? (
            <span className="text-red-main text-[12px]">{saveError}</span>
          ) : (
            <span className="text-gray-secondary text-[12px]">
              {saving
                ? 'Saving…'
                : isDirty
                  ? 'Unsaved changes'
                  : `${pickedMembers.length} members`}
            </span>
          )}
          <Button size="default" onClick={onSave} disabled={!canSave}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>

      <InviteByEmailModal
        open={inviteOpen}
        variant="meeting"
        onClose={() => setInviteOpen(false)}
        onSubmit={async ({ email }) => {
          // Org roles are owner/admin/member (the modal's 'project' roles
          // don't apply) — invite as a plain member. useInviteToOrg throws a
          // friendly message for not_found / already_member, which the modal
          // catches and surfaces inline; on success the modal closes itself.
          await inviteOrg.mutateAsync({ email, role: 'member' })
        }}
      />
    </div>
  )
}
