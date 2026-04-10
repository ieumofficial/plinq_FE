import { useRouter } from 'next/router'
import {
  CalendarIcon,
  CategoryIcon,
  FolderIcon,
  ListCheckIcon,
  SettingsIcon,
  UsersIcon,
} from './icons'

export const SIDEBAR_WIDTH = 300

type NavItem = {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const mainItems: NavItem[] = [
  { label: 'Personal Dashboard', href: '/personal-dashboard', icon: CategoryIcon },
  { label: 'Projects', href: '/projects', icon: FolderIcon },
  { label: 'Calendar', href: '/calendar', icon: CalendarIcon },
  { label: 'Action Items', href: '/action-items', icon: ListCheckIcon },
  { label: 'Organization Board', href: '/organization-board', icon: UsersIcon },
]

const footerItems: NavItem[] = [
  { label: 'Change Organizations', href: '/change-organizations', icon: UsersIcon },
  { label: 'Settings', href: '/settings', icon: SettingsIcon },
]

/**
 * Left sidebar shown on all authenticated pages.
 * Matches Figma node 122:2298 — 300 × 1014 px design canvas, but rendered
 * at fixed pixel sizes so it stays the same width regardless of window size
 * and stretches vertically to fill the window below the header.
 */
export default function Sidebar() {
  const router = useRouter()
  const currentPath = router.pathname

  const renderItem = ({ label, href, icon: Icon }: NavItem) => {
    const isActive = currentPath === href
    return (
      <button
        key={href}
        type="button"
        onClick={() => router.push(href)}
        className="flex items-center gap-[10px] cursor-pointer bg-transparent border-0 p-0 text-left"
      >
        <Icon className={`w-[24px] h-[24px] ${isActive ? 'text-[#4764c5]' : 'text-black'}`} />
        <span
          className={`font-sans font-medium text-[16px] leading-[24px] tracking-[0.2px] whitespace-nowrap ${
            isActive ? 'text-[#4764c5]' : 'text-black'
          }`}
        >
          {label}
        </span>
      </button>
    )
  }

  return (
    <aside
      className="fixed top-[103px] left-0 bottom-0 w-[300px] bg-[#efeff0] border-2 border-[#afb1b6] rounded-lg overflow-hidden z-10"
      data-name="Sidebar"
    >
      <nav className="absolute left-[31px] top-[44px] w-[194px] flex flex-col gap-[30px] items-start">
        {mainItems.map(renderItem)}
      </nav>
      <div className="absolute left-[31px] bottom-[44px] flex flex-col gap-[20px] items-start">
        {footerItems.map(renderItem)}
      </div>
    </aside>
  )
}
