import { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import AppLayout from '../../components/ui/AppLayout'
import Header from '../../components/ui/Header'
import Icon, { type IconName } from '../../components/ui/Icon'
import Button from '../../components/ui/Button'
import UserGroup from '../../components/ui/UserGroup'
import ProfileDropdown from '../../components/ProfileDropdown'
import {
  useCurrentUser,
  useMyOrg,
  useMyOrgsWithStats,
  useUpdateCurrentUser,
} from '../../lib/hooks'
import {
  usePresence,
  PRESENCE_DOT,
  PRESENCE_LABEL,
  type Presence,
} from '../../lib/presencePref'

type NavKey = 'overview' | 'profile'

const NAV_ITEMS: { key: NavKey; icon: IconName; label: string }[] = [
  { key: 'overview', icon: 'Dashboard', label: 'Overview' },
  { key: 'profile', icon: 'People', label: 'Profile' },
]

function MySpaceSidebar({
  active,
  userInitials,
  userName,
  userEmail,
  onItemClick,
  onBackToWorkspace,
}: {
  active: NavKey
  userInitials: string
  userName: string
  userEmail: string
  onItemClick: (key: NavKey) => void
  onBackToWorkspace: () => void
}) {
  const router = useRouter()
  const [presence, setPresence] = usePresence()
  const [profileRect, setProfileRect] = useState<DOMRect | null>(null)

  return (
    <aside className="bg-white-main border-r border-solid border-gray-border w-[200px] shrink-0 h-full flex flex-col justify-between pt-[10px] pb-[18px] px-[12px] overflow-hidden">
      <div className="flex flex-col gap-[10px] w-full">
        <p className="text-primary-main text-[10px] font-medium uppercase tracking-[1.5px] w-full">
          My space
        </p>
        <nav className="flex flex-col gap-[5px] w-full">
          {NAV_ITEMS.map((it) => {
            const selected = it.key === active
            return (
              <button
                key={it.key}
                type="button"
                onClick={() => onItemClick(it.key)}
                className={`flex items-center justify-between gap-[10px] p-[10px] rounded-[5px] w-full transition-colors ${
                  selected
                    ? 'bg-white-white border border-solid border-gray-border'
                    : 'hover:bg-gray-extra-light'
                }`}
              >
                <span className="flex items-center gap-[10px]">
                  <Icon
                    name={it.icon}
                    size={15}
                    className={selected ? 'text-black' : 'text-primary-main'}
                  />
                  <span
                    className={`text-[12px] ${
                      selected ? 'text-black font-semibold' : 'text-primary-main'
                    }`}
                  >
                    {it.label}
                  </span>
                </span>
              </button>
            )
          })}
        </nav>
      </div>

      <div className="flex flex-col gap-[5px] w-full">
        <div className="h-px bg-gray-border-light w-full" />
        <button
          type="button"
          onClick={onBackToWorkspace}
          className="flex items-center gap-[10px] px-[10px] py-[10px] rounded-[5px] hover:bg-gray-extra-light transition-colors"
        >
          <span className="bg-gray-extra-light rounded-[2px] w-[18px] h-[18px] inline-flex items-center justify-center text-gray-main">
            <Icon name="ArrowLeft" size={10} />
          </span>
          <span className="text-gray-main text-[12px]">Back to workspace</span>
        </button>
        <div className="h-px bg-gray-border-light w-full" />
        <button
          type="button"
          onClick={(e) => {
            setProfileRect(
              profileRect ? null : e.currentTarget.getBoundingClientRect()
            )
          }}
          className="flex items-center gap-[10px] px-[5px] py-[10px] rounded-[5px] hover:bg-gray-extra-light transition-colors"
          aria-label="Open profile menu"
        >
          <span className="bg-primary-main text-white rounded-full w-[25px] h-[25px] inline-flex items-center justify-center text-[12px] font-semibold uppercase shrink-0">
            {userInitials}
          </span>
          <div className="flex flex-col gap-[3px] min-w-0 text-left">
            <span
              className="text-black text-[14px] font-semibold truncate"
              style={{ fontFamily: 'Inter, ui-sans-serif, sans-serif' }}
            >
              {userName}
            </span>
            <span className="text-gray-main text-[10px] truncate">
              {userEmail}
            </span>
          </div>
        </button>
      </div>
      <ProfileDropdown
        anchorRect={profileRect}
        presence={presence}
        onPresenceChange={(next) => {
          setPresence(next)
          setProfileRect(null)
        }}
        onMyPage={() => {
          setProfileRect(null)
          router.push('/my/overview')
        }}
        onClose={() => setProfileRect(null)}
      />
    </aside>
  )
}

// ─── Field components ──────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
      {children}
    </p>
  )
}

