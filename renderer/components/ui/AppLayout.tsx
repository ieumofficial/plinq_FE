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
  /**
   * Optional Ask-AI panel rendered on the far right. Shells mount /
   * unmount this based on the header's Ask AI toggle. Width is owned
   * by the panel itself (typically 265px).
   */
  aiPanel?: ReactNode
  /** Page content. */
  children: ReactNode
}

/**
 * Standard application chrome:
 *   [header full-width 64px (= OS title bar)]
 *   [sidebar][optional panel][scrollable main][optional aiPanel]
 *
 * Personal Space → use sidebar only.
 * Project Space → pass a narrow stacked SideMenu as `sidebar` and a wider
 *   project nav as `panel`.
 * Ask AI → mount via `aiPanel` from any shell.
 */
export default function AppLayout({ header, sidebar, panel, aiPanel, children }: Props) {
  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {header}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {sidebar}
        {panel}
        <main className="flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col">
          {children}
        </main>
        {aiPanel}
      </div>
    </div>
  )
}
