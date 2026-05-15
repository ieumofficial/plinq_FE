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

import { useEffect, useRef } from 'react'
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

/** Stacked-card visual for groups with 2+ rows: 1-2 ghost cards behind the
 *  front card to hint at the count. Mirrors Figma's stack offsets (3+ shows
 *  3 cards; 2 shows 2; 1 shows 1). */
function StackedCard({
  count,
  children,
}: {
  count: number
  children: React.ReactNode
}) {
  if (count <= 1) return <>{children}</>
  // Two ghost cards offset so the bottom border of each peeks ~3-5px below.
  const ghosts = Math.min(count - 1, 2)
  return (
    <div className="relative w-full">
      {Array.from({ length: ghosts }).map((_, i) => (
        <div
          key={i}
          aria-hidden
          className="absolute left-0 right-0 bg-[#394851] border border-solid border-gray-main rounded-[5px] h-[40px]"
          style={{
            top: (i + 1) * 5,
            zIndex: 0,
            opacity: 1 - 0.15 * (i + 1),
            boxShadow: '0px 4px 5px rgba(0,0,0,0.05)',
          }}
        />
      ))}
      <div
        className="relative"
        style={{
          zIndex: ghosts + 1,
          marginBottom: ghosts * 6,
        }}
      >
        {children}
      </div>
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

      {/* Items */}
      <div className="flex flex-col gap-[10px]">
        {groups.length === 0 ? (
          <p className="text-gray-secondary text-[11px]">You're all caught up.</p>
        ) : (
          groups.map((g, idx) => {
            const meta = readMeta(g.newest)
            // First card → "Clear All" pill on hover-equivalent (we always
            // show it since header click would be redundant). Other cards →
            // single-message dismiss [×].
            const isFirst = idx === 0
            return (
              <StackedCard key={g.sessionId} count={g.rows.length}>
                <ChatNotificationItem
                  chatType={g.kind}
                  title={g.newest.preview_title ?? ''}
                  body={
                    g.kind === 'channel' && meta.authorName
                      ? // strip the "Author: " prefix our trigger added so we can
                        // re-render it as bold + plain via the channelAuthorName prop
                        (g.newest.preview_body ?? '').replace(
                          new RegExp(`^${meta.authorName}: `),
                          ''
                        )
                      : g.newest.preview_body ?? ''
                  }
                  channelAuthorName={
                    g.kind === 'channel' ? meta.authorName : undefined
                  }
                  avatarInitial={
                    g.kind === 'dm' ? g.newest.preview_title ?? 'U' : undefined
                  }
                  rightAction={
                    isFirst && totalNew > 1 ? 'clearAll' : 'dismiss'
                  }
                  onRightAction={() => {
                    if (isFirst && totalNew > 1) {
                      dismissAll.mutate()
                    } else {
                      // Dismiss every row in this group (the user already saw
                      // the latest preview; bulk-clear is more useful).
                      for (const row of g.rows) dismissOne.mutate(row.id)
                    }
                  }}
                  onClick={() => {
                    onClose()
                    // Phase 1 routing: there's a single org-scoped /messages
                    // page; we just route to it and let the page re-select
                    // the right session (TODO: deep-link to a session id once
                    // the URL supports it).
                    router.push('/messages')
                  }}
                />
              </StackedCard>
            )
          })
        )}
      </div>
    </div>
  )
}
