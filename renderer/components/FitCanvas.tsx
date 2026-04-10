import type { CSSProperties, ReactNode } from 'react'

type Props = {
  children: ReactNode
}

const dragRegion: CSSProperties = { WebkitAppRegion: 'drag' } as CSSProperties

/**
 * Wraps a fixed-pixel design canvas (1728 × 1117 — Figma's full canvas size)
 * for pre-login pages. The canvas is anchored at the top-left of the window,
 * so children positioned with absolute Figma px coordinates appear at the
 * exact same window coordinates. On windows narrower than 1728px the right
 * side is clipped; on wider windows there's empty space to the right.
 *
 * Also overlays a thin top strip marked as the OS-level draggable region,
 * so the window can always be moved by grabbing the top of the screen
 * (interactive children opt back out via WebkitAppRegion: 'no-drag').
 */
export default function FitCanvas({ children }: Props) {
  return (
    <div className="fixed inset-0 bg-white overflow-hidden">
      {/* Window drag strip — sits behind content; interactive children
          (buttons, inputs) override with no-drag where needed. */}
      <div
        className="fixed top-0 left-0 right-0 h-[28px]"
        style={dragRegion}
      />
      <div className="relative w-[1728px] h-[1117px]">{children}</div>
    </div>
  )
}
