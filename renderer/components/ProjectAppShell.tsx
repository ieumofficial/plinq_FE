import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/router'
import AppLayout from './ui/AppLayout'
import AskAiPanel from './ui/AskAiPanel'
import SideMenu, { type NavItem } from './ui/SideMenu'
import StackedSideMenu, { type StackedNavItem } from './ui/StackedSideMenu'
import Header from './ui/Header'
import ProjectLabel from './ui/ProjectLabel'
import CreateNewMenu, { type CreateType } from './CreateNewMenu'
import CreateProjectModal from './CreateProjectModal'
import CreateTaskModal from './CreateTaskModal'
import CreateMeetingModal from './CreateMeetingModal'
import CreateChatSessionModal from './CreateChatSessionModal'
import {
  useCurrentUser,
  useMyOrg,
  useMyOrgRole,
  useProject,
  useProjectCounts,
  useUserProjects,
} from '../lib/hooks'
import { useSidebarPref, useSpaceTransition } from '../lib/sidebarPref'
import { dbStatusToUi } from '../lib/types'

// ─── Create New context ─────────────────────────────────────────────────────

/** Prefilled fields the caller can hand to the create modals. Only `status`
 *  is wired through today (used by the kanban column "+ Add" buttons). */
export type CreateOpts = {
  status?: import('../lib/types').TaskStatusDb
}

type CreateNewApi = {
  openMenu: () => void
  open: (type: CreateType, opts?: CreateOpts) => void
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
  | 'meetings'
  | 'members'
  | 'knowledge'
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
  projectId: string
  active: ProjectActiveKey
  children: ReactNode
}

export default function ProjectAppShell({ projectId, active, children }: Props) {
  const router = useRouter()
  const { data: user, isFetched: userFetched } = useCurrentUser()
  const { data: org } = useMyOrg(user?.id)
  const { data: myOrgRole } = useMyOrgRole(user?.id)
  const { data: project } = useProject(projectId)
  const { data: counts } = useProjectCounts(projectId)
  const { data: userProjects = [] } = useUserProjects(user?.id)
  const isOrgOwner = myOrgRole === 'owner'
  const railItems = isOrgOwner
    ? PERSONAL_RAIL_ITEMS
    : PERSONAL_RAIL_ITEMS.filter((it) => it.key !== 'organization')
  const { collapsed: stackedSidebar, toggle: toggleSidebar } = useSidebarPref()
  useSpaceTransition(`project:${projectId}`)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  // Close the switcher whenever we navigate to a new project.
  useEffect(() => setSwitcherOpen(false), [projectId])

  useEffect(() => {
    if (userFetched && !user) router.push('/')
  }, [userFetched, user, router])

  const [menuOpen, setMenuOpen] = useState(false)
  const [createType, setCreateType] = useState<CreateType | null>(null)
  const [createOpts, setCreateOpts] = useState<CreateOpts>({})
  const [askAiOpen, setAskAiOpen] = useState(false)

  const initials = user
    ? `${user.first_name[0] ?? ''}${user.last_name[0] ?? ''}`.toUpperCase()
    : '··'
  const userName = user
    ? user.nickname || `${user.first_name} ${user.last_name}`.trim()
    : ''

  const openMenu = () => {
    setCreateType(null)
    setCreateOpts({})
    setMenuOpen(true)
  }
  const pickType = (t: CreateType) => {
    setMenuOpen(false)
    setCreateOpts({})
    setCreateType(t)
  }
  const closeAll = () => {
    setMenuOpen(false)
    setCreateType(null)
    setCreateOpts({})
  }
  // Stay on current page; TanStack Query invalidation in the create modals
  // refreshes the data automatically.
  const onCreated = () => closeAll()

  const api: CreateNewApi = {
    openMenu,
    open: (t, opts) => {
      setCreateOpts(opts ?? {})
      setCreateType(t)
    },
  }

  const projectName = project?.name ?? 'Project'
  const projectInitial = projectName.charAt(0).toUpperCase()

  const items: StackedNavItem[] = [
    { key: 'dashboard', icon: 'Dashboard', label: 'Project Dashboard' },
    { key: 'kanban', icon: 'Kanban', label: 'Kanban Board' },
    { key: 'backlog', icon: 'Task', label: 'Backlog', count: counts?.tasks },
    { key: 'meetings', icon: 'Meeting', label: 'Meetings', count: counts?.meetings },
    { key: 'members', icon: 'People', label: 'Members', count: counts?.members },
    { key: 'knowledge', icon: 'File', label: 'Knowledge Base', count: counts?.docs },
    { key: 'settings', icon: 'Settings', label: 'Settings' },
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
            onAskAi={() => setAskAiOpen((v) => !v)}
          />
        }
        sidebar={
          <SideMenu
            sectionLabel={stackedSidebar ? undefined : 'Personal Space'}
            items={railItems}
            footerItems={PERSONAL_FOOTER}
            activeKey="projects"
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
            key={`project:${projectId}`}
            spaceId={`project:${projectId}`}
            header={{
              kind: 'project',
              initial: projectInitial,
              color: project?.color ?? 'blue',
              name: projectName,
              subtitle: project?.description ?? undefined,
              status: project ? dbStatusToUi(project.status) : undefined,
              onSwitch: () => setSwitcherOpen((v) => !v),
              switchOpen: switcherOpen,
            }}
            items={items}
            activeKey={active}
            onItemClick={(k) => goPage(k as ProjectActiveKey)}
            onBack={() => router.push('/projects')}
            overlay={
              switcherOpen && (
                <>
                  <button
                    type="button"
                    aria-label="Close project switcher"
                    onClick={() => setSwitcherOpen(false)}
                    className="absolute inset-0 z-30 cursor-default"
                  />
                  <div className="absolute z-40 top-[95px] left-[10px] right-[10px] bg-white-white border border-solid border-gray-border-light rounded-[8px] shadow-md py-[5px] max-h-[280px] overflow-y-auto">
                    {userProjects.length === 0 ? (
                      <p className="px-[10px] py-[7px] text-gray-secondary text-[11px]">
                        No other projects.
                      </p>
                    ) : (
                      userProjects.map((p) => {
                        const isCurrent = p.id === projectId
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              if (isCurrent) {
                                setSwitcherOpen(false)
                                return
                              }
                              router.push(`/p/${p.id}/dashboard`)
                            }}
                            className={`w-full flex items-center gap-[8px] px-[10px] py-[6px] text-left hover:bg-white-item ${
                              isCurrent ? 'bg-blue-light/30' : ''
                            }`}
                          >
                            <ProjectLabel
                              name={p.name}
                              color={p.color ?? 'blue'}
                              size="sm"
                            />
                            <span
                              className={`text-[12px] text-black truncate flex-1 ${
                                isCurrent ? 'font-semibold' : ''
                              }`}
                            >
                              {p.name}
                            </span>
                          </button>
                        )
                      })
                    )}
                  </div>
                </>
              )
            }
          />
        }
        aiPanel={
          askAiOpen ? (
            <AskAiPanel
              onClose={() => setAskAiOpen(false)}
              orgId={org?.id ?? undefined}
              defaultContextProjectId={projectId}
              scopeLabel={projectName}
            />
          ) : undefined
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
        defaultStatus={createOpts.status}
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
      <CreateChatSessionModal
        open={createType === 'chat'}
        orgId={org?.id ?? null}
        onClose={closeAll}
        onCreated={() => closeAll()}
      />
    </CreateNewContext.Provider>
  )
}
