import type { CSSProperties, ReactNode } from 'react'
import Header, { HEADER_HEIGHT } from './Header'
import Sidebar, { SIDEBAR_WIDTH } from './Sidebar'

const dragRegion: CSSProperties = { WebkitAppRegion: 'drag' } as CSSProperties

type Props = {
  children: ReactNode
}

/**
 * Layout for all post-login pages. Renders Header (fixed at top) +
 * Sidebar (fixed at left), and exposes the remaining viewport area as a
 * scrollable `<main>` for page-specific content.
 *
 * Header and Sidebar both use fixed pixel sizes from Figma so they remain
 * the same size regardless of window dimensions.
 */
export default function AuthLayout({ children }: Props) {
  return (
    <div className="fixed inset-0 bg-white overflow-hidden">
      {/* OS-level drag strip across the very top so the window is always
          movable; interactive children opt out via no-drag. */}
      <div
        className="fixed top-0 left-0 right-0 h-[28px] z-20"
        style={dragRegion}
      />
      <Header />
      <Sidebar />
      <main
        className="fixed right-0 bottom-0 overflow-auto bg-white"
        style={{ top: HEADER_HEIGHT, left: SIDEBAR_WIDTH }}
      >
        {children}
      </main>
    </div>
  )
}
