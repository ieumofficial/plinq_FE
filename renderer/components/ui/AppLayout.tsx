import type { ReactNode } from 'react'

type Props = {
  /** Top header — full window width. Acts as the OS title bar. */
  header: ReactNode
  /** Side rail (typically <SideMenu />). Required. */
  sidebar: ReactNode
  /**
   * Optional secondary panel rendered between the sidebar and content.
   * Use for the icon rail + content panel pattern in Project Space.
   */
  panel?: ReactNode
  /** Page content. */
  children: ReactNode
}

/**
 * Standard application chrome:
 *   [header full-width 64px (= OS title bar)]
 *   [sidebar][optional panel][scrollable main]
 *
 * Personal Space → use sidebar only.
 * Project Space → pass a narrow stacked SideMenu as `sidebar` and a wider
 *   project nav as `panel`.
 */
export default function AppLayout({ header, sidebar, panel, children }: Props) {
  return (
    <div className="flex flex-col h-screen bg-[#F4F6F8] overflow-hidden">
      {header}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {sidebar}
        {panel}
        <main className="flex-1 min-w-0 min-h-0 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
