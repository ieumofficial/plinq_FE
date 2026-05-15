/**
 * Profile / status / sign-out popover anchored to the sidebar profile block.
 * Matches Figma 1576:27372 — dark gradient card with:
 *   - "My Page" row that navigates to /my/overview
 *   - SET STATUS section with Available / In a meeting / Unavailable cards
 *   - Sign out row at the bottom
 */
import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import Icon from './ui/Icon'
import {
  PRESENCE_LABEL,
  type Presence,
} from '../lib/presencePref'

type Props = {
  /** Trigger element's bounding rect. Null = closed. */
  anchorRect: DOMRect | null
  /** Where to place the popover relative to the trigger.
   *  - `right`: dropdown's left edge sits 8px to the right of the anchor;
   *     vertical alignment pins its bottom to the anchor's bottom. Used for
   *     the sidebar profile block at bottom-left.
   *  - `bottom`: dropdown opens below the anchor, right-aligned. Used for
   *     the header avatar at top-right. */
  placement?: 'right' | 'bottom'
  /** Avatar initials shown in the "My Page" row. */
  userInitials: string
  /** User display name shown alongside "My Page". */
  userName: string
  /** User email — shown under the "Sign out" row. */
  userEmail?: string
  presence: Presence
  onPresenceChange: (next: Presence) => void
  onMyPage: () => void
  onClose: () => void
}

/** Visual treatment for each presence card. The selected card is filled with
 *  the corresponding color; others are a translucent white card. */
const PRESENCE_STYLE: Record<
  Presence,
  { bg: string; dot: string; text: string; description: string }
> = {
  available: {
    bg: '#DCEBE0',
    dot: '#2F6B45',
    text: '#2F6B45',
    description: 'You will be paged on @ mentions and DMs',
  },
  in_meeting: {
    bg: '#F4E6CD',
    dot: '#8A5A1E',
    text: '#8A5A1E',
    description: 'Auto-set when you’re in a meeting',
  },
  unavailable: {
    bg: '#F2DEDE',
    dot: '#9B3838',
    text: '#9B3838',
    description: 'No notifications. Status visible to other members.',
  },
}

const ORDER: Presence[] = ['available', 'in_meeting', 'unavailable']

export default function ProfileDropdown({
  anchorRect,
  placement = 'right',
  userInitials,
  userName,
  userEmail,
  presence,
  onPresenceChange,
  onMyPage,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!anchorRect) return
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    function onScrollOrResize() {
      onClose()
    }
    const id = setTimeout(() => {
      document.addEventListener('mousedown', onDocClick)
    }, 0)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      clearTimeout(id)
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [anchorRect, onClose])

  if (!anchorRect || typeof window === 'undefined') return null

  const POPUP_W = 280
  const style: React.CSSProperties =
    placement === 'right'
      ? {
          // Sidebar profile at bottom-left: dropdown opens to the right,
          // bottoms aligned. Clamp so it doesn't go off-screen.
          position: 'fixed',
          left: Math.min(
            window.innerWidth - POPUP_W - 8,
            anchorRect.right + 8
          ),
          bottom: Math.max(8, window.innerHeight - anchorRect.bottom),
          width: POPUP_W,
          zIndex: 50,
        }
      : {
          // Header avatar at top-right: dropdown opens downward, right-aligned
          // with the avatar so it doesn't overflow off the right edge.
          position: 'fixed',
          top: anchorRect.bottom + 8,
          left: Math.max(8, anchorRect.right - POPUP_W),
          width: POPUP_W,
          zIndex: 50,
        }

  const handleSignOut = async () => {
    onClose()
    try {
      await supabase.auth.signOut()
    } catch (e) {
      console.error('[ProfileDropdown] signOut', e)
    }
    if (typeof window !== 'undefined') window.location.href = '/'
  }

  return (
    <div
      ref={ref}
      style={{
        ...style,
        backgroundImage:
          'linear-gradient(157.48deg, rgb(46, 67, 78) 0%, rgb(31, 47, 56) 100%)',
      }}
      onClick={(e) => e.stopPropagation()}
      className="border border-solid border-gray-main rounded-[10px] flex flex-col"
    >
      {/* My page header row */}
      <button
        type="button"
        onClick={onMyPage}
        className="flex items-center justify-between px-[7px] py-[9px] hover:bg-white/5 rounded-t-[10px] transition-colors"
      >
        <span className="flex items-center gap-[5px]">
          <span className="bg-primary-main text-white rounded-full w-[34px] h-[34px] inline-flex items-center justify-center text-[14px] font-semibold uppercase shrink-0">
            {userInitials}
          </span>
          <span className="flex flex-col items-start gap-[2px]">
            <span className="text-primary-light text-[14px] font-semibold leading-none">
              My Page
            </span>
            <span className="text-primary-light text-[10px] leading-[1.5]">
              {userName ? `${userName} · profile` : 'Overview · profile'}
            </span>
          </span>
        </span>
        <Icon name="ArrowRight" size={13} className="text-primary-light" />
      </button>

      {/* Set status */}
      <div className="border-t border-b border-solid border-gray-main flex flex-col gap-[5px] p-[10px]">
        <p className="text-gray-secondary text-[12px] font-medium uppercase tracking-[1.5px]">
          set status
        </p>
        {ORDER.map((p) => {
          const meta = PRESENCE_STYLE[p]
          const selected = p === presence
          return (
            <button
              key={p}
              type="button"
              onClick={() => onPresenceChange(p)}
              style={selected ? { backgroundColor: meta.bg } : undefined}
              className={`flex flex-col items-start gap-[5px] rounded-[8px] px-[10px] py-[7px] text-left transition-colors ${
                selected ? '' : 'bg-white-item hover:bg-white-white'
              }`}
            >
              <span className="flex items-center gap-[5px]">
                <span
                  className="w-[8px] h-[8px] rounded-full shrink-0"
                  style={{ backgroundColor: meta.dot }}
                />
                <span
                  className="text-[12px] font-semibold leading-none"
                  style={{ color: meta.text }}
                >
                  {PRESENCE_LABEL[p]}
                </span>
              </span>
              <span className="text-black text-[10px] leading-[1.5]">
                {meta.description}
              </span>
            </button>
          )
        })}
      </div>

      {/* Sign out */}
      <button
        type="button"
        onClick={handleSignOut}
        className="flex items-center gap-[7px] px-[15px] py-[10px] rounded-b-[10px] hover:bg-white/5 transition-colors text-left"
      >
        <span
          className="rounded-[5px] w-[34px] h-[34px] inline-flex items-center justify-center shrink-0"
          style={{ backgroundColor: '#F2DEDE', color: '#9B3838' }}
        >
          {/* Logout glyph — door with arrow pointing out */}
          <svg
            width="17"
            height="17"
            viewBox="0 0 15 15"
            fill="none"
            aria-hidden
          >
            <path
              d="M9.5 11.5V12.5C9.5 13.052 9.052 13.5 8.5 13.5H3.5C2.948 13.5 2.5 13.052 2.5 12.5V2.5C2.5 1.948 2.948 1.5 3.5 1.5H8.5C9.052 1.5 9.5 1.948 9.5 2.5V3.5"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M6 7.5H13M13 7.5L10.5 5M13 7.5L10.5 10"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="flex flex-col gap-[2px] min-w-0 flex-1">
          <span className="text-primary-light text-[14px] font-semibold leading-none">
            Sign out
          </span>
          {userEmail && (
            <span className="text-primary-light text-[10px] leading-[1.5] truncate">
              {userEmail}
            </span>
          )}
        </span>
      </button>
    </div>
  )
}
