import type { ReactNode } from 'react'

type Props = {
  /** Side rail (typically <SideMenu />). Required. */
  sidebar: ReactNode
  /**
   * Optional secondary panel rendered between the sidebar and content.
   * Use for the icon rail + content panel pattern in Project Space.
   */
  panel?: ReactNode
  /** Top header (typically <Header />). */
  header?: ReactNode
  /** Page content. */
  children: ReactNode
}

/**
 * Standard application chrome:
 *   [sidebar][optional panel][header above scrollable content]
 *
 * Personal Space → use sidebar only.
 * Project Space → pass a narrow stacked SideMenu as `sidebar` and a wider
 *   project nav as `panel`.
 */
export default function AppLayout({ sidebar, panel, header, children }: Props) {
  return (
    <div className="flex h-screen bg-[#F4F6F8] overflow-hidden">
      {sidebar}
      {panel}
      <div className="flex-1 min-w-0 flex flex-col">
        {header}
        <main className="flex-1 min-h-0 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
