import type { CSSProperties, ReactNode } from 'react'

type Props = {
  children: ReactNode
}

const dragRegion: CSSProperties = { WebkitAppRegion: 'drag' } as CSSProperties

/**
 * Shared dark gradient background with decorative blobs.
 * Includes macOS draggable title bar region at the top.
 */
export default function DarkBackground({ children }: Props) {
  return (
    <div
      className="relative min-h-screen w-full overflow-hidden flex flex-col"
      style={{
        background:
          'linear-gradient(166deg, rgb(46, 67, 78) 0%, rgb(31, 47, 56) 100%)',
      }}
    >
      {/* macOS draggable title bar */}
      <div
        className="fixed top-0 left-0 right-0 h-[28px] z-50"
        style={dragRegion}
      />

      {/* Decorative blobs */}
      <div
        className="absolute top-[-10%] right-[-10%] w-[60%] h-[50%] rounded-[40%] opacity-40 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(45, 90, 158, 0.6) 0%, transparent 70%)',
          mixBlendMode: 'screen',
        }}
      />
      <div
        className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[45%] rounded-[40%] opacity-30 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(120, 80, 180, 0.5) 0%, transparent 70%)',
          mixBlendMode: 'screen',
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col">
        {children}
      </div>
    </div>
  )
}
