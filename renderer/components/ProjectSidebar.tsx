import { useRouter } from 'next/router'
import {
  CalendarIcon,
  CategoryIcon,
  ChartIcon,
  DatabaseIcon,
  FolderIcon,
  UsersIcon,
} from './icons'

export const PROJECT_SIDEBAR_WIDTH = 250

type ProjectNavItem = {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const items: ProjectNavItem[] = [
  { label: 'Project Dashboard', href: '/project-dashboard', icon: CategoryIcon },
  { label: 'Kanban Board', href: '/kanban-board', icon: ChartIcon },
  { label: 'Backlog', href: '/backlog', icon: DatabaseIcon },
  { label: 'Timeline', href: '/timeline', icon: CalendarIcon },
  { label: 'Meetings', href: '/project-meetings', icon: FolderIcon },
  { label: 'Members', href: '/project-members', icon: UsersIcon },
  { label: 'Knowledge Base', href: '/knowledge-base', icon: FolderIcon },
]

type Props = {
  projectName?: string
}

/**
 * Secondary sidebar that lists views inside a single project.
 * Figma node 123:2323 — 250 × 1014 design canvas.
 */
export default function ProjectSidebar({ projectName = 'Project 1' }: Props) {
  const router = useRouter()
  const path = router.pathname

  return (
    <aside
      className="fixed top-[103px] left-[90px] bottom-0 w-[250px] bg-[#efeff0] border-2 border-[#afb1b6] rounded-lg overflow-hidden z-10"
      data-name="ProjectSidebar"
    >
      <div className="absolute left-[33px] top-[46px] w-[194px] flex flex-col gap-[30px]">
        <h2 className="font-sans font-medium text-[24px] leading-[28px] tracking-[0.2px] text-black whitespace-nowrap">
          {projectName}
        </h2>
        <nav className="flex flex-col gap-[30px] items-start">
          {items.map(({ label, href, icon: Icon }) => {
            const isActive = path === href
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
          })}
        </nav>
      </div>
    </aside>
  )
}
