import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/router'
import AppLayout from './ui/AppLayout'
import SideMenu, { type NavItem } from './ui/SideMenu'
import StackedSideMenu, { type StackedNavItem } from './ui/StackedSideMenu'
import Header from './ui/Header'
import CreateNewMenu, { type CreateType } from './CreateNewMenu'
import CreateProjectModal from './CreateProjectModal'
import CreateTaskModal from './CreateTaskModal'
import CreateMeetingModal from './CreateMeetingModal'
import {
  useCurrentUser,
  useMyOrg,
  useOrgMembers,
  useOrgProjects,
} from '../lib/hooks'
import { useSidebarPref, useSpaceTransition } from '../lib/sidebarPref'

// ─── Create New context ─────────────────────────────────────────────────────

type CreateNewApi = {
  openMenu: () => void
  open: (type: CreateType) => void
}

const CreateNewContext = createContext<CreateNewApi | null>(null)
export function useCreateNew(): CreateNewApi {
  const ctx = useContext(CreateNewContext)
  if (!ctx) throw new Error('useCreateNew must be used inside OrganizationAppShell')
  return ctx
}

export type OrgActiveKey =
  | 'dashboard'
  | 'projects'
  | 'members'
  | 'settings'

const PERSONAL_RAIL_ITEMS: NavItem[] = [
  { key: 'dashboard', icon: 'Dashboard', label: 'Dashboard' },
  { key: 'projects', icon: 'Folder', label: 'Projects' },
  { key: 'messages', icon: 'Chat', label: 'Messages' },
  { key: 'calendar', icon: 'Calendar', label: 'Calendar' },
  { key: 'tasks', icon: 'Task', label: 'Action Items' },
  { key: 'organization', icon: 'Organization', label: 'Organization' },
]

const PERSONAL_FOOTER: NavItem[] = [
  { key: 'settings', icon: 'Settings', label: 'Settings' },
]

function personalRoute(key: string, orgId: string | null): string | null {
  switch (key) {
    case 'dashboard':
      return '/personal-dashboard'
    case 'projects':
      return '/projects'
    case 'messages':
      return '/messages'
    case 'calendar':
      return '/calendar'
    case 'tasks':
      return '/action-items'
    case 'organization':
      return orgId ? `/o/${orgId}/dashboard` : '/organization'
    default:
      return null
  }
}

type Props = {
  orgId: string
  active: OrgActiveKey
  children: ReactNode
}

export default function OrganizationAppShell({ orgId, active, children }: Props) {
  const router = useRouter()
  const { data: user, isFetched: userFetched } = useCurrentUser()
  const { data: org } = useMyOrg(user?.id)
  const { data: members = [] } = useOrgMembers(orgId)
  const { data: orgProjects = [] } = useOrgProjects(orgId)
  const { collapsed: stackedSidebar, toggle: toggleSidebar } = useSidebarPref()
  useSpaceTransition(`org:${orgId}`)

  useEffect(() => {
    if (userFetched && !user) router.push('/')
  }, [userFetched, user, router])

  const [menuOpen, setMenuOpen] = useState(false)
  const [createType, setCreateType] = useState<CreateType | null>(null)

  const initials = user
    ? `${user.first_name[0] ?? ''}${user.last_name[0] ?? ''}`.toUpperCase()
    : '··'
  const userName = user
    ? user.nickname || `${user.first_name} ${user.last_name}`.trim()
    : ''

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
  const onCreated = () => closeAll()

  const api: CreateNewApi = { openMenu, open: (t) => setCreateType(t) }

  const orgName = org?.name ?? 'Organization'
  const orgInitial = orgName.charAt(0).toUpperCase()

  const items: StackedNavItem[] = [
    { key: 'dashboard', icon: 'Dashboard', label: 'Dashboard' },
    { key: 'projects', icon: 'Folder', label: 'Projects', count: orgProjects.length },
    { key: 'members', icon: 'People', label: 'Members', count: members.length },
    { key: 'settings', icon: 'Settings', label: 'Settings' },
  ]

  const goPage = (key: OrgActiveKey) => {
    const route = `/o/${orgId}/${key}`
    if (route !== router.pathname.replace('[orgId]', orgId)) {
      router.push(route)
    }
  }

  return (
    <CreateNewContext.Provider value={api}>
      <AppLayout
        header={
          <Header
            orgName={org?.name ?? 'Plinq'}
            eyebrow=""
            title=""
            userInitials={initials}
            hasNotifications={false}
            onBack={() => router.back()}
            onForward={() => window.history.forward()}
            onCreateNew={openMenu}
          />
        }
        sidebar={
          <SideMenu
            sectionLabel={stackedSidebar ? undefined : 'Personal Space'}
            items={PERSONAL_RAIL_ITEMS}
            footerItems={PERSONAL_FOOTER}
            activeKey="organization"
            userInitials={initials}
            userName={userName}
            stacked={stackedSidebar}
            onCreateNew={openMenu}
            onItemClick={(k) => {
              const route = personalRoute(k, org?.id ?? null)
              if (route) router.push(route)
            }}
            onToggleSidebar={toggleSidebar}
          />
        }
        panel={
          <StackedSideMenu
            key={`org:${orgId}`}
            spaceId={`org:${orgId}`}
            header={{
              kind: 'org',
              initial: orgInitial,
              color: 'blue',
              name: orgName,
              subtitle: `${members.length} members total`,
            }}
            items={items}
            activeKey={active}
            onItemClick={(k) => goPage(k as OrgActiveKey)}
            onBack={() => router.push('/personal-dashboard')}
          />
        }
      >
        {children}
      </AppLayout>

      <CreateNewMenu open={menuOpen} onClose={closeAll} onPick={pickType} />
      <CreateProjectModal
        open={createType === 'project'}
        orgId={org?.id ?? null}
        orgName={org?.name ?? null}
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
