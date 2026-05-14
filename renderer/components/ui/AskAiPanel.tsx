import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { aiStream } from '../../lib/aiClient'
import { renderMarkdown } from '../../lib/markdown'
import {
  useAgentConversations,
  useAgentMessages,
  useDeleteAgentConversation,
  type AgentConversation,
} from '../../lib/hooks'
import { queryKeys } from '../../lib/queryKeys'
import { aiFetch } from '../../lib/aiClient'
import {
  clearActiveConversationId,
  getActiveConversationId,
  setActiveConversationId,
} from '../../lib/conversationStore'

// Items in a proposal share these few fields; everything else (status,
// priority, due_date, …) is kind-specific and rendered via small fallbacks.
type ProposalItem = {
  id: string
  title?: string
  name?: string
  description?: string
  priority?: string
  status?: string
  due_date?: string
  start_date?: string
  [k: string]: unknown
}

/** Per-row editable task state (project_outline.initial_tasks). */
type TaskDraft = {
  include: boolean
  title: string
  description: string
  priority: string
  due_date: string // 'yyyy-mm-dd' or ''
  assignee_user_ids: string[]
}

type ChatItem =
  | {
      kind: 'message'
      id: string
      role: 'user' | 'assistant'
      content: string
      /** Local hh:mm timestamp shown next to author label. */
      time: string
      /** Assistant only — true while chunks are still streaming in. */
      streaming?: boolean
      /** Assistant only — server message_id once persisted (for future actions). */
      serverId?: string
      error?: string | null
    }
  | {
      kind: 'proposal'
      id: string
      time: string
      proposalId: string
      proposalKind: string
      projectId: string | null
      items: ProposalItem[]
      /** Item ids the user has currently checked. */
      selectedItemIds: string[]
      /** project_outline only — editable nested tasks for the (single) project item. */
      taskDrafts?: TaskDraft[]
      status: 'pending' | 'applying' | 'applied' | 'dismissed'
      /** Filled after a successful apply for the user's reference. */
      appliedSummary?: string
      /** Reason returned by /dismiss-proposal or by an agent self-dismissal. */
      dismissedReason?: string | null
      error?: string | null
    }

const PRIORITY_CYCLE = ['urgent', 'high', 'medium', 'low'] as const

type Props = {
  /** Close (✕) — parent toggles the panel mount. */
  onClose: () => void
  /**
   * Personal Agent: omit `projectId`, the server picks the user's single org
   * unless `orgId` is also given. Project Agent: pass `projectId` and the
   * server uses that project's org automatically.
   */
  orgId?: string
  projectId?: string
  /** Shown in the subtitle ("About this session · {label}"). */
  scopeLabel?: string
}

type View = 'chat' | 'sessions'

