/**
 * Inbox / notifications panel. Matches Figma 1400:21228 — dark gradient card
 * with an "Inbox · N new" header and a stack of notification rows. Anchored
 * to the bell icon in the header via `position: fixed`.
 *
 * Backend wiring is not in place yet; the panel reads from a client-side
 * stub list. Each row supports a single-click clear (X) and there's a
 * Clear All affordance on the first row when there are unread items.
 */
import { useEffect, useRef, useState } from 'react'
import Icon from './ui/Icon'

type NotifKind = 'dm' | 'channel'

type Notif = {
  id: string
  kind: NotifKind
  /** Person or channel name shown bold. */
  title: string
  /** Optional sender name (for channel messages — "Seungyeon: …"). */
  sender?: string
  body: string
}

type Props = {
  /** Trigger's bounding rect (the bell icon). Null = closed. */
  anchorRect: DOMRect | null
  onClose: () => void
}

/** Placeholder items. Replace with a real notifications query once the
 *  backend lands. */
const STUB_NOTIFS: Notif[] = [
  {
    id: 'n1',
    kind: 'dm',
    title: 'Mira Chen',
    body: 'Yes — staging flake reproduced.',
  },
  {
    id: 'n2',
    kind: 'channel',
    title: '#apollo-eng',
    sender: 'Seungyeon',
    body: 'Yes — staging flake reproduced.',
  },
  {
    id: 'n3',
    kind: 'dm',
    title: 'Mira Chen',
    body: 'Yes — staging flake reproduced.',
  },
]

function ChannelAvatar() {
  return (
    <span className="bg-primary-dark rounded-full w-[30px] h-[30px] inline-flex items-center justify-center shrink-0 text-primary-light">
      <Icon name="Chat" size={14} />
    </span>
  )
}

function PersonAvatar({ initial }: { initial: string }) {
  return (
    <span className="bg-gray-main text-white rounded-full w-[30px] h-[30px] inline-flex items-center justify-center text-[12px] font-semibold uppercase shrink-0">
      {initial}
    </span>
  )
}

export default function NotificationPanel({ anchorRect, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [items, setItems] = useState<Notif[]>(STUB_NOTIFS)

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

  // Anchor to bell — open downward, aligned to its right edge so the panel
  // doesn't run off-screen.
  const style: React.CSSProperties = {
    position: 'fixed',
    top: anchorRect.bottom + 8,
    left: Math.max(8, anchorRect.right - 338),
    width: 338,
    zIndex: 100,
  }

  const clearAll = () => setItems([])
  const clearOne = (id: string) =>
    setItems((prev) => prev.filter((n) => n.id !== id))

  return (
    <div
      ref={ref}
      style={{
        ...style,
        backgroundImage:
          'linear-gradient(167.23deg, rgb(46, 67, 78) 0%, rgb(31, 47, 56) 100%)',
      }}
      onClick={(e) => e.stopPropagation()}
      className="border border-solid border-gray-main rounded-[10px] p-[15px] flex flex-col gap-[12px] shadow-2xl"
    >
      {/* Header */}
      <div className="flex flex-col gap-[5px]">
        <p className="text-gray-secondary text-[10px] font-medium uppercase tracking-[1.5px]">
          notifications
        </p>
        <p className="text-primary-light text-[20px] font-semibold leading-[1.2]">
          Inbox ·{' '}
          <span className="text-[#eb7373]">
            {items.length === 0 ? '0' : `${items.length} new`}
          </span>
        </p>
      </div>

      {/* Items */}
      {items.length === 0 ? (
        <p className="text-gray-secondary text-[12px] py-[10px]">
          You're all caught up.
        </p>
      ) : (
        <div className="flex flex-col gap-[10px]">
          {items.map((n, i) => (
            <div
              key={n.id}
              className="bg-[#394851] border border-solid border-gray-main rounded-[5px] p-[10px] flex items-center gap-[10px]"
            >
              {n.kind === 'channel' ? (
                <ChannelAvatar />
              ) : (
                <PersonAvatar initial={n.title.charAt(0)} />
              )}
              <div className="flex flex-col gap-px min-w-0 flex-1">
                <p className="text-primary-light text-[12px] font-semibold truncate">
                  {n.title}
                </p>
                <p className="text-white text-[10px] leading-[1.5] truncate">
                  {n.sender && (
                    <span className="font-semibold">{n.sender}: </span>
                  )}
                  <span>{n.body}</span>
                </p>
              </div>
              {i === 0 && items.length > 1 ? (
                <button
                  type="button"
                  onClick={clearAll}
                  className="shrink-0 bg-gray-main text-primary-light text-[8px] font-semibold rounded-[3.75px] px-[7px] py-[3px] hover:opacity-90"
                >
                  Clear All
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => clearOne(n.id)}
                  className="shrink-0 bg-gray-main text-primary-light rounded-[3.75px] w-[15px] h-[15px] inline-flex items-center justify-center hover:opacity-90"
                  aria-label="Clear notification"
                >
                  <Icon name="Cross" size={9} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
