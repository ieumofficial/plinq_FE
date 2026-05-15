/**
 * Inbox dropdown anchored to the header bell icon (Figma 1400:21228 +
 * 1400:20715). Shows all undismissed `notifications` rows for the current
 * user — grouped by source session so a busy DM with 5 unread messages
 * collapses into a single card with a stacked-card visual underneath.
 *
 * Phase 1 only renders `chat_message` rows; future types (task/meeting/
 * mention) will plug in the same way — bring more `XxxNotificationItem`
 * components and add a dispatch in `renderItem`.
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import {
  useDismissAllNotifications,
  useDismissNotification,
  useNotifications,
} from '../lib/hooks'
import type { NotificationRow } from '../lib/queries'
import ChatNotificationItem from './ui/ChatNotificationItem'

type Props = {
  /** The bell button's bounding rect — null = closed. */
  anchorRect: DOMRect | null
  onClose: () => void
  userId: string | null | undefined
}

type ChannelKind = 'dm' | 'channel'

type GroupedChat = {
  sessionId: string
  kind: ChannelKind
  newest: NotificationRow
  rows: NotificationRow[]      // newest first
}

function readMeta(n: NotificationRow): {
  kind?: string
  scope?: string
  authorName?: string
  authorId?: string
  projectId?: string
} {
  return (n.preview_meta as Record<string, string> | null) ?? {}
}

function groupChat(notifs: NotificationRow[]): GroupedChat[] {
  const map = new Map<string, GroupedChat>()
  for (const n of notifs) {
    if (n.type !== 'chat_message') continue
    const sid = n.source_session_id ?? n.id
    const meta = readMeta(n)
    const kind: ChannelKind = meta.kind === 'channel' ? 'channel' : 'dm'
    const existing = map.get(sid)
    if (!existing) {
      map.set(sid, { sessionId: sid, kind, newest: n, rows: [n] })
    } else {
      existing.rows.push(n)
      // notifs are already newest-first from the query, so the first one
      // we saw for this group IS the newest — keep `newest` as-is.
    }
  }
  return Array.from(map.values())
}

// Approximate single-card height so we can pre-compute the group's outer
// height and animate height transitions. ChatNotificationItem ≈ 50px tall
// (10px padding + 30px avatar/body row + 10 padding). Matches Figma.
const CARD_H = 50
const COLLAPSED_GHOST_OFFSET = 8  // each ghost peeks 8px below the previous
const EXPANDED_GAP = 10

/**
 * Renders one chat-session group as a stack of ChatNotificationItem cards.
 *
 * Two visual states:
 *   - collapsed (default): only the latest card is fully visible. Up to 2 of
 *     the older cards peek 5px below it (Figma 1381:19830 / 1381:19849).
 *   - expanded: every card in the group is laid out vertically, like macOS
 *     Notification Center after a click. Smooth height + transform
 *     transition (250ms, ease-out).
 *
 * Children are absolutely positioned so we can animate their `top` /
 * `transform` independently while the outer wrapper interpolates `height`.
 */
function StackedGroup<T>({
  rows,
  isExpanded,
  onToggleExpand,
  renderItem,
}: {
  rows: T[]
  isExpanded: boolean
  onToggleExpand: () => void
  renderItem: (row: T, index: number) => React.ReactNode
}) {
  if (rows.length === 0) return null
  if (rows.length === 1) {
    // Nothing to stack — render the single card flat.
    return <div className="w-full">{renderItem(rows[0], 0)}</div>
  }

  const ghosts = Math.min(rows.length - 1, 2)
  const collapsedHeight = CARD_H + ghosts * COLLAPSED_GHOST_OFFSET
  const expandedHeight = rows.length * CARD_H + (rows.length - 1) * EXPANDED_GAP

  return (
    <div
      className="relative w-full overflow-visible transition-[height] duration-[260ms] ease-out"
      style={{ height: isExpanded ? expandedHeight : collapsedHeight }}
    >
      {rows.map((row, i) => {
        // collapsed: ghosts pushed down by 5px each so they peek out below
        // the front card (i=0). i > 2 stays clamped at the back of the stack.
        const collapsedTop = Math.min(i, ghosts) * COLLAPSED_GHOST_OFFSET
        const expandedTop = i * (CARD_H + EXPANDED_GAP)
        // collapsed back cards fade slightly so the eye picks the front first.
        const collapsedOpacity = i === 0 ? 1 : Math.max(0, 1 - i * 0.12)
        const collapsedScale = 1 - Math.min(i, ghosts) * 0.02
        return (
          <div
            key={(row as { id?: string }).id ?? i}
            className="absolute left-0 right-0 transition-all duration-[260ms] ease-out"
            style={{
              top: isExpanded ? expandedTop : collapsedTop,
              opacity: isExpanded ? 1 : collapsedOpacity,
              transform: isExpanded
                ? 'scale(1)'
                : `scale(${collapsedScale})`,
              transformOrigin: 'top center',
              // Front card always above the rest while collapsed; while
              // expanded, normal stacking is fine.
              zIndex: isExpanded ? 1 : rows.length - i,
              // Only the front card receives toggle clicks while collapsed —
              // back cards are visually hinted but not interactive yet.
              pointerEvents:
                !isExpanded && i > 0 ? 'none' : 'auto',
            }}
            onClick={(e) => {
              if (!isExpanded) {
                // First click anywhere on the stack → expand. Stop the click
                // from also firing the inner card's onClick (route to /messages).
                e.stopPropagation()
                onToggleExpand()
              }
            }}
          >
            {renderItem(row, i)}
          </div>
        )
      })}
    </div>
  )
}

