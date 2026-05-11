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
import { useCurrentUser, useMyOrg, useProject, useProjectCounts } from '../lib/hooks'
import { dbStatusToUi } from '../lib/types'

// ─── Create New context ─────────────────────────────────────────────────────

type CreateNewApi = {
  openMenu: () => void
  open: (type: CreateType) => void
}

const CreateNewContext = createContext<CreateNewApi | null>(null)
export function useCreateNew(): CreateNewApi {
  const ctx = useContext(CreateNewContext)
  if (!ctx) throw new Error('useCreateNew must be used inside ProjectAppShell')
  return ctx
}

export type ProjectActiveKey =
  | 'dashboard'
  | 'kanban'
  | 'backlog'
  | 'timeline'
  | 'meetings'
  | 'members'
  | 'knowledge'

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

const PERSONAL_ROUTE: Record<string, string> = {
  dashboard: '/personal-dashboard',
  projects: '/projects',
  messages: '/messages',
  calendar: '/calendar',
  tasks: '/action-items',
  organization: '/organization',
}

type Props = {
  projectId: string
  active: ProjectActiveKey
  children: ReactNode
}

export default function ProjectAppShell({ projectId, active, children }: Props) {
  const router = useRouter()
  const { data: user, isFetched: userFetched } = useCurrentUser()
  const { data: org } = useMyOrg(user?.id)
  const { data: project } = useProject(projectId)
  const { data: counts } = useProjectCounts(projectId)

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
  // Stay on current page; TanStack Query invalidation in the create modals
  // refreshes the data automatically.
  const onCreated = () => closeAll()

  const api: CreateNewApi = { openMenu, open: (t) => setCreateType(t) }

  const projectName = project?.name ?? 'Project'
  const projectInitial = projectName.charAt(0).toUpperCase()

  const items: StackedNavItem[] = [
    { key: 'dashboard', icon: 'Dashboard', label: 'Project Dashboard' },
    { key: 'kanban', icon: 'Kanban', label: 'Kanban Board' },
    { key: 'backlog', icon: 'Task', label: 'Backlog', count: counts?.tasks },
    { key: 'timeline', icon: 'Calendar', label: 'Timeline' },
    { key: 'meetings', icon: 'Meeting', label: 'Meetings', count: counts?.meetings },
    { key: 'members', icon: 'People', label: 'Members', count: counts?.members },
    { key: 'knowledge', icon: 'File', label: 'Knowledge Base', count: counts?.docs },
  ]

  const goPage = (key: ProjectActiveKey) => {
    const route = `/p/${projectId}/${key}`
    if (route !== router.pathname.replace('[projectId]', projectId)) {
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
            items={PERSONAL_RAIL_ITEMS}
            footerItems={PERSONAL_FOOTER}
            userInitials={initials}
            userName={userName}
            stacked
            onCreateNew={openMenu}
            onItemClick={(k) => {
              const route = PERSONAL_ROUTE[k]
              if (route) router.push(route)
            }}
          />
        }
        panel={
          <StackedSideMenu
            header={{
              kind: 'project',
              initial: projectInitial,
              color: project?.color ?? 'blue',
              name: projectName,
              subtitle: project?.description ?? undefined,
              status: project ? dbStatusToUi(project.status) : undefined,
            }}
            items={items}
            activeKey={active}
            onItemClick={(k) => goPage(k as ProjectActiveKey)}
            onBack={() => router.push('/projects')}
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
        defaultProjectId={projectId}
        lockProject
        onClose={closeAll}
        onCreated={onCreated}
      />
      <CreateMeetingModal
        open={createType === 'meeting'}
        defaultProjectId={projectId}
        lockProject
        onClose={closeAll}
        onCreated={onCreated}
      />
    </CreateNewContext.Provider>
  )
}
