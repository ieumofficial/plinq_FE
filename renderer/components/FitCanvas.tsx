import type { CSSProperties, ReactNode } from 'react'

type Props = {
  children: ReactNode
}

const dragRegion: CSSProperties = { WebkitAppRegion: 'drag' } as CSSProperties

/**
 * Wraps the design canvas. The canvas is 100vw wide and its height is
 * derived from the Figma 1728×1117 aspect ratio (1117 / 1728 ≈ 64.6412),
 * so all child layouts authored in vw units stay perfectly proportional
 * regardless of window width.
 *
 * The canvas is anchored to the top-left corner of the window (not centered),
 * so children positioned at top:0 / left:0 — like Header and Sidebar — sit
 * flush against the actual window edges.
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
      <div className="relative w-[100vw] h-[64.6412vw]">{children}</div>
    </div>
  )
}
