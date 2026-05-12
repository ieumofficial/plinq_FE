import { useEffect, useMemo, useState } from 'react'
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
import {
  useChatMessages,
  useChatSessions,
  useCurrentUser,
  useMyOrg,
} from '../lib/hooks'
import {
  markChatSessionRead,
  sendChatMessage,
  type ChatMessageWithAuthor,
  type ChatSessionWithMeta,
} from '../lib/queries'
import { queryKeys } from '../lib/queryKeys'
import { userToMember } from '../lib/types'

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
    projectTag:
      s.scope === 'member_group' && s.project_name ? s.project_name : undefined,
    unreadCount: s.unread_count,
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
  const { data: org } = useMyOrg(user?.id)
  const orgId = org?.id ?? null

  const { data: sessions = [] } = useChatSessions(user?.id, orgId)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [filter, setFilter] = useState<ChatFilterKey>('all')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [draft, setDraft] = useState('')

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

  // Mark read whenever the active session changes / new messages arrive.
  useEffect(() => {
    if (!activeSessionId) return
    void markChatSessionRead(activeSessionId).then(() => {
      if (user?.id && orgId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.chat.sessions(user.id, orgId),
        })
      }
    })
  }, [activeSessionId, messages.length, user?.id, orgId, queryClient])

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

  const submitDraft = async () => {
    if (!activeSessionId || !draft.trim() || !user) return
    const body = draft
    setDraft('')

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
                  orgName={org?.name ?? ''}
                  name={activeSession.name ?? '(untitled)'}
                  description={activeSession.description ?? undefined}
                  members={[]}
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
                />
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 min-h-0 overflow-y-auto py-[10px]">
              {messages.length === 0 ? (
                <div className="px-[20px] py-[40px] text-center text-gray-secondary text-[12px]">
                  No messages yet. Say hi 👋
                </div>
              ) : (
                messages.map((m) => (
                  <ChatMessage
                    key={m.id}
                    author={userToMember(m.author)}
                    time={formatTime(m.created_at)}
                    body={m.body}
                  />
                ))
              )}
            </div>

            {/* Composer */}
            <div className="p-[15px]">
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
                    <ChatComposerChip icon={<ComposerIcons.Sparkle />}>
                      AI on · drafts replies
                    </ChatComposerChip>
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

      {/* Details panel */}
      {activeSession?.kind === 'channel' && (
        <div className="p-[10px] shrink-0 h-full">
          <ChatDetails
            variant="channel"
            name={activeSession.name ?? '(untitled)'}
            description={activeSession.description ?? undefined}
            createdLine={`Created ${new Date(activeSession.created_at).toLocaleDateString(
              'en-US',
              { month: 'short', day: 'numeric', year: 'numeric' }
            )}`}
            members={[] as ChatChannelMember[]}
          />
        </div>
      )}
      {activeSession?.kind === 'dm' && activeSession.other_user && (
        <div className="p-[10px] shrink-0 h-full">
          <ChatDetails
            variant="dm"
            member={userToMember(activeSession.other_user)}
            jobTitle={activeSession.other_user.job_title ?? undefined}
            orgName={org?.name ?? undefined}
          />
        </div>
      )}

      <CreateChatSessionModal
        open={createOpen}
        orgId={orgId}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => setActiveSessionId(id)}
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
      <PersonalAppShell active="messages" stackedSidebar>
        <MessagesBody />
      </PersonalAppShell>
    </>
  )
}
