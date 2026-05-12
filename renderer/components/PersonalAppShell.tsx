import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/router'
import AppLayout from './ui/AppLayout'
import SideMenu, { type NavItem } from './ui/SideMenu'
import Header from './ui/Header'
import CreateNewMenu, { type CreateType } from './CreateNewMenu'
import CreateProjectModal from './CreateProjectModal'
import CreateTaskModal from './CreateTaskModal'
import CreateMeetingModal from './CreateMeetingModal'
import { useCurrentUser, useMyOrg } from '../lib/hooks'

// ─── Create New context ─────────────────────────────────────────────────────

type CreateNewApi = {
  /** Open the type-picker menu. */
  openMenu: () => void
  /** Skip the menu and jump straight into a specific create modal. */
  open: (type: CreateType) => void
}

const CreateNewContext = createContext<CreateNewApi | null>(null)

/** Use inside any page wrapped by PersonalAppShell to trigger the global Create New flow. */
export function useCreateNew(): CreateNewApi {
  const ctx = useContext(CreateNewContext)
  if (!ctx) throw new Error('useCreateNew must be used inside PersonalAppShell')
  return ctx
}

type ActiveKey = 'dashboard' | 'projects' | 'messages' | 'calendar' | 'tasks' | 'organization'

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', icon: 'Dashboard', label: 'Dashboard' },
  { key: 'projects', icon: 'Folder', label: 'Projects' },
  { key: 'messages', icon: 'Chat', label: 'Messages' },
  { key: 'calendar', icon: 'Calendar', label: 'Calendar' },
  { key: 'tasks', icon: 'Task', label: 'Action Items' },
  { key: 'organization', icon: 'Organization', label: 'Organization' },
]

const FOOTER_ITEMS: NavItem[] = [
  { key: 'settings', icon: 'Settings', label: 'Settings' },
]

const ROUTE_BY_KEY: Record<ActiveKey, string> = {
  dashboard: '/personal-dashboard',
  projects: '/projects',
  messages: '/messages',
  calendar: '/calendar',
  tasks: '/action-items',
  organization: '/organization',
}

type Props = {
  active: ActiveKey
  /** Shown above the header title. Format: "Workspace · Friday, April 10". */
  headerEyebrow?: string
  /** Big header title. Format: "Good morning, Yujin". */
  headerTitle?: string
  children: ReactNode
}

function buildEyebrow(orgName: string | null): string {
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
  return `${orgName ?? 'Workspace'} · ${date}`
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

/**
 * Layout shell for all post-login Personal Space pages.
 * Owns:
 *  - current user / org context (single fetch)
 *  - "Create new" flow (menu → 3 modals → DB write → route)
 */
export default function PersonalAppShell({
  active,
  headerEyebrow,
  headerTitle,
  children,
}: Props) {
  const router = useRouter()
  const { data: user, isFetched: userFetched } = useCurrentUser()
  const { data: org } = useMyOrg(user?.id)
  const orgId = org?.id ?? null
  const orgName = org?.name ?? null

  // Redirect to login if no user (only after the first fetch resolves)
  useEffect(() => {
    if (userFetched && !user) router.push('/')
  }, [userFetched, user, router])

  // Create New flow state
  const [menuOpen, setMenuOpen] = useState(false)
  const [createType, setCreateType] = useState<CreateType | null>(null)

  const initials = user
    ? `${user.first_name[0] ?? ''}${user.last_name[0] ?? ''}`.toUpperCase()
    : '··'
  const userName = user
    ? user.nickname || `${user.first_name} ${user.last_name}`.trim()
    : ''

  const eyebrow = headerEyebrow ?? buildEyebrow(orgName)
  const title = headerTitle ?? (user ? `${greeting()}, ${user.first_name}` : '')

  const openMenu = () => {
    setCreateType(null)
    setMenuOpen(true)
  }
  const pickType = (t: CreateType) => {
    setMenuOpen(false)
    setCreateType(t)
  }
  const closeAll = () => {
    setMenuOpen(false)
    setCreateType(null)
  }
  // Stay on current page; TanStack Query invalidation in the create modals
  // refreshes the data automatically.
  const onCreated = () => closeAll()

  const api: CreateNewApi = {
    openMenu,
    open: (t) => setCreateType(t),
  }

  return (
    <CreateNewContext.Provider value={api}>
      <AppLayout
        header={
          <Header
            orgName={orgName ?? 'Plinq'}
            eyebrow={eyebrow}
            title={title}
            userInitials={initials}
            hasNotifications={false}
            onBack={() => router.back()}
            onForward={() => window.history.forward()}
            onCreateNew={openMenu}
          />
        }
        sidebar={
          <SideMenu
            sectionLabel="Personal Space"
            items={NAV_ITEMS}
            footerItems={FOOTER_ITEMS}
            activeKey={active}
            userInitials={initials}
            userName={userName}
            onItemClick={(key) => {
              const route = ROUTE_BY_KEY[key as ActiveKey]
              if (route && route !== router.pathname) router.push(route)
            }}
            onCreateNew={openMenu}
          />
        }
      >
        {children}
      </AppLayout>

      <CreateNewMenu open={menuOpen} onClose={closeAll} onPick={pickType} />
      <CreateProjectModal
        open={createType === 'project'}
        orgId={orgId}
        orgName={orgName}
        onClose={closeAll}
        onCreated={onCreated}
      />
      <CreateTaskModal
        open={createType === 'task'}
        onClose={closeAll}
        onCreated={onCreated}
      />
      <CreateMeetingModal
        open={createType === 'meeting'}
        onClose={closeAll}
        onCreated={onCreated}
      />
    </CreateNewContext.Provider>
  )
}
