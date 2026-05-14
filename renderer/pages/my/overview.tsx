import { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import AppLayout from '../../components/ui/AppLayout'
import Header from '../../components/ui/Header'
import Icon, { type IconName } from '../../components/ui/Icon'
import Button from '../../components/ui/Button'
import ProjectLabel from '../../components/ui/ProjectLabel'
import UserGroup from '../../components/ui/UserGroup'
import PriorityTag from '../../components/ui/PriorityTag'
import { useProjectPreview } from '../../components/ProjectPreviewProvider'
import Tag from '../../components/ui/Tag'
import Checkbox from '../../components/ui/Checkbox'
import ProfileDropdown from '../../components/ProfileDropdown'
import {
  useCurrentUser,
  useMyOrg,
  useUserActionItems,
  useUserProjects,
} from '../../lib/hooks'
import { dbPriorityToUi, formatDueDate, userToMember } from '../../lib/types'
import { usePresence } from '../../lib/presencePref'

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
                    : 'hover:bg-white-item'
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
                      selected
                        ? 'text-black font-semibold'
                        : 'text-primary-main'
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
          className="flex items-center gap-[10px] px-[10px] py-[10px] rounded-[5px] hover:bg-white-item transition-colors"
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

function StatColumn({
  value,
  label,
  color,
}: {
  value: number | string
  label: string
  color: string
}) {
  return (
    <div className="flex flex-col gap-[5px] items-center">
      <p
        className="font-bold text-[28px] text-center tracking-[1px]"
        style={{
          fontFamily: 'Geist Mono, ui-monospace, monospace',
          color,
        }}
      >
        {value}
      </p>
      <p className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px] whitespace-nowrap">
        {label}
      </p>
    </div>
  )
}

function SectionEyebrow({
  eyebrow,
  eyebrowColor,
  title,
  action,
}: {
  eyebrow: string
  eyebrowColor: string
  title: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex flex-col gap-[5px]">
        <p
          className="text-[10px] font-medium uppercase tracking-[1.5px]"
          style={{ color: eyebrowColor }}
        >
          {eyebrow}
        </p>
        <p className="text-black text-[20px] font-semibold">{title}</p>
      </div>
      {action}
    </div>
  )
}

