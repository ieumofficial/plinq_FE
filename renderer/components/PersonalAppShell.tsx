import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/router'
import AppLayout from './ui/AppLayout'
import SideMenu, { type NavItem } from './ui/SideMenu'
import Header from './ui/Header'
import { supabase } from '../lib/supabase'
import { getCurrentUser } from '../lib/queries'
import type { UserRow } from '../lib/types'

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
 * Fetches the current user + the user's first organization once on mount,
 * then composes AppLayout + SideMenu + Header.
 *
 * Pages just declare their `active` nav key and content.
 */
export default function PersonalAppShell({
  active,
  headerEyebrow,
  headerTitle,
  children,
}: Props) {
  const router = useRouter()
  const [user, setUser] = useState<UserRow | null>(null)
  const [orgName, setOrgName] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const u = await getCurrentUser()
      if (cancelled) return
      if (!u) {
        router.push('/')
        return
      }
      setUser(u)

      // First org the user is a member of (TODO: replace with selected-org context)
      const { data } = await supabase
        .from('organization_members')
        .select('organizations(id, name)')
        .eq('user_id', u.id)
        .limit(1)
        .maybeSingle()
      if (!cancelled) {
        const org = (data as { organizations: { name: string } | null } | null)?.organizations
        setOrgName(org?.name ?? null)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [router])

  const initials = user
    ? `${user.first_name[0] ?? ''}${user.last_name[0] ?? ''}`.toUpperCase()
    : '··'
  const userName = user
    ? user.nickname || `${user.first_name} ${user.last_name}`.trim()
    : ''

  const eyebrow = headerEyebrow ?? buildEyebrow(orgName)
  const title = headerTitle ?? (user ? `${greeting()}, ${user.first_name}` : '')

  return (
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
        />
      }
    >
      {children}
    </AppLayout>
  )
}
