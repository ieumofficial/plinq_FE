import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import { useQueryClient } from '@tanstack/react-query'
import PersonalAppShell from '../components/PersonalAppShell'
import ChatSidebar, {
  type ChatDmItem,
  type ChatFilterKey,
  type ChatSessionGroup,
} from '../components/ui/ChatSidebar'
import ChatHeader from '../components/ui/ChatHeader'
import ChatMessage from '../components/ui/ChatMessage'
import ChatDetails, { type ChatChannelMember } from '../components/ui/ChatDetails'
import ChatComposer, {
  ChatComposerChip,
  ComposerIcons,
} from '../components/ui/ChatComposer'
import CreateChatSessionModal from '../components/CreateChatSessionModal'
import ChatSearchPanel from '../components/ChatSearchPanel'
import ChatSuggestions from '../components/ui/ChatSuggestions'
import {
  getChatSuggestions,
  type ChatSuggestion,
} from '../lib/chatSuggest'
import {
  useChatMessages,
  useChatSessionMembers,
  useDmSharedContext,
  useChatSessions,
  useCurrentUser,
  useDeleteChatSession,
  useActiveOrg,
  useUserProjects,
} from '../lib/hooks'
import {
  dismissNotificationsForSession,
  markChatSessionRead,
  sendChatMessage,
  type ChatMessageWithAuthor,
  type ChatSessionWithMeta,
} from '../lib/queries'
import { queryKeys } from '../lib/queryKeys'
import { userToMember } from '../lib/types'
import { supabase } from '../lib/supabase'
import type { UserRow } from '../lib/types'