function TextField({
  label,
  value,
  onChange,
  bold,
  readOnly,
  placeholder,
}: {
  label: string
  value: string
  onChange?: (next: string) => void
  bold?: boolean
  readOnly?: boolean
  placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-[5px] w-full">
      <FieldLabel>{label}</FieldLabel>
      <input
        type="text"
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        className={`h-[34px] w-full px-[16px] py-[12px] rounded-lg border border-solid border-gray-border bg-white-white text-[14px] outline-none focus:border-primary-main transition-colors ${
          bold ? 'font-semibold text-black' : 'text-black'
        } ${readOnly ? 'cursor-default text-gray-main' : ''}`}
      />
    </div>
  )
}

const PRESENCE_PILL_BG: Record<Presence, string> = {
  available: '#DCEBE0',
  in_meeting: '#F4E6CD',
  unavailable: '#F2DEDE',
}

const PRESENCE_PILL_TEXT: Record<Presence, string> = {
  available: '#2F6B45',
  in_meeting: '#8A5A1E',
  unavailable: '#9B3838',
}

function StatusSelector({
  value,
  onChange,
}: {
  value: Presence
  onChange: (next: Presence) => void
}) {
  const options: Presence[] = ['available', 'in_meeting', 'unavailable']
  return (
    <div className="flex flex-col gap-[5px]">
      <FieldLabel>Status</FieldLabel>
      <div className="bg-white-item rounded-[5px] flex items-start gap-[5px] p-[5px] w-fit">
        {options.map((p) => {
          const selected = value === p
          return (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              style={
                selected
                  ? { backgroundColor: PRESENCE_PILL_BG[p] }
                  : undefined
              }
              className={`inline-flex items-center gap-[5px] px-[15px] py-[10px] rounded-[5px] transition-colors ${
                selected ? '' : 'hover:bg-white-white'
              }`}
            >
              <span
                className="w-[6px] h-[6px] rounded-full shrink-0"
                style={{ backgroundColor: PRESENCE_DOT[p] }}
              />
              <span
                className="text-[12px] font-semibold leading-none whitespace-nowrap"
                style={{
                  color: selected ? PRESENCE_PILL_TEXT[p] : '#16242E',
                }}
              >
                {PRESENCE_LABEL[p]}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Org row ────────────────────────────────────────────────────────────────

const ORG_COLORS = [
  '#9B3838',
  '#5B3D8A',
  '#2D5A9E',
  '#2F6B45',
  '#8A5A1E',
  '#558589',
]

function orgColor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return ORG_COLORS[Math.abs(h) % ORG_COLORS.length]
}

function OrgRow({
  name,
  id,
  members,
  projects,
  myProjects,
  onClick,
}: {
  name: string
  id: string
  members: number
  projects: number
  myProjects: number
  onClick: () => void
}) {
  const initial = (name?.charAt(0) ?? '?').toUpperCase()
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-white-item rounded-[5px] flex items-center justify-between px-[14px] py-[10px] gap-[15px] w-full text-left hover:bg-white-secondary transition-colors"
    >
      <div className="flex items-center gap-[15px] min-w-0">
        <span
          className="w-[28px] h-[28px] rounded-[5px] inline-flex items-center justify-center text-white font-bold text-[14px] shrink-0"
          style={{
            backgroundColor: orgColor(id),
            fontFamily: 'Geist Mono, ui-monospace, monospace',
          }}
        >
          {initial}
        </span>
        <div className="flex flex-col gap-[3px] min-w-0">
          <p className="text-black text-[14px] font-semibold truncate">{name}</p>
          <p className="text-gray-secondary text-[10px] truncate">
            {members} member{members === 1 ? '' : 's'} · {projects} project
            {projects === 1 ? '' : 's'} · {myProjects} where you contribute
          </p>
        </div>
      </div>
    </button>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function MyProfilePage() {
  const router = useRouter()
  const { data: user, isFetched } = useCurrentUser()
  const { data: org } = useMyOrg(user?.id)
  const { data: orgsWithStats = [] } = useMyOrgsWithStats(user?.id)
  const updateUser = useUpdateCurrentUser()
  const [presence, setPresence] = usePresence()

  // Local form state — initialized from user, dirty diff tracked for the save bar.
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState('')

  useEffect(() => {
    if (user) {
      setDisplayName(
        user.nickname || `${user.first_name} ${user.last_name}`.trim()
      )
      setRole(user.job_title ?? '')
    }
  }, [user])

  useEffect(() => {
    if (isFetched && !user) router.push('/')
  }, [isFetched, user, router])

  const userInitials = user
    ? `${user.first_name[0] ?? ''}${user.last_name[0] ?? ''}`.toUpperCase()
    : '··'
  const userName = user
    ? user.nickname || `${user.first_name} ${user.last_name}`.trim()
    : ''
  const userEmail = user?.email ?? ''

  const isDirty = useMemo(() => {
    if (!user) return false
    const initialName =
      user.nickname || `${user.first_name} ${user.last_name}`.trim()
    return displayName !== initialName || role !== (user.job_title ?? '')
  }, [user, displayName, role])

  const onSave = () => {
    if (!user || !isDirty) return
    // Treat the Display name field as the user's preferred display label.
    // We persist it to `nickname`; first/last stay untouched until we add
    // dedicated UI for them.
    updateUser.mutate({
      nickname: displayName.trim() || null,
      job_title: role.trim() || null,
    })
  }

  return (
    <>
      <Head>
        <title>plinq · My Space · Profile</title>
      </Head>
      <AppLayout
        header={
          <Header
            orgName={org?.name ?? 'Plinq'}
            eyebrow="My Space · Profile"
            title={user ? userName : ''}
            userInitials={userInitials}
            onBack={() => router.back()}
            onForward={() => window.history.forward()}
          />
        }
        sidebar={
          <MySpaceSidebar
            active="profile"
            userInitials={userInitials}
            userName={userName}
            userEmail={userEmail}
            onItemClick={(k) => {
              if (k === 'overview') router.push('/my/overview')
              if (k === 'profile') router.push('/my/profile')
            }}
            onBackToWorkspace={() => router.push('/personal-dashboard')}
          />
        }
      >
        <div className="flex-1 min-h-0 p-[30px] flex flex-col gap-[10px] overflow-y-auto">
          <div className="flex items-start">
            <div className="flex-1 min-w-0 flex flex-col gap-[10px]">
              {/* Profile + form card */}
              <div className="bg-white-white border border-solid border-gray-border-light rounded-[10px] p-[25px] flex flex-col gap-[25px]">
                <h1 className="text-black text-[28px] font-semibold leading-none">
                  {userName || 'Your name'}
                </h1>

                {/* Avatar + actions */}
                <div className="flex items-start gap-[15px]">
                  <span className="bg-primary-main text-white rounded-full w-[60px] h-[60px] inline-flex items-center justify-center text-[28px] font-semibold uppercase shrink-0">
                    {userInitials}
                  </span>
                  <div className="flex flex-col gap-[5px]">
                    <div className="flex items-start gap-[10px]">
                      <button
                        type="button"
                        disabled
                        title="Photo upload isn't wired up yet."
                        className="bg-gray-disabled border border-solid border-gray-border-light rounded-[5px] px-[15px] py-[10px] text-gray-secondary text-[12px] cursor-not-allowed"
                      >
                        Upload new photo
                      </button>
                      <button
                        type="button"
                        disabled
                        title="Photo upload isn't wired up yet."
                        className="bg-transparent rounded-[5px] px-[15px] py-[10px] text-gray-secondary text-[12px] font-semibold cursor-not-allowed"
                      >
                        Remove
                      </button>
                    </div>
                    <p className="text-gray-secondary text-[12px]">
                      JPG or PNG · Max 4 MB · Square crop recommended.
                    </p>
                  </div>
                </div>

                {/* Inputs */}
                <div className="flex flex-col gap-[15px] w-full">
                  <TextField
                    label="Display name"
                    value={displayName}
                    onChange={setDisplayName}
                    bold
                  />
                  <div className="flex gap-[15px] w-full">
                    <div className="flex-1 min-w-0">
                      <TextField
                        label="Email"
                        value={userEmail}
                        readOnly
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <TextField
                        label="Role"
                        value={role}
                        onChange={setRole}
                        placeholder="e.g. Senior Product Designer"
                      />
                    </div>
                  </div>
                  <StatusSelector value={presence} onChange={setPresence} />
                </div>
              </div>

              {/* Organizations list */}
              <div className="bg-white-white border border-solid border-gray-border-light rounded-[10px] px-[20px] py-[15px] flex flex-col gap-[10px]">
                <p className="text-blue-main text-[10px] font-medium uppercase tracking-[1.5px]">
                  Organizations · {orgsWithStats.length}
                </p>
                {orgsWithStats.length === 0 ? (
                  <p className="text-gray-secondary text-[12px]">
                    You&apos;re not in any organizations yet.
                  </p>
                ) : (
                  <div className="flex flex-col gap-[5px]">
                    {orgsWithStats.map((o) => (
                      <OrgRow
                        key={o.id}
                        id={o.id}
                        name={o.name}
                        members={o.memberCount}
                        projects={o.projectCount}
                        myProjects={o.myProjectCount}
                        onClick={() => router.push(`/o/${o.id}/dashboard`)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Save bar */}
              <div className="bg-white-white border border-solid border-gray-border-light rounded-[10px] px-[20px] py-[15px] flex items-center justify-end gap-[10px]">
                <span className="text-gray-main text-[10px]">
                  {isDirty
                    ? 'Unsaved changes'
                    : updateUser.isPending
                    ? 'Saving…'
                    : 'Up to date'}
                </span>
                <Button
                  size="default"
                  onClick={onSave}
                  disabled={!isDirty || updateUser.isPending}
                >
                  {updateUser.isPending ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    </>
  )
}