export default function NotificationDropdown({
  anchorRect,
  onClose,
  userId,
}: Props) {
  const router = useRouter()
  const { data: notifs = [] } = useNotifications(userId)
  // Realtime is already subscribed once in Header for the bell badge — both
  // hooks share the same `notifications.inbox(userId)` cache key, so this
  // dropdown re-renders automatically when invalidations land. Subscribing
  // here too would trigger Supabase's "cannot add callbacks after subscribe"
  // because the channel name (`notifications:${userId}`) is the same.
  const dismissOne = useDismissNotification()
  const dismissAll = useDismissAllNotifications()
  const ref = useRef<HTMLDivElement>(null)
  // Per-group expand state — collapsed by default. Closing the dropdown
  // resets so reopening shows the compact view again.
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (!anchorRect) setExpanded(new Set())
  }, [anchorRect])
  const toggleExpand = (sessionId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(sessionId)) next.delete(sessionId)
      else next.add(sessionId)
      return next
    })

  // Outside click + Esc to close. Pause when not open.
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

  const groups = groupChat(notifs)
  const totalNew = notifs.length

  // Position fixed under the bell, right-aligned to it.
  const PANEL_WIDTH = 338
  const margin = 8
  const left = Math.max(
    margin,
    Math.min(
      anchorRect.right - PANEL_WIDTH,
      window.innerWidth - PANEL_WIDTH - margin
    )
  )
  const style: React.CSSProperties = {
    position: 'fixed',
    top: anchorRect.bottom + 8,
    left,
    width: PANEL_WIDTH,
    zIndex: 100,
  }

  return (
    <div
      ref={ref}
      style={{
        ...style,
        backgroundImage:
          'linear-gradient(167deg, rgb(46, 67, 78) 0%, rgb(31, 47, 56) 100%)',
      }}
      onClick={(e) => e.stopPropagation()}
      className="border border-solid border-gray-main rounded-[10px] p-[15px] flex flex-col gap-[12px] shadow-2xl"
    >
      {/* Header */}
      <div className="flex flex-col gap-[5px]">
        <p className="text-gray-secondary text-[10px] font-medium uppercase tracking-[1.5px]">
          notifications
        </p>
        <p className="text-primary-light text-[20px] font-semibold leading-none">
          Inbox <span className="text-red-dark-mode">· {totalNew} new</span>
        </p>
      </div>

      {/* Items — wider gap *between* sessions; intra-session stacks keep
          their tight 5px ghost peek (handled inside StackedGroup). */}
      <div className="flex flex-col gap-[18px]">
        {groups.length === 0 ? (
          <p className="text-gray-secondary text-[11px]">You're all caught up.</p>
        ) : (
          groups.map((g, idx) => {
            const isFirstGroup = idx === 0
            const isExpanded = expanded.has(g.sessionId)
            return (
              <StackedGroup
                key={g.sessionId}
                rows={g.rows}
                isExpanded={isExpanded}
                onToggleExpand={() => toggleExpand(g.sessionId)}
                renderItem={(row, i) => {
                  const meta = readMeta(row)
                  // Right action:
                  //   - first group / first card while collapsed → Clear All
                  //     (only when there's actually more than one notif)
                  //   - everywhere else → single dismiss [×]
                  const showClearAll =
                    isFirstGroup && i === 0 && !isExpanded && totalNew > 1
                  return (
                    <ChatNotificationItem
                      chatType={g.kind}
                      title={row.preview_title ?? ''}
                      body={
                        g.kind === 'channel' && meta.authorName
                          ? (row.preview_body ?? '').replace(
                              new RegExp(`^${meta.authorName}: `),
                              ''
                            )
                          : row.preview_body ?? ''
                      }
                      channelAuthorName={
                        g.kind === 'channel' ? meta.authorName : undefined
                      }
                      avatarInitial={
                        g.kind === 'dm' ? row.preview_title ?? 'U' : undefined
                      }
                      rightAction={showClearAll ? 'clearAll' : 'dismiss'}
                      onRightAction={() => {
                        if (showClearAll) {
                          dismissAll.mutate()
                        } else {
                          // While expanded, [×] dismisses just this one row.
                          // While collapsed (front of stack), it bulk-dismisses
                          // the whole group — the user has only ever seen the
                          // top preview anyway.
                          if (isExpanded) {
                            dismissOne.mutate(row.id)
                          } else {
                            for (const r of g.rows) dismissOne.mutate(r.id)
                          }
                        }
                      }}
                      onClick={() => {
                        // Front card while collapsed → handled by the stack
                        // wrapper (it expands instead). Cards while expanded
                        // (or single-row groups) → route to /messages.
                        if (!isExpanded && i === 0 && g.rows.length > 1) return
                        onClose()
                        router.push('/messages')
                      }}
                    />
                  )
                }}
              />
            )
          })
        )}
      </div>
    </div>
  )
}
