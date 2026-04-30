import type { CSSProperties, ReactNode } from 'react'
import Header, { HEADER_HEIGHT } from './Header'
import IconSidebar, { ICON_SIDEBAR_WIDTH } from './IconSidebar'
import ProjectSidebar, { PROJECT_SIDEBAR_WIDTH } from './ProjectSidebar'

const dragRegion: CSSProperties = { WebkitAppRegion: 'drag' } as CSSProperties

type Props = {
  children: ReactNode
  projectName?: string
}

/**
 * Layout for pages scoped to a single project: Header + compact icon
 * sidebar + project-specific secondary sidebar. Content area sits to the
 * right of both sidebars (left = 90 + 250 = 340).
 */
export default function ProjectLayout({ children, projectName }: Props) {
  return (
    <div className="fixed inset-0 bg-white overflow-hidden">
      <div
        className="fixed top-0 left-0 right-0 h-[28px] z-20"
        style={dragRegion}
      />
      <Header />
      <IconSidebar />
      <ProjectSidebar projectName={projectName} />
      <main
        className="fixed right-0 bottom-0 overflow-auto bg-white"
        style={{
          top: HEADER_HEIGHT,
          left: ICON_SIDEBAR_WIDTH + PROJECT_SIDEBAR_WIDTH,
        }}
      >
        {children}
      </main>
    </div>
  )
}
