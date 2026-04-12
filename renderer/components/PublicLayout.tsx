import type { CSSProperties, ReactNode } from 'react'

type Props = {
  children: ReactNode
}

const dragRegion: CSSProperties = { WebkitAppRegion: 'drag' } as CSSProperties

/**
 * Layout for pre-auth pages (/, /signup).
 * No Header, no Sidebar — just a full-viewport white surface with the
 * OS-level draggable strip along the top edge. Interactive children
 * opt out via `WebkitAppRegion: 'no-drag'` as needed.
 */
export default function PublicLayout({ children }: Props) {
  return (
    <div className="fixed inset-0 bg-white overflow-auto">
      <div
        className="fixed top-0 left-0 right-0 h-[28px] z-20"
        style={dragRegion}
      />
      {children}
    </div>
  )
}
