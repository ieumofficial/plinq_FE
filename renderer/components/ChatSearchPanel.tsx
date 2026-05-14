import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Icon from './ui/Icon'
import { searchChatMessages, type ChatSearchHit } from '../lib/queries'

type SessionMeta = {
  id: string
  /** Display label — "#general" for channels, "Mira Chen" for DMs. */
  label: string
  kind: 'channel' | 'dm'
}

type Props = {
  open: boolean
  orgId: string | null
  /** All sessions known to the current user — used to also surface matches by
   *  session name (in addition to message-content search). */
  sessions: SessionMeta[]
  onClose: () => void
  /** Picking a result jumps to the session. When `messageId` is provided, the
   *  parent should also scroll to and highlight that specific message. */
  onPick: (sessionId: string, messageId?: string) => void
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const diffDay = Math.floor(
    (Date.now() - d.getTime()) / (24 * 60 * 60 * 1000)
  )
  if (diffDay === 0) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }
  if (diffDay < 7) {
    return d.toLocaleDateString('en-US', { weekday: 'short' })
  }
  if (d.getFullYear() === new Date().getFullYear()) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function highlight(text: string, q: string) {
  if (!q.trim()) return text
  const at = text.toLowerCase().indexOf(q.toLowerCase())
  if (at < 0) return text
  return (
    <>
      {text.slice(0, at)}
      <mark className="bg-brown-light text-brown-med rounded-[2px] px-[2px]">
        {text.slice(at, at + q.length)}
      </mark>
      {text.slice(at + q.length)}
    </>
  )
}

export default function ChatSearchPanel({
  open,
  orgId,
  sessions,
  onClose,
  onPick,
}: Props) {
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) return
    setQuery('')
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Outside-click → close. The panel is anchored top-right and renders without
  // a backdrop dim, so we need to listen ourselves.
  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (target.closest('[data-chat-search]')) return
      onClose()
    }
    // Defer one tick so the click that opened us doesn't immediately close.
    const id = setTimeout(() => {
      document.addEventListener('mousedown', onDocClick)
    }, 0)
    return () => {
      clearTimeout(id)
      document.removeEventListener('mousedown', onDocClick)
    }
  }, [open, onClose])

  const nameHits = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 1) return []
    return sessions
      .filter((s) => s.label.toLowerCase().includes(q))
      .slice(0, 12)
  }, [sessions, query])

  const { data: messageHits = [], isFetching } = useQuery<ChatSearchHit[]>({
    queryKey: ['chatSearch', orgId, query],
    queryFn: () => searchChatMessages(orgId!, query),
    enabled: !!orgId && query.trim().length >= 2 && open,
    staleTime: 30 * 1000,
  })

  const sessionById = useMemo(() => {
    const m = new Map<string, SessionMeta>()
    for (const s of sessions) m.set(s.id, s)
    return m
  }, [sessions])

  if (!open) return null

  return (
    <div
      data-chat-search
      onClick={(e) => e.stopPropagation()}
      className="fixed top-[80px] right-[20px] z-[60] w-[420px] max-w-[92vw] max-h-[70vh] bg-white-white rounded-[10px] shadow-2xl border border-solid border-gray-border-light flex flex-col overflow-hidden"
    >
      {/* Header / input */}
      <div className="border-b border-solid border-gray-border-light p-[10px]">
        <div className="flex items-center gap-[10px] bg-white-item rounded-[8px] px-[10px] py-[6px]">
          <Icon name="Search" size={13} className="text-gray-main shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats and messages…"
            className="flex-1 bg-transparent outline-none text-[12px] text-black placeholder:text-gray-secondary"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-gray-secondary hover:text-black"
              aria-label="Clear"
            >
              <Icon name="Cross" size={11} />
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="text-gray-secondary hover:text-black text-[10px]"
              aria-label="Close"
            >
              esc
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {query.trim().length === 0 ? (
          <p className="px-[15px] py-[20px] text-center text-gray-secondary text-[11px]">
            Type to search across all chats and messages.
          </p>
        ) : (
          <div className="flex flex-col">
            {/* Chats by name */}
            {nameHits.length > 0 && (
              <div className="px-[10px] py-[8px]">
                <p className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px] mb-[5px] px-[6px]">
                  Chats · {nameHits.length}
                </p>
                <div className="flex flex-col">
                  {nameHits.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        onPick(s.id)
                        onClose()
                      }}
                      className="flex items-center gap-[8px] px-[8px] py-[6px] rounded-[5px] hover:bg-white-item text-left transition-colors"
                    >
                      <span className="text-gray-main text-[11px] font-semibold w-[14px] inline-flex justify-center shrink-0">
                        {s.kind === 'channel' ? '#' : '@'}
                      </span>
                      <span className="text-black text-[12px] truncate">
                        {highlight(s.label, query)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="px-[10px] py-[8px]">
              <p className="text-gray-main text-[10px] font-medium uppercase tracking-[1.5px] mb-[5px] px-[6px]">
                Messages
                {isFetching ? ' · searching…' : ` · ${messageHits.length}`}
              </p>
              {query.trim().length < 2 ? (
                <p className="text-gray-secondary text-[11px] px-[8px] py-[8px]">
                  Type at least 2 characters.
                </p>
              ) : messageHits.length === 0 && !isFetching ? (
                <p className="text-gray-secondary text-[11px] px-[8px] py-[8px]">
                  No messages match.
                </p>
              ) : (
                <div className="flex flex-col">
                  {messageHits.map((h) => {
                    const session = sessionById.get(h.session_id)
                    return (
                      <button
                        key={h.message_id}
                        type="button"
                        onClick={() => {
                          onPick(h.session_id, h.message_id)
                          onClose()
                        }}
                        className="flex flex-col gap-[2px] px-[8px] py-[6px] rounded-[5px] hover:bg-white-item text-left transition-colors"
                      >
                        <div className="flex items-center justify-between gap-[10px]">
                          <span className="text-gray-main text-[10px] font-semibold uppercase tracking-[1px] truncate">
                            {session
                              ? `${session.kind === 'channel' ? '#' : '@'} ${session.label}`
                              : 'Chat'}
                          </span>
                          <span className="text-gray-secondary text-[10px] shrink-0">
                            {formatTime(h.created_at)}
                          </span>
                        </div>
                        <p className="text-black text-[12px] leading-[1.4] line-clamp-2">
                          {highlight(h.snippet, query)}
                        </p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
