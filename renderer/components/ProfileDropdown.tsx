import { useEffect, useRef } from 'react'
import {
  PRESENCE_DOT,
  PRESENCE_LABEL,
  type Presence,
} from '../lib/presencePref'

type Props = {
  /** Bottom-left anchor — the dropdown opens upward from the profile block. */
  anchorRect: DOMRect | null
  presence: Presence
  onPresenceChange: (next: Presence) => void
  onMyPage: () => void
  onClose: () => void
}

const PRESENCE_BG: Record<Presence, string> = {
  available: '#DCEBE0',
  in_meeting: '#F4E6CD',
  unavailable: '#F2DEDE',
}

const PRESENCE_TEXT: Record<Presence, string> = {
  available: '#2F6B45',
  in_meeting: '#8A5A1E',
  unavailable: '#9B3838',
}

const OPTIONS: Presence[] = ['available', 'in_meeting', 'unavailable']

export default function ProfileDropdown({
  anchorRect,
  presence,
  onPresenceChange,
  onMyPage,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    function onScrollOrResize() {
      onClose()
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [onClose])

  if (!anchorRect || typeof window === 'undefined') return null

  // The dropdown opens UPWARD from the profile block (which sits at the
  // bottom of the sidebar). `bottom` is anchored above the trigger.
  const style: React.CSSProperties = {
    position: 'fixed',
    left: anchorRect.left,
    bottom: window.innerHeight - anchorRect.top + 4,
    width: Math.max(160, anchorRect.width),
  }

  return (
    <div
      ref={ref}
      style={style}
      onClick={(e) => e.stopPropagation()}
      className="z-50 bg-white-white border border-solid border-gray-border-light rounded-[5px] shadow-md p-[10px] flex flex-col gap-[5px]"
    >
      <button
        type="button"
        onClick={onMyPage}
        className="w-full bg-white-white border border-solid border-gray-border-light rounded-[5px] px-[25px] py-[10px] text-black text-[12px] hover:bg-white-item transition-colors"
      >
        My page
      </button>
      <div className="bg-white-item border border-solid border-gray-border-light rounded-[5px] p-[5px] flex flex-col gap-[5px]">
        {OPTIONS.map((p) => {
          const selected = presence === p
          return (
            <button
              key={p}
              type="button"
              onClick={() => onPresenceChange(p)}
              style={selected ? { backgroundColor: PRESENCE_BG[p] } : undefined}
              className={`w-full inline-flex items-center justify-center gap-[5px] px-[10px] py-[7px] rounded-[5px] transition-colors ${
                selected ? '' : 'bg-white-item hover:bg-white-white'
              }`}
            >
              <span
                className="w-[6px] h-[6px] rounded-full shrink-0"
                style={{ backgroundColor: PRESENCE_DOT[p] }}
              />
              <span
                className="text-[12px] font-semibold leading-none"
                style={{
                  color: selected ? PRESENCE_TEXT[p] : '#16242E',
                }}
              >
                {PRESENCE_LABEL[p]}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