function nowHHMM(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function isoToHHMM(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function newId(): string {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export default function AskAiPanel({
  onClose,
  orgId,
  projectId,
  scopeLabel,
}: Props) {
  const scope = useMemo(
    () => ({ orgId: orgId ?? null, projectId: projectId ?? null }),
    [orgId, projectId],
  )

  const qc = useQueryClient()
  const [view, setView] = useState<View>('chat')
  const [messages, setMessages] = useState<ChatItem[]>([])
  const [draft, setDraft] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [restored, setRestored] = useState(false) // tracked to avoid re-hydrating once user starts typing
  const [sending, setSending] = useState(false)
  const [composing, setComposing] = useState(false)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // ── Restoration: localStorage → DB fallback ─────────────────────
  // Step 1: read localStorage on scope change.
  useEffect(() => {
    setRestored(false)
    setMessages([])
    const saved = getActiveConversationId(scope)
    setConversationId(saved)
  }, [scope])

  // Step 2: if localStorage was empty, ask the server for the most recent
  // conversation in this scope. Only runs while we don't have an id yet.
  const convListEnabledForFallback = !conversationId && !restored
  const convListQuery = useAgentConversations({
    orgId: scope.orgId,
    projectId: scope.projectId,
    enabled: convListEnabledForFallback || view === 'sessions',
  })
  useEffect(() => {
    if (conversationId) return
    if (restored) return
    if (!convListQuery.data) return
    const first = convListQuery.data[0]
    if (first) {
      setConversationId(first.id)
    } else {
      // No prior conversation anywhere — start fresh.
      setRestored(true)
    }
  }, [conversationId, restored, convListQuery.data])

  // Step 3: hydrate messages from DB once we have a conversation id.
  const messagesQuery = useAgentMessages(conversationId)
  useEffect(() => {
    if (!conversationId) return
    if (restored) return
    const data = messagesQuery.data
    if (!data) return
    setMessages(
      data.messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map(
          (m): ChatItem => ({
            kind: 'message',
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            time: isoToHHMM(m.created_at),
          }),
        ),
    )
    setRestored(true)
  }, [conversationId, messagesQuery.data, restored])

  // Persist active conversation id whenever it changes.
  useEffect(() => {
    if (conversationId) setActiveConversationId(scope, conversationId)
  }, [conversationId, scope])

  // Autoscroll on new messages / chunks.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages])

  function startNewChat() {
    clearActiveConversationId(scope)
    setConversationId(null)
    setMessages([])
    setRestored(true) // don't auto-fallback to most recent
    setView('chat')
  }

  function openConversation(id: string) {
    setConversationId(id)
    setMessages([])
    setRestored(false) // trigger hydrate from DB
    setView('chat')
  }

  async function send(): Promise<void> {
    const body = draft.trim()
    if (!body || sending) return

    const userMsg: ChatItem = {
      kind: 'message',
      id: newId(),
      role: 'user',
      content: body,
      time: nowHHMM(),
    }
    const assistantMsg: ChatItem = {
      kind: 'message',
      id: newId(),
      role: 'assistant',
      content: '',
      time: nowHHMM(),
      streaming: true,
    }
    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setDraft('')
    setSending(true)
    requestAnimationFrame(() => {
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    })

    try {
      await aiStream(
        '/agent/chat',
        {
          message: body,
          conversation_id: conversationId,
          org_id: conversationId ? null : orgId ?? null,
          project_id: projectId ?? null,
        },
        (evt) => {
          const t = evt.type
          if (t === 'meta' && evt.is_new && typeof evt.conversation_id === 'string') {
            setConversationId(evt.conversation_id)
            // The new session needs to show up the next time the user opens
            // the sessions list — invalidate now so it's already in the cache.
            qc.invalidateQueries({ queryKey: queryKeys.agentChats.all })
          } else if (t === 'chunk' && typeof evt.text === 'string') {
            const text = evt.text as string
            setMessages((prev) => updateLastStreaming(prev, (m) => ({
              ...m,
              content: m.content + text,
            })))
          } else if (t === 'done') {
            const serverId = typeof evt.message_id === 'string' ? evt.message_id : undefined
            setMessages((prev) => updateLastStreaming(prev, (m) => ({
              ...m,
              streaming: false,
              serverId: serverId ?? m.serverId,
            })))
          } else if (t === 'error') {
            const msg = typeof evt.message === 'string' ? evt.message : 'unknown error'
            setMessages((prev) => updateLastStreaming(prev, (m) => ({
              ...m,
              streaming: false,
              error: msg,
            })))
          } else if (t === 'proposal') {
            // Materialize as a card right after the assistant message that
            // produced the tool call.
            const items = (Array.isArray(evt.items) ? evt.items : []) as ProposalItem[]
            const proposalKind = String(evt.kind ?? 'unknown')
            const taskDrafts =
              proposalKind === 'project_outline'
                ? extractInitialTaskDrafts(items[0])
                : undefined
            const card: ChatItem = {
              kind: 'proposal',
              id: newId(),
              time: nowHHMM(),
              proposalId: String(evt.proposal_id ?? ''),
              proposalKind,
              projectId: (evt.project_id as string | null) ?? null,
              items,
              // project_outline always applies the (single) project item; other
              // kinds let the user pick which items to materialize.
              selectedItemIds:
                proposalKind === 'project_outline'
                  ? items.map((i) => i.id).filter(Boolean)
                  : items.map((i) => i.id).filter(Boolean),
              taskDrafts,
              status: 'pending',
            }
            setMessages((prev) => [...prev, card])
          } else if (t === 'proposal_dismissed') {
            const proposalId = String(evt.proposal_id ?? '')
            const reason = typeof evt.reason === 'string' ? evt.reason : null
            setMessages((prev) =>
              prev.map((m) =>
                m.kind === 'proposal' && m.proposalId === proposalId
                  ? { ...m, status: 'dismissed', dismissedReason: reason }
                  : m,
              ),
            )
          }
        },
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setMessages((prev) => updateLastStreaming(prev, (m) => ({
        ...m,
        streaming: false,
        error: msg,
      })))
    } finally {
      setSending(false)
      // The new conversation appears in the sessions list — refresh next open.
      // (TanStack invalidation happens via mutation; here we just re-fetch on view switch.)
    }
  }

  // ── Apply / Dismiss for proposal cards ─────────────────────────
  function setCard(cardId: string, mut: (c: Extract<ChatItem, { kind: 'proposal' }>) => ChatItem) {
    setMessages((prev) =>
      prev.map((m) => (m.kind === 'proposal' && m.id === cardId ? mut(m) : m)),
    )
  }

  async function handleApply(cardId: string): Promise<void> {
    const card = messages.find(
      (m): m is Extract<ChatItem, { kind: 'proposal' }> =>
        m.kind === 'proposal' && m.id === cardId,
    )
    if (!card || card.status !== 'pending') return
    if (card.selectedItemIds.length === 0) return

    // Build overrides for project_outline: keep only the included tasks and
    // pass back the user's edits. Other kinds use the items as-is (no edit UI yet).
    const overrides: Record<string, Record<string, unknown>> = {}
    if (
      card.proposalKind === 'project_outline' &&
      card.taskDrafts &&
      card.items[0]?.id
    ) {
      const includedTasks = card.taskDrafts
        .filter((t) => t.include && t.title.trim())
        .map((t) => ({
          title: t.title.trim(),
          description: t.description.trim() || null,
          priority: t.priority,
          due_date: t.due_date || null,
          assignee_user_ids: t.assignee_user_ids,
        }))
      overrides[card.items[0].id] = { initial_tasks: includedTasks }
    }

    setCard(cardId, (c) => ({ ...c, status: 'applying', error: null }))

    // The apply ack comes back as its own assistant text — give it a slot now.
    const ackMsg: ChatItem = {
      kind: 'message',
      id: newId(),
      role: 'assistant',
      content: '',
      time: nowHHMM(),
      streaming: true,
    }
    setMessages((prev) => [...prev, ackMsg])

    try {
      await aiStream(
        '/agent/apply-proposal',
        {
          proposal_id: card.proposalId,
          selected_item_ids: card.selectedItemIds,
          overrides,
        },
        (evt) => {
          const t = evt.type
          if (t === 'applied') {
            setCard(cardId, (c) => ({
              ...c,
              status: 'applied',
              appliedSummary: summarizeAppliedResult(c.proposalKind, evt.result),
            }))
          } else if (t === 'chunk' && typeof evt.text === 'string') {
            const text = evt.text as string
            setMessages((prev) => updateLastStreaming(prev, (m) => ({
              ...m,
              content: m.content + text,
            })))
          } else if (t === 'done') {
            const serverId =
              typeof evt.message_id === 'string' ? evt.message_id : undefined
            setMessages((prev) => updateLastStreaming(prev, (m) => ({
              ...m,
              streaming: false,
              serverId: serverId ?? m.serverId,
            })))
          } else if (t === 'error') {
            const msg = typeof evt.message === 'string' ? evt.message : 'apply failed'
            setMessages((prev) => updateLastStreaming(prev, (m) => ({
              ...m,
              streaming: false,
              error: msg,
            })))
          }
        },
      )
      // The apply changed real DB rows — invalidate dependent caches.
      qc.invalidateQueries({ queryKey: queryKeys.tasks.all })
      qc.invalidateQueries({ queryKey: queryKeys.projects.all })
      qc.invalidateQueries({ queryKey: queryKeys.meetings.all })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setCard(cardId, (c) => ({ ...c, status: 'pending', error: msg }))
      setMessages((prev) => updateLastStreaming(prev, (m) => ({
        ...m,
        streaming: false,
        error: msg,
      })))
    }
  }

  async function handleDismiss(cardId: string): Promise<void> {
    const card = messages.find(
      (m): m is Extract<ChatItem, { kind: 'proposal' }> =>
        m.kind === 'proposal' && m.id === cardId,
    )
    if (!card || card.status !== 'pending') return

    setCard(cardId, (c) => ({ ...c, status: 'dismissed', error: null }))
    try {
      const r = await aiFetch('/agent/dismiss-proposal', {
        method: 'POST',
        body: { proposal_id: card.proposalId, reason: 'user_dismissed' },
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setCard(cardId, (c) => ({ ...c, status: 'pending', error: msg }))
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (composing || e.nativeEvent.isComposing || e.keyCode === 229) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  function onInput(e: React.ChangeEvent<HTMLTextAreaElement>): void {
    setDraft(e.target.value)
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(120, ta.scrollHeight)}px`
  }

  const todayLabel = (() => {
    const d = new Date()
    const month = d.toLocaleString('en', { month: 'short' }).toLowerCase()
    return `today  ·  ${month} ${d.getDate()}`
  })()

  return (
    <aside
      className="flex h-full w-[265px] shrink-0 flex-col justify-between border-l border-gray-border-light text-white"
      style={{
        backgroundImage:
          'linear-gradient(139.48deg, #2E434E 0%, #1F2F38 100%)',
      }}
      data-node-id="1373:14052"
    >
      {view === 'sessions' ? (
        <SessionsView
          conversations={convListQuery.data ?? []}
          loading={convListQuery.isLoading}
          activeId={conversationId}
          onClose={onClose}
          onBack={() => setView('chat')}
          onNew={startNewChat}
          onPick={openConversation}
          onDeletedActive={() => {
            // The conversation we were viewing was just deleted — reset so the
            // next message starts a fresh session instead of POSTing to a 404.
            clearActiveConversationId(scope)
            setConversationId(null)
            setMessages([])
            setRestored(true)
          }}
        />
      ) : (
        <>
          {/* ── Top: header + context chips ─────────────────────────── */}
          <div className="flex flex-col gap-[10px]">
            <div className="flex flex-col gap-[10px] border-b border-primary-main p-[15px]">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-[5px]">
                  <button
                    type="button"
                    onClick={() => setView('sessions')}
                    aria-label="Open sessions"
                    className="flex size-[28px] items-center justify-center rounded-[5px] bg-white/15 hover:bg-white/25"
                  >
                    <SessionsIcon size={14} />
                  </button>
                  <div className="flex w-[120px] flex-col">
                    <p className="text-[14px] font-semibold leading-none text-white">Ask AI</p>
                    <p className="text-[10px] leading-[1.5] text-gray-secondary">
                      About this session{scopeLabel ? ` · ${scopeLabel}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-[5px]">
                  <button
                    type="button"
                    onClick={startNewChat}
                    aria-label="New chat"
                    title="New chat"
                    className="flex size-[20px] items-center justify-center rounded-[5px] bg-white/15 text-white/80 hover:bg-white/25"
                  >
                    <PlusIcon size={11} />
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close Ask AI"
                    className="flex size-[20px] items-center justify-center rounded-[5px] bg-white/15 text-white/80 hover:bg-white/25"
                  >
                    <CloseIcon size={11} />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-[5px]">
                {scopeLabel && <ContextChip label={scopeLabel} dot />}
                <ContextChip label="+ Add Context" dashed />
              </div>
            </div>
          </div>

          {/* ── Body: messages ──────────────────────────────────────── */}
          <div ref={scrollRef} className="flex flex-1 flex-col gap-[20px] overflow-y-auto px-[15px] py-[10px]">
            <DateDivider label={todayLabel} />

            {messages.length === 0 && !messagesQuery.isLoading && (
              <p className="px-[15px] text-center text-[10px] italic text-gray-secondary">
                Ask anything about this {scopeLabel ?? 'workspace'} — meetings, tasks,
                decisions, or plain reasoning. I can also propose tasks/meetings for
                you to review.
              </p>
            )}

            {messages.map((m) => {
              if (m.kind === 'message') {
                return m.role === 'user' ? (
                  <UserBubble key={m.id} content={m.content} time={m.time} />
                ) : (
                  <AssistantBubble
                    key={m.id}
                    content={m.content}
                    time={m.time}
                    streaming={m.streaming}
                    error={m.error ?? null}
                  />
                )
              }
              return (
                <ProposalCard
                  key={m.id}
                  card={m}
                  onToggleItem={(itemId) =>
                    setMessages((prev) =>
                      prev.map((x) =>
                        x.kind === 'proposal' && x.id === m.id
                          ? {
                              ...x,
                              selectedItemIds: x.selectedItemIds.includes(itemId)
                                ? x.selectedItemIds.filter((i) => i !== itemId)
                                : [...x.selectedItemIds, itemId],
                            }
                          : x,
                      ),
                    )
                  }
                  onPatchTask={(idx, patch) =>
                    setMessages((prev) =>
                      prev.map((x) => {
                        if (x.kind !== 'proposal' || x.id !== m.id || !x.taskDrafts) return x
                        const next = x.taskDrafts.slice()
                        next[idx] = { ...next[idx], ...patch }
                        return { ...x, taskDrafts: next }
                      }),
                    )
                  }
                  onApply={() => void handleApply(m.id)}
                  onDismiss={() => void handleDismiss(m.id)}
                />
              )
            })}
          </div>

          {/* ── Composer ────────────────────────────────────────────── */}
          <div className="border-t border-primary-main px-[15px] py-[10px]">
            <div className="overflow-clip rounded-[10px] p-px">
              <div className="flex flex-col gap-[10px] rounded-[10px] border border-gray-main bg-white/10 p-[10px]">
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={onInput}
                  onKeyDown={onKeyDown}
                  onCompositionStart={() => setComposing(true)}
                  onCompositionEnd={() => setComposing(false)}
                  rows={1}
                  placeholder={`Ask anything about ${scopeLabel ?? 'this session'}...`}
                  disabled={sending}
                  className="min-h-[20px] w-full resize-none bg-transparent text-[10px] leading-normal text-white placeholder:text-gray-secondary focus:outline-none disabled:opacity-60"
                />
                <div className="flex items-center justify-end gap-[10px]">
                  <span className="text-[10px] text-gray-secondary">⏎ to send</span>
                  <button
                    type="button"
                    onClick={() => void send()}
                    disabled={sending || !draft.trim()}
                    className="flex h-[25px] items-center justify-center gap-[5px] rounded-[5px] bg-white pl-[7px] pr-[10px] text-[10px] font-semibold text-primary-main disabled:opacity-50"
                  >
                    <SendIcon size={11} />
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </aside>
  )
}

// ─── Sessions list view ──────────────────────────────────────────

function SessionsView({
  conversations,
  loading,
  activeId,
  onClose,
  onBack,
  onNew,
  onPick,
  onDeletedActive,
}: {
  conversations: AgentConversation[]
  loading: boolean
  activeId: string | null
  onClose: () => void
  onBack: () => void
  onNew: () => void
  onPick: (id: string) => void
  onDeletedActive: () => void
}) {
  const grouped = useMemo(() => groupByDay(conversations), [conversations])
  const deleteConv = useDeleteAgentConversation()

  return (
    <>
      <div className="flex items-center justify-between border-b border-primary-main p-[15px]">
        <div className="flex items-center gap-[5px]">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to chat"
            className="flex size-[28px] items-center justify-center rounded-[5px] bg-white/15 hover:bg-white/25"
          >
            <BackIcon size={12} />
          </button>
          <p className="text-[14px] font-semibold leading-none text-white">Sessions</p>
        </div>
        <div className="flex items-center gap-[5px]">
          <button
            type="button"
            onClick={onNew}
            aria-label="New chat"
            title="New chat"
            className="flex size-[20px] items-center justify-center rounded-[5px] bg-white/15 text-white/80 hover:bg-white/25"
          >
            <PlusIcon size={11} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Ask AI"
            className="flex size-[20px] items-center justify-center rounded-[5px] bg-white/15 text-white/80 hover:bg-white/25"
          >
            <CloseIcon size={11} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-[15px] overflow-y-auto px-[10px] py-[12px]">
        {loading && (
          <p className="px-[10px] text-[10px] italic text-gray-secondary">Loading…</p>
        )}
        {!loading && conversations.length === 0 && (
          <p className="px-[10px] text-[10px] italic text-gray-secondary">
            No prior sessions yet. Start a new chat below.
          </p>
        )}
        {grouped.map((g) => (
          <div key={g.label} className="flex flex-col gap-[3px]">
            <p className="px-[10px] text-[8px] uppercase tracking-[1.5px] text-gray-main">
              {g.label}
            </p>
            {g.items.map((c) => (
              <SessionRow
                key={c.id}
                convo={c}
                active={c.id === activeId}
                onPick={() => onPick(c.id)}
                onDelete={() => {
                  if (!window.confirm('Delete this conversation?')) return
                  const wasActive = c.id === activeId
                  deleteConv.mutate(c.id, {
                    onSuccess: () => {
                      if (wasActive) onDeletedActive()
                    },
                  })
                }}
                deleting={deleteConv.isPending}
              />
            ))}
          </div>
        ))}
      </div>
    </>
  )
}

function SessionRow({
  convo,
  active,
  onPick,
  onDelete,
  deleting,
}: {
  convo: AgentConversation
  active: boolean
  onPick: () => void
  onDelete: () => void
  deleting: boolean
}) {
  const title = convo.title?.trim() || 'Untitled'
  return (
    <div
      className={`group flex items-center gap-[5px] rounded-[5px] px-[10px] py-[7px] ${
        active ? 'bg-white/15' : 'hover:bg-white/10'
      }`}
    >
      <button
        type="button"
        onClick={onPick}
        className="flex flex-1 flex-col items-start gap-[2px] truncate text-left"
      >
        <p
          className={`w-full truncate text-[11px] ${
            active ? 'font-semibold text-white' : 'text-primary-light'
          }`}
        >
          {title}
        </p>
        <p className="text-[9px] text-gray-main">{relTime(convo.created_at)}</p>
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        aria-label="Delete session"
        className="flex size-[20px] shrink-0 items-center justify-center rounded-[4px] text-gray-light opacity-0 transition-opacity hover:bg-white/15 hover:text-white group-hover:opacity-100 disabled:opacity-50"
      >
        <TrashIcon size={11} />
      </button>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────

function ContextChip({
  label,
  dot,
  dashed,
}: {
  label: string
  dot?: boolean
  dashed?: boolean
}) {
  return (
    <span
      className={`flex items-center gap-[6px] rounded-[15px] border ${
        dashed
          ? 'border-dashed border-primary-main text-gray-light'
          : 'border-primary-main bg-white/10 text-primary-light'
      } px-[10px] py-[3px] text-[10px]`}
    >
      {dot && <span className="size-[5px] rounded-full bg-blue-med" />}
      {label}
    </span>
  )
}

function DateDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-[6px] px-[10px]">
      <div className="h-px flex-1 bg-primary-main/60" />
      <span className="whitespace-pre text-[8px] uppercase tracking-[1.5px] text-gray-main">
        {label}
      </span>
      <div className="h-px flex-1 bg-primary-main/60" />
    </div>
  )
}

function UserBubble({ content, time }: { content: string; time: string }) {
  return (
    <div className="flex flex-col items-end gap-[5px] pl-[15px]">
      <div className="flex items-center gap-[4px] text-[8px]">
        <span className="font-semibold text-white">YOU</span>
        <span className="font-mono text-primary-main">· {time}</span>
      </div>
      <div className="rounded-[10px] rounded-tr-[3px] border border-gray-main bg-white/15 px-[10px] py-[5px] text-[10px] leading-[1.5] text-white">
        {content}
      </div>
    </div>
  )
}

function AssistantBubble({
  content,
  time,
  streaming,
  error,
}: {
  content: string
  time: string
  streaming?: boolean
  error: string | null
}) {
  const showGenerating = streaming && content.length === 0 && !error
  return (
    <div className="flex flex-col items-start gap-[5px] pr-[15px]">
      <div className="flex items-center gap-[4px] text-[8px]">
        <div className="flex size-[15px] items-center justify-center rounded-[3px] bg-white/15">
          <SparkleIcon size={8} />
        </div>
        <span className="font-semibold text-white-main">plinq AI</span>
        <span className="font-mono text-primary-main">· {time}</span>
      </div>

      {showGenerating ? (
        <GeneratingAnimation />
      ) : (
        <div
          className="prose-invert w-full rounded-[10px] rounded-tl-[3px] border border-gray-main bg-white/15 px-[10px] py-[5px] text-[10px] leading-[1.5] text-white [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_li]:ml-4 [&_ol]:list-decimal [&_strong]:font-semibold [&_table]:border [&_table]:border-collapse [&_td]:border [&_td]:border-white/20 [&_td]:px-1 [&_td]:py-0.5 [&_th]:border [&_th]:border-white/20 [&_th]:bg-white/10 [&_th]:px-1 [&_th]:py-0.5 [&_ul]:list-disc"
          dangerouslySetInnerHTML={
            streaming
              ? { __html: escapeForStreaming(content) }
              : { __html: renderMarkdown(content) }
          }
        />
      )}

      {error && (
        <p className="rounded-[6px] border border-red-med/60 bg-red-med/15 px-[8px] py-[5px] text-[10px] text-red-light">
          {error}
        </p>
      )}
    </div>
  )
}

function escapeForStreaming(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
}

function GeneratingAnimation() {
  return (
    <div className="flex items-center gap-[5px]">
      <div className="grid size-[20px] grid-cols-2 grid-rows-2 gap-[1px]">
        <div className="size-[9px] animate-pulse rounded-[2px] bg-gray-light" />
        <div className="size-[9px] animate-pulse rounded-full bg-blue-med [animation-delay:120ms]" />
        <div className="size-[9px] animate-pulse rounded-[2px] bg-blue-med [animation-delay:240ms]" />
        <div className="size-[9px] animate-pulse rounded-[2px] bg-gray-main [animation-delay:360ms]" />
      </div>
      <p className="text-[10px] leading-[1.5] text-gray-light">Generating a response...</p>
    </div>
  )
}

// ─── Proposal card ──────────────────────────────────────────────

function ProposalCard({
  card,
  onToggleItem,
  onPatchTask,
  onApply,
  onDismiss,
}: {
  card: Extract<ChatItem, { kind: 'proposal' }>
  onToggleItem: (itemId: string) => void
  onPatchTask: (idx: number, patch: Partial<TaskDraft>) => void
  onApply: () => void
  onDismiss: () => void
}) {
  const kindLabel = humanizeKind(card.proposalKind)
  const isPending = card.status === 'pending'
  const isApplying = card.status === 'applying'
  const isApplied = card.status === 'applied'
  const isDismissed = card.status === 'dismissed'

  // project_outline takes a dedicated editor (project header + per-task editing).
  // Other kinds keep the simpler "checkbox per item" layout.
  if (card.proposalKind === 'project_outline' && card.taskDrafts) {
    const project = card.items[0]
    const includedCount = card.taskDrafts.filter((t) => t.include && t.title.trim()).length
    return (
      <div className="flex flex-col items-start gap-[5px] pr-[15px]">
        <div className="flex items-center gap-[4px] text-[8px]">
          <div className="flex size-[15px] items-center justify-center rounded-[3px] bg-white/15">
            <SparkleIcon size={8} />
          </div>
          <span className="font-semibold text-white-main">Proposal · {kindLabel}</span>
          <span className="font-mono text-primary-main">· {card.time}</span>
        </div>

        <div className="w-full overflow-hidden rounded-[10px] rounded-tl-[3px] border border-gray-main bg-white/15">
          {/* Project header (read-only for now) */}
          <div className="flex flex-col gap-[3px] px-[10px] pb-[8px] pt-[10px]">
            <p className="text-[12px] font-semibold text-white">{project?.name ?? 'New project'}</p>
            {project?.description && (
              <p className="text-[10px] leading-[1.4] text-primary-light">
                {String(project.description)}
              </p>
            )}
          </div>

          <div className="border-t border-white/10 px-[10px] pb-[6px] pt-[8px]">
            <p className="mb-[5px] text-[8px] uppercase tracking-[1.5px] text-gray-light">
              Initial tasks · {card.taskDrafts.length}
            </p>
            <ul className="flex flex-col gap-[5px]">
              {card.taskDrafts.map((task, i) => (
                <TaskDraftRow
                  key={i}
                  task={task}
                  disabled={!isPending}
                  onPatch={(patch) => onPatchTask(i, patch)}
                />
              ))}
            </ul>
          </div>

          <div className="flex items-center justify-between border-t border-white/10 bg-black/15 px-[8px] py-[6px]">
            {isPending && (
              <>
                <button
                  type="button"
                  onClick={onDismiss}
                  className="text-[10px] text-gray-light hover:text-white"
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  onClick={onApply}
                  disabled={!project}
                  className="rounded-[5px] bg-white px-[10px] py-[4px] text-[10px] font-semibold text-primary-main disabled:opacity-50"
                >
                  Create project + {includedCount} task{includedCount === 1 ? '' : 's'}
                </button>
              </>
            )}
            {isApplying && (
              <span className="text-[10px] italic text-primary-light">Applying…</span>
            )}
            {isApplied && (
              <span className="text-[10px] text-green-light">
                ✓ Applied{card.appliedSummary ? ` · ${card.appliedSummary}` : ''}
              </span>
            )}
            {isDismissed && (
              <span className="text-[10px] text-gray-light">
                Dismissed{card.dismissedReason ? ` · ${card.dismissedReason}` : ''}
              </span>
            )}
          </div>
        </div>

        {card.error && (
          <p className="rounded-[6px] border border-red-med/60 bg-red-med/15 px-[8px] py-[5px] text-[10px] text-red-light">
            {card.error}
          </p>
        )}
      </div>
    )
  }

  // ── Generic card (other kinds) ──
  return (
    <div className="flex flex-col items-start gap-[5px] pr-[15px]">
      <div className="flex items-center gap-[4px] text-[8px]">
        <div className="flex size-[15px] items-center justify-center rounded-[3px] bg-white/15">
          <SparkleIcon size={8} />
        </div>
        <span className="font-semibold text-white-main">Proposal · {kindLabel}</span>
        <span className="font-mono text-primary-main">· {card.time}</span>
      </div>

      <div className="w-full overflow-hidden rounded-[10px] rounded-tl-[3px] border border-gray-main bg-white/15">
        <ul className="flex flex-col gap-[2px] p-[8px]">
          {card.items.length === 0 && (
            <li className="text-[10px] italic text-gray-light">No items in this proposal.</li>
          )}
          {card.items.map((item) => {
            const checked = card.selectedItemIds.includes(item.id)
            const title = item.title || item.name || `Item ${item.id.slice(0, 6)}`
            const meta = [item.priority, item.due_date].filter(Boolean).join(' · ')
            // project_outline carries the new project's initial_tasks +
            // member_user_ids nested inside the single item.
            const nestedTasks =
              card.proposalKind === 'project_outline' && Array.isArray(item.initial_tasks)
                ? (item.initial_tasks as Array<Record<string, unknown>>)
                : null
            const nestedMembers =
              card.proposalKind === 'project_outline' && Array.isArray(item.member_user_ids)
                ? (item.member_user_ids as string[])
                : null
            return (
              <li
                key={item.id}
                className="flex items-start gap-[6px] rounded-[5px] px-[5px] py-[4px] hover:bg-white/10"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!isPending}
                  onChange={() => onToggleItem(item.id)}
                  className="mt-[2px] size-[11px] cursor-pointer accent-blue-med disabled:cursor-not-allowed"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <p className="truncate text-[10px] font-semibold text-white">{title}</p>
                  {item.description && (
                    <p className="line-clamp-2 text-[9px] leading-[1.4] text-primary-light">
                      {String(item.description)}
                    </p>
                  )}
                  {meta && (
                    <p className="text-[8px] uppercase tracking-[1px] text-gray-light">{meta}</p>
                  )}
                  {nestedTasks && nestedTasks.length > 0 && (
                    <div className="mt-[3px] flex flex-col gap-[2px] rounded-[4px] border border-white/10 bg-black/15 px-[6px] py-[4px]">
                      <p className="text-[8px] uppercase tracking-[1px] text-gray-light">
                        Initial tasks · {nestedTasks.length}
                      </p>
                      <ul className="flex flex-col gap-[1px]">
                        {nestedTasks.map((t, i) => {
                          const tTitle = String(t.title ?? `Task ${i + 1}`)
                          const tMeta = [t.priority, t.due_date].filter(Boolean).join(' · ')
                          return (
                            <li key={i} className="flex items-start gap-[4px]">
                              <span className="text-[9px] text-gray-light">•</span>
                              <div className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate text-[9px] text-primary-light">
                                  {tTitle}
                                </span>
                                {tMeta && (
                                  <span className="text-[8px] uppercase tracking-[0.8px] text-gray-main">
                                    {tMeta}
                                  </span>
                                )}
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}
                  {nestedMembers && nestedMembers.length > 0 && (
                    <p className="text-[8px] uppercase tracking-[1px] text-gray-light">
                      Members · {nestedMembers.length}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>

        <div className="flex items-center justify-between border-t border-white/10 bg-black/15 px-[8px] py-[6px]">
          {isPending && (
            <>
              <button
                type="button"
                onClick={onDismiss}
                className="text-[10px] text-gray-light hover:text-white"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={onApply}
                disabled={card.selectedItemIds.length === 0}
                className="rounded-[5px] bg-white px-[10px] py-[4px] text-[10px] font-semibold text-primary-main disabled:opacity-50"
              >
                Apply ({card.selectedItemIds.length})
              </button>
            </>
          )}
          {isApplying && (
            <span className="text-[10px] italic text-primary-light">Applying…</span>
          )}
          {isApplied && (
            <span className="text-[10px] text-green-light">
              ✓ Applied{card.appliedSummary ? ` · ${card.appliedSummary}` : ''}
            </span>
          )}
          {isDismissed && (
            <span className="text-[10px] text-gray-light">
              Dismissed{card.dismissedReason ? ` · ${card.dismissedReason}` : ''}
            </span>
          )}
        </div>
      </div>

      {card.error && (
        <p className="rounded-[6px] border border-red-med/60 bg-red-med/15 px-[8px] py-[5px] text-[10px] text-red-light">
          {card.error}
        </p>
      )}
    </div>
  )
}

function TaskDraftRow({
  task,
  disabled,
  onPatch,
}: {
  task: TaskDraft
  disabled: boolean
  onPatch: (patch: Partial<TaskDraft>) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const dim = !task.include
  return (
    <li
      className={`flex flex-col gap-[3px] rounded-[5px] border border-white/10 px-[6px] py-[5px] ${
        dim ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-start gap-[6px]">
        <input
          type="checkbox"
          checked={task.include}
          disabled={disabled}
          onChange={(e) => onPatch({ include: e.target.checked })}
          className="mt-[3px] size-[11px] cursor-pointer accent-blue-med disabled:cursor-not-allowed"
        />
        <textarea
          rows={1}
          value={task.title}
          disabled={disabled || !task.include}
          onChange={(e) => onPatch({ title: e.target.value })}
          placeholder="Task title"
          className="min-h-[15px] flex-1 resize-none bg-transparent text-[10px] font-semibold leading-[1.3] text-white placeholder:text-gray-main focus:outline-none disabled:opacity-70"
        />
        <button
          type="button"
          aria-label={expanded ? 'Collapse' : 'Edit details'}
          onClick={() => setExpanded((v) => !v)}
          disabled={disabled || !task.include}
          className="mt-[1px] text-[10px] text-gray-light hover:text-white disabled:opacity-50"
        >
          {expanded ? '▾' : '▸'}
        </button>
      </div>

      <div className="flex items-center gap-[5px] pl-[17px]">
        <PriorityPill
          value={task.priority}
          disabled={disabled || !task.include}
          onChange={(p) => onPatch({ priority: p })}
        />
        <input
          type="date"
          value={task.due_date}
          disabled={disabled || !task.include}
          onChange={(e) => onPatch({ due_date: e.target.value })}
          className="rounded-[4px] border border-white/10 bg-white/5 px-[5px] py-[2px] text-[9px] text-primary-light focus:border-white/30 focus:outline-none disabled:opacity-50"
          style={{ colorScheme: 'dark' }}
        />
      </div>

      {expanded && (
        <AutoTextarea
          value={task.description}
          disabled={disabled || !task.include}
          onChange={(v) => onPatch({ description: v })}
          placeholder="Description (optional)"
          minRows={2}
          className="ml-[17px] resize-none rounded-[4px] border border-white/10 bg-white/5 p-[5px] text-[9px] leading-[1.4] text-primary-light placeholder:text-gray-main focus:border-white/30 focus:outline-none disabled:opacity-70"
        />
      )}
    </li>
  )
}

function AutoTextarea({
  value,
  onChange,
  placeholder,
  disabled,
  minRows = 2,
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
  minRows?: number
  className?: string
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null)

  // Resize on every value change so external setState (or initial paint) also fits.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  return (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
    />
  )
}

function PriorityPill({
  value,
  disabled,
  onChange,
}: {
  value: string
  disabled: boolean
  onChange: (next: string) => void
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  // Close on outside click — single document-level listener while open.
  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div ref={wrapRef} className="relative inline-flex">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-[3px] rounded-full border px-[6px] py-[1px] text-[8px] font-semibold uppercase tracking-[0.5px] disabled:opacity-50 ${priorityTone(value)}`}
      >
        {value || 'medium'}
        <span className="text-[7px] opacity-70">▾</span>
      </button>
      {open && (
        <ul className="absolute left-0 top-[calc(100%+3px)] z-10 flex w-[80px] flex-col gap-[1px] rounded-[5px] border border-white/15 bg-primary-deep p-[3px] shadow-lg">
          {PRIORITY_CYCLE.map((p) => (
            <li key={p}>
              <button
                type="button"
                onClick={() => {
                  onChange(p)
                  setOpen(false)
                }}
                className={`flex w-full items-center justify-between rounded-[4px] px-[5px] py-[3px] text-[9px] uppercase tracking-[0.5px] hover:bg-white/10 ${
                  p === value ? 'text-white' : 'text-primary-light'
                }`}
              >
                <span>{p}</span>
                {p === value && <span className="text-[8px]">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function priorityTone(value: string): string {
  if (value === 'urgent') return 'bg-red-med/30 text-red-light border-red-med/40'
  if (value === 'high') return 'bg-brown-med/25 text-brown-light border-brown-med/40'
  if (value === 'low') return 'bg-blue-med/20 text-blue-light border-blue-med/40'
  return 'bg-white/10 text-primary-light border-white/15'
}

function humanizeKind(kind: string): string {
  switch (kind) {
    case 'tasks':
      return 'Tasks'
    case 'task_updates':
      return 'Task updates'
    case 'project_outline':
      return 'New project'
    case 'meetings':
      return 'Meetings'
    case 'meeting_agenda':
      return 'Meeting agenda'
    case 'assignee':
      return 'Assignees'
    case 'meeting_deletes':
      return 'Meeting deletes'
    default:
      return kind
  }
}

function summarizeAppliedResult(kind: string, result: unknown): string {
  if (!result || typeof result !== 'object') return ''
  const r = result as Record<string, unknown>
  if (Array.isArray(r.created_task_ids)) return `${r.created_task_ids.length} task(s) created`
  if (Array.isArray(r.updated_task_ids)) return `${r.updated_task_ids.length} task(s) updated`
  if (Array.isArray(r.deleted_task_ids)) return `${r.deleted_task_ids.length} task(s) deleted`
  if (typeof r.project_id === 'string') return 'project created'
  if (Array.isArray(r.created_meeting_ids)) return `${r.created_meeting_ids.length} meeting(s) created`
  return ''
}

// ─── Helpers ─────────────────────────────────────────────────────

/**
 * Pull editable task drafts out of a project_outline proposal item. Falls back
 * to `initial_task_titles` when the agent didn't enrich (no description /
 * priority / due_date). Every draft starts `include: true`.
 */
function extractInitialTaskDrafts(item: ProposalItem | undefined): TaskDraft[] {
  if (!item) return []
  const detailed = Array.isArray(item.initial_tasks)
    ? (item.initial_tasks as Array<Record<string, unknown>>)
    : []
  if (detailed.length > 0) {
    return detailed.map((t) => ({
      include: true,
      title: String(t.title ?? '').trim(),
      description: typeof t.description === 'string' ? t.description : '',
      priority: typeof t.priority === 'string' ? t.priority : 'medium',
      due_date: typeof t.due_date === 'string' ? t.due_date : '',
      assignee_user_ids: Array.isArray(t.assignee_user_ids)
        ? (t.assignee_user_ids as string[]).filter((s) => typeof s === 'string')
        : [],
    }))
  }
  const titles = Array.isArray(item.initial_task_titles)
    ? (item.initial_task_titles as string[]).filter((s) => typeof s === 'string')
    : []
  return titles.map((title) => ({
    include: true,
    title,
    description: '',
    priority: 'medium',
    due_date: '',
    assignee_user_ids: [],
  }))
}

/**
 * Find the most recent streaming assistant message and replace it with `mut(it)`.
 * Used by chunk/done/error/catch handlers so a proposal card landing between
 * the assistant message and the rest of its chunks doesn't break targeting.
 */
function updateLastStreaming(
  prev: ChatItem[],
  mut: (m: Extract<ChatItem, { kind: 'message' }> & { role: 'assistant' }) => ChatItem,
): ChatItem[] {
  for (let i = prev.length - 1; i >= 0; i--) {
    const m = prev[i]
    if (m.kind === 'message' && m.role === 'assistant' && m.streaming) {
      const out = prev.slice()
      out[i] = mut(m as Extract<ChatItem, { kind: 'message' }> & { role: 'assistant' })
      return out
    }
  }
  return prev
}

function startOfDay(d: Date): number {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.getTime()
}

function groupByDay(
  conversations: AgentConversation[],
): { label: string; items: AgentConversation[] }[] {
  const todayStart = startOfDay(new Date())
  const dayMs = 86400000
  const groups: Record<string, AgentConversation[]> = {}
  const order: string[] = []
  for (const c of conversations) {
    const d = new Date(c.created_at)
    const ds = startOfDay(d)
    let label: string
    if (ds === todayStart) label = 'Today'
    else if (ds === todayStart - dayMs) label = 'Yesterday'
    else if (ds > todayStart - 7 * dayMs) label = 'Earlier this week'
    else label = d.toLocaleDateString('en', { month: 'short', year: 'numeric' })
    if (!(label in groups)) {
      groups[label] = []
      order.push(label)
    }
    groups[label].push(c)
  }
  return order.map((label) => ({ label, items: groups[label] }))
}

function relTime(iso: string): string {
  const t = new Date(iso).getTime()
  const diff = Date.now() - t
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Date(iso).toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
  })
}

// ─── Icons (inline SVG so we don't need extra files) ────────────

function SparkleIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <path
        d="M6 0L7.2 4.8L12 6L7.2 7.2L6 12L4.8 7.2L0 6L4.8 4.8L6 0Z"
        fill="white"
      />
    </svg>
  )
}

function CloseIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M2 2 L10 10 M10 2 L2 10" />
    </svg>
  )
}

function SendIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="currentColor">
      <path d="M11 1 L1 5 L5 6.5 L6.5 10.5 L11 1Z" />
    </svg>
  )
}

function SessionsIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="white" strokeWidth="1.4" strokeLinecap="round">
      <path d="M3 4 H11 M3 7 H11 M3 10 H8" />
    </svg>
  )
}

function PlusIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M6 2 V10 M2 6 H10" />
    </svg>
  )
}

function BackIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.5 2 L3.5 6 L7.5 10" />
    </svg>
  )
}

function TrashIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 3.5 H9.5 M4 3.5 V2 H8 V3.5 M3.5 3.5 L4 10 H8 L8.5 3.5" />
    </svg>
  )
}
