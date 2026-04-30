import { useRouter } from 'next/router'
import {
  CalendarIcon,
  CategoryIcon,
  FolderIcon,
  ListCheckIcon,
  SettingsIcon,
  UserIcon,
  UsersIcon,
} from './icons'

export const ICON_SIDEBAR_WIDTH = 90

type IconNavItem = {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
}

const mainItems: IconNavItem[] = [
  { href: '/personal-dashboard', icon: CategoryIcon, label: 'Personal Dashboard' },
  { href: '/projects', icon: FolderIcon, label: 'Projects' },
  { href: '/calendar', icon: CalendarIcon, label: 'Calendar' },
  { href: '/action-items', icon: ListCheckIcon, label: 'Action Items' },
  { href: '/organization-board', icon: UsersIcon, label: 'Organization Board' },
]

const footerItems: IconNavItem[] = [
  { href: '/change-organizations', icon: UsersIcon, label: 'Change Organizations' },
  { href: '/settings', icon: SettingsIcon, label: 'Settings' },
]

/**
 * Compact icon-only primary sidebar shown on project pages.
 * Figma node 123:2293 — 90 × 1014 design canvas.
 */
export default function IconSidebar() {
  const router = useRouter()
  const path = router.pathname

  const renderIcon = ({ href, icon: Icon, label }: IconNavItem) => {
    const isActive = path === href
    return (
      <button
        key={href}
        type="button"
        onClick={() => router.push(href)}
        aria-label={label}
        className="w-[24px] h-[24px] flex items-center justify-center bg-transparent border-0 p-0 cursor-pointer"
      >
        <Icon className={`w-[24px] h-[24px] ${isActive ? 'text-[#4764c5]' : 'text-black'}`} />
      </button>
    )
  }

  return (
    <aside
      className="fixed top-[103px] left-0 bottom-0 w-[90px] bg-[#efeff0] border-2 border-[#afb1b6] rounded-lg overflow-hidden z-10"
      data-name="IconSidebar"
    >
      {/* Profile avatar */}
      <button
        type="button"
        aria-label="Profile"
        className="absolute left-[33px] top-[46px] w-[30px] h-[30px] rounded-full border border-black bg-white flex items-center justify-center cursor-pointer p-0"
      >
        <UserIcon className="w-[18px] h-[18px] text-black" />
      </button>

      {/* Main nav icons (Category, Folder, Calendar, ListCheck, Users)
          starting 60px below the profile (y=106 in design coords). */}
      <nav className="absolute left-[33px] top-[106px] flex flex-col gap-[30px] items-start">
        {mainItems.map(renderIcon)}
      </nav>

      {/* Bottom utility icons */}
      <div className="absolute left-[33px] bottom-[44px] flex flex-col gap-[20px] items-start">
        {footerItems.map(renderIcon)}
      </div>
    </aside>
  )
}