export default function MyOverviewPage() {
  const router = useRouter()
  const preview = useProjectPreview()
  const { data: user, isFetched: userFetched } = useCurrentUser()
  const { data: org } = useMyOrg(user?.id)

  useEffect(() => {
    if (userFetched && !user) router.push('/')
  }, [userFetched, user, router])

  const { data: actionItems = [] } = useUserActionItems(user?.id, { limit: 50 })
  const { data: projects = [] } = useUserProjects(user?.id)

  const userInitials = user
    ? `${user.first_name[0] ?? ''}${user.last_name[0] ?? ''}`.toUpperCase()
    : '··'
  const userName = user
    ? user.nickname || `${user.first_name} ${user.last_name}`.trim()
    : ''
  const userEmail = user?.email ?? ''
  const fullName = user
    ? `${user.first_name} ${user.last_name}`.trim() || user.nickname || ''
    : ''
  const role = user?.job_title ?? 'Member'

  const today = new Date()
  const startOfWeek = useMemo(() => {
    const d = new Date(today)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - d.getDay())
    return d
  }, [today])
  const endOfWeek = useMemo(() => {
    const d = new Date(startOfWeek)
    d.setDate(d.getDate() + 7)
    return d
  }, [startOfWeek])

  const openTasks = actionItems.filter((t) => t.status !== 'done')
  const dueThisWeek = openTasks.filter((t) => {
    if (!t.due_date) return false
    const d = new Date(t.due_date)
    return d >= startOfWeek && d < endOfWeek
  }).length
  const todayCount = openTasks.filter((t) => {
    if (!t.due_date) return false
    const d = new Date(t.due_date + 'T00:00:00')
    return d.toDateString() === today.toDateString()
  }).length
  const activeProjects = projects.filter(
    (p) => p.status === 'in_progress' || p.status === 'review'
  ).length
  const orgsCount = new Set(projects.map((p) => p.org_id)).size

  return (
    <>
      <Head>
        <title>plinq · My Space · Overview</title>
      </Head>
      <AppLayout
        header={
          <Header
            orgName={org?.name ?? 'Plinq'}
            eyebrow={`My Space · ${today.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}`}
            title={user ? `Good morning, ${user.first_name}` : ''}
            userInitials={userInitials}
            onBack={() => router.back()}
            onForward={() => window.history.forward()}
          />
        }
        sidebar={
          <MySpaceSidebar
            active="overview"
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
        <div className="flex-1 min-h-0 p-[15px] flex flex-col gap-[10px] overflow-y-auto">
          {/* HEADER CARD */}
          <div className="shrink-0 bg-white-white border border-solid border-gray-border-light rounded-[10px] p-[20px] flex items-center justify-between gap-[20px]">
            <div className="flex items-center gap-[24px] min-w-0">
              <span className="bg-primary-main text-white rounded-full w-[60px] h-[60px] inline-flex items-center justify-center text-[28px] font-semibold uppercase shrink-0">
                {userInitials}
              </span>
              <div className="flex flex-col gap-[10px] min-w-0">
                <p className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px]">
                  member since · {org?.name ? 'March 2024' : '—'}
                </p>
                <p className="text-black text-[28px] font-semibold leading-none">
                  {fullName || 'Your name'}
                </p>
                <p className="text-gray-main text-[12px]">
                  {role}
                  {userEmail ? ` · ${userEmail}` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-[50px] shrink-0">
              <div className="w-px h-[53px] bg-gray-border-light" />
              <div className="flex items-center gap-[30px]">
                <StatColumn
                  value={activeProjects}
                  label="Active projects"
                  color="#2F6B45"
                />
                <StatColumn
                  value={openTasks.length}
                  label="Open tasks"
                  color="#B65A5A"
                />
                <StatColumn value={todayCount} label="Today" color="#2D5A9E" />
              </div>
              <Button
                size="compact"
                variant="secondary"
                onClick={() => router.push('/my/profile')}
              >
                Edit profile
              </Button>
            </div>
          </div>

          {/* TWO-COL PANELS */}
          <div className="flex-1 min-h-0 flex gap-[10px]">
            {/* What you have to do */}
            <section className="flex-1 min-w-0 bg-white-white border border-solid border-gray-border-light rounded-[10px] px-[20px] py-[15px] flex flex-col gap-[10px] overflow-hidden">
              <SectionEyebrow
                eyebrow={`${openTasks.length} open tasks · ${dueThisWeek} due this week`}
                eyebrowColor="#9B3838"
                title="What you have to do"
                action={
                  <button
                    type="button"
                    onClick={() => router.push('/action-items')}
                    className="flex items-center gap-[5px] pl-[10px] pr-[5px] py-[5px] rounded-[5px] text-black text-[10px] uppercase hover:bg-white-item transition-colors"
                  >
                    View all
                    <Icon name="ArrowRight" size={15} />
                  </button>
                }
              />
              <div className="flex flex-col gap-[5px] flex-1 min-h-0 overflow-y-auto">
                {openTasks.length === 0 ? (
                  <p className="text-gray-secondary text-[12px] px-[10px]">
                    No open tasks. 🎉
                  </p>
                ) : (
                  openTasks.slice(0, 8).map((t) => (
                    <div
                      key={t.id}
                      className="bg-white-item rounded-[5px] flex items-center justify-between px-[14px] py-[10px] gap-[15px]"
                    >
                      <div className="flex items-center gap-[15px] min-w-0 flex-1">
                        <Checkbox checked={false} />
                        <div className="flex flex-col gap-[5px] min-w-0">
                          <p className="text-black text-[12px] font-semibold truncate">
                            {t.title}
                          </p>
                          <div className="flex items-center gap-[20px]">
                            {t.due_date && (
                              <span className="text-gray-secondary text-[10px] font-medium uppercase tracking-[1.5px]">
                                {formatDueDate(t.due_date) ?? '—'}
                              </span>
                            )}
                            {t.due_date && (
                              <span className="w-px h-[10px] bg-gray-border-light" />
                            )}
                            <PriorityTag priority={dbPriorityToUi(t.priority)} />
                          </div>
                        </div>
                      </div>
                      {t.project_id && (
                        <Tag color="purple" size="md">
                          {projects.find((p) => p.id === t.project_id)?.name ??
                            'Project'}
                        </Tag>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Your projects */}
            <section className="flex-1 min-w-0 bg-white-white border border-solid border-gray-border-light rounded-[10px] px-[20px] py-[15px] flex flex-col gap-[10px] overflow-hidden">
              <SectionEyebrow
                eyebrow={`Across ${orgsCount || 1} organization${
                  orgsCount === 1 ? '' : 's'
                }`}
                eyebrowColor="#2D5A9E"
                title="Your projects"
                action={
                  <button
                    type="button"
                    onClick={() => router.push('/projects')}
                    className="flex items-center gap-[5px] pl-[10px] pr-[5px] py-[5px] rounded-[5px] text-black text-[10px] uppercase hover:bg-white-item transition-colors"
                  >
                    View all {projects.length}
                    <Icon name="ArrowRight" size={15} />
                  </button>
                }
              />
              <div className="flex flex-col gap-[5px] flex-1 min-h-0 overflow-y-auto">
                {projects.length === 0 ? (
                  <p className="text-gray-secondary text-[12px] px-[10px]">
                    No projects yet.
                  </p>
                ) : (
                  projects.slice(0, 10).map((p) => {
                    const pct = Math.max(0, Math.min(100, p.progressPct ?? 0))
                    const isLead = p.lead_id === user?.id
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => preview.open(p.id)}
                        className="bg-white-item rounded-[5px] flex items-center justify-between px-[14px] py-[10px] gap-[10px] text-left hover:bg-white-secondary transition-colors"
                      >
                        <div className="flex items-center gap-[15px] min-w-0 flex-1">
                          <ProjectLabel
                            name={p.name}
                            color={p.color ?? 'blue'}
                            size="md"
                          />
                          <div className="flex flex-col gap-[3px] min-w-0">
                            <p className="text-black text-[14px] font-semibold truncate">
                              {p.name}
                            </p>
                            <p className="text-gray-secondary text-[10px] truncate">
                              <span
                                className={
                                  isLead ? 'font-bold text-blue-main' : ''
                                }
                              >
                                {isLead ? 'Lead' : 'Member'}
                              </span>
                              {p.dueDate
                                ? `  ·  Due ${formatDueDate(p.dueDate) ?? ''}`
                                : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-[5px] w-[105px] shrink-0">
                          <span className="flex-1 h-[5px] bg-gray-progress rounded-[5px] overflow-hidden">
                            <span
                              className="block h-full rounded-[5px] bg-blue-main"
                              style={{ width: `${pct}%` }}
                            />
                          </span>
                          <span
                            className="text-black text-[10px] font-semibold tracking-[1px] shrink-0"
                            style={{
                              fontFamily:
                                'Geist Mono, ui-monospace, monospace',
                            }}
                          >
                            {pct}%
                          </span>
                        </div>
                        {p.members.length > 0 && (
                          <UserGroup
                            members={p.members.map(userToMember)}
                            size={15}
                            max={5}
                          />
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            </section>
          </div>
        </div>
      </AppLayout>
    </>
  )
}