function formatRelative(iso: string | null): string | undefined {
  if (!iso) return undefined
  const d = new Date(iso)
  const diffMin = Math.round((Date.now() - d.getTime()) / 60000)
  if (diffMin < 1) return 'now'
  if (diffMin < 60) return `${diffMin}m`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function ymd(iso: string): string {
  return iso.slice(0, 10)
}

/** Hex colors mirroring the ProjectLabel palette. */
const PROJECT_COLOR_HEX: Record<string, string> = {
  blue: '#2D5A9E',
  green: '#2F6B45',
  amber: '#B68A48',
  red: '#9B3838',
  purple: '#5B3D8A',
  turquoise: '#558589',
}

/** Same hash-of-name palette UserGroup uses for initial-only avatars. */
const NAME_COLOR_FALLBACK = [
  '#5B7FB6',
  '#588F6E',
  '#B68A48',
  '#5B3D8A',
  '#9B3838',
  '#455E6A',
]
function colorForName(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return NAME_COLOR_FALLBACK[Math.abs(h) % NAME_COLOR_FALLBACK.length]
}

function resolveProjectColor(color: string | null | undefined): string {
  if (!color) return '#2D5A9E'
  if (color.startsWith('#')) return color
  return PROJECT_COLOR_HEX[color] ?? '#2D5A9E'
}

function formatDateDivider(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const today = ymd(now.toISOString())
  const yesterdayDate = new Date(now)
  yesterdayDate.setDate(now.getDate() - 1)
  const yesterday = ymd(yesterdayDate.toISOString())
  const that = ymd(iso)
  const weekday = d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
  if (that === today) return `Today · ${weekday}`
  if (that === yesterday) return `Yesterday · ${weekday}`
  return weekday
}

function buildSessionGroups(sessions: ChatSessionWithMeta[]): {
  groups: ChatSessionGroup[]
  sessionsCount: number
} {
  const orgWide: ChatSessionWithMeta[] = []
  const projectAssigned: ChatSessionWithMeta[] = []
  const memberGroups: ChatSessionWithMeta[] = []
  for (const s of sessions) {
    if (s.kind !== 'channel') continue
    if (s.scope === 'org_wide') orgWide.push(s)
    else if (s.scope === 'project') projectAssigned.push(s)
    else memberGroups.push(s)
  }
  const toItem = (s: ChatSessionWithMeta) => ({
    id: s.id,
    name: s.name ?? '(untitled)',
    projectTag: s.project_name ?? undefined,
    unreadCount: s.unread_count,
    createdBy: s.created_by,
  })
  const groups: ChatSessionGroup[] = []
  if (orgWide.length > 0)
    groups.push({ label: 'Org-wide', items: orgWide.map(toItem) })
  if (projectAssigned.length > 0)
    groups.push({ label: 'Assigned to projects', items: projectAssigned.map(toItem) })
  if (memberGroups.length > 0)
    groups.push({ label: 'Member groups', items: memberGroups.map(toItem) })
  return {
    groups,
    sessionsCount: orgWide.length + projectAssigned.length + memberGroups.length,
  }
}

function buildDmItems(sessions: ChatSessionWithMeta[]): ChatDmItem[] {
  return sessions
    .filter((s) => s.kind === 'dm' && s.other_user)
    .map((s) => ({
      id: s.id,
      name:
        s.other_user!.nickname ||
        `${s.other_user!.first_name} ${s.other_user!.last_name}`.trim() ||
        s.other_user!.email,
      preview: s.last_message_body ?? undefined,
      timeLabel: formatRelative(s.last_message_at) ?? undefined,
      unreadCount: s.unread_count,
      presence: 'online' as const,
    }))
}

function MessagesBody() {
  const queryClient = useQueryClient()
  const { data: user } = useCurrentUser()
  const activeOrg = useActiveOrg(user?.id)
  const orgId = activeOrg?.id ?? null

  const { data: sessions = [] } = useChatSessions(user?.id, orgId)
  const { data: projects = [] } = useUserProjects(user?.id, { orgId })
  const projectColorMap = useMemo(() => {
    const m = new Map<string, string | null>()
    for (const p of projects) m.set(p.id, p.color ?? null)
    return m
  }, [projects])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [filter, setFilter] = useState<ChatFilterKey>('all')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [dmCreateOpen, setDmCreateOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  /** When a search result is picked, we jump to that session AND scroll the
   *  matching message into view with a temporary highlight. Cleared after 2.5s
   *  so the highlight fades cleanly. */
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(
    null
  )
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // After a search pick, scroll to the highlighted message once it actually
  // exists in the DOM. We retry briefly because the session may be loading.
  useEffect(() => {
    if (!highlightedMessageId) return
    let cancelled = false
    let attempts = 0
    const tryScroll = () => {
      if (cancelled) return
      const el = messageRefs.current.get(highlightedMessageId)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        // Clear the highlight after the flash animation finishes.
        setTimeout(() => {
          if (!cancelled) setHighlightedMessageId(null)
        }, 2500)
        return
      }
      attempts += 1
      if (attempts < 20) setTimeout(tryScroll, 100)
    }
    tryScroll()
    return () => {
      cancelled = true
    }
  }, [highlightedMessageId])
  const [draft, setDraft] = useState('')
  const { mutate: deleteSession } = useDeleteChatSession()

  const handleDeleteSession = (id: string) => {
    const target = sessions.find((s) => s.id === id)
    const name = target?.name ?? 'this session'
    if (!window.confirm(`Delete #${name}? This cannot be undone.`)) return
    deleteSession(id, {
      onSuccess: () => {
        if (activeSessionId === id) setActiveSessionId(null)
      },
    })
  }

  useEffect(() => {
    if (!activeSessionId && sessions.length > 0) {
      setActiveSessionId(sessions[0].id)
    }
  }, [sessions, activeSessionId])

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? null,
    [sessions, activeSessionId]
  )

  const { data: messages = [] } = useChatMessages(activeSessionId)
  const { data: sessionMembers = [] } = useChatSessionMembers(activeSessionId)
  // For DM ChatDetails — fetch only when this session is a DM with a known
  // other party. The hook bails out via enabled when otherId is null.
  const dmOtherId =
    activeSession?.kind === 'dm' ? activeSession.other_user?.id ?? null : null
  const { data: dmShared } = useDmSharedContext(user?.id, dmOtherId)

  // Auto-scroll the messages pane to the bottom when entering a session or
  // when new messages arrive.
  const messagesRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = messagesRef.current
    if (!el) return
    // Scroll instantly on session switch, smoothly on new messages.
    el.scrollTop = el.scrollHeight
  }, [activeSessionId, messages.length])

  // Mark read whenever the active session changes / new messages arrive.
  // Also drop any unread notifications for this session — opening the
  // conversation is the user "consuming" them.
  useEffect(() => {
    if (!activeSessionId) return
    const sid = activeSessionId
    // Defer mark-read by ~1.5s so the catch-me-up endpoint (fired on mount
    // by CatchMeUpCard) gets to read the OLD last_read_at first and decide
    // there ARE unread messages. If we flipped last_read_at to now()
    // immediately, catch-me-up would see zero unread and the card would
    // never appear on first open. Its DB lookups are sub-ms, so 1.5s is a
    // generous safety margin; the sidebar unread badge clearing 1.5s late
    // is unnoticeable.
    const t = setTimeout(() => {
      void markChatSessionRead(sid).then(() => {
        if (user?.id && orgId) {
          queryClient.invalidateQueries({
            queryKey: queryKeys.chat.sessions(user.id, orgId),
          })
        }
      })
      void dismissNotificationsForSession(sid).then(() => {
        queryClient.invalidateQueries({
          queryKey: queryKeys.notifications.all,
        })
      })
    }, 1500)
    return () => clearTimeout(t)
  }, [activeSessionId, messages.length, user?.id, orgId, queryClient])

  // Realtime: subscribe to INSERTs on the active session's chat_messages so
  // messages from other users appear without a refresh.
  useEffect(() => {
    if (!activeSessionId || !user?.id) return
    const channel = supabase
      .channel(`chat:${activeSessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `session_id=eq.${activeSessionId}`,
        },
        async (payload) => {
          const row = payload.new as {
            id: string
            session_id: string
            author_id: string
            body: string
            reply_to_id: string | null
            pinned_at: string | null
            pinned_by: string | null
            edited_at: string | null
            created_at: string
          }
          // Skip our own message — already inserted optimistically.
          if (row.author_id === user.id) return

          // Fetch the author so we can render the row.
          const { data: authorRow } = await supabase
            .from('users')
            .select('id, email, first_name, last_name, nickname, job_title')
            .eq('id', row.author_id)
            .single()
          const author = (authorRow as UserRow | null) ?? {
            id: row.author_id,
            email: '',
            first_name: '?',
            last_name: '',
            nickname: null,
            job_title: null,
          }

          const messagesKey = queryKeys.chat.messages(activeSessionId)
          queryClient.setQueryData<ChatMessageWithAuthor[]>(
            messagesKey,
            (prev = []) =>
              prev.some((m) => m.id === row.id) ? prev : [...prev, { ...row, author }]
          )
          // Also refresh the sidebar so unread badge / preview updates.
          if (orgId) {
            queryClient.invalidateQueries({
              queryKey: queryKeys.chat.sessions(user.id, orgId),
            })
          }
        }
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [activeSessionId, user?.id, orgId, queryClient])

  // Realtime: subscribe to ALL chat_messages INSERTs so the sidebar's preview/
  // unread updates even for sessions you're not currently viewing.
  useEffect(() => {
    if (!user?.id || !orgId) return
    const channel = supabase
      .channel(`chat-sidebar:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        () => {
          queryClient.invalidateQueries({
            queryKey: queryKeys.chat.sessions(user.id, orgId),
          })
        }
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user?.id, orgId, queryClient])

  const { groups: sessionGroups, sessionsCount } = useMemo(
    () => buildSessionGroups(sessions),
    [sessions]
  )
  const dms = useMemo(() => buildDmItems(sessions), [sessions])

  const filtered = useMemo(() => {
    let g = sessionGroups
    let d = dms
    if (filter === 'unread' || filter === 'mentions') {
      g = sessionGroups
        .map((gr) => ({
          ...gr,
          items: gr.items.filter((it) => (it.unreadCount ?? 0) > 0),
        }))
        .filter((gr) => gr.items.length > 0)
      d = dms.filter((it) => (it.unreadCount ?? 0) > 0)
    } else if (filter === 'sessions') {
      d = []
    } else if (filter === 'dms') {
      g = []
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      g = g
        .map((gr) => ({
          ...gr,
          items: gr.items.filter((it) => it.name.toLowerCase().includes(q)),
        }))
        .filter((gr) => gr.items.length > 0)
      d = d.filter((it) => it.name.toLowerCase().includes(q))
    }
    return { groups: g, dms: d }
  }, [sessionGroups, dms, filter, search])

  // ─── AI suggested replies ──────────────────────────────────────────────
  // `aiOn` is the composer chip toggle. `suggestions` is what's currently
  // shown above the composer; `lastSuggestedAfterId` blocks repeat fetches
  // while we sit on the same incoming message.
  // Default OFF — drafting is opt-in. Turning it on triggers a single draft
  // for the current incoming message; it won't re-draft until the
  // conversation moves on (a new message arrives) — see the effect below.
  const [aiOn, setAiOn] = useState(false)
  const [suggestions, setSuggestions] = useState<ChatSuggestion[]>([])
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [sendingSuggestionIndex, setSendingSuggestionIndex] = useState<
    number | null
  >(null)
  // Per-(session, lastMessage) guard against duplicate network calls while
  // the user stays in the session. Real persistence is the BE cache
  // (chat_draft_suggestions) — on reload this ref resets, the effect fires
  // once, and the BE returns the *stored* drafts instead of regenerating.
  const lastSuggestedAfterIdRef = useRef<string | null>(null)

  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null
  const lastIsFromOther = !!lastMessage && lastMessage.author_id !== user?.id

  // Reset suggestion state when switching sessions so we don't carry over
  // a previous channel's drafts to a new one.
  useEffect(() => {
    setSuggestions([])
    setSuggestLoading(false)
    setSendingSuggestionIndex(null)
    lastSuggestedAfterIdRef.current = null
  }, [activeSessionId])

  const runSuggest = useCallback(async () => {
    if (!activeSessionId || !lastMessage) return
    setSuggestLoading(true)
    setSuggestions([])
    lastSuggestedAfterIdRef.current = lastMessage.id
    try {
      // BE serves from chat_draft_suggestions when this is the same
      // incoming message as a previous run — no Sonnet call, just the
      // remembered drafts.
      const res = await getChatSuggestions(activeSessionId, { n: 3 })
      setSuggestions(res)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[messages] suggestion fetch failed', e)
      // Poison the guard so the next incoming message can re-trigger.
      lastSuggestedAfterIdRef.current = null
    } finally {
      setSuggestLoading(false)
    }
  }, [activeSessionId, lastMessage?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch suggestions when:
  //   - AI is on
  //   - the conversation is not empty AND last message is from someone else
  //   - the user hasn't typed anything yet (draft empty — we don't want to
  //     wipe their typing)
  //   - we haven't already fetched for this exact incoming message *this
  //     session view* (the BE still de-dupes via its cache on reload)
  useEffect(() => {
    if (!aiOn) return
    if (!activeSessionId) return
    if (!lastIsFromOther || !lastMessage) return
    if (draft.trim()) return
    if (lastSuggestedAfterIdRef.current === lastMessage.id) return
    void runSuggest()
    // lastMessage?.id keeps deps stable — the array reference can change
    // while pointing at the same final message; we only care about the id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiOn, activeSessionId, lastIsFromOther, lastMessage?.id, draft])

  const submitDraft = async () => {
    if (!activeSessionId || !draft.trim() || !user) return
    const body = draft
    setDraft('')
    // After we send, suggestions become stale — clear them and let the next
    // incoming message re-trigger the fetch.
    setSuggestions([])
    lastSuggestedAfterIdRef.current = null

    // Optimistically insert the message into the local cache so it appears
    // instantly. The server round-trip becomes background work, and our own
    // message can never be flagged as unread because getChatSessions filters
    // by author_id.
    const tempId = `temp-${Date.now()}`
    const optimistic: ChatMessageWithAuthor = {
      id: tempId,
      session_id: activeSessionId,
      author_id: user.id,
      body,
      reply_to_id: null,
      pinned_at: null,
      pinned_by: null,
      edited_at: null,
      created_at: new Date().toISOString(),
      author: user,
    }
    const messagesKey = queryKeys.chat.messages(activeSessionId)
    queryClient.setQueryData<ChatMessageWithAuthor[]>(messagesKey, (prev = []) => [
      ...prev,
      optimistic,
    ])

    const result = await sendChatMessage({ session_id: activeSessionId, body })
    if ('error' in result) {
      // Roll back the optimistic insert if the server rejected.
      queryClient.setQueryData<ChatMessageWithAuthor[]>(messagesKey, (prev = []) =>
        prev.filter((m) => m.id !== tempId)
      )
      return
    }
    // Replace temp id with real id (no refetch needed — body/author unchanged).
    queryClient.setQueryData<ChatMessageWithAuthor[]>(messagesKey, (prev = []) =>
      prev.map((m) => (m.id === tempId ? { ...m, id: result.id } : m))
    )
    // Refresh the sidebar's last-message preview / time, but don't invalidate
    // the messages query (we already have the real row in cache).
    if (orgId) {
      queryClient.invalidateQueries({
        queryKey: queryKeys.chat.sessions(user.id, orgId),
      })
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      <ChatSidebar
        activeFilter={filter}
        onFilterChange={setFilter}
        searchValue={search}
        onSearchChange={setSearch}
        sessionsCount={sessionsCount}
        sessionGroups={filtered.groups}
        dms={filtered.dms}
        dmCount={dms.length}
        activeId={activeSessionId ?? undefined}
        onItemClick={(id) => setActiveSessionId(id)}
        onCreateClick={() => setCreateOpen(true)}
        onCreateDmClick={() => setDmCreateOpen(true)}
        currentUserId={user?.id}
        onDeleteSession={handleDeleteSession}
      />

      {/* Conversation pane */}
      <section className="flex-1 min-w-0 flex flex-col bg-white-white border-t border-r border-solid border-gray-border-light">
        {!activeSession ? (
          <div className="flex-1 flex items-center justify-center text-gray-secondary text-[12px]">
            Pick a session to start chatting.
          </div>
        ) : (
          <>
            <div className="px-[20px] pt-[20px] pb-[15px] border-b border-solid border-gray-border-light">
              {activeSession.kind === 'channel' ? (
                <ChatHeader
                  variant="channel"
                  orgName={activeOrg?.name ?? ''}
                  name={activeSession.name ?? '(untitled)'}
                  description={activeSession.description ?? undefined}
                  members={sessionMembers.map(userToMember)}
                  memberCount={sessionMembers.length}
                  onSearch={() => setSearchOpen(true)}
                  eyebrowColor={
                    activeSession.project_id
                      ? resolveProjectColor(projectColorMap.get(activeSession.project_id))
                      : undefined
                  }
                  tipNode={
                    activeSession.scope === 'org_wide' ? (
                      <>
                        <strong className="text-black font-semibold">
                          #{activeSession.name}
                        </strong>{' '}
                        is the org-wide default channel. Everyone at{' '}
                        {activeOrg?.name ?? 'this organization'} is a member.
                      </>
                    ) : activeSession.scope === 'project' ? (
                      <>
                        <strong className="text-black font-semibold">
                          #{activeSession.name}
                        </strong>{' '}
                        is the channel for the{' '}
                        {activeSession.project_name ?? 'project'} team.
                      </>
                    ) : (
                      <>
                        <strong className="text-black font-semibold">
                          #{activeSession.name}
                        </strong>{' '}
                        is a member group channel.
                      </>
                    )
                  }
                />
              ) : (
                <ChatHeader
                  variant="dm"
                  name={
                    activeSession.other_user
                      ? activeSession.other_user.nickname ||
                        `${activeSession.other_user.first_name} ${activeSession.other_user.last_name}`.trim()
                      : 'Direct message'
                  }
                  member={
                    activeSession.other_user
                      ? userToMember(activeSession.other_user)
                      : { name: '?' }
                  }
                  jobTitle={activeSession.other_user?.job_title ?? undefined}
                  isActive
                  onSearch={() => setSearchOpen(true)}
                  eyebrowColor={
                    activeSession.other_user
                      ? colorForName(
                          activeSession.other_user.nickname ||
                            `${activeSession.other_user.first_name} ${activeSession.other_user.last_name}`.trim() ||
                            activeSession.other_user.email
                        )
                      : undefined
                  }
                />
              )}
            </div>

            {/* Messages */}
            <div ref={messagesRef} className="flex-1 min-h-0 overflow-y-auto py-[10px]">
              {messages.length === 0 ? (
                <div className="px-[20px] py-[40px] text-center text-gray-secondary text-[12px]">
                  No messages yet. Say hi 👋
                </div>
              ) : (
                messages.map((m, i) => {
                  const prev = messages[i - 1]
                  const showDivider = !prev || ymd(prev.created_at) !== ymd(m.created_at)
                  const isHighlighted = highlightedMessageId === m.id
                  return (
                    <div key={m.id}>
                      {showDivider && (
                        <div className="flex items-center gap-[10px] my-[10px] px-[15px]">
                          <div className="flex-1 h-px bg-gray-border-light" />
                          <span
                            className="bg-white-white border border-solid border-gray-border-light rounded-full px-[12px] py-[4px] text-[10px] text-gray-main tracking-[1px]"
                            style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}
                          >
                            {formatDateDivider(m.created_at)}
                          </span>
                          <div className="flex-1 h-px bg-gray-border-light" />
                        </div>
                      )}
                      <div
                        ref={(el) => {
                          if (el) messageRefs.current.set(m.id, el)
                          else messageRefs.current.delete(m.id)
                        }}
                        className={
                          isHighlighted
                            ? 'bg-brown-light/60 transition-colors duration-500'
                            : 'bg-transparent transition-colors duration-500'
                        }
                      >
                        <ChatMessage
                          author={userToMember(m.author)}
                          time={formatTime(m.created_at)}
                          body={m.body}
                        />
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Composer (with optional Suggested replies strip on top) */}
            <div className="p-[15px] flex flex-col gap-[10px]">
              {aiOn && (
                <ChatSuggestions
                  suggestions={suggestions}
                  loading={suggestLoading}
                  sendingIndex={sendingSuggestionIndex}
                  onEdit={(s) => {
                    // Drop into the composer so the user can tweak before sending.
                    setDraft(s.body)
                    setSuggestions([])
                  }}
                  onSend={async (s) => {
                    if (!activeSessionId || !user) return
                    const i = suggestions.findIndex(
                      (x) => x.body === s.body && x.label === s.label,
                    )
                    setSendingSuggestionIndex(i >= 0 ? i : 0)
                    try {
                      const tempId = `temp-${Date.now()}`
                      const optimistic: ChatMessageWithAuthor = {
                        id: tempId,
                        session_id: activeSessionId,
                        author_id: user.id,
                        body: s.body,
                        reply_to_id: null,
                        pinned_at: null,
                        pinned_by: null,
                        edited_at: null,
                        created_at: new Date().toISOString(),
                        author: user,
                      }
                      const messagesKey = queryKeys.chat.messages(activeSessionId)
                      queryClient.setQueryData<ChatMessageWithAuthor[]>(
                        messagesKey,
                        (prev = []) => [...prev, optimistic],
                      )
                      const result = await sendChatMessage({
                        session_id: activeSessionId,
                        body: s.body,
                      })
                      if ('error' in result) {
                        queryClient.setQueryData<ChatMessageWithAuthor[]>(
                          messagesKey,
                          (prev = []) => prev.filter((m) => m.id !== tempId),
                        )
                        return
                      }
                      queryClient.setQueryData<ChatMessageWithAuthor[]>(
                        messagesKey,
                        (prev = []) =>
                          prev.map((m) =>
                            m.id === tempId ? { ...m, id: result.id } : m,
                          ),
                      )
                      setSuggestions([])
                      lastSuggestedAfterIdRef.current = null
                      if (orgId) {
                        queryClient.invalidateQueries({
                          queryKey: queryKeys.chat.sessions(user.id, orgId),
                        })
                      }
                    } finally {
                      setSendingSuggestionIndex(null)
                    }
                  }}
                />
              )}
              <ChatComposer
                value={draft}
                onChange={setDraft}
                onSend={submitDraft}
                placeholder={
                  activeSession.kind === 'channel'
                    ? `Message #${activeSession.name}`
                    : 'Send a message'
                }
                scopeChips={
                  <>
                    {(() => {
                      // Draft only makes sense when the newest message is from
                      // someone else (something to reply to). If it's mine or
                      // the thread is empty, the toggle is unavailable.
                      const aiUnavailable = !lastIsFromOther
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            if (aiUnavailable) return
                            setAiOn((v) => !v)
                          }}
                          disabled={aiUnavailable}
                          className={`rounded-[10px] px-[7px] py-[3px] inline-flex items-center gap-[5px] transition-colors ${
                            aiUnavailable
                              ? 'bg-white-item text-gray-light cursor-not-allowed opacity-60'
                              : aiOn
                                ? 'bg-primary-dark text-white'
                                : 'bg-white-item text-gray-main hover:bg-gray-extra-light'
                          }`}
                          title={
                            aiUnavailable
                              ? 'No new message to reply to — AI draft unavailable'
                              : aiOn
                                ? 'Click to turn AI suggestions off'
                                : 'Click to turn AI suggestions on'
                          }
                        >
                          <ComposerIcons.Sparkle />
                          <span className="text-[10px] leading-[1.5] whitespace-nowrap">
                            {aiUnavailable
                              ? 'AI draft · unavailable'
                              : aiOn
                                ? 'AI on · drafts replies'
                                : 'AI off'}
                          </span>
                        </button>
                      )
                    })()}
                    {activeSession.kind === 'channel' && (
                      <ChatComposerChip icon={<ComposerIcons.OrgChart />}>
                        {activeSession.scope === 'org_wide'
                          ? 'Org-wide'
                          : activeSession.scope === 'project'
                            ? `Project · ${activeSession.project_name ?? ''}`
                            : 'Member group'}
                      </ChatComposerChip>
                    )}
                  </>
                }
              />
            </div>
          </>
        )}
      </section>

      {/* Details panel — sits flush against the conversation pane (Figma 896:7228) */}
      {activeSession?.kind === 'channel' && (
        <ChatDetails
          variant="channel"
          name={activeSession.name ?? '(untitled)'}
          description={activeSession.description ?? undefined}
          createdLine={`Created ${new Date(activeSession.created_at).toLocaleDateString(
            'en-US',
            { month: 'short', day: 'numeric', year: 'numeric' }
          )}`}
          members={
            sessionMembers.map((u) => ({
              member: userToMember(u),
              tag: u.id === activeSession.created_by ? 'Lead' : undefined,
            })) as ChatChannelMember[]
          }
          memberCount={sessionMembers.length}
          sessionId={activeSession.id}
        />
      )}
      {activeSession?.kind === 'dm' && activeSession.other_user && (
        <ChatDetails
          variant="dm"
          member={userToMember(activeSession.other_user)}
          jobTitle={activeSession.other_user.job_title ?? undefined}
          orgName={activeOrg?.name ?? undefined}
          sharedSessions={(dmShared?.sessions ?? []).map((s) => ({
            id: s.id,
            name: s.kind === 'channel' ? `#${s.name}` : s.name,
            subtitle:
              s.scope === 'project' && s.project_name
                ? `Project · ${s.project_name}`
                : s.scope === 'org_wide'
                  ? 'Org-wide'
                  : s.scope === 'member_group'
                    ? 'Member group'
                    : undefined,
          }))}
          sharedFiles={(dmShared?.files ?? []).map((f) => ({
            id: f.id,
            name: f.name,
            meta: f.project_name
              ? `${f.project_name} · ${new Date(f.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
              : new Date(f.uploaded_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                }),
          }))}
          sessionId={activeSession.id}
        />
      )}

      <CreateChatSessionModal
        open={createOpen}
        orgId={orgId}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => setActiveSessionId(id)}
      />

      {/* DM-locked variant — opens from the DM section "+" button */}
      <CreateChatSessionModal
        open={dmCreateOpen}
        orgId={orgId}
        lockMode="dm"
        onClose={() => setDmCreateOpen(false)}
        onCreated={(id) => setActiveSessionId(id)}
      />

      {/* Global chat search — triggered by the search icon in the conversation header */}
      <ChatSearchPanel
        open={searchOpen}
        orgId={orgId}
        sessions={sessions.map((s) => ({
          id: s.id,
          kind: s.kind,
          label:
            s.kind === 'channel'
              ? s.name ?? '(untitled)'
              : s.other_user
                ? s.other_user.nickname ||
                  `${s.other_user.first_name} ${s.other_user.last_name}`.trim()
                : 'Direct message',
        }))}
        onClose={() => setSearchOpen(false)}
        onPick={(sessionId, messageId) => {
          setActiveSessionId(sessionId)
          if (messageId) setHighlightedMessageId(messageId)
        }}
      />
    </div>
  )
}

export default function MessagesPage() {
  return (
    <>
      <Head>
        <title>plinq · Messages</title>
      </Head>
      <PersonalAppShell active="messages">
        <MessagesBody />
      </PersonalAppShell>
    </>
  )
}
