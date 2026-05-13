import { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import OrganizationAppShell from '../../../components/OrganizationAppShell'
import Button from '../../../components/ui/Button'
import Input from '../../../components/ui/Input'
import ProjectLabel, { type ProjectColorKey } from '../../../components/ui/ProjectLabel'
import UserGroup from '../../../components/ui/UserGroup'
import Icon from '../../../components/ui/Icon'
import {
  useCurrentUser,
  useMyOrg,
  useOrgMembers,
} from '../../../lib/hooks'
import { userToMember } from '../../../lib/types'

const PALETTE: ProjectColorKey[] = [
  'blue',
  'green',
  'amber',
  'red',
  'purple',
  'turquoise',
]

function colorMatches(stored: string | null | undefined, key: ProjectColorKey) {
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
  const { data: org } = useMyOrg(user?.id)
  const { data: members = [] } = useOrgMembers(orgId)

  // Local form state — there's no updateOrg mutation yet, so changes stay
  // client-side. The Save bar at the bottom hooks up to whatever mutation
  // gets wired later (placeholder no-op for now).
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>('blue')
  const [memberSearch, setMemberSearch] = useState('')
  const [pickedMemberIds, setPickedMemberIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (org) {
      setName(org.name)
      // No color field on org yet — default to blue.
      setColor('blue')
    }
  }, [org])

  // Pre-populate picked members with the first few from the org so the
  // mock card matches the Figma's "5 added" feel.
  useEffect(() => {
    if (pickedMemberIds.size === 0 && members.length > 0) {
      const initial = new Set(members.slice(0, Math.min(3, members.length)).map((m) => m.id))
      setPickedMemberIds(initial)
    }
  }, [members, pickedMemberIds.size])

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

  function onSave() {
    // TODO: wire up to a real updateOrg mutation once it exists. For now this
    // is a visual stub so the design layout is in place.
    console.log('[org/settings] save', { name, color, members: Array.from(pickedMemberIds) })
  }

  const initialLetter = (name || org?.name || '?').charAt(0).toUpperCase()
  const orgName = org?.name ?? 'Organization'

  return (
    <div className="flex-1 min-h-0 p-[50px] flex flex-col gap-[15px] overflow-hidden">
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
      <div className="flex-1 min-h-0 flex flex-col gap-[10px] overflow-hidden">
        <div className="flex-1 min-h-0 bg-white-white border border-gray-border-light rounded-[10px] p-[25px] flex flex-col gap-[25px] overflow-y-auto">
          {/* Header — big avatar + name + joined */}
          <div className="flex items-center gap-[15px]">
            <span
              className="w-[65px] h-[65px] inline-flex items-center justify-center rounded-[10px] bg-red-light text-red-main"
              style={{
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
                Joined · Mar 14, 2019
              </span>
            </div>
          </div>

          {/* Organization name */}
          <Input
            label="Organization name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          {/* Organization colour */}
          <div className="flex items-end justify-between gap-[10px]">
            <div className="flex flex-col gap-[10px]">
              <p className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                Organization colour
              </p>
              <div className="flex items-center gap-[5px]">
                {PALETTE.map((c) => {
                  const selected = colorMatches(color, c)
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`rounded-[5px] transition-shadow ${
                        selected
                          ? 'ring-2 ring-primary-main ring-offset-2'
                          : 'hover:ring-1 hover:ring-gray-border'
                      }`}
                      aria-label={`Use ${c} palette`}
                    >
                      <ProjectLabel name={initialLetter} color={c} size="md" />
                    </button>
                  )
                })}
              </div>
            </div>
            <Button size="compact" variant="secondary">
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
                className="inline-flex items-center gap-[5px] text-black text-[10px] font-medium uppercase tracking-[1.5px] hover:text-primary-main"
              >
                <Icon name="Add" size={13} />
                Invite by email
              </button>
            </div>

            <div className="border border-gray-border-light rounded-[5px] overflow-hidden">
              {/* Search */}
              <div className="flex items-center gap-[10px] px-[10px] py-[10px] border-b border-solid border-gray-border-light">
                <Icon name="Search" size={15} />
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Add team or member · Start typing a name"
                  className="flex-1 bg-transparent outline-none text-[12px] text-black placeholder:text-gray-secondary"
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

              {/* Suggestion footer */}
              <div className="flex items-center gap-[5px] px-[10px] py-[8px] bg-white-item">
                <span aria-hidden>💡</span>
                <span className="text-gray-main text-[10px]">
                  Suggested from past work:
                </span>
                <button
                  type="button"
                  className="text-primary-main text-[10px] hover:underline"
                >
                  + Sam Lee, + Riley Wong
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SAVE BAR */}
        <div className="shrink-0 bg-white-white border border-gray-border-light rounded-[10px] px-[20px] py-[20px] flex items-center justify-end gap-[15px]">
          <span className="text-gray-secondary text-[12px]">
            {pickedMembers.length} members
          </span>
          <Button size="default" onClick={onSave}>
            Save changes
          </Button>
        </div>
      </div>
    </div>
  )
}
